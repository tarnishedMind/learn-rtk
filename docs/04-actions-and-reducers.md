# Step 4. Actions and reducers without a slice

Code: [`src/features/notifications/notifications.ts`](../src/features/notifications/notifications.ts)

`createSlice` is built from two smaller tools, `createAction` and `createReducer`. You
rarely need them directly, but they are handy for events that don't belong to one
feature (here: toast notifications that any part of the app can show).

## `createAction`: an action creator plus its type

Classic:

```js
export const TOAST_DISMISSED = 'notifications/dismissed'
export const toastDismissed = (id) => ({ type: TOAST_DISMISSED, payload: id })
```

RTK:

```ts
export const toastDismissed = createAction<string>('notifications/dismissed')

// with a prepare callback, same idea as in createSlice
export const toastShown = createAction('notifications/shown', (text: string, kind: Toast['kind'] = 'info') => ({
  payload: { id: nanoid(), text, kind },
}))
```

[notifications.ts#L13-L16](../src/features/notifications/notifications.ts#L13-L16)

## `createReducer`: a `switch` with a builder and Immer

```ts
export const notificationsReducer = createReducer([] as Toast[], (builder) => {
  builder
    .addCase(toastShown, (state, { payload }) => {
      state.push(payload)
      if (state.length > 5) state.shift() // cap the queue
    })
    .addCase(toastDismissed, (state, { payload }) => state.filter((t) => t.id !== payload))
})
```

[notifications.ts#L18-L25](../src/features/notifications/notifications.ts#L18-L25)

`addCase(toastShown, ...)` takes the action creator itself, so the payload type is
inferred. The first handler mutates; the second returns a new array. Both are fine.

Mounting a plain reducer: `combineSlices(..., { notifications: notificationsReducer })`
([store.ts#L20-L22](../src/app/store.ts#L20-L22)).

## `.match()` as a type guard

```ts
export const isErrorToast = (action: unknown) => toastShown.match(action) && action.payload.kind === 'error'
```

[notifications.ts#L27-L28](../src/features/notifications/notifications.ts#L27-L28)

After `toastShown.match(action)` TypeScript knows the payload shape. Useful in custom
middleware and listeners, where actions arrive as `unknown`.

## When to use which

| Need | Use |
|------|-----|
| State owned by one feature | `createSlice` |
| A global event several slices react to, with no state of its own | `createAction` |
| A reducer for actions defined elsewhere | `createReducer`, or `extraReducers` in a slice |

---

Previous: [Step 3](03-slices.md) · Next: [Step 5. Async logic with thunks](05-async-thunks.md)
