import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { FLOORS } from '../domain/data'
import { nextInGrid, type GridItem } from '../domain/gridNav'
import { STATUS_LABEL, floorLabel, formatArea, formatPrice, roomsLabel } from '../domain/format'
import { DAY_END, DAY_START, SUN_THRESHOLD, directSun, facadeLight, sunAt } from '../domain/sun'
import type { Apartment, Facade } from '../domain/types'
import { useStore } from '../state/store'
import './Building.css'

/* ---------- rzut izometryczny ----------
   Patrzymy od południowego wschodu. Narożnik południowo-wschodni jest z przodu,
   elewacja południowa biegnie od niego w lewo, wschodnia w prawo. */
const C = 0.866
const S = 0.5
const L = 104 // długość jednego mieszkania wzdłuż elewacji
const HF = 48 // wysokość kondygnacji
const HT = FLOORS * HF
const CX = 350
const CY = 560
const VB = { x: -50, y: -70, w: 740, h: 720 }
const PLOT = 60 // margines działki wokół budynku
const PLOT_T = 14 // grubość podstawy makiety
const LEN: Record<Facade, number> = { S: 3 * L, E: 2 * L }

type P = [number, number]

/** punkt na elewacji: d = odległość od przedniego narożnika, z = wysokość */
const pt = (f: Facade, d: number, z: number): P => [CX + (f === 'S' ? -d : d) * C, CY - d * S - z]
/** przesunięcie prostopadle od elewacji na zewnątrz */
const out = (f: Facade, p: P, k: number): P => [p[0] + (f === 'S' ? -C : C) * k, p[1] + S * k]
/** punkt na ziemi: e = na wschód, n = na północ od przedniego narożnika */
const ground = (e: number, n: number): P => [CX + (e + n) * C, CY + (e - n) * S]
const poly = (ps: P[]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
const quad = (f: Facade, d0: number, d1: number, z0: number, z1: number) =>
  poly([pt(f, d0, z0), pt(f, d1, z0), pt(f, d1, z1), pt(f, d0, z1)])

function span(a: Apartment): [number, number] {
  return a.facade === 'S' ? [(2 - a.slot) * L, (3 - a.slot) * L] : [(a.slot - 3) * L, (a.slot - 2) * L]
}

/* ---------- kolory ---------- */
type RGB = [number, number, number]
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t) as RGB
const css = (c: RGB) => `rgb(${c.map(Math.round).join(' ')})`

const K = {
  skyTopNight: hex('#232a52'),
  skyTopDay: hex('#8fc6ea'),
  skyLowNight: hex('#454775'),
  skyLowDay: hex('#e6f2f7'),
  skyWarm: hex('#f9bb86'),
  skyDusk: hex('#c98f9a'),
  wallGold: hex('#ffd49a'),
  wallNight: hex('#3d4160'),
  wallShade: hex('#cbbda6'),
  wallLit: hex('#fdf5e4'),
  roofNight: hex('#2c3048'),
  roofShade: hex('#a79f8f'),
  roofLit: hex('#ded6c4'),
  glassShade: hex('#5b7386'),
  glassLit: hex('#cfe6f2'),
  glassDark: hex('#262c44'),
  glassWarm: hex('#ffd681'),
  groundNight: hex('#2a3140'),
  groundDay: hex('#cdd7b8'),
  treeNight: hex('#1d2a2b'),
  treeDay: hex('#6b9967'),
}

function hull(points: P[]): P[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (src: P[]) => {
    const h: P[] = []
    for (const q of src) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop()
      h.push(q)
    }
    return h.slice(0, -1)
  }
  return [...half(p), ...half([...p].reverse())]
}

const TREES: [number, number][] = [
  [-345, -30],
  [-350, 170],
  [42, 238],
]

const PLOT_PTS: P[] = [
  ground(-LEN.S - PLOT, -PLOT),
  ground(70, -PLOT),
  ground(70, LEN.E + PLOT),
  ground(-LEN.S - PLOT, LEN.E + PLOT),
]
const down = (p: P): P => [p[0], p[1] + PLOT_T]

const cellLabel = (a: Apartment, dim: boolean) =>
  `${dim ? 'Poza filtrami: ' : ''}Mieszkanie ${a.id}, ${roomsLabel(a.rooms)}, ${formatArea(a.area)}, ${floorLabel(a.floor)}, ${formatPrice(a.price)}, ${STATUS_LABEL[a.status]}`

export function Building() {
  const { apartments, visibleIds, state, dispatch } = useStore()
  // jeden przystanek Tab na całą bryłę; między mieszkaniami chodzi się strzałkami
  const grid = useMemo<GridItem[]>(
    () => apartments.map((a) => ({ id: a.id, row: a.floor, col: a.slot })),
    [apartments],
  )
  const [activeId, setActiveId] = useState(() => `${FLOORS - 1}.01`)
  const cellRefs = useRef(new Map<string, SVGGElement>())
  const sun = sunAt(state.hour)
  const day = sun.daylight
  const t = (state.hour - DAY_START) / (DAY_END - DAY_START)
  // 1 przy horyzoncie, 0 gdy słońce jest wysoko — steruje ciepłem nieba i ścian
  const warm = Math.max(0, 1 - Math.max(0, sun.elevation) / 36)

  const skyTop = css(mix(mix(K.skyTopNight, K.skyTopDay, day), K.skyDusk, warm * 0.5))
  const skyLow = css(mix(mix(K.skyLowNight, K.skyLowDay, day), K.skyWarm, warm * 0.9))
  const wallLit = mix(K.wallLit, K.wallGold, warm * 0.7)
  const light: Record<Facade, number> = { S: facadeLight('S', state.hour), E: facadeLight('E', state.hour) }
  const ambient = mix(K.wallNight, K.wallShade, day)
  // to samo kryterium co lista i wykres: bez bezpośredniego słońca pole zostaje w cieniu
  const lit = (a: Apartment) =>
    directSun(a.facade, a.floor, state.hour) > SUN_THRESHOLD ? light[a.facade] : 0
  const wall = (a: Apartment) => css(mix(ambient, wallLit, lit(a)))
  const roof = css(
    mix(mix(K.roofNight, K.roofShade, day), K.roofLit, day * Math.sin((Math.max(0, sun.elevation) * Math.PI) / 180)),
  )
  const groundFill = css(mix(K.groundNight, K.groundDay, day))
  const treeFill = css(mix(K.treeNight, K.treeDay, day))
  const plotSideA = css(mix(K.groundNight, hex('#a9b196'), day))
  const plotSideB = css(mix(K.groundNight, hex('#8f977f'), day))

  const glass = (a: Apartment) => {
    const dayGlass = mix(K.glassShade, K.glassLit, lit(a))
    const someoneHome = a.status !== 'wolne' && (a.floor * 3 + a.slot * 5) % 4 !== 0
    return css(mix(dayGlass, someoneHome ? K.glassWarm : K.glassDark, 1 - day))
  }

  // cień bryły na ziemi
  let shadow: string | null = null
  if (sun.elevation > 2) {
    const len = Math.min(HT / Math.tan((sun.elevation * Math.PI) / 180), 520)
    const az = (sun.azimuth * Math.PI) / 180
    const de = -len * Math.sin(az)
    const dn = -len * Math.cos(az)
    const base: [number, number][] = [
      [0, 0],
      [-LEN.S, 0],
      [0, LEN.E],
      [-LEN.S, LEN.E],
    ]
    shadow = poly(hull([...base.map(([e, n]) => ground(e, n)), ...base.map(([e, n]) => ground(e + de, n + dn))]))
  }

  const sunX = 630 - t * 640
  const sunY = 70 - 120 * Math.sin(Math.PI * t)

  const hovered = apartments.find((a) => a.id === state.hoveredId) ?? null
  const selectedId = state.selectedId

  // od góry do dołu — taka sama kolejność dla klawiatury
  const ordered = [...apartments].sort((a, b) => b.floor - a.floor || a.slot - b.slot)

  const roofPts: P[] = [
    pt('S', LEN.S, HT),
    pt('S', 0, HT),
    pt('E', LEN.E, HT),
    [CX + (LEN.E - LEN.S) * C, CY - (LEN.S + LEN.E) * S - HT],
  ]
  const roofCenter: P = [
    (roofPts[0][0] + roofPts[2][0]) / 2,
    (roofPts[0][1] + roofPts[2][1]) / 2,
  ]
  const inset = roofPts.map(
    (p): P => [roofCenter[0] + (p[0] - roofCenter[0]) * 0.78, roofCenter[1] + (p[1] - roofCenter[1]) * 0.78],
  )

  let tip: { x: number; y: number; a: Apartment } | null = null
  if (hovered) {
    const [d0, d1] = span(hovered)
    const z1 = (hovered.floor + 1) * HF
    const a = pt(hovered.facade, d0, z1)
    const b = pt(hovered.facade, d1, z1)
    tip = {
      x: Math.min(Math.max((a[0] + b[0]) / 2, VB.x + 118), VB.x + VB.w - 118),
      y: Math.max(Math.min(a[1], b[1]) - 72, VB.y + 6),
      a: hovered,
    }
  }

  return (
    <div className="building">
      <div
        className="building__canvas"
        style={{ background: `linear-gradient(${skyTop}, ${skyLow} 62%)` }}
      >
        <p className="building__hint">Kliknij mieszkanie na elewacji</p>
        <svg
          className="building__svg"
          viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
          role="group"
          aria-label="Bryła budynku. Każde mieszkanie jest przyciskiem; strzałki przechodzą między mieszkaniami."
        >
          <defs>
            <radialGradient id="b-glow">
              <stop offset="0" stopColor="#fff3c4" stopOpacity="0.95" />
              <stop offset="0.35" stopColor="#f6c860" stopOpacity="0.55" />
              <stop offset="1" stopColor="#f6c860" stopOpacity="0" />
            </radialGradient>
            <clipPath id="b-plot">
              <polygon points={poly(PLOT_PTS)} />
            </clipPath>
          </defs>

          {/* słońce */}
          <g aria-hidden="true">
            <circle cx={sunX} cy={sunY} r="70" fill="url(#b-glow)" />
            <circle cx={sunX} cy={sunY} r="19" fill="#fff0b8" />
          </g>

          {/* ziemia, cień, drzewa za budynkiem */}
          <g aria-hidden="true">
            <polygon points={poly([PLOT_PTS[0], PLOT_PTS[1], down(PLOT_PTS[1]), down(PLOT_PTS[0])])} fill={plotSideA} />
            <polygon points={poly([PLOT_PTS[1], PLOT_PTS[2], down(PLOT_PTS[2]), down(PLOT_PTS[1])])} fill={plotSideB} />
            <polygon points={poly(PLOT_PTS)} fill={groundFill} />
            {shadow && <polygon points={shadow} fill="#1d1b18" opacity={0.26 * day} clipPath="url(#b-plot)" />}
            <text
              className="building__compass"
              transform={`translate(${ground(-LEN.S / 2, -46)[0]} ${ground(-LEN.S / 2, -46)[1]}) rotate(30)`}
              textAnchor="middle"
            >
              POŁUDNIE
            </text>
            <text
              className="building__compass"
              transform={`translate(${ground(46, LEN.E / 2)[0]} ${ground(46, LEN.E / 2)[1]}) rotate(-30)`}
              textAnchor="middle"
            >
              WSCHÓD
            </text>
          </g>

          {/* drzewa — rysowane przed bryłą, stoją z boku i z tyłu */}
          <g aria-hidden="true">
            {TREES.map(([e, n]) => {
              const p = ground(e, n)
              return (
                <g key={`${e}_${n}`}>
                  <ellipse cx={p[0]} cy={p[1]} rx="20" ry="8" fill="#1d1b18" opacity={0.18 * day} />
                  <rect x={p[0] - 2} y={p[1] - 26} width="4" height="26" fill="#4a3f33" />
                  <circle cx={p[0]} cy={p[1] - 40} r="23" fill={treeFill} />
                  <circle cx={p[0] - 9} cy={p[1] - 48} r="12" fill="#ffffff" opacity={0.1 * day} />
                </g>
              )
            })}
          </g>

          {/* dach */}
          <g aria-hidden="true" className="building__late">
            <polygon points={poly(roofPts)} fill={roof} stroke="#1d1b18" strokeOpacity="0.25" />
            <polygon points={poly(inset)} fill={treeFill} opacity="0.55" />
          </g>

          {/* mieszkania */}
          {ordered.map((a) => {
            const [d0, d1] = span(a)
            const z0 = a.floor * HF
            const z1 = z0 + HF
            const w = d1 - d0
            const dim = !visibleIds.has(a.id)
            return (
              <g
                key={a.id}
                className="building__cell"
                style={{ '--f': a.floor } as CSSProperties}
                ref={(el) => {
                  if (el) cellRefs.current.set(a.id, el)
                  else cellRefs.current.delete(a.id)
                }}
                role="button"
                tabIndex={a.id === activeId ? 0 : -1}
                aria-label={cellLabel(a, dim)}
                aria-haspopup="dialog"
                // bez fokusu po kliknięciu myszą: fokus przewijał stronę i gubił kliknięcie
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => dispatch({ type: 'hover', id: a.id })}
                onMouseLeave={() => dispatch({ type: 'hover', id: null })}
                onFocus={() => {
                  setActiveId(a.id)
                  dispatch({ type: 'hover', id: a.id })
                }}
                onBlur={() => dispatch({ type: 'hover', id: null })}
                onClick={() => dispatch({ type: 'select', id: a.id })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') dispatch({ type: 'select', id: a.id })
                  if (e.key === ' ') e.preventDefault()
                  const next = nextInGrid(grid, a.id, e.key)
                  if (next) {
                    e.preventDefault()
                    setActiveId(next)
                    cellRefs.current.get(next)?.focus()
                  }
                }}
                // Spacja dopiero przy puszczeniu, żeby nie aktywowała przycisku w otwartym panelu
                onKeyUp={(e) => {
                  if (e.key === ' ') dispatch({ type: 'select', id: a.id })
                }}
              >
                <polygon
                  points={quad(a.facade, d0, d1, z0, z1)}
                  fill={wall(a)}
                  stroke="#1d1b18"
                  strokeOpacity="0.22"
                />
                <polygon
                  points={quad(a.facade, d0 + w * 0.12, d0 + w * 0.4, z0 + HF * 0.26, z0 + HF * 0.8)}
                  fill={glass(a)}
                  stroke="#1d1b18"
                  strokeOpacity="0.35"
                />
                <polygon
                  points={quad(
                    a.facade,
                    d0 + w * 0.58,
                    d0 + w * 0.88,
                    z0 + HF * (a.balcony ? 0.12 : 0.26),
                    z0 + HF * 0.8,
                  )}
                  fill={glass(a)}
                  stroke="#1d1b18"
                  strokeOpacity="0.35"
                />
                {a.status === 'rezerwacja' && (
                  <polygon className="building__tint building__tint--hold" points={quad(a.facade, d0, d1, z0, z1)} />
                )}
                {a.status === 'sprzedane' && (
                  <polygon className="building__tint building__tint--sold" points={quad(a.facade, d0, d1, z0, z1)} />
                )}
                {dim && <polygon className="building__tint building__tint--dim" points={quad(a.facade, d0, d1, z0, z1)} />}
              </g>
            )
          })}

          {/* balkony — osobna warstwa, bo wystają na sąsiednie pola */}
          <g aria-hidden="true" className="building__balconies building__late">
            {ordered
              .filter((a) => a.balcony)
              .map((a) => {
                const [d0, d1] = span(a)
                const w = d1 - d0
                const zb = a.floor * HF + HF * 0.1
                const a0 = pt(a.facade, d0 + w * 0.5, zb)
                const a1 = pt(a.facade, d0 + w * 0.95, zb)
                const o0 = out(a.facade, a0, 10)
                const o1 = out(a.facade, a1, 10)
                const rail = HF * 0.36
                return (
                  <g key={a.id} opacity={visibleIds.has(a.id) ? 1 : 0.45}>
                    <polygon points={poly([a0, a1, o1, o0])} fill="#4a463f" />
                    <polygon
                      points={poly([o0, o1, [o1[0], o1[1] - rail], [o0[0], o0[1] - rail]])}
                      fill="#ffffff"
                      fillOpacity={0.3 + 0.25 * day}
                      stroke="#2a2824"
                      strokeWidth="1.2"
                    />
                  </g>
                )
              })}
          </g>

          {/* numery pięter */}
          <g aria-hidden="true">
            {Array.from({ length: FLOORS }, (_, f) => {
              const p = pt('S', LEN.S, f * HF + HF / 2)
              return (
                <text key={f} className="building__floor" x={p[0] - 12} y={p[1] + 4} textAnchor="end">
                  {f === 0 ? 'P' : f}
                </text>
              )
            })}
          </g>

          {/* obrys wybranego i najechanego — na wierzchu */}
          {apartments
            .filter((a) => a.id === selectedId || a.id === state.hoveredId)
            .map((a) => {
              const [d0, d1] = span(a)
              return (
                <polygon
                  key={a.id}
                  className={`building__outline${a.id === selectedId ? ' is-selected' : ''}`}
                  points={quad(a.facade, d0, d1, a.floor * HF, (a.floor + 1) * HF)}
                />
              )
            })}

          {tip && (
            <g className="building__tip" transform={`translate(${tip.x} ${tip.y})`} aria-hidden="true">
              <rect x="-112" y="0" width="224" height="58" rx="10" />
              <text x="0" y="23" textAnchor="middle" className="building__tip-main">
                {tip.a.id} · {roomsLabel(tip.a.rooms)} · {formatArea(tip.a.area)}
              </text>
              <text x="0" y="44" textAnchor="middle" className="building__tip-sub">
                {formatPrice(tip.a.price)} · {STATUS_LABEL[tip.a.status]}
              </text>
            </g>
          )}
        </svg>
      </div>

      <ul className="building__legend" aria-label="Legenda">
        <li>
          <span className="building__swatch building__swatch--free" /> wolne
        </li>
        <li>
          <span className="building__swatch building__swatch--hold" /> rezerwacja
        </li>
        <li>
          <span className="building__swatch building__swatch--sold" /> sprzedane
        </li>
        <li>
          <span className="building__swatch building__swatch--dim" /> poza filtrami
        </li>
      </ul>
    </div>
  )
}
