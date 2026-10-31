// =============================================================================
// CASE: typed hooks and thunk helpers via .withTypes() (RTK 2 / react-redux 9)
// =============================================================================
import { createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import { useDispatch, useSelector, useStore } from 'react-redux'
import type { AppDispatch, AppStore, RootState } from './store'

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useAppStore = useStore.withTypes<AppStore>()

// So we don't have to write generics in every thunk
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState
  dispatch: AppDispatch
  rejectValue: string
}>()

export const createAppSelector = createSelector.withTypes<RootState>()
