# Step 11. Code splitting

Code: [`src/features/settings/settingsSlice.ts`](../src/features/settings/settingsSlice.ts),
[`src/services/usersApi.ts`](../src/services/usersApi.ts), [`src/app/store.ts`](../src/app/store.ts)

## Classic Redux

The "reducer registry" pattern: keep a map of async reducers, call
`store.replaceReducer(combineReducers({ ...static, ...async }))` when a chunk loads,
and type `state.settings` by hand as optional.

## Lazy slices (RTK 2)

### 1. Declare the root reducer as extensible

[store.ts#L13-L22](../src/app/store.ts#L13-L22)

```ts
export interface LazyLoadedSlices {}

export const rootReducer = combineSlices(authSlice, todosSlice, api, { ... })
  .withLazyLoadedSlices<LazyLoadedSlices>()
```

### 2. In the lazy module, extend the type and inject

[settingsSlice.ts#L34-L45](../src/features/settings/settingsSlice.ts#L34-L45)

```ts
declare module '@/app/store' {
  export interface LazyLoadedSlices extends WithSlice<typeof settingsSlice> {}
}

export const injectedSettings = settingsSlice.injectInto(rootReducer)
export const { selectTheme } = injectedSettings.selectors
```

- Module augmentation adds `settings?: SettingsState` to `RootState`, as optional.
- `injectInto` adds the reducer the moment the module is imported (e.g. via
  `React.lazy(() => import('./SettingsPage'))`). No `replaceReducer` call needed.
- Selectors from the *injected* slice are safe even before the first action reaches the
  slice: if `state.settings` is missing, they read from `initialState`. The test shows
  `selectTheme` returning `'system'` right after injection
  ([listeners.test.ts#L32-L42](../src/app/listeners.test.ts#L32-L42)).

## Lazy RTK Query endpoints

[usersApi.ts](../src/services/usersApi.ts)

```ts
export const usersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<User[], void>({ query: () => '/users', providesTags: ['User'] }),
  }),
  overrideExisting: false,
})

export const { useGetUsersQuery, usePrefetch } = usersApi
```

[usersApi.ts#L13-L32](../src/services/usersApi.ts#L13-L32)

One `api` (one middleware, one cache, shared tags), endpoints spread across feature
chunks. `overrideExisting: false` makes accidental duplicate names a dev warning.

### `enhanceEndpoints`

[usersApi.ts#L34-L39](../src/services/usersApi.ts#L34-L39)

```ts
usersApi.enhanceEndpoints({ endpoints: { getUsers: { keepUnusedDataFor: 300 } } })
```

Change options (tags, cache time, `transformResponse`) of existing endpoints without
editing their definition, useful with generated APIs (OpenAPI codegen).

### `queryFn`: cache anything, not just HTTP

[usersApi.ts#L20-L29](../src/services/usersApi.ts#L20-L29)

```ts
getDraft: build.query<string, string>({
  queryFn: (key) => {
    try { return { data: localStorage.getItem(`draft:${key}`) ?? '' } }
    catch (e) { return { error: { status: 'CUSTOM_ERROR', error: String(e) } } }
  },
}),
```

Return `{ data }` or `{ error }` and you get loading states, caching, tags and
deduplication for localStorage, IndexedDB, a third-party SDK, or a Web Worker.

---

Previous: [Step 10](10-rtk-query-advanced.md) · Next: [Step 12. Testing](12-testing.md)
