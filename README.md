# Learn Redux Toolkit (RTK 2) by example

A small, type-checked codebase where every file demonstrates a set of Redux Toolkit
patterns. Each file starts with a `CASE:` / `CASES:` header listing what it shows.
The guide in [`docs/`](docs/) walks through those cases in order.

**Who it's for:** you already know "classic" Redux: `switch` reducers, `ADD_TODO`
constants, action creators, `combineReducers`, `connect`/`mapStateToProps`,
`redux-thunk`, maybe `reselect` and `redux-saga`. Every chapter shows the old way next
to the RTK way and links to the real code.

## The guide

### Part 1. Setup

| # | Step | Code |
|---|------|------|
| 1 | [Create the store](docs/01-store.md): `configureStore`, `combineSlices`, middleware, store factory | [`app/store.ts`](src/app/store.ts) |
| 2 | [Typed hooks](docs/02-typed-hooks.md): `useAppSelector` / `useAppDispatch` instead of `connect` | [`app/hooks.ts`](src/app/hooks.ts) |

### Part 2. Base principles

| # | Step | Code |
|---|------|------|
| 3 | [Write a slice](docs/03-slices.md): `createSlice`, Immer, `prepare`, `selectors` | [`features/auth/authSlice.ts`](src/features/auth/authSlice.ts) |
| 4 | [Actions and reducers without a slice](docs/04-actions-and-reducers.md): `createAction`, `createReducer`, `.match()` | [`features/notifications/notifications.ts`](src/features/notifications/notifications.ts) |
| 5 | [Async logic with thunks](docs/05-async-thunks.md): `createAsyncThunk`, `rejectWithValue`, `condition`, abort, `unwrap` | [`authSlice.ts`](src/features/auth/authSlice.ts), [`todosSlice.ts`](src/features/todos/todosSlice.ts) |
| 6 | [Normalized data and selectors](docs/06-entities-and-selectors.md): `createEntityAdapter`, `createSelector` | [`features/todos/todosSlice.ts`](src/features/todos/todosSlice.ts) |
| 7 | [Using it in components](docs/07-components.md): selectors, dispatching thunks, cancelling on unmount | [`components/TodosPage.tsx`](src/components/TodosPage.tsx) |

### Part 3. Use cases

| # | Step | Code |
|---|------|------|
| 8 | [Side effects with the listener middleware](docs/08-listeners.md) (instead of sagas) | [`app/listeners.ts`](src/app/listeners.ts) |
| 9 | [RTK Query basics](docs/09-rtk-query-basics.md): `createApi`, generated hooks, tags | [`services/api.ts`](src/services/api.ts) |
| 10 | [RTK Query advanced](docs/10-rtk-query-advanced.md): reauth, optimistic updates, streaming, infinite scroll | [`services/api.ts`](src/services/api.ts), [`TodosPage.tsx`](src/components/TodosPage.tsx) |
| 11 | [Code splitting](docs/11-code-splitting.md): lazy slices, `injectEndpoints` | [`settingsSlice.ts`](src/features/settings/settingsSlice.ts), [`usersApi.ts`](src/services/usersApi.ts) |
| 12 | [Testing](docs/12-testing.md): reducers, selectors, thunks, listeners | [`todosSlice.test.ts`](src/features/todos/todosSlice.test.ts), [`listeners.test.ts`](src/app/listeners.test.ts) |

Short on time? Read [the cheat sheet](docs/cheatsheet.md): a one-page mapping from
classic Redux concepts to their RTK replacements.

## Project layout

```
src/
  app/
    store.ts          store, root reducer, types           (step 1)
    hooks.ts          typed hooks and helpers              (step 2)
    listeners.ts      listener middleware effects          (step 8)
    listeners.test.ts                                      (step 12)
  features/
    auth/authSlice.ts             createSlice + createAsyncThunk  (steps 3, 5)
    notifications/notifications.ts createAction + createReducer   (step 4)
    todos/todosSlice.ts           entity adapter, slice thunks    (steps 5, 6)
    todos/todosSlice.test.ts                                      (step 12)
    settings/settingsSlice.ts     lazy slice                      (step 11)
  services/
    api.ts            RTK Query api                        (steps 9, 10)
    usersApi.ts       injected endpoints                   (step 11)
  components/
    TodosPage.tsx     using all of the above in React      (steps 7, 9, 10)
```

## Running it

There is no UI to start; the code is meant to be read, type-checked and tested.

```bash
npm install
```

```bash
npm run typecheck
```

```bash
npm test
```

Versions: `@reduxjs/toolkit` 2.6+, `react-redux` 9, React 19, TypeScript 5.
