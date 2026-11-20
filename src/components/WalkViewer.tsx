import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Apartment } from '../domain/types'
import { SIDES, links, viewpoint } from '../domain/walk'
import type { Link, Side } from '../domain/walk'
import { PanoView, type Hotspot } from './PanoView'
import './WalkViewer.css'

/** Nazwy stron świata: 'down' to okna, 'up' to wejście; zależą od elewacji. */
const SIDE_NAME: Record<Apartment['facade'], Record<Side, string>> = {
  S: { down: 'południe', up: 'północ', right: 'wschód', left: 'zachód' },
  E: { down: 'wschód', up: 'zachód', right: 'północ', left: 'południe' },
}

/** Kąt patrzenia dla strony rzutu: 0 = w stronę wejścia, 90 = w prawo, 180 = okna. */
const ANGLE: Record<Side, number> = { up: 0, right: 90, down: 180, left: 270 }
const LEAVE_MS = 240

interface View {
  room: number
  /** stopnie, bez zawijania — dzięki temu obrót zawsze idzie krótszą drogą */
  yaw: number
}

const mod360 = (a: number) => ((a % 360) + 360) % 360
/** najkrótsza różnica kątów, w zakresie -180..180 */
const delta = (from: number, to: number) => ((to - from + 540) % 360) - 180
const sideOf = (yaw: number): Side => SIDES[Math.round(mod360(yaw) / 90) % 4]

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function ArrowIcon({ d }: { d: string }) {
  return (
    <svg className="walk__icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ARROW_LEFT = 'M14.5 5 L7.5 12 L14.5 19'
const ARROW_RIGHT = 'M9.5 5 L16.5 12 L9.5 19'
const ICON_EXPAND = 'M4 9 V4 H9 M20 9 V4 H15 M4 15 V20 H9 M20 15 V20 H15'
const ICON_SHRINK = 'M9 4 V9 H4 M15 4 V9 H20 M9 20 V15 H4 M15 20 V15 H20'

export function WalkViewer({ apartment }: { apartment: Apartment }) {
  const { plan, facade } = apartment
  const all = useMemo(() => links(plan), [plan])
  const start = useMemo<View>(
    () => ({ room: Math.max(0, plan.findIndex((r) => r.kind === 'hol')), yaw: ANGLE.down }),
    [plan],
  )

  const [view, setView] = useState<View>(start)
  const [pitch, setPitch] = useState(0)
  const [history, setHistory] = useState<View[]>([])
  const [expanded, setExpanded] = useState(false)
  const [animate, setAnimate] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const pending = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const dir = `s${apartment.slot}${apartment.balcony ? '' : 'n'}`
  const panoUrl = (room: number) => `${import.meta.env.BASE_URL}pano/${dir}/${room}.webp`

  const here = plan[view.room]
  // panorama jest zrobiona z punktu widzenia przy wejściu, nie ze środka pokoju
  const center = viewpoint(plan, view.room, all)
  const doors = all.filter((l) => l.from === view.room)

  /** kierunek i odległość środka przejścia, widziane ze środka pomieszczenia */
  const bearing = (l: Link) => {
    const mid = (l.start + l.end) / 2
    const px = l.side === 'up' || l.side === 'down' ? mid : l.at
    const py = l.side === 'up' || l.side === 'down' ? l.at : mid
    const dx = px - center.x
    const dy = py - center.y
    return { angle: (Math.atan2(dx, -dy) * 180) / Math.PI, distance: Math.hypot(dx, dy) }
  }

  // wczytaj z wyprzedzeniem panoramy sąsiednich pomieszczeń
  useEffect(() => {
    for (const l of all.filter((x) => x.from === view.room)) {
      new Image().src = panoUrl(l.to)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, view.room, dir])

  useEffect(
    () => () => {
      if (pending.current !== null) window.clearTimeout(pending.current)
    },
    [],
  )

  // w trybie powiększonym Escape tylko zmniejsza widok, nie zamyka dialogu
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setExpanded(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [expanded])

  // powiększony spacer jest nakładką na cały ekran: reszta panelu nie może łapać fokusu spod spodu
  useEffect(() => {
    if (!expanded) return
    const root = rootRef.current
    const body = root?.closest('.detail__body')
    if (!root || !body) return
    const marked: Element[] = []
    for (const child of Array.from(body.children)) {
      if (child.contains(root) || child.hasAttribute('inert')) continue
      child.setAttribute('inert', '')
      marked.push(child)
    }
    return () => {
      for (const child of marked) child.removeAttribute('inert')
    }
  }, [expanded])

  const moveTo = (next: View, remember: boolean) => {
    if (leaving) return
    const commit = () => {
      pending.current = null
      // punkty przejść w panoramie zmieniają key po ruchu i giną razem z fokusem — przenieś go na kadr;
      // chipy pomieszczeń pod kadrem zostają, więc fokus na nich zostaje tam, gdzie był
      const active = document.activeElement
      if (active === document.body || (active && frameRef.current?.contains(active))) {
        frameRef.current?.focus({ preventScroll: true })
      }
      if (remember) setHistory((h) => [...h, view])
      setAnimate(false)
      setPitch(0)
      setView(next)
      setLeaving(false)
    }
    if (reducedMotion()) return commit()
    setLeaving(true)
    pending.current = window.setTimeout(commit, LEAVE_MS)
  }

  /** przejście przez drzwi: patrzysz dalej w kierunku, w którym szedłeś */
  /**
   * Przez drzwi patrzysz dalej w stronę ruchu. W łazience od razu na umywalkę z lustrem:
   * stoi przy górnej ścianie, w rogu przeciwnym do drzwi (tak układa ją blender/wnetrze.py).
   */
  const through = (l: Link) => {
    const room = plan[l.to]
    if (room.kind !== 'lazienka') return moveTo({ room: l.to, yaw: ANGLE[l.side] }, true)
    const cam = viewpoint(plan, l.to, all)
    // l.side to strona pomieszczenia, z którego wychodzisz: 'left' = drzwi w prawej ścianie łazienki
    const tx = l.side === 'left' ? room.x + 0.65 : room.x + room.w - 0.65
    const ty = room.y + 0.3
    const yaw = (Math.atan2(tx - cam.x, -(ty - cam.y)) * 180) / Math.PI
    return moveTo({ room: l.to, yaw }, true)
  }
  const jump = (room: number) => {
    if (room !== view.room) moveTo({ room, yaw: mod360(view.yaw) }, true)
  }
  const rotate = (degrees: number) => {
    setAnimate(!reducedMotion())
    setView((v) => ({ ...v, yaw: v.yaw + degrees }))
  }
  const back = () => {
    const previous = history[history.length - 1]
    if (!previous || leaving) return
    setHistory(history.slice(0, -1))
    moveTo(previous, false)
  }
  const restart = () => {
    if (leaving) return
    setHistory([])
    moveTo(start, false)
  }

  /** przejście najbliższe kierunkowi patrzenia, jeśli mieści się w polu widzenia */
  const ahead = () => {
    const ranked = doors
      .map((l) => ({ l, off: Math.abs(delta(mod360(view.yaw), mod360(bearing(l).angle))) }))
      .sort((a, b) => a.off - b.off)
    return ranked[0] && ranked[0].off <= 50 ? ranked[0].l : null
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        rotate(-45)
        break
      case 'ArrowRight':
        e.preventDefault()
        rotate(45)
        break
      case 'ArrowUp': {
        e.preventDefault()
        const link = ahead()
        if (link) through(link)
        break
      }
      case 'ArrowDown':
      case 'Backspace':
        e.preventDefault()
        back()
        break
    }
  }

  const sideName = SIDE_NAME[facade][sideOf(view.yaw)]
  const doorNames = doors.map((l) => plan[l.to].label)
  const announce = `${here.label}. ${doorNames.length ? `Przejścia: ${doorNames.join(', ')}.` : 'Brak przejść.'}`

  const hotspots: Hotspot[] = doors.map((l) => ({
    key: `${view.room}-${l.to}`,
    ...bearing(l),
    label: plan[l.to].label,
    onGo: () => through(l),
  }))

  // Te same inicjały co na mapie; np. K może oznaczać kuchnię i korytarz.
  const mapKey = new Map<string, Set<string>>()
  for (const room of plan) {
    const initial = room.label.slice(0, 1).toLocaleUpperCase('pl-PL')
    const labels = mapKey.get(initial) ?? new Set<string>()
    labels.add(room.label.toLocaleLowerCase('pl-PL'))
    mapKey.set(initial, labels)
  }

  return (
    <div ref={rootRef} className={`walk${expanded ? ' walk--expanded' : ''}`} onKeyDown={onKeyDown}>
      <div ref={frameRef} className="walk__frame" tabIndex={0} role="group" aria-label={`Spacer po mieszkaniu ${apartment.id}`}>
        <PanoView
          key={`${dir}-${view.room}`}
          src={panoUrl(view.room)}
          yaw={view.yaw}
          pitch={pitch}
          animate={animate}
          leaving={leaving}
          alt={`${here.label}, panorama 360 stopni`}
          hotspots={hotspots}
          onLook={(yaw, nextPitch) => {
            setAnimate(false)
            setPitch(nextPitch)
            setView((v) => ({ ...v, yaw }))
          }}
        />

        <p className="walk__badge">
          {here.label} · {sideName}
        </p>

        <button
          type="button"
          className="walk__btn walk__expand"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <ArrowIcon d={expanded ? ICON_SHRINK : ICON_EXPAND} />
          {expanded ? 'Zmniejsz' : 'Powiększ'}
        </button>

        <button
          type="button"
          className="walk__btn walk__turn walk__turn--left"
          aria-label="Obróć w lewo"
          onClick={() => rotate(-90)}
        >
          <ArrowIcon d={ARROW_LEFT} />
        </button>
        <button
          type="button"
          className="walk__btn walk__turn walk__turn--right"
          aria-label="Obróć w prawo"
          onClick={() => rotate(90)}
        >
          <ArrowIcon d={ARROW_RIGHT} />
        </button>

        <p className="walk__hint" aria-hidden="true">
          Przeciągnij, żeby się rozejrzeć
        </p>

        <p className="visually-hidden" aria-live="polite">
          {announce}
        </p>
      </div>

      <div className="walk__bar">
        {/* wszystkie pomieszczenia jak legenda mini-mapy: sąsiednie przez drzwi, dalsze skokiem */}
        <div className="walk__side">
          <p className="walk__label" id={`${apartment.id}-rooms`}>
            Pomieszczenia
            <span>
              {view.room + 1} / {plan.length}
            </span>
          </p>
          <ul className="walk__rooms" aria-labelledby={`${apartment.id}-rooms`}>
            {plan.map((r, i) => {
              const door = doors.find((l) => l.to === i)
              const here = i === view.room
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={`chip walk__room-chip${door ? ' is-door' : ''}`}
                    aria-pressed={here}
                    onClick={() => (door ? through(door) : jump(i))}
                  >
                    {r.label}
                    {door && <span className="visually-hidden"> (przejście obok)</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="walk__actions">
            <button type="button" className="walk__link" disabled={history.length === 0} onClick={back}>
              <span aria-hidden="true">← </span>
              Wstecz
            </button>
            <button type="button" className="walk__link" onClick={restart}>
              Od początku
            </button>
          </div>
        </div>
        <MiniMap apartment={apartment} room={view.room} at={center} yaw={view.yaw} onPick={jump} />
        <p className="walk__map-key">
          {Array.from(mapKey, ([initial, labels]) => `${initial} ${Array.from(labels).join(' / ')}`).join(' · ')}
        </p>
      </div>
    </div>
  )
}

function MiniMap({
  apartment,
  room: current,
  at,
  yaw,
  onPick,
}: {
  apartment: Apartment
  room: number
  at: { x: number; y: number }
  yaw: number
  onPick: (room: number) => void
}) {
  const { plan } = apartment
  const pad = 0.25
  const minX = Math.min(...plan.map((r) => r.x))
  const minY = Math.min(...plan.map((r) => r.y))
  const maxX = Math.max(...plan.map((r) => r.x + r.w))
  const maxY = Math.max(...plan.map((r) => r.y + r.h))
  const room = plan[current]
  const unit = Math.min(0.5, Math.min(room.w, room.h) / 3)

  return (
    <svg
      className="walk__map"
      style={{ '--map-label-size': `${(maxX - minX + pad * 2) * 12 / 160}px` } as CSSProperties}
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      // skrót dla myszy; klawiatura i czytniki mają tę samą nawigację w liście przejść pod kadrem
      aria-hidden="true"
    >
      {plan.map((r, index) => (
        <g
          key={index}
          className="walk__room-hit"
          onClick={() => onPick(index)}
        >
          <title>{r.label}</title>
          <rect
            className={`walk__room walk__room--${r.kind}${index === current ? ' walk__room--current' : ''}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
          />
          <text className="walk__initial" x={r.x + r.w / 2} y={r.y + r.h / 3} aria-hidden="true">
            {r.label.slice(0, 1).toLocaleUpperCase('pl-PL')}
          </text>
        </g>
      ))}
      <g
        className="walk__pos"
        transform={`translate(${at.x} ${at.y}) rotate(${yaw})`}
        aria-hidden="true"
      >
        <path className="walk__cone" d={`M0 0 L${-unit * 1.3} ${-unit * 2.2} L${unit * 1.3} ${-unit * 2.2} Z`} />
        <circle className="walk__dot" r={unit * 0.45} />
      </g>
    </svg>
  )
}
