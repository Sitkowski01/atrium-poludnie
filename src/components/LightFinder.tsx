import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { STATUS_LABEL, floorLabel, formatArea, formatHour, formatPrice, roomsLabel } from '../domain/format'
import { MOMENTS, homeHours, matchMoments, onlySoldMatch, summarizeMatches, type Moment } from '../domain/light'
import { DAY_START, DAY_END, sunAt, sunWindow } from '../domain/sun'
import { useCountUp } from '../hooks/useCountUp'
import { useStore, type Spotlight } from '../state/store'
import './ApartmentList.css'
import './LightFinder.css'
import './SunBar.css'

const SHOWN = 5
const position = (from: number, to: number) => ({
  left: `${(from - DAY_START) / (DAY_END - DAY_START) * 100}%`,
  width: `${(to - from) / (DAY_END - DAY_START) * 100}%`,
})

function MatchBar({ sun, moments }: { sun: ReturnType<typeof sunWindow>; moments: readonly Moment[] }) {
  return <span className="sunbar__track light__flat-bar" aria-hidden="true">
    {moments.map((m) => <span key={m.id} className="light__bar-home" style={position(m.from, m.to)} />)}
    {sun && <span className="sunbar__sun" style={position(sun.from, sun.to)} />}
    {sun && moments.map((m) => {
      const from = Math.max(m.from, sun.from)
      const to = Math.min(m.to, sun.to)
      return to > from ? <span key={m.id} className="light__bar-overlap" style={position(from, to)} /> : null
    })}
  </span>
}
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
  const { apartments, dispatch } = useStore()
  const [picked, setPicked] = useState<string[]>(['poranek', 'popoludnie'])
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
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
  const shown = expanded ? matches : matches.slice(0, SHOWN)
  const commonResult = shown.length > 1 && shown.every((match) =>
    hoursText(match.share) === hoursText(shown[0].share) &&
    formatHour(match.firstSunAt) === formatHour(shown[0].firstSunAt),
  )
  const orderedShown = commonResult
    ? [...shown].sort((a, b) => b.apartment.floor - a.apartment.floor || a.apartment.price - b.apartment.price)
    : shown
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
        ? { ids: matches.map((m) => m.apartment.id), label: `Słońce, kiedy jesteś w domu: ${moments.map((m) => m.label.toLowerCase()).join(', ')}` }
        : null,
    [matches, moments],
  )
  const ours = useRef<Spotlight | null>(null)
  useEffect(() => {
    if (inView && spot) {
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
    setExpanded(false)
    const on = picked.includes(m.id)
    setPicked((p) => (on ? p.filter((id) => id !== m.id) : [...p, m.id]))
    // bryła pokazuje światło w środku właśnie włączonej pory
    if (!on) dispatch({ type: 'setHour', hour: Math.round(((m.from + m.to) / 2) * 20) / 20, byUser: true })
  }

  const evening = picked.length === 1 && picked[0] === 'wieczor'

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
                ? `Pokazane mieszkania: ${hoursText(shown[0].share)}; słońce od ${formatHour(shown[0].firstSunAt)} w Twoich godzinach.`
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

        {commonResult && <p className="light__order">kolejność: wyżej piętro, potem niższa cena</p>}
        {matches.length > 0 && (
          <ol className="light__list" id={listId}>
            {orderedShown.map(({ apartment: a, share, firstSunAt }) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="apt-list__main light__flat"
                  aria-haspopup="dialog"
                  onClick={() => dispatch({ type: 'select', id: a.id })}
                  onMouseEnter={() => dispatch({ type: 'hover', id: a.id })}
                  onMouseLeave={() => dispatch({ type: 'hover', id: null })}
                  onFocus={() => dispatch({ type: 'hover', id: a.id })}
                  onBlur={() => dispatch({ type: 'hover', id: null })}
                >
                  <span className="apt-list__number">
                    <span className="apt-list__id">{a.id}</span>
                    <span className={`badge badge--${a.status}`}>{STATUS_LABEL[a.status]}</span>
                  </span>
                  <span className="apt-list__info">
                  <span className="apt-list__facts">
                    {[roomsLabel(a.rooms), formatArea(a.area), floorLabel(a.floor)].map((fact) =>
                      <span className="apt-list__fact" key={fact}>{fact}</span>,
                    )}
                  </span>
                  <span className="light__flat-timeline">
                    <MatchBar sun={sunWindow(a.facade, a.floor)} moments={moments} />
                    {!commonResult && <span className="light__flat-reason">
                      słońce od {formatHour(firstSunAt)}
                      <span className="visually-hidden"> w Twoich godzinach; przy remisie wcześniej znaczy wyżej</span>
                    </span>}
                  </span>
                  </span>
                  <span className="apt-list__price">
                    {!commonResult && <span className="light__flat-share">
                      {hoursText(share)}
                    </span>}
                    <strong>{formatPrice(a.price)}</strong>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {matches.length > 0 && (
          <p className="light__bar-legend">
            <span className="light__keys">
              <span className="light__key"><span className="sunbar__sun light__key-sun" aria-hidden="true" />słońce w salonie</span>
              <span className="light__key"><span className="light__key-home" aria-hidden="true" />jesteś w domu</span>
            </span>
          </p>
        )}
        <div className="light__links">
        {matches.length > SHOWN && (
          <button type="button" className="btn apt-list__more" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Zwiń listę' : `Pokaż wszystkie ${matches.length} →`}
          </button>
        )}
        {matches.length > 0 && (
          <a className="light__building-link" href="#budynek" onClick={(event) => {
            const building = document.getElementById('budynek')
            if (!building) return
            event.preventDefault()
            const reduce = typeof window.matchMedia === 'function' &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches
            building.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' })
            building.focus({ preventScroll: true })
          }}>
            Zobacz na bryle ↑
          </a>
        )}
        </div>
      </div>
    </div>
  )
}
