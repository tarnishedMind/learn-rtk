// =============================================================================
// CASE: code splitting endpoints, injectEndpoints in a separate file/chunk,
//        enhanceEndpoints for further tweaking, queryFn without HTTP (caching any
//        async work), prefetch
// =============================================================================
import { api } from './api'

export interface User {
  id: string
  name: string
}

export const usersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<User[], void>({
      query: () => '/users',
      providesTags: ['User'],
    }),

    // queryFn: RTK Query as a cache for anything (localStorage, IndexedDB, SDK)
    getDraft: build.query<string, string>({
      queryFn: (key) => {
        try {
          return { data: localStorage.getItem(`draft:${key}`) ?? '' }
        } catch (e) {
          return { error: { status: 'CUSTOM_ERROR', error: String(e) } }
        }
      },
    }),
  }),
  overrideExisting: false,
})

// Tweak existing endpoints without touching the original file
usersApi.enhanceEndpoints({
  endpoints: {
    getUsers: { keepUnusedDataFor: 300 },
  },
})

export const { useGetUsersQuery, useGetDraftQuery, usePrefetch } = usersApi
