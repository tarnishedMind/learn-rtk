// =============================================================================
// CASES: createEntityAdapter (normalization, sortComparer, CRUD methods),
//        buildCreateSlice + asyncThunkCreator (thunks right inside reducers),
//        isAnyOf / isPending / isRejected matchers,
//        memoized selectors with an argument, getSelectors for entities
// =============================================================================
import {
  asyncThunkCreator,
  buildCreateSlice,
  createEntityAdapter,
  createSelector,
  isAnyOf,
  isPending,
  isRejected,
  nanoid,
  type EntityState,
  type PayloadAction,
} from '@reduxjs/toolkit'
import { loggedOut } from '@/features/auth/authSlice'

export interface Todo {
  id: string
  title: string
  completed: boolean
  createdAt: number
}

export type Filter = 'all' | 'active' | 'done'

const todosAdapter = createEntityAdapter<Todo>({
  // ids are always sorted: incomplete first, then by date
  sortComparer: (a, b) => Number(a.completed) - Number(b.completed) || b.createdAt - a.createdAt,
})

interface TodosState extends EntityState<Todo, string> {
  filter: Filter
  loading: boolean
  error: string | null
}

const initialState: TodosState = todosAdapter.getInitialState({
  filter: 'all',
  loading: false,
  error: null,
})

// slice creators: let you declare thunks right in reducers
const createAppSlice = buildCreateSlice({ creators: { asyncThunk: asyncThunkCreator } })

export const todosSlice = createAppSlice({
  name: 'todos',
  initialState,
  reducers: (create) => ({
    todoAdded: create.preparedReducer(
      (title: string) => ({
        payload: { id: nanoid(), title, completed: false, createdAt: Date.now() } satisfies Todo,
      }),
      todosAdapter.addOne,
    ),
    todoToggled: create.reducer((state, action: PayloadAction<string>) => {
      const todo = state.entities[action.payload]
      if (todo) todo.completed = !todo.completed
    }),
    todoRemoved: create.reducer(todosAdapter.removeOne),
    completedCleared: create.reducer((state) => {
      const doneIds = state.ids.filter((id) => state.entities[id].completed)
      todosAdapter.removeMany(state, doneIds)
    }),
    filterChanged: create.reducer((state, action: PayloadAction<Filter>) => {
      state.filter = action.payload
    }),

    // a thunk + its pending/fulfilled/rejected reducers in one place
    fetchTodos: create.asyncThunk(
      async (_: void, { signal }) => {
        const res = await fetch('/api/todos', { signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as Todo[]
      },
      {
        fulfilled: (state, action) => {
          todosAdapter.setAll(state, action.payload)
        },
        // shared loading/error logic lives in the matchers below
      },
    ),

    saveTodo: create.asyncThunk(
      async (todo: Todo, { rejectWithValue }) => {
        const res = await fetch(`/api/todos/${todo.id}`, { method: 'PUT', body: JSON.stringify(todo) })
        if (!res.ok) return rejectWithValue(`Failed to save "${todo.title}"`)
        return (await res.json()) as Todo
      },
      {
        fulfilled: (state, action) => {
          todosAdapter.upsertOne(state, action.payload)
        },
      },
    ),
  }),

  extraReducers: (builder) => {
    builder
      // reacting to an action from ANOTHER slice
      .addCase(loggedOut, () => initialState)
      // one handler for several thunks
      .addMatcher(isPending(todosSlice.actions.fetchTodos, todosSlice.actions.saveTodo), (state) => {
        state.loading = true
        state.error = null
      })
      .addMatcher(
        isAnyOf(todosSlice.actions.fetchTodos.fulfilled, todosSlice.actions.saveTodo.fulfilled),
        (state) => {
          state.loading = false
        },
      )
      .addMatcher(isRejected(todosSlice.actions.fetchTodos, todosSlice.actions.saveTodo), (state, action) => {
        state.loading = false
        state.error = (action.payload as string | undefined) ?? action.error.message ?? 'Error'
      })
  },

  selectors: {
    selectFilter: (s) => s.filter,
    selectTodosLoading: (s) => s.loading,
  },
})

export const { todoAdded, todoToggled, todoRemoved, completedCleared, filterChanged, fetchTodos, saveTodo } =
  todosSlice.actions
export const { selectFilter, selectTodosLoading } = todosSlice.selectors

// ---- adapter selectors bound to RootState ---------------------------------
type WithTodos = { todos: TodosState }

export const {
  selectAll: selectAllTodos,
  selectById: selectTodoById,
  selectIds: selectTodoIds,
  selectTotal: selectTodosTotal,
} = todosAdapter.getSelectors<WithTodos>((state) => state.todos)

// memoized derived selector
export const selectVisibleTodos = createSelector(
  [selectAllTodos, (state: WithTodos) => state.todos.filter],
  (todos, filter) =>
    filter === 'all' ? todos : todos.filter((t) => (filter === 'done' ? t.completed : !t.completed)),
)

export const selectStats = createSelector([selectAllTodos], (todos) => {
  const done = todos.filter((t) => t.completed).length
  return { total: todos.length, done, active: todos.length - done }
})

// selector with an argument: (state, query), caches the last call
export const selectTodosMatching = createSelector(
  [selectAllTodos, (_: WithTodos, query: string) => query.toLowerCase()],
  (todos, q) => todos.filter((t) => t.title.toLowerCase().includes(q)),
)
