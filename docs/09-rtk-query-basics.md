# Step 9. RTK Query basics

Code: [`src/services/api.ts`](../src/services/api.ts), [`src/components/TodosPage.tsx`](../src/components/TodosPage.tsx) (`ServerTodos`)

## Classic Redux

For each resource: `FETCH_X_REQUEST/SUCCESS/FAILURE` constants, a thunk, a reducer with
`loading`/`error`/`data`, a `componentDidMount` that fetches, and manual refetching after
every mutation. Caching and deduplication are up to you.

RTK Query replaces all of that with one declaration per endpoint. It stores its cache
in the Redux store (under `state.api`), so DevTools still show everything.

## Define the API

```ts
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api', prepareHeaders }),
  tagTypes: ['Todo', 'User'],
  keepUnusedDataFor: 60,         // seconds to keep data after the last subscriber leaves
  refetchOnReconnect: true,
  endpoints: (build) => ({
    getTodos: build.query<Todo[], { completed?: boolean } | void>({
      query: (filter) => ({ url: '/todos', params: filter ?? undefined }),
    }),
    addTodo: build.mutation<Todo, Pick<Todo, 'title'>>({
      query: (body) => ({ url: '/todos', method: 'POST', body }),
    }),
  }),
})

export const { useGetTodosQuery, useAddTodoMutation } = api
```

[api.ts#L84-L98](../src/services/api.ts#L84-L98), [#L114-L118](../src/services/api.ts#L114-L118), [#L198-L208](../src/services/api.ts#L198-L208)

- `build.query` for reads, `build.mutation` for writes.
- Generics: `<ResultType, ArgType>`.
- Hooks are generated from endpoint names: `getTodos` → `useGetTodosQuery`,
  `useLazyGetTodosQuery`; `addTodo` → `useAddTodoMutation`.
- Register `api` in `combineSlices` and add `api.middleware` ([step 1](01-store.md)).

### Auth header from state

[api.ts#L42-L49](../src/services/api.ts#L42-L49)

```ts
prepareHeaders: (headers, { getState }) => {
  const token = (getState() as RootState).auth.accessToken
  if (token) headers.set('authorization', `Bearer ${token}`)
  return headers
}
```

## Cache invalidation with tags

Instead of "after adding, dispatch `fetchTodos()` again", queries *provide* tags and
mutations *invalidate* them. Any active query with a matching tag refetches automatically.

```ts
getTodos: build.query({
  providesTags: (result = []) => [
    ...result.map(({ id }) => ({ type: 'Todo' as const, id })),   // one tag per item
    { type: 'Todo' as const, id: 'LIST' },                         // the list itself
  ],
}),
getTodo:    build.query({ providesTags: (_r, _e, id) => [{ type: 'Todo', id }] }),
addTodo:    build.mutation({ invalidatesTags: [{ type: 'Todo', id: 'LIST' }] }),
deleteTodo: build.mutation({
  invalidatesTags: (_r, _e, id) => [{ type: 'Todo', id }, { type: 'Todo', id: 'LIST' }],
}),
```

[api.ts#L91-L98](../src/services/api.ts#L91-L98), [#L110](../src/services/api.ts#L110), [#L114-L118](../src/services/api.ts#L114-L118), [#L153-L159](../src/services/api.ts#L153-L159)

- Adding a todo invalidates only `LIST`, so `getTodo(id)` caches stay.
- Deleting invalidates that item *and* the list.

## Shaping responses

[api.ts#L100-L112](../src/services/api.ts#L100-L112)

```ts
getTodo: build.query<Todo, string>({
  query: (id) => `/todos/${id}`,
  transformResponse: (raw: ServerTodo) => ({ ...raw, updatedAt: Date.parse(raw.updated_at) }),
  transformErrorResponse: (err) => ({ status: err.status, message: 'Todo not found' }),
  extraOptions: { maxRetries: 0 },
}),
```

Normalize the server format once, at the boundary.

## Using the hooks

[TodosPage.tsx#L64-L125](../src/components/TodosPage.tsx#L64-L125)

```tsx
const { data: todos = [], isLoading, isFetching, error, refetch } = useGetTodosQuery()

const { data: selected } = useGetTodoQuery(selectedId ?? skipToken)   // no request until there's an id

const [loadTodo, { isFetching }] = useLazyGetTodoQuery()               // fires on demand
loadTodo(id, true /* preferCacheValue */)

const [addTodo, { isLoading: adding }] = useAddTodoMutation()
const created = await addTodo({ title: 'From RTK Query' }).unwrap()   // throws on error
```

- `isLoading` is true only for the first load; `isFetching` is true for every request.
- Two components calling `useGetTodosQuery()` share one request and one cache entry.
- `skipToken` ([#L79-L80](../src/components/TodosPage.tsx#L79-L80)) is the type-safe
  alternative to `{ skip: true }`: the argument type stays non-nullable.

### Re-render only on what you need: `selectFromResult`

[TodosPage.tsx#L66-L75](../src/components/TodosPage.tsx#L66-L75)

```tsx
const { doneCount } = useGetTodosQuery(undefined, {
  pollingInterval: 60_000,
  skipPollingIfUnfocused: true,
  selectFromResult: ({ data, isLoading }) => ({
    doneCount: data?.filter((t) => t.completed).length ?? 0,
    isLoading,
  }),
})
```

The component re-renders only when `doneCount` or `isLoading` changes, not on every
change to the list. `pollingInterval` refetches on a timer.

### Prefetching

[TodosPage.tsx#L87](../src/components/TodosPage.tsx#L87), [#L110](../src/components/TodosPage.tsx#L110)

```tsx
const prefetchTodo = usePrefetch('getTodo', { ifOlderThan: 30 })
<li onMouseEnter={() => prefetchTodo(t.id)}>
```

---

Previous: [Step 8](08-listeners.md) · Next: [Step 10. RTK Query advanced](10-rtk-query-advanced.md)
