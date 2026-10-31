// =============================================================================
// CASES for createListenerMiddleware (replaces redux-saga/observable for most tasks):
//  - reacting to a specific action (actionCreator)
//  - matcher over several actions (isAnyOf)
//  - predicate on state changes (saving to localStorage)
//  - debounce: cancelActiveListeners + delay
//  - "takeLatest" semantics and waiting for another action (take, condition)
//  - fork: cancellable background task (polling while the user is logged in)
// =============================================================================
import { createListenerMiddleware, isAnyOf, isRejectedWithValue, type TypedStartListening } from '@reduxjs/toolkit'
import type { AppDispatch, RootState } from './store'
import { login, loggedOut } from '@/features/auth/authSlice'
import { fetchTodos, saveTodo, todoAdded, todoRemoved, todoToggled } from '@/features/todos/todosSlice'
import { api } from '@/services/api'

export const listenerMiddleware = createListenerMiddleware()

// .withTypes can't be called before RootState is declared in the import cycle,
// so we use TypedStartListening, whose type is resolved lazily.
type AppStartListening = TypedStartListening<RootState, AppDispatch>
export const startAppListening = listenerMiddleware.startListening as AppStartListening

// 1. Specific action → side effect
startAppListening({
  actionCreator: loggedOut,
  effect: (_action, { dispatch }) => {
    dispatch(api.util.resetApiState()) // clear the RTK Query cache on logout
  },
})

// 2. Debounce: autosave 500 ms after the last change
startAppListening({
  matcher: isAnyOf(todoAdded, todoToggled, todoRemoved),
  effect: async (_action, { cancelActiveListeners, delay, getState }) => {
    cancelActiveListeners() // cancels the previous run that is still waiting
    await delay(500) // throws TaskAbortError when cancelled
    try {
      localStorage.setItem('todos', JSON.stringify(getState().todos.entities))
    } catch {
      /* storage unavailable, silently ignore */
    }
  },
})

// 3. predicate: fires when a specific state field changes
startAppListening({
  predicate: (_action, current, previous) => current.todos.filter !== previous.todos.filter,
  effect: (_action, { getState }) => {
    if (typeof document !== 'undefined') document.title = `Todos — ${getState().todos.filter}`
  },
})

// 4. Sequential flow: after login, load todos and
//    start background polling that lives until logout
startAppListening({
  actionCreator: login.fulfilled,
  effect: async (_action, { dispatch, fork, take, unsubscribe, subscribe }) => {
    unsubscribe() // don't start a second instance while this one is running
    try {
      await dispatch(fetchTodos())

      const poller = fork(async (forkApi) => {
        while (true) {
          await forkApi.delay(30_000)
          await dispatch(fetchTodos()) // dispatch from the effect's closure
        }
      })

      await take(loggedOut.match) // wait for logout
      poller.cancel()
    } finally {
      subscribe() // listen for the next login again
    }
  },
})

// 5. Global error handling: any rejectWithValue + RTK Query errors
startAppListening({
  matcher: isAnyOf(isRejectedWithValue, saveTodo.rejected),
  effect: (action) => {
    const payload = 'payload' in action ? action.payload : undefined
    console.warn('[error]', action.type, payload)
  },
})
