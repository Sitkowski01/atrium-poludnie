import { countActive } from '../domain/filter'
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

export function FilterBar() {
  const { state, dispatch, limits } = useStore()
  const { filters, favourites } = state
  const active = countActive(filters, limits)
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
      <fieldset className="filter-bar__group">
        <legend className="filter-bar__label">Pokoje</legend>
        <div className="filter-bar__chips">
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
      </fieldset>

      <fieldset className="filter-bar__group">
        <legend className="filter-bar__label">Ekspozycja</legend>
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
      </fieldset>

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
          aria-valuetext={`od ${formatArea(filters.areaMin)}`}
          onChange={(e) =>
            dispatch({ type: 'setFilters', patch: { areaMin: Number(e.target.value) } })
          }
        />
      </label>

      <fieldset className="filter-bar__group">
        <legend className="filter-bar__label">Piętro</legend>
        <div className="filter-bar__floors">
          <label className="field">
            <span className="field__label">od</span>
            <select value={filters.floorMin} onChange={(e) => setFloorMin(Number(e.target.value))}>
              {floors.map((f) => (
                <option key={f} value={f}>
                  {floorLabel(f)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">do</span>
            <select value={filters.floorMax} onChange={(e) => setFloorMax(Number(e.target.value))}>
              {floors.map((f) => (
                <option key={f} value={f}>
                  {floorLabel(f)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <div className="filter-bar__group filter-bar__checks">
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

      {active > 0 && (
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
    </section>
  )
}
