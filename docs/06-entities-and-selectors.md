# Step 6. Normalized data and selectors

Code: [`src/features/todos/todosSlice.ts`](../src/features/todos/todosSlice.ts)

## Classic Redux

You either store an array and `map`/`filter` it on every update, or hand-roll
normalization (`normalizr`, `byId` + `allIds`) and write the same add/update/remove
logic for every entity type. Derived data goes through `reselect`.

## `createEntityAdapter`

```ts
const todosAdapter = createEntityAdapter<Todo>({
  sortComparer: (a, b) => Number(a.completed) - Number(b.completed) || b.createdAt - a.createdAt,
})

const initialState = todosAdapter.getInitialState({ filter: 'all', loading: false, error: null })
// → { ids: [], entities: {}, filter: 'all', loading: false, error: null }
```

[todosSlice.ts#L30-L45](../src/features/todos/todosSlice.ts#L30-L45)

- State shape is `{ ids: string[], entities: Record<string, Todo> }` plus your own fields.
- `sortComparer` keeps `ids` sorted on every change (here: incomplete first, newest first).
- Without a `sortComparer`, `ids` keep insertion order.

### CRUD methods are ready-made reducers

[todosSlice.ts#L54-L68](../src/features/todos/todosSlice.ts#L54-L68), [#L81-L97](../src/features/todos/todosSlice.ts#L81-L97)

```ts
todoAdded:   create.preparedReducer(prepareFn, todosAdapter.addOne),   // used as the reducer directly
todoRemoved: create.reducer(todosAdapter.removeOne),
completedCleared: create.reducer((state) => {
  const doneIds = state.ids.filter((id) => state.entities[id].completed)
  todosAdapter.removeMany(state, doneIds)                                // or called inside a reducer
}),
// in thunk handlers:
todosAdapter.setAll(state, action.payload)
todosAdapter.upsertOne(state, action.payload)
```

Full list: `addOne/Many`, `setOne/Many/All`, `updateOne/Many`, `upsertOne/Many`,
`removeOne/Many/All`. Each accepts either `(state, payload)` or `(state, action)`.

For simple field updates, writing to the entity directly is fine:
`state.entities[id].completed = !...` ([#L60-L63](../src/features/todos/todosSlice.ts#L60-L63)).

### Generated selectors

[todosSlice.ts#L133-L141](../src/features/todos/todosSlice.ts#L133-L141)

```ts
export const { selectAll: selectAllTodos, selectById: selectTodoById, selectIds, selectTotal } =
  todosAdapter.getSelectors<WithTodos>((state) => state.todos)
```

`selectAll` is memoized and returns todos in `ids` order.

## `createSelector`: memoized derived data

`reselect` is built in. Same API as before:

```ts
export const selectVisibleTodos = createSelector(
  [selectAllTodos, (state: WithTodos) => state.todos.filter],
  (todos, filter) => (filter === 'all' ? todos : todos.filter(/* ... */)),
)

export const selectStats = createSelector([selectAllTodos], (todos) => {
  const done = todos.filter((t) => t.completed).length
  return { total: todos.length, done, active: todos.length - done }
})
```

[todosSlice.ts#L143-L153](../src/features/todos/todosSlice.ts#L143-L153)

The result function only reruns when an input changes, so `selectStats(state)` returns
the *same object* for the same state, and a component using it doesn't re-render. (The
test checks this: [todosSlice.test.ts#L43-L45](../src/features/todos/todosSlice.test.ts#L43-L45).)

### Selectors with an argument

[todosSlice.ts#L155-L159](../src/features/todos/todosSlice.ts#L155-L159)

```ts
export const selectTodosMatching = createSelector(
  [selectAllTodos, (_: WithTodos, query: string) => query.toLowerCase()],
  (todos, q) => todos.filter((t) => t.title.toLowerCase().includes(q)),
)
// usage: selectTodosMatching(state, 'milk')
```

Extra arguments are passed to every input selector. RTK 2 uses `weakMapMemoize` by
default, so it caches results for several different arguments, not just the last one.

### Rules of thumb

- Don't memoize trivial lookups (`s => s.filter`); memoize anything that returns a new
  array or object (`filter`, `map`, object literals).
- Keep the raw state minimal (`filter` and the entities) and derive everything else.

---

Previous: [Step 5](05-async-thunks.md) · Next: [Step 7. Using it in components](07-components.md)
