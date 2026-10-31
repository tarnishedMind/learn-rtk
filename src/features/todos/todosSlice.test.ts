// =============================================================================
// TESTING CASES: pure reducer, selectors, thunk with mocked fetch
//                     on a real store from makeStore()
// =============================================================================
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import {
  completedCleared,
  fetchTodos,
  filterChanged,
  saveTodo,
  selectStats,
  selectVisibleTodos,
  todoAdded,
  todoToggled,
  todosSlice,
} from './todosSlice'

afterEach(() => vi.unstubAllGlobals())

describe('todosSlice reducer', () => {
  it('adds, toggles and clears completed', () => {
    let state = todosSlice.reducer(undefined, todoAdded('a'))
    state = todosSlice.reducer(state, todoAdded('b'))
    const firstId = state.ids[1]
    state = todosSlice.reducer(state, todoToggled(firstId))
    expect(state.entities[firstId].completed).toBe(true)
    // sortComparer: completed ones move to the end
    expect(state.ids[state.ids.length - 1]).toBe(firstId)

    state = todosSlice.reducer(state, completedCleared())
    expect(state.ids).toHaveLength(1)
  })
})

describe('selectors', () => {
  it('filter and stats are memoized', () => {
    const store = makeStore()
    store.dispatch(todoAdded('a'))
    store.dispatch(todoAdded('b'))
    store.dispatch(todoToggled(store.getState().todos.ids[0]))

    const s1 = store.getState()
    expect(selectStats(s1)).toEqual({ total: 2, done: 1, active: 1 })
    expect(selectStats(s1)).toBe(selectStats(s1)) // same reference

    store.dispatch(filterChanged('done'))
    expect(selectVisibleTodos(store.getState())).toHaveLength(1)
  })
})

describe('async thunks', () => {
  it('fetchTodos stores the data and clears loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json([{ id: '1', title: 'srv', completed: false, createdAt: 1 }])),
    )
    const store = makeStore()
    const promise = store.dispatch(fetchTodos())
    expect(store.getState().todos.loading).toBe(true)
    await promise
    expect(store.getState().todos.loading).toBe(false)
    expect(store.getState().todos.ids).toEqual(['1'])
  })

  it('saveTodo: rejectWithValue ends up in error, unwrap throws the payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    const store = makeStore()
    const todo = { id: 'x', title: 'Buy milk', completed: false, createdAt: 0 }

    await expect(store.dispatch(saveTodo(todo)).unwrap()).rejects.toBe('Failed to save "Buy milk"')
    expect(store.getState().todos.error).toBe('Failed to save "Buy milk"')
  })
})
