# Step 5. Async logic with thunks

Code: [`authSlice.ts`](../src/features/auth/authSlice.ts) (standalone thunk),
[`todosSlice.ts`](../src/features/todos/todosSlice.ts) (thunks inside the slice, matchers)

> For **fetching and caching server data**, prefer RTK Query ([step 9](09-rtk-query-basics.md)).
> Thunks are still the right tool for flows like login, or logic that combines several requests.

## Classic redux-thunk

```js
export const LOGIN_REQUEST = 'auth/LOGIN_REQUEST'
export const LOGIN_SUCCESS = 'auth/LOGIN_SUCCESS'
export const LOGIN_FAILURE = 'auth/LOGIN_FAILURE'

export const login = (credentials) => async (dispatch, getState) => {
  if (getState().auth.status === 'loading') return
  dispatch({ type: LOGIN_REQUEST })
  try {
    const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
    if (!res.ok) throw new Error(res.status === 401 ? 'Invalid username or password' : 'Server error')
    dispatch({ type: LOGIN_SUCCESS, payload: await res.json() })
  } catch (e) {
    dispatch({ type: LOGIN_FAILURE, error: e.message })
  }
}
// ...plus three `case`s in the reducer
```

## `createAsyncThunk`

```ts
export const login = createAsyncThunk<
  LoginResponse,                                          // what it returns
  { email: string; password: string },                    // its argument
  { state: { auth: AuthState }; rejectValue: string }     // thunkApi config
>(
  'auth/login',
  async (credentials, { rejectWithValue, signal }) => {
    const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials), signal })
    if (!res.ok) return rejectWithValue(res.status === 401 ? 'Invalid username or password' : 'Server error')
    return (await res.json()) as LoginResponse
  },
  { condition: (_arg, { getState }) => getState().auth.status !== 'loading' },
)
```

[authSlice.ts#L22-L43](../src/features/auth/authSlice.ts#L22-L43)

It dispatches `auth/login/pending`, then `auth/login/fulfilled` or `auth/login/rejected`
for you. The pieces:

| Option | What it does | Classic equivalent |
|--------|--------------|--------------------|
| `rejectWithValue(x)` | Rejects with a typed `action.payload` you control | `dispatch({ type: FAILURE, error })` |
| a thrown error | Rejects with a serialized `action.error` (`message`, `name`, `stack`) | `catch` block |
| `condition` | Return `false` to skip the thunk entirely (no actions dispatched) | early `return` in the thunk |
| `signal` | An `AbortSignal`; pass it to `fetch` so `promise.abort()` cancels the request | none |

### Handling the lifecycle in the slice: `extraReducers`

```ts
extraReducers: (builder) => {
  builder
    .addCase(login.pending, (state) => { state.status = 'loading'; state.error = null })
    .addCase(login.fulfilled, (state, { payload }) => { state.user = payload.user; /* ... */ })
    .addCase(login.rejected, (state, action) => {
      state.status = 'failed'
      state.error = action.payload ?? action.error.message ?? 'Unknown error'
    })
}
```

[authSlice.ts#L61-L77](../src/features/auth/authSlice.ts#L61-L77)

`reducers` define *new* actions owned by the slice; `extraReducers` respond to actions
defined *elsewhere* (thunks, other slices). In `rejected`, `action.payload` is set only
when you used `rejectWithValue`; otherwise fall back to `action.error.message`.

## Thunks declared inside the slice (`create.asyncThunk`)

[todosSlice.ts#L47-L100](../src/features/todos/todosSlice.ts#L47-L100)

With `buildCreateSlice` + `asyncThunkCreator`, the `reducers` field becomes a callback
and a thunk can live right next to its reducers:

```ts
const createAppSlice = buildCreateSlice({ creators: { asyncThunk: asyncThunkCreator } })

export const todosSlice = createAppSlice({
  name: 'todos',
  initialState,
  reducers: (create) => ({
    todoToggled: create.reducer((state, action: PayloadAction<string>) => { /* ... */ }),
    fetchTodos: create.asyncThunk(
      async (_: void, { signal }) => { /* fetch */ },
      { fulfilled: (state, action) => { todosAdapter.setAll(state, action.payload) } },
    ),
  }),
})

export const { fetchTodos } = todosSlice.actions   // a regular thunk action creator
```

You may pass `pending`, `fulfilled`, `rejected` and `settled` handlers; omit the ones a
matcher already covers.

## Matchers: one handler for many actions

[todosSlice.ts#L102-L121](../src/features/todos/todosSlice.ts#L102-L121)

Instead of copy-pasting `loading = true` into every thunk:

```ts
builder
  .addMatcher(isPending(fetchTodos, saveTodo), (state) => { state.loading = true; state.error = null })
  .addMatcher(isAnyOf(fetchTodos.fulfilled, saveTodo.fulfilled), (state) => { state.loading = false })
  .addMatcher(isRejected(fetchTodos, saveTodo), (state, action) => {
    state.loading = false
    state.error = (action.payload as string | undefined) ?? action.error.message ?? 'Error'
  })
```

Also available: `isFulfilled`, `isRejectedWithValue`, `isAsyncThunkAction`, `isAllOf`.
Rule: all `addCase` calls go before any `addMatcher`.

### Reacting to another slice's action

[todosSlice.ts#L104-L105](../src/features/todos/todosSlice.ts#L104-L105)

```ts
.addCase(loggedOut, () => initialState)
```

The todos slice resets on `auth/loggedOut`. In classic Redux you'd import the
`LOGGED_OUT` constant into a second reducer; here you import the action creator.

## In components: `unwrap()` and `abort()`

```ts
const promise = dispatch(fetchTodos())
return () => promise.abort()          // cancel on unmount

await dispatch(saveTodo(todo)).unwrap()   // resolves with payload, or throws the rejected value
```

See [step 7](07-components.md).

---

Previous: [Step 4](04-actions-and-reducers.md) · Next: [Step 6. Normalized data and selectors](06-entities-and-selectors.md)
