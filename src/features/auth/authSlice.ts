// =============================================================================
// CASES: createSlice + prepare callback, the selectors field (RTK 2),
//        createAsyncThunk: rejectWithValue, condition, signal (abort),
//        extraReducers with builder + addCase / addMatcher
// =============================================================================
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AuthState {
  user: { id: string; name: string } | null
  accessToken: string | null
  status: 'idle' | 'loading' | 'failed'
  error: string | null
}

const initialState: AuthState = { user: null, accessToken: null, status: 'idle', error: null }

interface LoginResponse {
  user: { id: string; name: string }
  accessToken: string
}

// A standalone thunk. Generics: <Returned, Arg, ThunkApiConfig>.
// (auth doesn't import hooks.ts to avoid a circular type dependency)
export const login = createAsyncThunk<
  LoginResponse,
  { email: string; password: string },
  { state: { auth: AuthState }; rejectValue: string }
>(
  'auth/login',
  async (credentials, { rejectWithValue, signal }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      signal, // thunk.abort() cancels the request
    })
    if (!res.ok) return rejectWithValue(res.status === 401 ? 'Invalid username or password' : 'Server error')
    return (await res.json()) as LoginResponse
  },
  {
    // don't run again while a login is in progress
    condition: (_arg, { getState }) => getState().auth.status !== 'loading',
  },
)

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loggedOut: () => initialState,
    tokenRefreshed: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload
    },
    // prepare: build payload/meta outside the reducer (no side effects allowed in reducers)
    userRenamed: {
      reducer: (state, action: PayloadAction<string, string, { at: number }>) => {
        if (state.user) state.user.name = action.payload
      },
      prepare: (name: string) => ({ payload: name.trim(), meta: { at: Date.now() } }),
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.status = 'idle'
        state.user = payload.user
        state.accessToken = payload.accessToken
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed'
        // payload exists if rejectWithValue was used; otherwise it's a serialized error
        state.error = action.payload ?? action.error.message ?? 'Unknown error'
      })
  },
  // Selectors receive the slice state, not the whole RootState
  selectors: {
    selectUser: (s) => s.user,
    selectIsAuthed: (s) => s.accessToken !== null,
    selectAuthError: (s) => s.error,
  },
})

export const { loggedOut, tokenRefreshed, userRenamed } = authSlice.actions
export const { selectUser, selectIsAuthed, selectAuthError } = authSlice.selectors
