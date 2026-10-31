// =============================================================================
// CASE: lazy slice (code splitting), attached to the store only once the
//        module is imported, via rootReducer.inject / slice.injectInto.
//        Selectors of such slices are safe before injection thanks to initialState.
// =============================================================================
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { rootReducer } from '@/app/store'

type Theme = 'light' | 'dark' | 'system'

interface SettingsState {
  theme: Theme
  locale: string
}

const initialState: SettingsState = { theme: 'system', locale: 'ru' }

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    themeChanged: (s, a: PayloadAction<Theme>) => {
      s.theme = a.payload
    },
    localeChanged: (s, a: PayloadAction<string>) => {
      s.locale = a.payload
    },
  },
  selectors: {
    selectTheme: (s) => s.theme,
  },
})

// Extend the RootState type so state.settings is visible (as optional)
declare module '@/app/store' {
  export interface LazyLoadedSlices extends WithSlice<typeof settingsSlice> {}
}
import type { WithSlice } from '@reduxjs/toolkit'

// Inject on module import. Returns a slice whose selectors
// "know" where the data lives in the root state.
export const injectedSettings = settingsSlice.injectInto(rootReducer)

export const { themeChanged, localeChanged } = settingsSlice.actions
export const { selectTheme } = injectedSettings.selectors
