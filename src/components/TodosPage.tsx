// =============================================================================
// CASES in components:
//  - useAppSelector with a memoized selector and a selector with an argument
//  - dispatch(thunk).unwrap() + try/catch, cancelling a thunk on unmount
//  - RTK Query: selectFromResult (re-render only when the needed slice changes),
//    skipToken, pollingInterval, lazy query, mutation unwrap, prefetch,
//    infinite query, streaming quotes
// =============================================================================
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchTodos,
  filterChanged,
  selectStats,
  selectTodosMatching,
  selectVisibleTodos,
  todoAdded,
  todoToggled,
} from '@/features/todos/todosSlice'
import {
  useAddTodoMutation,
  useGetFeedInfiniteQuery,
  useGetQuotesQuery,
  useGetTodoQuery,
  useGetTodosQuery,
  useLazyGetTodoQuery,
  useToggleTodoMutation,
} from '@/services/api'
import { usePrefetch } from '@/services/usersApi'

// ---- Client state (slice) ------------------------------------------------
export function LocalTodos() {
  const dispatch = useAppDispatch()
  const todos = useAppSelector(selectVisibleTodos)
  const stats = useAppSelector(selectStats)
  const [query, setQuery] = useState('')
  const matching = useAppSelector((s) => selectTodosMatching(s, query))

  useEffect(() => {
    const promise = dispatch(fetchTodos())
    return () => promise.abort() // StrictMode/unmount: cancel the request
  }, [dispatch])

  return (
    <section>
      <p>
        {stats.done}/{stats.total} done, found: {matching.length}
      </p>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <button onClick={() => dispatch(todoAdded('New todo'))}>Add</button>
      <button onClick={() => dispatch(filterChanged('active'))}>Active</button>
      <ul>
        {todos.map((t) => (
          <li key={t.id} onClick={() => dispatch(todoToggled(t.id))}>
            {t.completed ? '✅' : '⬜'} {t.title}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---- Server state (RTK Query) --------------------------------------------
export function ServerTodos({ selectedId }: { selectedId: string | null }) {
  // pollingInterval + selecting only part of the data: the component doesn't re-render
  // when incomplete todos change
  const { doneCount, isLoading } = useGetTodosQuery(undefined, {
    pollingInterval: 60_000,
    skipPollingIfUnfocused: true,
    selectFromResult: ({ data, isLoading }) => ({
      doneCount: data?.filter((t) => t.completed).length ?? 0,
      isLoading,
    }),
  })

  const { data: todos = [] } = useGetTodosQuery()

  // skipToken: no request is sent until there is an id (type-safe, unlike skip: true)
  const { data: selected, error } = useGetTodoQuery(selectedId ?? skipToken)

  // lazy: request on demand
  const [loadTodo, { isFetching: lazyLoading }] = useLazyGetTodoQuery()

  const [addTodo, { isLoading: adding }] = useAddTodoMutation()
  const [toggleTodo] = useToggleTodoMutation()
  const prefetchTodo = usePrefetch('getTodo', { ifOlderThan: 30 })

  const handleAdd = async () => {
    try {
      const created = await addTodo({ title: 'From RTK Query' }).unwrap()
      console.log('created', created.id)
    } catch (e) {
      console.error('failed', e)
    }
  }

  if (isLoading) return <p>Loading…</p>

  return (
    <section>
      <p>Done: {doneCount}</p>
      {error && <p role="alert">Failed to load todo</p>}
      {selected && <h3>{selected.title}</h3>}
      <button disabled={adding} onClick={handleAdd}>
        Add
      </button>
      <ul>
        {todos.map((t) => (
          <li key={t.id} onMouseEnter={() => prefetchTodo(t.id)}>
            <input
              type="checkbox"
              checked={t.completed}
              onChange={() => toggleTodo({ id: t.id, completed: !t.completed })}
            />
            {t.title}
            <button disabled={lazyLoading} onClick={() => loadTodo(t.id, true /* preferCacheValue */)}>
              Details
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---- Infinite feed --------------------------------------------------------
export function Feed({ search }: { search: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetFeedInfiniteQuery(search)
  const items = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <>
      {items.map((t) => (
        <div key={t.id}>{t.title}</div>
      ))}
      {hasNextPage && (
        <button disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
          More
        </button>
      )}
    </>
  )
}

// ---- Streaming quotes -----------------------------------------------------
const SYMBOLS = ['AAPL', 'BTCUSD'] // stable reference, otherwise a new cache key on every render

export function Ticker() {
  const { data } = useGetQuotesQuery(SYMBOLS)
  return (
    <ul>
      {Object.values(data ?? {}).map((q) => (
        <li key={q.symbol}>
          {q.symbol}: {q.price.toFixed(2)}
        </li>
      ))}
    </ul>
  )
}
