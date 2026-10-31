# Step 2. Typed hooks

Code: [`src/app/hooks.ts`](../src/app/hooks.ts)

## Classic Redux

```js
const mapStateToProps = (state) => ({ todos: state.todos.items })
const mapDispatchToProps = { addTodo }
export default connect(mapStateToProps, mapDispatchToProps)(TodoList)
```

`connect` still works, but hooks are the recommended API: less boilerplate and much
better TypeScript inference.

## RTK

Define pre-typed hooks once and use them everywhere instead of the raw
`useSelector`/`useDispatch`:

```ts
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useAppStore = useStore.withTypes<AppStore>()
```

[hooks.ts#L8-L10](../src/app/hooks.ts#L8-L10)

- `useAppSelector((s) => s.todos.filter)`: `s` is already `RootState`.
- `useAppDispatch()` returns a dispatch that knows about thunks, so
  `dispatch(fetchTodos()).unwrap()` is typed.

## Same trick for thunks and selectors

[hooks.ts#L13-L19](../src/app/hooks.ts#L13-L19)

```ts
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState
  dispatch: AppDispatch
  rejectValue: string
}>()

export const createAppSelector = createSelector.withTypes<RootState>()
```

With these you don't repeat the `{ state: RootState; rejectValue: string }` generic in
every thunk.

> **Watch out for import cycles.** `authSlice.ts` does *not* use
> `createAppAsyncThunk`: `hooks.ts` imports `store.ts`, which imports `authSlice.ts`,
> so the types would depend on themselves. In such slices pass the generics directly
> (see [step 5](05-async-thunks.md)). For the same reason
> [`listeners.ts`](../src/app/listeners.ts#L18-L21) uses `TypedStartListening`.

---

Previous: [Step 1](01-store.md) · Next: [Step 3. Write a slice](03-slices.md)
