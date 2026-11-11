import { useEffect, useRef } from 'react'
import { activeFilterChips } from '../domain/activeFilters'
import { useStore } from '../state/store'
import './ActiveFilters.css'

interface Props {
  /** gdzie przenieść fokus, gdy po usunięciu nie zostaje żaden chip */
  onEmptyFocus?: () => void
}

export function ActiveFilters({ onEmptyFocus }: Props) {
  const { state, dispatch, limits } = useStore()
  const chips = activeFilterChips(state.filters, limits)
  const listRef = useRef<HTMLUListElement>(null)
  // fokus po następnym renderze: id chipa albo true = lista została pusta
  const pendingFocus = useRef<string | true | null>(null)

  useEffect(() => {
    const pending = pendingFocus.current
    if (pending === null) return
    pendingFocus.current = null
    if (pending !== true) {
      const el = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-chip]') ?? []).find(
        (n) => n.dataset.chip === pending,
      )
      if (el) {
        el.focus()
        return
      }
    }
    onEmptyFocus?.()
  }, [chips, onEmptyFocus])

  if (chips.length === 0) return null

  return (
    <ul ref={listRef} className="active-filters" aria-label="Aktywne filtry">
      {chips.map((chip, i) => (
        <li key={chip.id}>
          <button
            type="button"
            className="active-filters__chip"
            data-chip={chip.id}
            aria-label={`Usuń filtr: ${chip.label}`}
            onClick={(e) => {
              if (document.activeElement === e.currentTarget) {
                const neighbour = chips[i + 1] ?? chips[i - 1]
                pendingFocus.current = neighbour ? neighbour.id : true
              }
              dispatch({ type: 'setFilters', patch: chip.patch })
            }}
          >
            {chip.label}
            <span className="active-filters__x" aria-hidden="true">
              ×
            </span>
          </button>
        </li>
      ))}
      {chips.length >= 2 && (
        <li>
          <button
            type="button"
            className="active-filters__clear"
            onClick={() => {
              // przycisk zaraz zniknie — fokus przechodzi na nagłówek listy
              onEmptyFocus?.()
              dispatch({ type: 'resetFilters' })
            }}
          >
            Wyczyść wszystkie
          </button>
        </li>
      )}
    </ul>
  )
}
