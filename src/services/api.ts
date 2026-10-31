// =============================================================================
// RTK Query CASES:
//  - fetchBaseQuery + prepareHeaders (token from state)
//  - custom baseQuery: token refresh with a promise mutex + retry
//  - tags: providesTags / invalidatesTags, LIST tag, per-id tag
//  - transformResponse / transformErrorResponse
//  - optimistic update (updateQueryData + patch.undo)
//  - pessimistic update (after the server responds)
//  - streaming via WebSocket in onCacheEntryAdded
//  - infiniteQuery (RTK 2.6+), keepUnusedDataFor
// =============================================================================
import {
  createApi,
  fetchBaseQuery,
  retry,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import type { RootState } from '@/app/store'
import { loggedOut, tokenRefreshed } from '@/features/auth/authSlice'

export interface Todo {
  id: string
  title: string
  completed: boolean
  updatedAt: number
}

export interface Quote {
  symbol: string
  price: number
  ts: number
}

interface Page<T> {
  items: T[]
  nextCursor: string | null
}

// ---- base query -----------------------------------------------------------
const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) headers.set('authorization', `Bearer ${token}`)
    return headers
  },
})

// One refresh for everyone: parallel 401s await the same promise
let refreshing: Promise<boolean> | null = null

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status === 401) {
    refreshing ??= (async () => {
      const refresh = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions)
      if (refresh.data) {
        api.dispatch(tokenRefreshed((refresh.data as { accessToken: string }).accessToken))
        return true
      }
      api.dispatch(loggedOut())
      return false
    })().finally(() => {
      refreshing = null
    })

    if (await refreshing) result = await rawBaseQuery(args, api, extraOptions)
    else retry.fail(result.error) // don't retry if the refresh failed
  }
  return result
}

// retry wraps everything: 5xx/network errors are retried with backoff
const baseQuery = retry(baseQueryWithReauth, { maxRetries: 2 })

// ---- api ------------------------------------------------------------------
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Todo', 'User'],
  keepUnusedDataFor: 60,
  refetchOnReconnect: true,
  endpoints: (build) => ({
    // --- query with a tag per item + LIST
    getTodos: build.query<Todo[], { completed?: boolean } | void>({
      query: (filter) => ({ url: '/todos', params: filter ?? undefined }),
      providesTags: (result = []) => [
        ...result.map(({ id }) => ({ type: 'Todo' as const, id })),
        { type: 'Todo' as const, id: 'LIST' },
      ],
    }),

    getTodo: build.query<Todo, string>({
      query: (id) => `/todos/${id}`,
      // normalize the server response
      transformResponse: (raw: Omit<Todo, 'updatedAt'> & { updated_at: string }) => ({
        id: raw.id,
        title: raw.title,
        completed: raw.completed,
        updatedAt: Date.parse(raw.updated_at),
      }),
      transformErrorResponse: (err) => ({ status: err.status, message: 'Todo not found' }),
      providesTags: (_r, _e, id) => [{ type: 'Todo', id }],
      extraOptions: { maxRetries: 0 }, // no point retrying a 404
    }),

    // --- create: just invalidate the list
    addTodo: build.mutation<Todo, Pick<Todo, 'title'>>({
      query: (body) => ({ url: '/todos', method: 'POST', body }),
      invalidatesTags: [{ type: 'Todo', id: 'LIST' }],
    }),

    // --- OPTIMISTIC update: patch the cache immediately, roll back on error
    toggleTodo: build.mutation<Todo, Pick<Todo, 'id' | 'completed'>>({
      query: ({ id, ...patch }) => ({ url: `/todos/${id}`, method: 'PATCH', body: patch }),
      async onQueryStarted({ id, completed }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData('getTodos', undefined, (draft) => {
            const todo = draft.find((t) => t.id === id)
            if (todo) todo.completed = completed
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
    }),

    // --- PESSIMISTIC: put the server response in the cache, no refetch
    renameTodo: build.mutation<Todo, Pick<Todo, 'id' | 'title'>>({
      query: ({ id, title }) => ({ url: `/todos/${id}`, method: 'PATCH', body: { title } }),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled
        dispatch(api.util.upsertQueryData('getTodo', id, data))
        dispatch(
          api.util.updateQueryData('getTodos', undefined, (draft) => {
            const i = draft.findIndex((t) => t.id === id)
            if (i !== -1) draft[i] = data
          }),
        )
      },
    }),

    deleteTodo: build.mutation<void, string>({
      query: (id) => ({ url: `/todos/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Todo', id },
        { type: 'Todo', id: 'LIST' },
      ],
    }),

    // --- STREAMING: initial snapshot over HTTP, then updates from WebSocket
    getQuotes: build.query<Record<string, Quote>, string[]>({
      query: (symbols) => ({ url: '/quotes', params: { symbols: symbols.join(',') } }),
      keepUnusedDataFor: 5,
      async onCacheEntryAdded(symbols, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        const ws = new WebSocket(`wss://example.com/quotes?symbols=${symbols.join(',')}`)
        try {
          await cacheDataLoaded // wait for the first HTTP response
          ws.addEventListener('message', (e: MessageEvent<string>) => {
            const batch = JSON.parse(e.data) as Quote[]
            updateCachedData((draft) => {
              for (const q of batch) draft[q.symbol] = q
            })
          })
        } catch {
          // cache entry was removed before data arrived, do nothing
        }
        await cacheEntryRemoved // no subscribers → close the socket
        ws.close()
      },
    }),

    // --- INFINITE SCROLL (RTK 2.6+)
    getFeed: build.infiniteQuery<Page<Todo>, string, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        maxPages: 10,
      },
      query: ({ queryArg, pageParam }) => ({
        url: '/feed',
        params: { q: queryArg, cursor: pageParam ?? undefined },
      }),
    }),
  }),
})

export const {
  useGetTodosQuery,
  useGetTodoQuery,
  useLazyGetTodoQuery,
  useAddTodoMutation,
  useToggleTodoMutation,
  useRenameTodoMutation,
  useDeleteTodoMutation,
  useGetQuotesQuery,
  useGetFeedInfiniteQuery,
} = api
