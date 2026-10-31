// =============================================================================
// CASES: configureStore, combineSlices (RTK 2), lazy slices, middleware order,
//        setupListeners (refetchOnFocus/Reconnect), store factory for tests/SSR
// =============================================================================
import { combineSlices, configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { authSlice } from '@/features/auth/authSlice'
import { todosSlice } from '@/features/todos/todosSlice'
import { notificationsReducer } from '@/features/notifications/notifications'
import { api } from '@/services/api'
import { listenerMiddleware } from './listeners'

// Lazily injected slices are "added" here via module augmentation
// (see features/settings/settingsSlice.ts). An empty interface is fine.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LazyLoadedSlices {}

// combineSlices takes reducerPath from slices and the RTK Query api itself
// and accepts plain reducers as an object
export const rootReducer = combineSlices(authSlice, todosSlice, api, {
  notifications: notificationsReducer,
}).withLazyLoadedSlices<LazyLoadedSlices>()

export type RootState = ReturnType<typeof rootReducer>

// A factory, not a singleton: each test and SSR request needs its own store
export const makeStore = (preloadedState?: Partial<RootState>) => {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // example: allow a non-serializable field in a specific action
          ignoredActions: ['quotes/socketError'],
        },
      })
        // the listener middleware goes first so it sees actions before the others
        .prepend(listenerMiddleware.middleware)
        .concat(api.middleware),
    devTools: true, // in Vite: import.meta.env.DEV
  })

  // Enables RTK Query's refetchOnFocus / refetchOnReconnect
  setupListeners(store.dispatch)
  return store
}

export const store = makeStore()

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']
