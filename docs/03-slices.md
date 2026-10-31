# Step 3. Write a slice

Code: [`src/features/auth/authSlice.ts`](../src/features/auth/authSlice.ts)

## Classic Redux

Three files for one feature:

```js
// constants.js
export const LOGGED_OUT = 'auth/LOGGED_OUT'
export const USER_RENAMED = 'auth/USER_RENAMED'

// actions.js
export const loggedOut = () => ({ type: LOGGED_OUT })
export const userRenamed = (name) => ({ type: USER_RENAMED, payload: name.trim(), meta: { at: Date.now() } })

// reducer.js
export default function authReducer(state = initialState, action) {
  switch (action.type) {
    case LOGGED_OUT:
      return initialState
    case USER_RENAMED:
      return state.user ? { ...state, user: { ...state.user, name: action.payload } } : state
    default:
      return state
  }
}

// selectors.js
export const selectUser = (state) => state.auth.user
```

## RTK

One `createSlice` call generates the action types, action creators and the reducer:

```ts
export const authSlice = createSlice({
  name: 'auth',                       // prefix for action types: 'auth/loggedOut'
  initialState,
  reducers: {
    loggedOut: () => initialState,
    tokenRefreshed: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload     // "mutation" is fine, see below
    },
    userRenamed: {
      reducer: (state, action: PayloadAction<string, string, { at: number }>) => {
        if (state.user) state.user.name = action.payload
      },
      prepare: (name: string) => ({ payload: name.trim(), meta: { at: Date.now() } }),
    },
  },
  selectors: {
    selectUser: (s) => s.user,
    selectIsAuthed: (s) => s.accessToken !== null,
  },
})

export const { loggedOut, tokenRefreshed, userRenamed } = authSlice.actions
export const { selectUser, selectIsAuthed } = authSlice.selectors
```

[authSlice.ts#L45-L87](../src/features/auth/authSlice.ts#L45-L87)

## Principles

### 1. Immer: write "mutating" code, get immutable updates

Inside slice reducers `state` is an Immer draft. `state.accessToken = x` produces a new
object; no more nested spreads. Two rules:

- Either mutate the draft **or** return a new value, never both.
  `loggedOut: () => initialState` returns; `tokenRefreshed` mutates.
- To replace the whole state you must `return` it (`state = x` does nothing).

### 2. Action names are events, not setters

`loggedOut`, `tokenRefreshed`, `userRenamed`: past-tense "what happened", not
`setToken`. Several slices can react to the same event (the todos slice resets itself
on `loggedOut`, see [step 5](05-async-thunks.md#reacting-to-another-slices-action)).

### 3. `prepare`: keep reducers pure

[authSlice.ts#L53-L59](../src/features/auth/authSlice.ts#L53-L59)

Reducers must not have side effects, so `Date.now()`, `nanoid()` or input normalization
go into `prepare`. It builds `payload`/`meta` (and `error`) before the action is
dispatched; `userRenamed(' Bob ')` creates
`{ type: 'auth/userRenamed', payload: 'Bob', meta: { at: 1730... } }`.

### 4. `selectors` live next to the state (RTK 2)

[authSlice.ts#L78-L83](../src/features/auth/authSlice.ts#L78-L83)

Selectors in the `selectors` field receive the **slice** state, not `RootState`.
`authSlice.selectors.selectUser` is automatically wrapped to read `state.auth`, so it
accepts the root state when you call it. If the slice is mounted under another key,
use `authSlice.getSelectors(rootState => rootState.somewhereElse)`.

### 5. Action creators know their type

`loggedOut.type === 'auth/loggedOut'` and `loggedOut.match(action)` is a type guard.
No constants to export.

---

Previous: [Step 2](02-typed-hooks.md) · Next: [Step 4. Actions and reducers without a slice](04-actions-and-reducers.md)
