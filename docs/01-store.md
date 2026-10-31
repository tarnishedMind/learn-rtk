# Step 1. Create the store

Code: [`src/app/store.ts`](../src/app/store.ts)

## Classic Redux

```js
import { createStore, combineReducers, applyMiddleware, compose } from 'redux'
import thunk from 'redux-thunk'

const rootReducer = combineReducers({ auth: authReducer, todos: todosReducer })

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose
export const store = createStore(rootReducer, composeEnhancers(applyMiddleware(thunk, logger)))
```

You wire up thunk, DevTools and enhancers by hand, and nothing warns you when you
mutate state or put a `Date`/`Promise` in it.

## RTK

```ts
export const rootReducer = combineSlices(authSlice, todosSlice, api, {
  notifications: notificationsReducer,
}).withLazyLoadedSlices<LazyLoadedSlices>()

export const makeStore = (preloadedState?: Partial<RootState>) => {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: { ignoredActions: ['quotes/socketError'] } })
        .prepend(listenerMiddleware.middleware)
        .concat(api.middleware),
    devTools: true,
  })
  setupListeners(store.dispatch)
  return store
}
```

### What `configureStore` gives you for free

- **redux-thunk** is already in `getDefaultMiddleware()`.
- **Redux DevTools** are on (`devTools: true`; in Vite use `import.meta.env.DEV`).
- **Dev-only checks:** an immutability check (throws if you mutate state outside
  Immer) and a serializability check (warns about non-serializable values in actions
  or state). Opt out per action with `serializableCheck.ignoredActions`
  ([store.ts#L33-L36](../src/app/store.ts#L33-L36)).

### `combineSlices` instead of `combineReducers` (RTK 2)

[store.ts#L20-L22](../src/app/store.ts#L20-L22)

- Pass slices and an RTK Query `api` directly. Each one is mounted under its own
  `reducerPath` (the slice's `name`, or the api's `reducerPath`), so you never repeat keys.
- Plain reducers still go in an object: `{ notifications: notificationsReducer }`.
- `.withLazyLoadedSlices<LazyLoadedSlices>()` lets other modules add slices later
  (see [step 11](11-code-splitting.md)).

### Middleware order

[store.ts#L31-L40](../src/app/store.ts#L31-L40)

The `middleware` option is a callback that receives `getDefaultMiddleware`. Don't
replace the defaults with an array, or you lose thunk and the checks.

- `.prepend(listenerMiddleware.middleware)`: the listener middleware should run first
  so it sees every action ([step 8](08-listeners.md)).
- `.concat(api.middleware)`: required for RTK Query caching, polling and invalidation.

### `setupListeners`

[store.ts#L44-L45](../src/app/store.ts#L44-L45)

Subscribes to window `focus` and `online` events so RTK Query's `refetchOnFocus` and
`refetchOnReconnect` options work.

### A factory, not a singleton

[store.ts#L26-L49](../src/app/store.ts#L26-L49)

`makeStore()` builds a fresh store. The app uses one instance (`export const store =
makeStore()`), while every test and every SSR request gets its own, so state never
leaks between them. `preloadedState` lets tests start from any state.

### Types come from the store, not written by hand

[store.ts#L24](../src/app/store.ts#L24), [#L51-L52](../src/app/store.ts#L51-L52)

```ts
export type RootState = ReturnType<typeof rootReducer>
export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']   // knows about thunks
```

Add a slice, and `RootState` updates by itself.

---

Next: [Step 2. Typed hooks](02-typed-hooks.md)
