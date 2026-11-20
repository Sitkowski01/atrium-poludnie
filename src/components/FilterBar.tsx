import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { countActive } from '../domain/filter'
import { MOMENTS } from '../domain/light'
import { floorLabel, formatArea, formatPrice } from '../domain/format'
import type { Facade } from '../domain/types'
import { useStore } from '../state/store'
import './FilterBar.css'

const ROOM_OPTIONS = [1, 2, 3, 4]

const FACADE_OPTIONS: { value: Facade | 'all'; label: string }[] = [
  { value: 'all', label: 'Obie' },
  { value: 'S', label: 'Południe' },
  { value: 'E', label: 'Wschód' },
]

const NARROW_QUERY = '(max-width: 980px)'

function matchNarrow(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  try {
    return window.matchMedia(NARROW_QUERY)
  } catch {
    return null
  }
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => matchNarrow()?.matches ?? false)
  useEffect(() => {
    const mq = matchNarrow()
    if (!mq) return
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M3 6h7M14 6h3M3 14h3M10 14h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="14" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function FilterBar() {
  const { state, dispatch, limits } = useStore()
  const { filters, favourites } = state
  const active = countActive(filters, limits)
  const narrow = useNarrow()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const collapsed = narrow && !open
  const floors = Array.from({ length: limits.floorMax + 1 }, (_, i) => i)

  const toggleRoom = (n: number) => {
    const rooms = filters.rooms.includes(n)
      ? filters.rooms.filter((r) => r !== n)
      : [...filters.rooms, n].sort((a, b) => a - b)
    dispatch({ type: 'setFilters', patch: { rooms } })
  }

  const setFloorMin = (v: number) =>
    dispatch({
      type: 'setFilters',
      patch: { floorMin: v, floorMax: Math.max(v, filters.floorMax) },
    })

  const setFloorMax = (v: number) =>
    dispatch({
      type: 'setFilters',
      patch: { floorMax: v, floorMin: Math.min(v, filters.floorMin) },
    })

  return (
    <section className="filter-bar" aria-label="Filtry mieszkań">
      {narrow && (
        <div className="filter-bar__top">
          <button
            type="button"
            ref={toggleRef}
            className="btn filter-bar__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
          >
            <SlidersIcon />
            Filtry
            {active > 0 && (
              <>
                <span className="filter-bar__badge" aria-hidden="true">
                  {active}
                </span>
                <span className="visually-hidden">, aktywnych: {active}</span>
              </>
            )}
          </button>
          {active > 0 && (
            <button
              type="button"
              className="btn btn--ghost filter-bar__clear"
              onClick={() => {
                // przycisk zaraz zniknie — fokus wraca na przełącznik
                toggleRef.current?.focus()
                dispatch({ type: 'resetFilters' })
              }}
            >
              Wyczyść
            </button>
          )}
        </div>
      )}
      <div
        id={panelId}
        className={`filter-bar__panel${collapsed ? '' : ' filter-bar__panel--open'}`}
        inert={collapsed}
      >
        <div className="filter-bar__body">
      <div className="filter-bar__home" role="group" aria-labelledby={`${panelId}-home`}>
        <span className="filter-bar__label" id={`${panelId}-home`}>W domu</span>
        <div className="filter-bar__chips filter-bar__home-chips">
          {MOMENTS.map((m) => (
            <button
              key={m.id}
              type="button"
              className="chip"
              aria-pressed={filters.home.includes(m.id)}
              onClick={() => dispatch({ type: 'setFilters', patch: {
                home: filters.home.includes(m.id)
                  ? filters.home.filter((id) => id !== m.id)
                  : [...filters.home, m.id],
              } })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-bar__group filter-bar__group--wide" role="group" aria-labelledby={`${panelId}-rooms`}>
        <span className="filter-bar__label" id={`${panelId}-rooms`}>Pokoje</span>
        <div className="filter-bar__chips">
          <button
            type="button"
            className="chip"
            aria-pressed={filters.rooms.length === 0}
            onClick={() => dispatch({ type: 'setFilters', patch: { rooms: [] } })}
          >
            Dowolne
          </button>
          {ROOM_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className="chip"
              aria-pressed={filters.rooms.includes(n)}
              onClick={() => toggleRoom(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-bar__group" role="group" aria-labelledby={`${panelId}-facade`}>
        <span className="filter-bar__label" id={`${panelId}-facade`}>Ekspozycja</span>
        <div className="filter-bar__chips">
          {FACADE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className="chip"
              aria-pressed={filters.facade === o.value}
              onClick={() => dispatch({ type: 'setFilters', patch: { facade: o.value } })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <label className="filter-bar__group">
        <span className="filter-bar__label filter-bar__label--row">
          Cena do <strong>{formatPrice(filters.priceMax)}</strong>
        </span>
        <input
          type="range"
          min={limits.priceMin}
          max={limits.priceMax}
          step={10000}
          value={filters.priceMax}
          style={{ '--pct': `${limits.priceMax > limits.priceMin ? (filters.priceMax - limits.priceMin) / (limits.priceMax - limits.priceMin) * 100 : 0}%` } as CSSProperties}
          aria-valuetext={formatPrice(filters.priceMax)}
          onChange={(e) =>
            dispatch({ type: 'setFilters', patch: { priceMax: Number(e.target.value) } })
          }
        />
      </label>

      <label className="filter-bar__group">
        <span className="filter-bar__label filter-bar__label--row">
          Metraż od <strong>{formatArea(filters.areaMin)}</strong>
        </span>
        <input
          type="range"
          min={limits.areaMin}
          max={limits.areaMax}
          step={1}
          value={filters.areaMin}
          style={{ '--pct': `${limits.areaMax > limits.areaMin ? (filters.areaMin - limits.areaMin) / (limits.areaMax - limits.areaMin) * 100 : 0}%` } as CSSProperties}
          aria-valuetext={`od ${formatArea(filters.areaMin)}`}
          onChange={(e) =>
            dispatch({ type: 'setFilters', patch: { areaMin: Number(e.target.value) } })
          }
        />
      </label>

      <div className="filter-bar__group" role="group" aria-labelledby={`${panelId}-floor`}>
        <span className="filter-bar__label" id={`${panelId}-floor`}>Piętro</span>
        <div className="filter-bar__floors">
          <label className="field">
            <span className="visually-hidden">Piętro od</span>
            <select value={filters.floorMin} onChange={(e) => setFloorMin(Number(e.target.value))}>
              {floors.map((f) => (
                <option key={f} value={f}>
                  {floorLabel(f)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="visually-hidden">Piętro do</span>
            <select value={filters.floorMax} onChange={(e) => setFloorMax(Number(e.target.value))}>
              {floors.map((f) => (
                <option key={f} value={f}>
                  {floorLabel(f)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="filter-bar__group filter-bar__checks" role="group" aria-labelledby={`${panelId}-show`}>
        <span className="filter-bar__label" id={`${panelId}-show`}>Pokaż</span>
        <div className="filter-bar__check-options">
        <label className="filter-bar__check">
          <input
            type="checkbox"
            checked={filters.onlyAvailable}
            onChange={(e) =>
              dispatch({ type: 'setFilters', patch: { onlyAvailable: e.target.checked } })
            }
          />
          Ukryj sprzedane
        </label>
        <label className="filter-bar__check">
          <input
            type="checkbox"
            checked={filters.onlyFavourites}
            onChange={(e) =>
              dispatch({ type: 'setFilters', patch: { onlyFavourites: e.target.checked } })
            }
          />
          Tylko ulubione ({favourites.length})
        </label>
        </div>
      </div>

      {active > 0 && !narrow && (
        <div className="filter-bar__reset">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={(e) => {
              // przycisk zaraz zniknie — fokus wraca na pierwszą kontrolkę filtrów
              e.currentTarget.closest('.filter-bar')?.querySelector<HTMLElement>('button')?.focus()
              dispatch({ type: 'resetFilters' })
            }}
          >
            Wyczyść filtry ({active})
          </button>
        </div>
      )}
        </div>
      </div>
    </section>
  )
}
