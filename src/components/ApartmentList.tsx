import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import {
  FACADE_LABEL,
  STATUS_LABEL,
  floorLabel,
  formatArea,
  formatHour,
  formatPrice,
  roomsLabel,
} from '../domain/format'
import { sunWindow } from '../domain/sun'
import type { SortKey } from '../domain/types'
import { useStore } from '../state/store'
import './ApartmentList.css'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'price-asc', label: 'Cena rosnąco' },
  { value: 'price-desc', label: 'Cena malejąco' },
  { value: 'area-desc', label: 'Największe' },
  { value: 'floor-desc', label: 'Najwyższe piętro' },
]

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      className="apt-list__sun-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EmptyArt() {
  const windows = [0, 1, 2].flatMap((row) => [0, 1].map((col) => ({ row, col })))
  return (
    <svg
      className="apt-list__empty-art"
      viewBox="0 0 96 96"
      width="96"
      height="96"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 86h80" fill="none" stroke="var(--line-2)"strokeWidth="2" strokeLinecap="round" />
      <rect
        x="24"
        y="14"
        width="48"
        height="72"
        rx="3"
        fill="none"
        stroke="var(--line-2)"
        strokeWidth="2"
      />
      {windows.map(({ row, col }) => (
        <rect
          key={`${row}-${col}`}
          x={33 + col * 18}
          y={24 + row * 16}
          width="12"
          height="10"
          rx="1.5"
          fill="none"
          stroke="var(--line-2)"
          strokeWidth="2"
        />
      ))}
      <rect x="42" y="68" width="12" height="18" rx="1.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  )
}

const NARROW_QUERY = '(max-width: 980px)'
const COLLAPSED_ROWS = 8

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

export function ApartmentList() {
  const { state, dispatch, visible, apartments } = useStore()
  const { hoveredId, selectedId, favourites } = state
  const listRef = useRef<HTMLUListElement>(null)
  const pointerInside = useRef(false)
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  const favRefs = useRef(new Map<string, HTMLButtonElement>())
  const countRef = useRef<HTMLParagraphElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const narrow = useNarrow()
  // kaskada wejścia tylko przy pierwszym renderze listy, nie przy zmianie filtrów
  const intro = useRef(true)
  useEffect(() => {
    intro.current = false
  }, [])
  const [expanded, setExpanded] = useState(false)
  const justCollapsed = useRef(false)
  // wiersz, którego serce miało fokus w chwili usuwania z listy „Tylko ulubione”
  const pendingFocus = useRef<{ id: string; next: string | null; prev: string | null } | null>(null)

  const collapsible = narrow && visible.length > COLLAPSED_ROWS
  const shown = collapsible && !expanded ? visible.slice(0, COLLAPSED_ROWS) : visible

  useEffect(() => {
    if (!justCollapsed.current) return
    justCollapsed.current = false
    const btn = moreRef.current
    if (btn && btn.getBoundingClientRect().top < 0) btn.scrollIntoView({ block: 'nearest' })
  }, [expanded])

  useEffect(() => {
    const pending = pendingFocus.current
    if (!pending) return
    pendingFocus.current = null
    if (visible.some((a) => a.id === pending.id)) return
    const target =
      (pending.next && favRefs.current.get(pending.next)) ||
      (pending.prev && favRefs.current.get(pending.prev)) ||
      countRef.current
    target?.focus()
  }, [visible])

  // Najechanie przyszło spoza listy (bryła budynku) — pokaż wiersz.
  useEffect(() => {
    if (!hoveredId || pointerInside.current) return
    const list = listRef.current
    if (list && list.contains(document.activeElement)) return
    const row = rowRefs.current.get(hoveredId)
    // przewijamy tylko samą listę i tylko gdy ma własne przewijanie — nigdy okno
    if (!row || !list || list.scrollHeight <= list.clientHeight) return
    const r = row.getBoundingClientRect()
    const l = list.getBoundingClientRect()
    if (r.top < l.top) list.scrollTop -= l.top - r.top + 8
    else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom + 8
  }, [hoveredId])

  const isEmpty = visible.length === 0
  useEffect(() => {
    // lista znika z kursorem w środku i nie dostaje mouseleave
    if (isEmpty) pointerInside.current = false
  }, [isEmpty])

  return (
    <section className="apt-list" aria-label="Lista mieszkań">
      <div className="apt-list__head">
        <p className="apt-list__count" aria-live="polite" ref={countRef} tabIndex={-1}>
          <strong>{visible.length}</strong> z {apartments.length} mieszkań
        </p>
        <label className="apt-list__sort">
          <span className="apt-list__sort-label">Sortuj</span>
          <select
            value={state.sort}
            onChange={(e) => dispatch({ type: 'setSort', sort: e.target.value as SortKey })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="apt-list__empty">
          <EmptyArt />
          <h2 className="apt-list__empty-title">Nic tu nie pasuje</h2>
          <p>Żadne mieszkanie nie spełnia tych filtrów. Poluzuj cenę albo metraż.</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              // przycisk zaraz zniknie — fokus przechodzi na licznik wyników
              countRef.current?.focus()
              dispatch({ type: 'resetFilters' })
            }}
          >
            Wyczyść filtry
          </button>
        </div>
      ) : (
        <>
        <ul
          ref={listRef}
          id={listId}
          className={`apt-list__items${intro.current ? ' apt-list__items--intro' : ''}`}
          onMouseEnter={() => {
            pointerInside.current = true
          }}
          onMouseLeave={() => {
            pointerInside.current = false
          }}
        >
          {shown.map((a, index) => {
            const sun = sunWindow(a.facade, a.floor)
            const fav = favourites.includes(a.id)
            const cls = [
              'apt-list__item',
              a.id === hoveredId && 'apt-list__item--hover',
              a.id === selectedId && 'apt-list__item--selected',
              a.status === 'sprzedane' && 'apt-list__item--sold',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <li
                key={a.id}
                className={cls}
                style={{ '--i': Math.min(index, 8) } as CSSProperties}
                ref={(el) => {
                  if (el) rowRefs.current.set(a.id, el)
                  else rowRefs.current.delete(a.id)
                }}
                onMouseEnter={() => dispatch({ type: 'hover', id: a.id })}
                onMouseLeave={() => dispatch({ type: 'hover', id: null })}
                onFocus={() => dispatch({ type: 'hover', id: a.id })}
                onBlur={() => dispatch({ type: 'hover', id: null })}
              >
                <button
                  type="button"
                  className="apt-list__main"
                  aria-haspopup="dialog"
                  onClick={() => dispatch({ type: 'select', id: a.id })}
                >
                  <span className="apt-list__id">{a.id}</span>
                  <span className="apt-list__info">
                    <span className="apt-list__facts">
                      {[
                        [roomsLabel(a.rooms), formatArea(a.area)],
                        [floorLabel(a.floor), FACADE_LABEL[a.facade]],
                      ].map((row, ri) => (
                        <span key={ri} className="apt-list__facts-row">
                          {row.map((fact, fi) => (
                            <span key={fi} className="apt-list__fact">
                              {fact}
                              {ri === 0 && <span className="visually-hidden">, </span>}
                              {ri === 1 && fi === 0 && <span className="visually-hidden">, </span>}
                            </span>
                          ))}
                        </span>
                      ))}
                    </span>
                    <span className="apt-list__sun">
                      {sun && <SunIcon />}
                      {sun
                        ? `słońce ${formatHour(sun.from)}–${formatHour(sun.to)}`
                        : 'bez bezpośredniego słońca'}
                    </span>
                    <span className={`badge badge--${a.status}`}>{STATUS_LABEL[a.status]}</span>
                  </span>
                  <span className="apt-list__price">
                    <strong>{formatPrice(a.price)}</strong>
                    <span className="apt-list__ppm">{formatPrice(a.pricePerM2)}/m²</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`apt-list__fav${fav ? ' apt-list__fav--on' : ''}`}
                  aria-pressed={fav}
                  aria-label={
                    fav
                      ? `Usuń mieszkanie ${a.id} z ulubionych`
                      : `Dodaj mieszkanie ${a.id} do ulubionych`
                  }
                  ref={(el) => {
                    if (el) favRefs.current.set(a.id, el)
                    else favRefs.current.delete(a.id)
                  }}
                  onClick={(e) => {
                    if (
                      state.filters.onlyFavourites &&
                      fav &&
                      document.activeElement === e.currentTarget
                    ) {
                      const i = visible.findIndex((v) => v.id === a.id)
                      pendingFocus.current = {
                        id: a.id,
                        next: visible[i + 1]?.id ?? null,
                        prev: visible[i - 1]?.id ?? null,
                      }
                    }
                    dispatch({ type: 'toggleFavourite', id: a.id })
                  }}
                >
                  <Heart filled={fav} />
                </button>
              </li>
            )
          })}
        </ul>
        {collapsible && (
          <button
            type="button"
            ref={moreRef}
            className="btn btn--ghost apt-list__more"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => {
              if (expanded) justCollapsed.current = true
              setExpanded(!expanded)
            }}
          >
            {expanded ? 'Zwiń listę' : `Pokaż wszystkie (${visible.length})`}
          </button>
        )}
        </>
      )}
    </section>
  )
}
