# Step 10. RTK Query advanced

Code: [`src/services/api.ts`](../src/services/api.ts), [`src/components/TodosPage.tsx`](../src/components/TodosPage.tsx)

## Token refresh and retries (custom `baseQuery`)

[api.ts#L51-L81](../src/services/api.ts#L51-L81)

Classic Redux usually solved this with an axios interceptor that knew nothing about the
store. Here it's a wrapper around `fetchBaseQuery` that can dispatch:

```ts
let refreshing: Promise<boolean> | null = null

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  let result = await rawBaseQuery(args, api, extra)
  if (result.error?.status === 401) {
    refreshing ??= (async () => {
      const refresh = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extra)
      if (refresh.data) { api.dispatch(tokenRefreshed(refresh.data.accessToken)); return true }
      api.dispatch(loggedOut())
      return false
    })().finally(() => { refreshing = null })

    if (await refreshing) result = await rawBaseQuery(args, api, extra)   // retry with the new token
    else retry.fail(result.error)
  }
  return result
}

const baseQuery = retry(baseQueryWithReauth, { maxRetries: 2 })
```

- **Promise mutex:** if five requests get a 401 at once, they all await the *same*
  refresh instead of sending five refresh calls.
- **`retry`** retries failed requests with exponential backoff. `retry.fail()` stops it
  early; `extraOptions: { maxRetries: 0 }` turns it off per endpoint
  ([#L111](../src/services/api.ts#L111)).

## Optimistic update

[api.ts#L120-L136](../src/services/api.ts#L120-L136)

Update the cache immediately, roll back if the server fails:

```ts
toggleTodo: build.mutation<Todo, Pick<Todo, 'id' | 'completed'>>({
  query: ({ id, ...patch }) => ({ url: `/todos/${id}`, method: 'PATCH', body: patch }),
  async onQueryStarted({ id, completed }, { dispatch, queryFulfilled }) {
    const patch = dispatch(
      api.util.updateQueryData('getTodos', undefined, (draft) => {
        const todo = draft.find((t) => t.id === id)
        if (todo) todo.completed = completed
      }),
    )
    try { await queryFulfilled } catch { patch.undo() }
  },
}),
```

`updateQueryData(endpoint, arg, recipe)` edits one cache entry with Immer. The `arg`
must match the cache key (`undefined` here, because the list is fetched with
`useGetTodosQuery()`).

## Pessimistic update

[api.ts#L138-L151](../src/services/api.ts#L138-L151)

Wait for the server, then write its response into the cache instead of refetching:

```ts
async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
  const { data } = await queryFulfilled
  dispatch(api.util.upsertQueryData('getTodo', id, data))           // create or replace an entry
  dispatch(api.util.updateQueryData('getTodos', undefined, (draft) => { /* replace item */ }))
}
```

| Strategy | When |
|----------|------|
| `invalidatesTags` | Simplest; costs an extra request |
| Pessimistic (`upsertQueryData`/`updateQueryData` after response) | The server returns the updated entity |
| Optimistic (`updateQueryData` + `undo`) | Instant feedback matters (toggles, likes) |

## Streaming updates (WebSocket)

[api.ts#L161-L181](../src/services/api.ts#L161-L181), used in `Ticker` ([TodosPage.tsx#L146-L160](../src/components/TodosPage.tsx#L146-L160))

```ts
getQuotes: build.query<Record<string, Quote>, string[]>({
  query: (symbols) => ({ url: '/quotes', params: { symbols: symbols.join(',') } }),
  async onCacheEntryAdded(symbols, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
    const ws = new WebSocket(`wss://example.com/quotes?symbols=${symbols.join(',')}`)
    try {
      await cacheDataLoaded
      ws.addEventListener('message', (e) => {
        updateCachedData((draft) => { for (const q of JSON.parse(e.data)) draft[q.symbol] = q })
      })
    } catch {}
    await cacheEntryRemoved
    ws.close()
  },
}),
```

The socket opens when the first component subscribes and closes when the last one
unmounts (after `keepUnusedDataFor`). Pass a **stable** argument
(`const SYMBOLS = [...]` outside the component), or every render creates a new cache key.

## Infinite scroll (RTK 2.6+)

[api.ts#L183-L194](../src/services/api.ts#L183-L194), used in `Feed` ([TodosPage.tsx#L127-L144](../src/components/TodosPage.tsx#L127-L144))

```ts
getFeed: build.infiniteQuery<Page<Todo>, string, string | null>({   // <Page, QueryArg, PageParam>
  infiniteQueryOptions: {
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    maxPages: 10,
  },
  query: ({ queryArg, pageParam }) => ({ url: '/feed', params: { q: queryArg, cursor: pageParam ?? undefined } }),
}),
```

```tsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetFeedInfiniteQuery(search)
const items = data?.pages.flatMap((p) => p.items) ?? []
```

All pages live in one cache entry; `maxPages` drops old pages to bound memory.

## Clearing the cache on logout

[listeners.ts#L23-L29](../src/app/listeners.ts#L23-L29): `dispatch(api.util.resetApiState())`
so the next user doesn't see the previous user's data.

---

Previous: [Step 9](09-rtk-query-basics.md) · Next: [Step 11. Code splitting](11-code-splitting.md)
