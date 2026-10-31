# Classic Redux → RTK cheat sheet

| Classic Redux | RTK | Where in this repo | Guide |
|---------------|-----|--------------------|-------|
| `createStore` + `applyMiddleware(thunk)` + DevTools compose | `configureStore` | [store.ts#L27-L47](../src/app/store.ts#L27-L47) | [1](01-store.md) |
| `combineReducers({ ... })` | `combineSlices(sliceA, sliceB, api, { ... })` | [store.ts#L20-L22](../src/app/store.ts#L20-L22) | [1](01-store.md) |
| `connect(mapState, mapDispatch)` | `useAppSelector` / `useAppDispatch` | [hooks.ts](../src/app/hooks.ts) | [2](02-typed-hooks.md) |
| Action type constants + action creators + `switch` reducer | `createSlice` | [authSlice.ts#L45-L84](../src/features/auth/authSlice.ts#L45-L84) | [3](03-slices.md) |
| `{ ...state, user: { ...state.user, name } }` | `state.user.name = name` (Immer) | [authSlice.ts#L55-L57](../src/features/auth/authSlice.ts#L55-L57) | [3](03-slices.md) |
| Side-effectful action creator (`Date.now()`, ids) | `prepare` callback | [authSlice.ts#L53-L59](../src/features/auth/authSlice.ts#L53-L59) | [3](03-slices.md) |
| `selectors.js` with `state.auth.x` | `selectors` field in the slice | [authSlice.ts#L78-L83](../src/features/auth/authSlice.ts#L78-L83) | [3](03-slices.md) |
| Standalone action creator / reducer | `createAction` / `createReducer` | [notifications.ts](../src/features/notifications/notifications.ts) | [4](04-actions-and-reducers.md) |
| `action.type === X` guard | `actionCreator.match(action)` | [notifications.ts#L28](../src/features/notifications/notifications.ts#L28) | [4](04-actions-and-reducers.md) |
| Thunk + `REQUEST/SUCCESS/FAILURE` | `createAsyncThunk` / `create.asyncThunk` | [authSlice.ts#L24-L43](../src/features/auth/authSlice.ts#L24-L43), [todosSlice.ts#L74-L99](../src/features/todos/todosSlice.ts#L74-L99) | [5](05-async-thunks.md) |
| Same `loading = true` in N cases | `addMatcher(isPending(a, b), ...)` | [todosSlice.ts#L106-L120](../src/features/todos/todosSlice.ts#L106-L120) | [5](05-async-thunks.md) |
| `normalizr`, hand-written `byId`/`allIds` | `createEntityAdapter` | [todosSlice.ts#L30-L45](../src/features/todos/todosSlice.ts#L30-L45) | [6](06-entities-and-selectors.md) |
| `reselect` | `createSelector` (built in) | [todosSlice.ts#L143-L159](../src/features/todos/todosSlice.ts#L143-L159) | [6](06-entities-and-selectors.md) |
| `redux-saga` (`takeLatest`, `debounce`, `fork`, `take`) | `createListenerMiddleware` | [listeners.ts](../src/app/listeners.ts) | [8](08-listeners.md) |
| Fetch thunks + `loading/data/error` reducers + manual refetch | RTK Query `createApi` + tags | [api.ts](../src/services/api.ts) | [9](09-rtk-query-basics.md) |
| axios interceptor for token refresh | custom `baseQuery` with a mutex | [api.ts#L51-L81](../src/services/api.ts#L51-L81) | [10](10-rtk-query-advanced.md) |
| Optimistic `UPDATE` + manual rollback action | `updateQueryData` + `patch.undo()` | [api.ts#L120-L136](../src/services/api.ts#L120-L136) | [10](10-rtk-query-advanced.md) |
| Reducer registry + `replaceReducer` | `withLazyLoadedSlices` + `slice.injectInto` | [settingsSlice.ts](../src/features/settings/settingsSlice.ts) | [11](11-code-splitting.md) |
| `redux-mock-store` | Real store from `makeStore()` + mocked `fetch` | [todosSlice.test.ts](../src/features/todos/todosSlice.test.ts) | [12](12-testing.md) |
