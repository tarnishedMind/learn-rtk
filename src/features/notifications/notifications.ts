// =============================================================================
// CASES: createAction + createReducer without a slice (handy for
//        cross-domain events), action.match() as a type guard
// =============================================================================
import { createAction, createReducer, nanoid } from '@reduxjs/toolkit'

export interface Toast {
  id: string
  kind: 'info' | 'error'
  text: string
}

export const toastShown = createAction('notifications/shown', (text: string, kind: Toast['kind'] = 'info') => ({
  payload: { id: nanoid(), text, kind },
}))
export const toastDismissed = createAction<string>('notifications/dismissed')

export const notificationsReducer = createReducer([] as Toast[], (builder) => {
  builder
    .addCase(toastShown, (state, { payload }) => {
      state.push(payload)
      if (state.length > 5) state.shift() // cap the queue
    })
    .addCase(toastDismissed, (state, { payload }) => state.filter((t) => t.id !== payload))
})

// type guard: handy in listeners or custom middleware
export const isErrorToast = (action: unknown) => toastShown.match(action) && action.payload.kind === 'error'
