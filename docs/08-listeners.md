# Step 8. Side effects with the listener middleware

Code: [`src/app/listeners.ts`](../src/app/listeners.ts)

## Classic Redux

Reacting to actions ("after X happens, do Y") meant `redux-saga` (generators, `takeLatest`,
`fork`, `race`), `redux-observable`, or a hand-written middleware. Thunks can't react to
actions; they only run when you call them.

`createListenerMiddleware` covers most saga use cases with plain `async/await`.

## Setup

```ts
export const listenerMiddleware = createListenerMiddleware()
type AppStartListening = TypedStartListening<RootState, AppDispatch>
export const startAppListening = listenerMiddleware.startListening as AppStartListening
```

[listeners.ts#L16-L21](../src/app/listeners.ts#L16-L21). It is added with
`.prepend(listenerMiddleware.middleware)` in [store.ts](../src/app/store.ts#L39).

Each `startAppListening({ <trigger>, effect })` takes one of these triggers:
`actionCreator`, `type`, `matcher` or `predicate`. The effect receives the action and a
`listenerApi` with `dispatch`, `getState`, `getOriginalState`, `delay`, `take`,
`condition`, `fork`, `cancelActiveListeners`, `unsubscribe`/`subscribe`, and a `signal`.

## The cases

### 1. One action → side effect

[listeners.ts#L23-L29](../src/app/listeners.ts#L23-L29)

```ts
startAppListening({
  actionCreator: loggedOut,
  effect: (_action, { dispatch }) => { dispatch(api.util.resetApiState()) },
})
```

Saga: `takeEvery(LOGGED_OUT, function* () { yield put(...) })`.

### 2. Debounce

[listeners.ts#L31-L43](../src/app/listeners.ts#L31-L43)

```ts
startAppListening({
  matcher: isAnyOf(todoAdded, todoToggled, todoRemoved),
  effect: async (_action, { cancelActiveListeners, delay, getState }) => {
    cancelActiveListeners()   // cancel the previous run that's still waiting
    await delay(500)          // throws if cancelled, so the code below never runs
    localStorage.setItem('todos', JSON.stringify(getState().todos.entities))
  },
})
```

Saga: `debounce(500, [...], saveTodos)`. `cancelActiveListeners()` + `delay()` is also
how you get `takeLatest` semantics.

### 3. React to a state change (`predicate`)

[listeners.ts#L45-L51](../src/app/listeners.ts#L45-L51)

```ts
startAppListening({
  predicate: (_action, current, previous) => current.todos.filter !== previous.todos.filter,
  effect: (_action, { getState }) => { document.title = `Todos — ${getState().todos.filter}` },
})
```

You don't care which action changed it, only that it changed.

### 4. Long-running flow: `take`, `fork`, cancellation

[listeners.ts#L53-L75](../src/app/listeners.ts#L53-L75)

```ts
startAppListening({
  actionCreator: login.fulfilled,
  effect: async (_action, { dispatch, fork, take, unsubscribe, subscribe }) => {
    unsubscribe()                         // only one instance at a time
    try {
      await dispatch(fetchTodos())
      const poller = fork(async (forkApi) => {
        while (true) {
          await forkApi.delay(30_000)
          await dispatch(fetchTodos())
        }
      })
      await take(loggedOut.match)         // wait for another action
      poller.cancel()
    } finally {
      subscribe()                         // listen for the next login
    }
  },
})
```

The saga equivalent is a `while (true) { yield take(LOGIN); const task = yield fork(poll);
yield take(LOGOUT); yield cancel(task) }` loop. `condition(predicate, timeout)` is the
state-based sibling of `take`.

### 5. Global error handling

[listeners.ts#L77-L84](../src/app/listeners.ts#L77-L84)

```ts
startAppListening({
  matcher: isAnyOf(isRejectedWithValue, saveTodo.rejected),
  effect: (action) => console.warn('[error]', action.type, action.payload),
})
```

`isRejectedWithValue` matches any thunk rejected via `rejectWithValue` *and* failed
RTK Query requests, so it's a single place for error toasts or logging.

## Listeners vs thunks vs RTK Query

| Use case | Tool |
|----------|------|
| Load and cache server data | RTK Query |
| Imperative async flow started by the UI | thunk |
| "When X happens / when state changes, do Y" | listener |
| Debounce, polling, cancellable background work | listener |

---

Previous: [Step 7](07-components.md) · Next: [Step 9. RTK Query basics](09-rtk-query-basics.md)
