import { useEffect, useMemo, useRef, useState } from 'react'
import { floorLabel, formatArea, formatHour, formatPrice, roomsLabel } from '../domain/format'
import { MOMENTS, matchMoments, type Moment } from '../domain/light'
import { sunAt, sunWindow } from '../domain/sun'
import { useCountUp } from '../hooks/useCountUp'
import { useStore, type Spotlight } from '../state/store'
import { SunBar } from './SunBar'
import './LightFinder.css'

const SHOWN = 5

/** „1 mieszkanie”, „3 mieszkania”, „12 mieszkań” */
const flats = (n: number) => {
  if (n === 1) return 'mieszkanie'
  const d = n % 10
  const t = n % 100
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? 'mieszkania' : 'mieszkań'
}

/** mała tarcza na łuku: gdzie jest słońce w środku tej pory dnia */
function MomentGlyph({ m }: { m: Moment }) {
  const mid = (m.from + m.to) / 2
  const t = (sunAt(mid).azimuth - 50) / 260
  const el = Math.max(0, sunAt(mid).elevation) / 60
  const x = 24 + 20 * Math.cos(Math.PI * (1 - t))
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
  const moments = useMemo(() => MOMENTS.filter((m) => picked.includes(m.id)), [picked])
  const matches = useMemo(() => matchMoments(apartments, moments), [apartments, moments])
  const shownCount = Math.round(useCountUp(matches.length, { duration: 700 }))
  const wants = useMemo(() => moments.map((m) => [m.from, m.to] as const), [moments])

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
      moments.length
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

      <div className="light__result" aria-live="polite">
        {moments.length === 0 ? (
          <p className="light__empty">Zaznacz choć jedną porę dnia.</p>
        ) : (
          <>
            <p className="light__count">
              <span className="light__num" aria-hidden="true">
                {shownCount}
              </span>
              <span className="light__count-text">
                <span className="visually-hidden">{matches.length} </span>
                {flats(matches.length)} ma słońce w&nbsp;salonie przez większość czasu, kiedy jesteś w&nbsp;domu
              </span>
            </p>
            {matches.length === 0 && (
              <p className="light__note">
                {evening
                  ? 'Wieczorem słońce stoi na zachodzie, a okna salonów wychodzą tu na południe i wschód. Wieczorne światło złapiesz na balkonie od południa — dobierz też poranek albo popołudnie.'
                  : 'W tych godzinach słońce nie wpada do salonów. Spróbuj dodać inną porę dnia.'}
              </p>
            )}
          </>
        )}

        {matches.length > 0 && (
          <ol className="light__list">
            {matches.slice(0, SHOWN).map(({ apartment: a, share }) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="light__flat"
                  aria-haspopup="dialog"
                  onClick={() => dispatch({ type: 'select', id: a.id })}
                  onMouseEnter={() => dispatch({ type: 'hover', id: a.id })}
                  onMouseLeave={() => dispatch({ type: 'hover', id: null })}
                  onFocus={() => dispatch({ type: 'hover', id: a.id })}
                  onBlur={() => dispatch({ type: 'hover', id: null })}
                >
                  <span className="light__flat-id">{a.id}</span>
                  <span className="light__flat-facts">
                    {roomsLabel(a.rooms)} · {formatArea(a.area)} · {floorLabel(a.floor)}
                  </span>
                  <SunBar sun={sunWindow(a.facade, a.floor)} wants={wants} className="light__flat-bar" />
                  <span className="light__flat-share">
                    {Math.round(share * 100)}%<span className="visually-hidden"> czasu w domu ze słońcem</span>
                  </span>
                  <span className="light__flat-price">{formatPrice(a.price)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {matches.length > SHOWN && (
          <p className="light__more">
            i jeszcze {matches.length - SHOWN} — wszystkie są podświetlone na bryle
          </p>
        )}
      </div>
    </div>
  )
}
