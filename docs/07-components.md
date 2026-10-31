# Step 7. Using it in components

Code: [`src/components/TodosPage.tsx`](../src/components/TodosPage.tsx), the `LocalTodos` component
([#L32-L62](../src/components/TodosPage.tsx#L32-L62))

## Classic Redux

```js
class TodoList extends React.Component {
  componentDidMount() { this.props.fetchTodos() }
  render() { /* this.props.todos, this.props.stats */ }
}
export default connect(
  (state) => ({ todos: getVisibleTodos(state), stats: getStats(state) }),
  { fetchTodos, todoAdded },
)(TodoList)
```

## RTK + hooks

```tsx
export function LocalTodos() {
  const dispatch = useAppDispatch()
  const todos = useAppSelector(selectVisibleTodos)
  const stats = useAppSelector(selectStats)
  const [query, setQuery] = useState('')
  const matching = useAppSelector((s) => selectTodosMatching(s, query))

  useEffect(() => {
    const promise = dispatch(fetchTodos())
    return () => promise.abort()
  }, [dispatch])

  return <button onClick={() => dispatch(todoAdded('New todo'))}>Add</button>
}
```

## What to notice

### `useAppSelector` re-renders on reference change

`useSelector` compares the returned value with `===`. A selector that builds a new
array each time (`s => s.todos.ids.map(...)`) re-renders the component on *every*
action. That's why `selectVisibleTodos` and `selectStats` are memoized
([step 6](06-entities-and-selectors.md)). In dev mode, react-redux 9 warns when a
selector returns a different reference for the same state.

### Selectors with arguments

[TodosPage.tsx#L38](../src/components/TodosPage.tsx#L38)

Wrap them in an inline function: `useAppSelector((s) => selectTodosMatching(s, query))`.

### Cancelling a thunk on unmount

[TodosPage.tsx#L40-L43](../src/components/TodosPage.tsx#L40-L43)

`dispatch(thunk)` returns a promise with an `.abort()` method. Calling it in the
effect cleanup aborts the `signal` passed to `fetch`, and the thunk is rejected with
`action.meta.aborted === true`. This also handles React StrictMode's double effect
run in development.

### `unwrap()` for local error handling

When the component needs the result (close a modal, show an inline error):

```ts
try {
  const saved = await dispatch(saveTodo(todo)).unwrap()
} catch (message) {
  // the rejectWithValue payload, or the serialized error
}
```

Without `unwrap()`, the promise always resolves with the final action, even on failure.

### Server state goes to RTK Query

The same file has a `ServerTodos` component that uses RTK Query hooks instead of
slices and thunks. That's covered in [steps 9-10](09-rtk-query-basics.md).

---

Previous: [Step 6](06-entities-and-selectors.md) · Next: [Step 8. Side effects with listeners](08-listeners.md)
