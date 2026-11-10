import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { Apartment } from '../domain/types'
import { exits, links, turn } from '../domain/walk'
import type { Link, Side } from '../domain/walk'
import './WalkViewer.css'

const KEY = { up: 'u', right: 'r', down: 'd', left: 'l' } as const

/** Nazwy stron świata: 'down' to okna, 'up' to wejście; zależą od elewacji. */
const SIDE_NAME: Record<Apartment['facade'], Record<Side, string>> = {
  S: { down: 'południe', up: 'północ', right: 'wschód', left: 'zachód' },
  E: { down: 'wschód', up: 'zachód', right: 'północ', left: 'południe' },
}

const SWIPE_MIN = 40
const ANGLE: Record<Side, number> = { up: 0, right: 90, down: 180, left: 270 }

interface View {
  room: number
  side: Side
}

type Motion = 'none' | 'forward' | 'left' | 'right'

/** Kadr, który jest już wczytany (albo definitywnie się nie wczytał). */
interface Shown {
  url: string
  failed: boolean
  seq: number
  motion: Motion
  view: View
}

function frameUrl(apartment: Apartment, room: number, side: Side) {
  const dir = `s${apartment.slot}${apartment.balcony ? '' : 'n'}`
  return `${import.meta.env.BASE_URL}spacer/${dir}/${room}-${KEY[side]}.webp`
}

function ArrowIcon({ d }: { d: string }) {
  return (
    <svg className="walk__icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ARROW_LEFT = 'M14.5 5 L7.5 12 L14.5 19'
const ARROW_RIGHT = 'M9.5 5 L16.5 12 L9.5 19'
const ARROW_UP = 'M12 19 V6 M6 11.5 L12 5.5 L18 11.5'
const ICON_EXPAND = 'M4 9 V4 H9 M20 9 V4 H15 M4 15 V20 H9 M20 15 V20 H15'
const ICON_SHRINK = 'M9 4 V9 H4 M15 4 V9 H20 M9 20 V15 H4 M15 20 V15 H20'

export function WalkViewer({ apartment }: { apartment: Apartment }) {
  const { plan, facade } = apartment
  const all = useMemo(() => links(plan), [plan])
  const start = useMemo<View>(() => ({ room: Math.max(0, plan.findIndex((r) => r.kind === 'hol')), side: 'down' }), [plan])

  const [view, setView] = useState<View>(start)
  const [history, setHistory] = useState<View[]>([])
  const [expanded, setExpanded] = useState(false)
  const [shown, setShown] = useState<Shown | null>(null)
  const [leaving, setLeaving] = useState<Shown | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const shownRef = useRef<Shown | null>(null)
  const preloaded = useRef(new Map<string, HTMLImageElement>())
  const swipeStart = useRef<number | null>(null)

  const here = plan[view.room]
  const url = frameUrl(apartment, view.room, view.side)
  const here_exits = exits(all, view.room, view.side)
  const loading = shown?.url !== url

  const sideName = (side: Side) => SIDE_NAME[facade][side]
  const roomsOf = (list: Link[]) => list.map((l) => plan[l.to].label)
  const describe = (v: View) => {
    const names = roomsOf(exits(all, v.room, v.side))
    return `${plan[v.room].label}, widok na ${sideName(v.side)}. ${
      names.length ? `Przejścia: ${names.join(', ')}.` : 'Brak przejść w tę stronę.'
    }`
  }

  // Wczytanie kadru docelowego; do tego czasu zostaje poprzedni.
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    const commit = (failed: boolean) => {
      if (cancelled) return
      const prev = shownRef.current
      if (prev?.url === url) return
      const motion: Motion = !prev
        ? 'none'
        : prev.view.room !== view.room
          ? 'forward'
          : turn(prev.view.side, 'right') === view.side
            ? 'right'
            : 'left'
      const next: Shown = { url, failed, seq: (prev?.seq ?? 0) + 1, motion, view }
      shownRef.current = next
      setLeaving(prev ? { ...prev, motion } : null)
      setShown(next)
    }
    img.onload = () => commit(false)
    img.onerror = () => commit(true)
    img.src = url
    return () => {
      cancelled = true
    }
  }, [url, view])

  // Zapas bezpieczeństwa: stary kadr znika, nawet gdyby animacja się nie zakończyła.
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => setLeaving(null), 700)
    return () => window.clearTimeout(timer)
  }, [leaving])

  // Wyprzedzające ładowanie sąsiednich kadrów: obrót w obie strony i cele wyjść.
  useEffect(() => {
    const wanted = [
      frameUrl(apartment, view.room, turn(view.side, 'left')),
      frameUrl(apartment, view.room, turn(view.side, 'right')),
      ...exits(all, view.room, view.side).map((l) => frameUrl(apartment, l.to, view.side)),
    ]
    for (const src of wanted) {
      if (preloaded.current.has(src)) continue
      const img = new Image()
      img.src = src
      preloaded.current.set(src, img)
    }
  }, [apartment, all, view])

  // W trybie powiększonym Escape tylko zmniejsza widok, nie zamyka dialogu.
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

  const go = (next: View) => {
    if (next.room === view.room && next.side === view.side) return
    setHistory((h) => [...h, view])
    setView(next)
  }
  const rotate = (direction: 'left' | 'right') => go({ room: view.room, side: turn(view.side, direction) })
  const forward = (link: Link) => go({ room: link.to, side: view.side })
  const back = () => {
    const previous = history[history.length - 1]
    if (!previous) return
    setHistory(history.slice(0, -1))
    setView(previous)
  }
  const restart = () => {
    setHistory([])
    setView(start)
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        rotate('left')
        break
      case 'ArrowRight':
        e.preventDefault()
        rotate('right')
        break
      case 'ArrowUp':
        e.preventDefault()
        if (here_exits.length === 1) forward(here_exits[0])
        else if (here_exits.length > 1) rootRef.current?.querySelector<HTMLButtonElement>('.walk__go')?.focus()
        break
      case 'ArrowDown':
      case 'Backspace':
        e.preventDefault()
        back()
        break
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return
    swipeStart.current = e.clientX
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = swipeStart.current
    swipeStart.current = null
    if (from === null) return
    const dx = e.clientX - from
    // przeciągnięcie w lewo = obrót w prawo, jak przy panoramie
    if (Math.abs(dx) > SWIPE_MIN) rotate(dx < 0 ? 'right' : 'left')
  }

  const turnCaption = (direction: 'left' | 'right') =>
    roomsOf(exits(all, view.room, turn(view.side, direction))).join(', ')

  const renderLayer = (frame: Shown, role: 'in' | 'out') => (
    <div
      key={frame.seq}
      className={`walk__layer walk__layer--${role}-${frame.motion}`}
      aria-hidden={role === 'out' ? true : undefined}
      onAnimationEnd={(e) => {
        if (role === 'out' && e.target === e.currentTarget) setLeaving(null)
      }}
    >
      {frame.failed ? (
        <div className="walk__missing">Tego widoku jeszcze nie ma</div>
      ) : (
        <img
          className="walk__img"
          src={frame.url}
          alt={role === 'in' ? describe(frame.view) : ''}
          draggable={false}
        />
      )}
    </div>
  )

  const turnButton = (direction: 'left' | 'right') => {
    const caption = turnCaption(direction)
    return (
      <button
        type="button"
        className={`walk__btn walk__turn walk__turn--${direction}`}
        aria-label={direction === 'left' ? 'Obróć w lewo' : 'Obróć w prawo'}
        onClick={() => rotate(direction)}
      >
        <ArrowIcon d={direction === 'left' ? ARROW_LEFT : ARROW_RIGHT} />
        {caption && <span className="walk__caption">{caption}</span>}
      </button>
    )
  }

  return (
    <div ref={rootRef} className={`walk${expanded ? ' walk--expanded' : ''}`} onKeyDown={onKeyDown}>
      <div
        className="walk__frame"
        tabIndex={0}
        role="group"
        aria-label={`Spacer po mieszkaniu ${apartment.id}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null
        }}
      >
        {leaving && renderLayer(leaving, 'out')}
        {shown && renderLayer(shown, 'in')}

        {loading && <span className="walk__loading" aria-hidden="true" />}

        <p className="walk__badge">
          {here.label} · {sideName(view.side)}
        </p>

        <button
          type="button"
          className="walk__btn walk__expand"
          onClick={() => setExpanded((v) => !v)}
        >
          <ArrowIcon d={expanded ? ICON_SHRINK : ICON_EXPAND} />
          {expanded ? 'Zmniejsz' : 'Powiększ'}
        </button>

        {turnButton('left')}
        {turnButton('right')}

        <div className="walk__exits">
          {here_exits.length > 0 ? (
            here_exits.map((link) => (
              <button
                key={`${link.to}-${link.start}`}
                type="button"
                className="walk__btn walk__go"
                aria-label={`Przejdź do: ${plan[link.to].label}`}
                onClick={() => forward(link)}
              >
                <ArrowIcon d={ARROW_UP} />
                {plan[link.to].label}
              </button>
            ))
          ) : (
            <p className="walk__hint">Obróć się, żeby zobaczyć przejścia</p>
          )}
        </div>

        <p className="visually-hidden" aria-live="polite">
          {describe(view)}
        </p>
      </div>

      <div className="walk__bar">
        <div className="walk__actions">
          <button type="button" className="btn" disabled={history.length === 0} onClick={back}>
            Wstecz
          </button>
          <button type="button" className="btn" onClick={restart}>
            Od początku
          </button>
        </div>
        <MiniMap apartment={apartment} view={view} onPick={(room) => go({ room, side: view.side })} />
      </div>
    </div>
  )
}

function MiniMap({
  apartment,
  view,
  onPick,
}: {
  apartment: Apartment
  view: View
  onPick: (room: number) => void
}) {
  const { plan } = apartment
  const pad = 0.25
  const minX = Math.min(...plan.map((r) => r.x))
  const minY = Math.min(...plan.map((r) => r.y))
  const maxX = Math.max(...plan.map((r) => r.x + r.w))
  const maxY = Math.max(...plan.map((r) => r.y + r.h))
  const room = plan[view.room]
  const unit = Math.min(0.5, Math.min(room.w, room.h) / 3)

  return (
    <svg
      className="walk__map"
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      role="group"
      aria-label="Mini-mapa mieszkania"
    >
      {plan.map((r, index) => {
        const current = index === view.room
        return (
          <g
            key={index}
            className="walk__room-hit"
            role="button"
            tabIndex={0}
            aria-label={`Przejdź do: ${r.label}`}
            aria-current={current ? 'true' : undefined}
            onClick={() => onPick(index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onPick(index)
              }
            }}
          >
            <title>{r.label}</title>
            <rect
              className={`walk__room walk__room--${r.kind}${current ? ' walk__room--current' : ''}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
            />
          </g>
        )
      })}
      <g
        className="walk__pos"
        transform={`translate(${room.x + room.w / 2} ${room.y + room.h / 2}) rotate(${ANGLE[view.side]})`}
        aria-hidden="true"
      >
        <path className="walk__cone" d={`M0 0 L${-unit * 1.1} ${-unit * 2.2} L${unit * 1.1} ${-unit * 2.2} Z`} />
        <circle className="walk__dot" r={unit * 0.45} />
      </g>
    </svg>
  )
}
