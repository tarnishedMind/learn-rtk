// =============================================================================
// CASE: testing a debounced listener with fake timers + a lazy slice
// =============================================================================
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from './store'
import { todoAdded } from '@/features/todos/todosSlice'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('listeners', () => {
  it('autosave fires once after a burst of changes', async () => {
    vi.useFakeTimers()
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { setItem, getItem: () => null })

    const store = makeStore()
    store.dispatch(todoAdded('a'))
    store.dispatch(todoAdded('b'))
    store.dispatch(todoAdded('c'))

    await vi.advanceTimersByTimeAsync(499)
    expect(setItem).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(Object.keys(JSON.parse(setItem.mock.calls[0][1]))).toHaveLength(3)
  })
})

describe('lazy slice', () => {
  it('settings appears in state after injection', async () => {
    const store = makeStore()
    // before the module is imported there is no settings in state, but the selector returns initialState
    const { selectTheme, themeChanged } = await import('@/features/settings/settingsSlice')
    expect(selectTheme(store.getState())).toBe('system')

    store.dispatch(themeChanged('dark'))
    expect(selectTheme(store.getState())).toBe('dark')
    expect(store.getState().settings?.theme).toBe('dark')
  })
})
