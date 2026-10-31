# Step 12. Testing

Code: [`src/features/todos/todosSlice.test.ts`](../src/features/todos/todosSlice.test.ts),
[`src/app/listeners.test.ts`](../src/app/listeners.test.ts). Run with `npm test` (Vitest).

## Classic Redux

Separate tests for action creators (`expect(addTodo('a')).toEqual({ type: ADD_TODO, ... })`),
reducers, and thunks with `redux-mock-store`, which records dispatched actions but
never runs reducers.

## The RTK way

Action creators are generated, so don't test them. Test **behavior**: reducers as pure
functions, and everything else through a **real store** from `makeStore()`.

### 1. Reducer as a pure function

[todosSlice.test.ts#L21-L34](../src/features/todos/todosSlice.test.ts#L21-L34)

```ts
let state = todosSlice.reducer(undefined, todoAdded('a'))
state = todosSlice.reducer(state, todoAdded('b'))
state = todosSlice.reducer(state, todoToggled(state.ids[1]))
expect(state.entities[firstId].completed).toBe(true)
```

`reducer(undefined, action)` starts from `initialState`.

### 2. Selectors on a real store

[todosSlice.test.ts#L36-L50](../src/features/todos/todosSlice.test.ts#L36-L50)

```ts
const store = makeStore()
store.dispatch(todoAdded('a'))
expect(selectStats(store.getState())).toEqual({ total: 2, done: 1, active: 1 })
expect(selectStats(s1)).toBe(selectStats(s1))   // memoization: same reference
```

### 3. Thunks: mock `fetch`, not the store

[todosSlice.test.ts#L52-L74](../src/features/todos/todosSlice.test.ts#L52-L74)

```ts
vi.stubGlobal('fetch', vi.fn(async () => Response.json([{ id: '1', /* ... */ }])))
const store = makeStore()
const promise = store.dispatch(fetchTodos())
expect(store.getState().todos.loading).toBe(true)
await promise
expect(store.getState().todos.ids).toEqual(['1'])
```

Error path with `unwrap()`:

```ts
vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
await expect(store.dispatch(saveTodo(todo)).unwrap()).rejects.toBe('Failed to save "Buy milk"')
expect(store.getState().todos.error).toBe('Failed to save "Buy milk"')
```

This tests the thunk, the reducers and the matchers together. In bigger apps, use
[MSW](https://mswjs.io/) to mock the network instead of stubbing `fetch`.

### 4. Listeners with fake timers

[listeners.test.ts#L13-L30](../src/app/listeners.test.ts#L13-L30)

```ts
vi.useFakeTimers()
const store = makeStore()           // listeners are registered on the shared middleware
store.dispatch(todoAdded('a')); store.dispatch(todoAdded('b')); store.dispatch(todoAdded('c'))

await vi.advanceTimersByTimeAsync(499)
expect(setItem).not.toHaveBeenCalled()
await vi.advanceTimersByTimeAsync(1)
expect(setItem).toHaveBeenCalledTimes(1)   // debounced into one save
```

### 5. Lazy slices

[listeners.test.ts#L32-L42](../src/app/listeners.test.ts#L32-L42)

Import the lazy module with `await import(...)` inside the test and check that its
selectors work before and after the first action.

## Tips

- Always create a new store per test (`makeStore()`), never import the app singleton.
- Use `makeStore(preloadedState)` to start from a specific state.
- For components, render them inside `<Provider store={makeStore()}>` with React
  Testing Library and assert on what the user sees.

---

Previous: [Step 11](11-code-splitting.md) · Back to [the README](../README.md) · See also [the cheat sheet](cheatsheet.md)
