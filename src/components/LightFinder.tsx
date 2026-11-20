import { useEffect, useMemo, useRef, useState } from 'react'
import { floorLabel, formatArea, formatHour, formatPrice, roomsLabel } from '../domain/format'
import { MATCH_FROM, MOMENTS, homeHours, matchMoments, onlySoldMatch, summarizeMatches, type Moment } from '../domain/light'
import { sunAt, sunShare, sunWindow } from '../domain/sun'
import { useCountUp } from '../hooks/useCountUp'
import { useStore, type Spotlight } from '../state/store'
import { SunBar } from './SunBar'
import { tweenHour } from '../state/tweenHour'
import './LightFinder.css'

const hoursFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 })
const FACADE_NAMES = {
  S: { from: 'od południa', subject: 'Południe' },
  E: { from: 'od wschodu', subject: 'Wschód' },
}

/** „1 mieszkanie”, „3 mieszkania”, „12 mieszkań” */
const flats = (n: number) => {
  if (n === 1) return 'mieszkanie'
  const d = n % 10
  const t = n % 100
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? 'mieszkania' : 'mieszkań'
}

/** „ma” / „mają” — zgodnie z liczbą mieszkań: 1 ma, 2–4 mają, 5+ ma */
const has = (n: number) => {
  const d = n % 10
  const t = n % 100
  return n !== 1 && d >= 2 && d <= 4 && (t < 12 || t > 14) ? 'mają' : 'ma'
}

/** mała tarcza na łuku: gdzie jest słońce w środku tej pory dnia */
function MomentGlyph({ m }: { m: Moment }) {
  const mid = (m.from + m.to) / 2
  const t = (sunAt(mid).azimuth - 50) / 260
  const el = Math.max(0, sunAt(mid).elevation) / 60
  // jak na bryle: słońce wschodzi po prawej, zachodzi po lewej
  const x = 24 - 20 * Math.cos(Math.PI * (1 - t))
  const y = 24 - 18 * el
  return (
    <svg className="light__glyph" viewBox="0 0 48 28" aria-hidden="true">
      <path d="M4 24 A20 18 0 0 1 44 24" />
      <line x1="2" y1="24.5" x2="46" y2="24.5" />
      <circle cx={x} cy={y} r="3.6" />
    </svg>
  )
}

/**
 * „Kiedy jesteś w domu?” — zaznaczasz pory, które spędzasz w domu, a strona liczy, w których
 * mieszkaniach słońce wpada wtedy do salonu (te same godziny co na bryle i w wyszukiwarce).
 * Bryła po prawej podświetla dopasowane mieszkania i przestawia porę dnia na wybraną porę.
 */
export function LightFinder() {
  const { apartments, state, dispatch } = useStore()
  // jeden wybór pór na całej stronie: kafle to filtr „W domu” wyszukiwarki (ten sam stan w sklepie)
  const picked = state.filters.home
  const moments = useMemo(() => MOMENTS.filter((m) => picked.includes(m.id)), [picked])
  const totalHours = homeHours(moments)
  const hoursText = (share: number) => `${hoursFormat.format(share * totalHours)} / ${hoursFormat.format(totalHours)} h w słońcu`
  const matches = useMemo(() => matchMoments(apartments, moments), [apartments, moments])
  const summary = useMemo(() => summarizeMatches(apartments, moments, matches), [apartments, moments, matches])
  const facadeName = summary.wholeFacade ? FACADE_NAMES[summary.wholeFacade].from : null
  // dlaczego druga elewacja odpada: słońce kończy się za wcześnie albo zaczyna za późno
  const missedFacade = summary.missed[0]
  const missedWindow = missedFacade ? sunWindow(missedFacade.facade, 3) : null
  const homeFrom = moments.length ? Math.min(...moments.map((m) => m.from)) : 0
  const comparison = !missedFacade
    ? ''
    : !missedWindow
      ? `${FACADE_NAMES[missedFacade.facade].subject} nie ma wtedy słońca w salonie.`
      : missedWindow.from > homeFrom + 1
        ? `${FACADE_NAMES[missedFacade.facade].subject} dostaje słońce do salonu dopiero od ${formatHour(missedWindow.from)}, więc w tych godzinach przegrywa.`
        : `${FACADE_NAMES[missedFacade.facade].subject} ma słońce w salonie tylko do ${formatHour(missedWindow.to)}, więc przy tylu godzinach w domu odpada.`
  const shownCount = Math.round(useCountUp(matches.length, { duration: 700 }))
  const soldOnly = useMemo(() => onlySoldMatch(apartments, moments), [apartments, moments])
  // Wspólne podsumowanie dotyczy wszystkich dopasowanych mieszkań.
  const commonResult = matches.length > 1 && matches.every((match) =>
    hoursText(match.share) === hoursText(matches[0].share) &&
    formatHour(match.firstSunAt) === formatHour(matches[0].firstSunAt),
  )
  const bestHours = matches.length ? hoursFormat.format(Math.max(...matches.map((m) => m.share)) * totalHours) : ''

  // bryła reaguje tylko wtedy, gdy rozdział jest na ekranie; po wyjściu oddajemy ją innym
  const root = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '-30% 0px -30% 0px', threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const spot = useMemo<Spotlight | null>(
    () =>
      matches.length
        ? { ids: matches.map((m) => m.apartment.id), label: `W domu: ${moments.map((m) => m.label.toLowerCase()).join(', ')}` }
        : null,
    [matches, moments],
  )
  // jeden zegar na stronie: wejście w rozdział przestawia porę dnia na pierwszą zaznaczoną porę w domu
  // (suwak pod bryłą nie stoi na 10:00, kiedy kafle mówią „poranek”)
  const pickedRef = useRef(picked)
  pickedRef.current = picked
  useEffect(() => {
    if (!inView) return
    const first = MOMENTS.find((m) => pickedRef.current.includes(m.id))
    if (!first) return
    tweenHour(Math.round(((first.from + first.to) / 2) * 20) / 20, (h) => dispatch({ type: 'setHour', hour: h, byUser: true }))
  }, [inView, dispatch])
  const ours = useRef<Spotlight | null>(null)
  useEffect(() => {
    if (inView && spot) {
      // nowy wybór pór zastępuje poprzedni wpis zamiast odkładać go na stosie (inaczej po wyjściu z rozdziału
      // bryła wracała do starego wyboru)
      if (ours.current && ours.current !== spot) dispatch({ type: 'spotlight', spot: null, owner: ours.current })
      ours.current = spot
      dispatch({ type: 'spotlight', spot })
    } else if (ours.current) {
      dispatch({ type: 'spotlight', spot: null, owner: ours.current })
      ours.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, spot])
  useEffect(
    () => () => {
      if (ours.current) dispatch({ type: 'spotlight', spot: null, owner: ours.current })
    },
    [dispatch],
  )

  const toggle = (m: Moment) => {
    const on = picked.includes(m.id)
    const next = on ? picked.filter((id) => id !== m.id) : [...picked, m.id]
    dispatch({ type: 'setFilters', patch: { home: MOMENTS.map((x) => x.id).filter((id) => next.includes(id)) } })
    // bryła pokazuje światło w środku właśnie włączonej pory
    if (!on) {
      dispatch({ type: 'cancelIntro' })
      tweenHour(Math.round(((m.from + m.to) / 2) * 20) / 20, (h) => dispatch({ type: 'setHour', hour: h, byUser: true }))
    }
  }

  const goToSearch = () => {
    dispatch({ type: 'resetFilters' })
    dispatch({ type: 'setFilters', patch: { home: picked, onlyAvailable: true } })
    dispatch({ type: 'setSort', sort: 'sun-home' })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = document.getElementById('mieszkania')
    target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    target?.focus({ preventScroll: true })
  }

  const evening = picked.length === 1 && picked[0] === 'wieczor'
  // dowód zamiast gołej liczby, z różnicą widoczną gołym okiem: najlepsze dopasowanie, najlepsze z innym
  // wynikiem (zwykle druga elewacja) i dla porównania mieszkanie, które odpada — z ile godzin mu brakuje
  const examples = useMemo(() => {
    const total = homeHours(moments)
    if (!matches.length || total <= 0) return []
    const label = (share: number) => hoursFormat.format(share * total)
    const best = matches[0]
    const other = matches.find((m) => label(m.share) !== label(best.share)) ??
      matches.find((m) => m.apartment.slot !== best.apartment.slot)
    const shown = new Set([best.apartment.id, other?.apartment.id])
    const miss = apartments
      .filter((a) => a.status !== 'sprzedane' && !shown.has(a.id))
      .map((a) => ({
        apartment: a,
        share: moments.reduce((sum, m) => sum + sunShare(a.facade, a.floor, m.from, m.to) * (m.to - m.from), 0) / total,
      }))
      .filter((m) => m.share < MATCH_FROM)
      .sort((x, y) => y.share - x.share || y.apartment.floor - x.apartment.floor)[0]
    return [
      { ...best, miss: false },
      ...(other ? [{ ...other, miss: false }] : []),
      ...(miss ? [{ ...miss, miss: true }] : []),
    ]
  }, [matches, moments, apartments])
  const homeBands = useMemo(() => moments.map((m) => [m.from, m.to] as const), [moments])

  return (
    <div className="light" ref={root}>
      <fieldset className="light__moments">
        <legend className="light__legend">Zaznacz pory, które spędzasz w domu</legend>
        {MOMENTS.map((m) => {
          const on = picked.includes(m.id)
          return (
            <button
              key={m.id}
              type="button"
              className={`light__moment${on ? ' is-on' : ''}`}
              aria-pressed={on}
              title={m.note}
              onClick={() => toggle(m)}
            >
              <MomentGlyph m={m} />
              <span className="light__moment-label">{m.label}</span>
              <span className="light__moment-time">
                {formatHour(m.from)}–{formatHour(m.to)}
              </span>
              <span className="light__moment-note">{m.note}</span>
            </button>
          )
        })}
      </fieldset>

      <p className="visually-hidden" aria-live="polite">
        {moments.length === 0
          ? 'Zaznacz choć jedną porę dnia.'
          : matches.length > 0
            ? `${matches.length} ${flats(matches.length)} ${has(matches.length)} słońce w salonie przez większość czasu, kiedy jesteś w domu${facadeName ? `, wszystkie dostępne ${facadeName}` : ''}.`
            : soldOnly
              ? 'Takie mieszkania są, ale już sprzedane — dobierz inną porę dnia.'
              : 'Żadne mieszkanie nie ma słońca w salonie przez większość czasu, kiedy jesteś w domu.'}
      </p>

      <div className="light__result">
        {moments.length === 0 ? (
          <p className="light__empty">Zaznacz choć jedną porę dnia.</p>
        ) : (
          <>
            <p className="light__count" aria-hidden="true">
              <span className="light__num">{shownCount}</span>
              <span className="light__count-text">
                {flats(shownCount)} {has(shownCount)} słońce w&nbsp;salonie przez większość czasu, kiedy jesteś w&nbsp;domu
              </span>
            </p>
            {matches.length > 0 && <p className="light__common">
              {commonResult
                ? `Każde z nich: ${hoursText(matches[0].share)}; słońce od ${formatHour(matches[0].firstSunAt)} w Twoich godzinach.`
                : `Najwięcej: ${bestHours} z ${hoursFormat.format(totalHours)} godzin w domu przy słońcu.`}
            </p>}
            {matches.length > 0 && facadeName && (
              <p className="light__note">
                Pasują wszystkie dostępne mieszkania {facadeName}. {comparison}
              </p>
            )}
            {matches.length === 0 && (
              <p className="light__note">
                {soldOnly
                  ? 'Takie mieszkania są, ale już sprzedane — dobierz inną porę dnia.'
                  : evening
                    ? 'Wieczorem słońce stoi na zachodzie, a okna salonów wychodzą tu na południe i wschód. Wieczorne światło złapiesz na balkonie od południa — dobierz też poranek albo popołudnie.'
                    : 'W tych godzinach słońce nie wpada do salonów. Spróbuj dodać inną porę dnia.'}
              </p>
            )}
          </>
        )}

        {examples.length > 0 && (
          <>
          <p className="light__keys" aria-hidden="true">
            <span className="light__key"><span className="light__key-sun" />słońce w salonie</span>
            <span className="light__key"><span className="light__key-home" />jesteś w domu</span>
          </p>
          <ul className="light__examples" aria-label="Przykładowe mieszkania">
            {examples.map(({ apartment: a, share, miss }) => (
              <li key={a.id} className={miss ? 'light__example-miss' : undefined}>
                {miss && (
                  <span className="light__example-note">
                    dla porównania — odpada
                    {/* ta sama strona co najlepsze, ale nisko: słońce zasłania budynek obok */}
                    {a.facade === examples[0].apartment.facade && a.floor <= 1 && a.floor < examples[0].apartment.floor
                      ? ': nisko, w cieniu budynku obok'
                      : ''}
                  </span>
                )}
                <button type="button" className="light__example" onClick={() => dispatch({ type: 'select', id: a.id })}>
                  <span className="light__example-id">{a.id}</span>
                  <span className="light__example-meta">
                    {roomsLabel(a.rooms)} · {formatArea(a.area)} · {floorLabel(a.floor)}
                  </span>
                  <SunBar sun={sunWindow(a.facade, a.floor)} home={homeBands} className="light__example-bar" />
                  <span className="light__example-share">
                    {miss ? 'tylko ' : ''}{hoursFormat.format(share * totalHours)} z {hoursFormat.format(totalHours)} h w słońcu
                  </span>
                  <span className="light__example-price">{formatPrice(a.price)}</span>
                </button>
              </li>
            ))}
          </ul>
          </>
        )}

        {matches.length > 0 && (
          <button type="button" className="btn btn--primary light__search" onClick={goToSearch}>
            Pokaż {matches.length === 1 ? 'to' : 'te'} {matches.length} {flats(matches.length)} w wyszukiwarce →
          </button>
        )}
      </div>
    </div>
  )
}
