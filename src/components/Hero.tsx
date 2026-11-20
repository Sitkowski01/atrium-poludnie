import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useCountUp } from '../hooks/useCountUp'
import { formatDuration, formatHour, freeLabel } from '../domain/format'
import { sunWindow, type SunWindow } from '../domain/sun'
import type { Facade } from '../domain/types'
import { useHour, useStore, type Spotlight } from '../state/store'
import { SunBar } from './SunBar'
import './Hero.css'

const thousands = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 })

/** piętro, dla którego rozkład jest podany: to samo co w kartach typów */
const REF_FLOOR = 3

interface Line {
  facade: Facade
  name: string
  sun: SunWindow | null
  free: number
  spot: Spotlight
}

function reduceMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** „w słońcu do 18:20” / „słońce od 7:40” / „po słońcu” — dla godziny z suwaka */
function status(sun: SunWindow | null, hour: number): { text: string; on: boolean } {
  if (!sun) return { text: 'bez słońca', on: false }
  if (hour < sun.from) return { text: `słońce od ${formatHour(sun.from)}`, on: false }
  if (hour <= sun.to) return { text: `w słońcu do ${formatHour(sun.to)}`, on: true }
  return { text: `słońce było do ${formatHour(sun.to)}`, on: false }
}

/**
 * Rozkład słońca: dwie elewacje jak dwa kursy w rozkładzie jazdy. Kreska to godzina z suwaka pod
 * bryłą, więc tablica żyje razem z budynkiem; najechanie podświetla tę stronę na bryle.
 */
function SunTimetable({ lines }: { lines: Line[] }) {
  const { hour } = useHour()
  const { dispatch } = useStore()
  // najechanie i fokus osobno: odsunięcie myszy nie gasi wiersza, który ma fokus z klawiatury
  const [hovered, setHovered] = useState<Facade | null>(null)
  const [focused, setFocused] = useState<Facade | null>(null)
  const active = lines.find((l) => l.facade === (hovered ?? focused)) ?? null
  const spot = active?.spot ?? null

  // jedno podświetlenie naraz, zawsze sprzątane przy zmianie i odmontowaniu
  useEffect(() => {
    if (!spot) return
    dispatch({ type: 'spotlight', spot })
    return () => dispatch({ type: 'spotlight', spot: null, owner: spot })
  }, [spot, dispatch])

  const pick = (line: Line) => {
    setHovered(null)
    dispatch({ type: 'resetFilters' })
    dispatch({ type: 'setFilters', patch: { facade: line.facade } })
    const target = document.getElementById('mieszkania')
    if (target) {
      target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
      target.focus({ preventScroll: true })
    }
  }

  return (
    <section className="timetable" aria-labelledby="rozklad-title">
      <header className="timetable__head">
        <h2 className="timetable__title" id="rozklad-title">
          Rozkład słońca
        </h2>
        <span className="timetable__meta">salon · {REF_FLOOR}. piętro</span>
        <span className="timetable__clock" aria-hidden="true">
          teraz<strong>{formatHour(hour)}</strong>
        </span>
      </header>
      <ol className="timetable__lines">
        {lines.map((line) => {
          const st = status(line.sun, hour)
          return (
            <li key={line.facade}>
              <button
                type="button"
                className={`timetable__line${st.on ? ' is-on' : ''}`}
                onMouseEnter={() => setHovered(line.facade)}
                onMouseLeave={() => setHovered((h) => (h === line.facade ? null : h))}
                onFocus={() => setFocused(line.facade)}
                onBlur={() => setFocused((f) => (f === line.facade ? null : f))}
                onClick={() => pick(line)}
              >
                <span className="timetable__name">{line.name}</span>
                <span className="timetable__hours">
                  {line.sun ? (
                    <>
                      {formatHour(line.sun.from)}
                      <span className="timetable__arrow" aria-hidden="true">
                        –
                      </span>
                      <span className="visually-hidden"> do </span>
                      {formatHour(line.sun.to)}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
                <SunBar sun={line.sun} now={hour} className="timetable__bar" />
                <span className="timetable__status">
                  <span className="timetable__dot" aria-hidden="true" />
                  {st.text}
                </span>
                <span className="timetable__free">
                  {line.sun ? `${formatDuration(line.sun.total)} · ` : ''}
                  {freeLabel(line.free)}
                  <span className="visually-hidden">. Pokaż w wyszukiwarce mieszkania od tej strony</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="timetable__axis" aria-hidden="true">
        <span>5:00</span>
        <span>13:00</span>
        <span>21:00</span>
      </div>
    </section>
  )
}

export function Hero() {
  const { apartments, limits } = useStore()
  const free = apartments.filter((a) => a.status === 'wolne')
  const cheapest = Math.min(...free.map((a) => a.price))
  // liczby dochodzą przy wejściu; czytnik dostaje od razu wartość końcową
  const freeShown = Math.round(useCountUp(free.length, { from: 0, duration: 1100 }))
  const priceShown = Math.round(useCountUp(cheapest / 1000, { from: (cheapest / 1000) * 0.6, duration: 1100 }))

  const lines = useMemo<Line[]>(
    () =>
      (['S', 'E'] as const).map((facade) => {
        const list = apartments.filter((a) => a.facade === facade)
        const name = facade === 'S' ? 'Południe' : 'Wschód'
        return {
          facade,
          name,
          sun: sunWindow(facade, REF_FLOOR),
          free: list.filter((a) => a.status === 'wolne').length,
          spot: { ids: list.map((a) => a.id), label: `Okna od ${facade === 'S' ? 'południa' : 'wschodu'}` },
        }
      }),
    [apartments],
  )

  const goTo = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
    target.focus({ preventScroll: true })
  }

  return (
    <header className="hero">
      <p className="hero__kicker">
        <span className="hero__kicker-num">01</span>
        <span>Budynek</span>
        <span className="hero__kicker-meta">Szczecin · odbiór 2027</span>
      </p>
      <h1 className="hero__title">
        Dom, w&nbsp;którym <em>słońce</em>&nbsp;ma swój rozkład.
      </h1>
      <p className="hero__lead">
        {apartments.length} mieszkań od południa i wschodu. Przesuń porę dnia pod bryłą i zobacz, do których salonów
        wchodzi światło — potem przejdź się po wnętrzu w 360°.
      </p>

      <SunTimetable lines={lines} />

      <div className="hero__foot">
        <a className="btn btn--primary hero__cta" href="#mieszkania" onClick={goTo('mieszkania')}>
          Wybierz mieszkanie
          <span aria-hidden="true">→</span>
        </a>
        <dl className="hero__facts">
          <div>
            <dt>wolnych</dt>
            <dd>
              <span aria-hidden="true">{freeShown}</span>
              <span className="visually-hidden">{free.length}</span>
            </dd>
          </div>
          <div>
            <dt>
              <span className="hero__facts-long">cena </span>od
            </dt>
            <dd>
              <span aria-hidden="true">{thousands.format(priceShown)} tys. zł</span>
              <span className="visually-hidden">{thousands.format(cheapest)} zł</span>
            </dd>
          </div>
          <div>
            <dt>metraż</dt>
            <dd>
              {limits.areaMin}–{limits.areaMax}&nbsp;m²
            </dd>
          </div>
        </dl>
      </div>
    </header>
  )
}
