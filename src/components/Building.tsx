import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { FLOORS } from '../domain/data'
import { nextInGrid, type GridItem } from '../domain/gridNav'
import { FACADE_LABEL, STATUS_LABEL, floorLabel, formatArea, formatHour, formatPrice, roomsLabel } from '../domain/format'
import { sunWindow } from '../domain/sun'
import type { Apartment, Facade } from '../domain/types'
import { useHour, useStore } from '../state/store'
import { SceneSky } from './SceneSky'
import { SunOrbit } from './SunOrbit'
import './Building.css'

/* ---------- rzut izometryczny ----------
   Te same stałe co w blender/budynek.py: render pokrywa dokładnie viewBox,
   więc klikalne pola leżą co do piksela na oknach z renderu. */
const C = 0.866
const S = 0.5
const L = 104 // długość jednego mieszkania wzdłuż elewacji (6,5 m)
const HF = 48 // wysokość kondygnacji (3 m)
const CX = 350
const CY = 560
const VB = { x: -50, y: -70, w: 740, h: 720 }
const LEN: Record<Facade, number> = { S: 3 * L, E: 2 * L }

type P = [number, number]

/** punkt na elewacji: d = odległość od przedniego narożnika, z = wysokość */
const pt = (f: Facade, d: number, z: number): P => [CX + (f === 'S' ? -d : d) * C, CY - d * S - z]
/** punkt na ziemi: e = na wschód, n = na północ od przedniego narożnika */
const ground = (e: number, n: number): P => [CX + (e + n) * C, CY + (e - n) * S]
const poly = (ps: P[]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
const quad = (f: Facade, d0: number, d1: number, z0: number, z1: number) =>
  poly([pt(f, d0, z0), pt(f, d1, z0), pt(f, d1, z1), pt(f, d0, z1)])

function span(a: Apartment): [number, number] {
  return a.facade === 'S' ? [(2 - a.slot) * L, (3 - a.slot) * L] : [(a.slot - 3) * L, (a.slot - 2) * L]
}

/* ---------- rendery na pory dnia (blender/budynek.py → blender/budynek-web.mjs) ---------- */
export const FRAME_HOURS = [6, 7.5, 9, 10.5, 12, 13.5, 15, 16.5, 18, 19.2, 20.2, 21] as const
const frameName = (h: number) => h.toFixed(2).padStart(5, '0').replace('.', '_')
const frameUrl = (h: number, hi: boolean) =>
  `${import.meta.env.BASE_URL}budynek/${frameName(h)}${hi ? '' : '-1x'}.webp`

/** dwa rendery, między którymi leży godzina, i udział drugiego */
function framesFor(hour: number): { a: number; b: number; t: number } {
  if (hour <= FRAME_HOURS[0]) return { a: FRAME_HOURS[0], b: FRAME_HOURS[0], t: 0 }
  for (let i = 0; i < FRAME_HOURS.length - 1; i++) {
    const a = FRAME_HOURS[i]
    const b = FRAME_HOURS[i + 1]
    if (hour <= b) return { a, b, t: (hour - a) / (b - a) }
  }
  const last = FRAME_HOURS[FRAME_HOURS.length - 1]
  return { a: last, b: last, t: 0 }
}

/** podświetlenie z legendy: jedna grupa mieszkań na bryle, reszta przygaszona */
type Spot = 'wolne' | 'rezerwacja' | 'sprzedane' | 'poza'
const SPOTS: { key: Spot; label: string }[] = [
  { key: 'wolne', label: 'wolne' },
  { key: 'rezerwacja', label: 'rezerwacja' },
  { key: 'sprzedane', label: 'sprzedane' },
  { key: 'poza', label: 'poza filtrami' },
]
/** grupy statusu obejmują tylko mieszkania w filtrach, resztę zbiera „poza filtrami”, więc liczniki sumują się do 35 */
const inSpot = (a: Apartment, spot: Spot, dim: boolean) => (spot === 'poza' ? dim : !dim && a.status === spot)

/** „1 mieszkanie”, „3 mieszkania”, „12 mieszkań” */
function flatsLabel(n: number): string {
  if (n === 0) return 'żadne mieszkanie'
  if (n === 1) return '1 mieszkanie'
  const d = n % 10
  const t = n % 100
  return `${n} ${d >= 2 && d <= 4 && (t < 12 || t > 14) ? 'mieszkania' : 'mieszkań'}`
}

/* ---------- części zależne od godziny ----------
   Godzina zmienia się co klatkę (przelot przy wejściu, odtwarzanie dnia). Tylko te małe komponenty
   ją subskrybują, więc 35 komórek, legenda i karta nie przeliczają się 30 razy na sekundę. */

function HourSky() {
  return <SceneSky hour={useHour().hour} />
}

function HourOrbit({ layer }: { layer: 'back' | 'front' }) {
  return <SunOrbit hour={useHour().hour} layer={layer} cx={315} horizon={290} rx={330} ry={345} />
}

/** dwa rendery, między którymi leży godzina; przenikają się wraz z nią */
function HourRenders({ hiRes, ready }: { hiRes: boolean | null; ready: ReadonlySet<string> }) {
  const { hour } = useHour()
  /** najlepszy wczytany obraz danej godziny: pełna rozdzielczość, a do czasu jej wczytania połowa */
  const best = (h: number): string | null => {
    const hi = frameUrl(h, true)
    const lo = frameUrl(h, false)
    if (hiRes && ready.has(hi)) return hi
    if (ready.has(lo)) return lo
    if (ready.has(hi)) return hi
    return null
  }
  const want = framesFor(hour)
  // render jeszcze się nie wczytał: najbliższa godzina, która już jest
  const nearest = (h: number) =>
    best(h) ? h : [...FRAME_HOURS].filter((x) => best(x)).sort((x, y) => Math.abs(x - h) - Math.abs(y - h))[0]
  const fa = nearest(want.a)
  const fb = want.b
  const urlA = fa === undefined ? null : best(fa)
  const urlB = fb !== fa ? best(fb) : null
  return (
    <g aria-hidden="true" className="building__renders">
      {urlA && <image key={fa} href={urlA} x={VB.x} y={VB.y} width={VB.w} height={VB.h} />}
      {urlB && <image key={fb} href={urlB} x={VB.x} y={VB.y} width={VB.w} height={VB.h} opacity={want.t} />}
    </g>
  )
}

const cellLabel = (a: Apartment, dim: boolean) => {
  const sun = sunWindow(a.facade, a.floor)
  const light = sun ? `słońce w salonie ${formatHour(sun.from)}–${formatHour(sun.to)}` : 'bez bezpośredniego słońca'
  return `${dim ? 'Poza filtrami: ' : ''}Mieszkanie ${a.id}, ${roomsLabel(a.rooms)}, ${formatArea(a.area)}, ${floorLabel(a.floor)}, okna na ${FACADE_LABEL[a.facade]}, ${light}, ${formatPrice(a.price)}, ${STATUS_LABEL[a.status]}`
}

export function Building() {
  const { apartments, visibleIds, state, dispatch } = useStore()
  // jeden przystanek Tab na całą bryłę; między mieszkaniami chodzi się strzałkami
  const grid = useMemo<GridItem[]>(
    () => apartments.map((a) => ({ id: a.id, row: a.floor, col: a.slot })),
    [apartments],
  )
  const [activeId, setActiveId] = useState(() => `${FLOORS - 1}.01`)
  const cellRefs = useRef(new Map<string, SVGGElement>())
  const boxRef = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<Spot | null>(null)
  // null do czasu pomiaru: nic nie pobieramy, zanim nie wiadomo, której rozdzielczości trzeba
  const [hiRes, setHiRes] = useState<boolean | null>(null)
  // adresy, które się naprawdę wczytały (błąd nie trafia tutaj)
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set())

  // rozdzielczość dobrana do rozmiaru na ekranie; zmienia się tylko w górę,
  // żeby obrót telefonu albo zwężenie okna nie pobierały wszystkiego od nowa
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      // ile jednostek rysunku przypada na piksel ekranu: podpisy SVG mnożą przez to swój rozmiar
      if (el.clientWidth) el.style.setProperty('--svg-k', String(VB.w / el.clientWidth))
      const hi = el.clientWidth * (window.devicePixelRatio || 1) > 820
      setHiRes((prev) => (prev === true ? true : hi))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // kolejność: klatki przelotu przy wejściu (świt → 10:30), potem reszta dnia
  useEffect(() => {
    if (hiRes === null) return
    let cancelled = false
    const intro = [6, 7.5, 9, 10.5]
    const order = [...intro, ...FRAME_HOURS.filter((h) => !intro.includes(h))]
    const next = (i: number) => {
      if (cancelled || i >= order.length) return
      const url = frameUrl(order[i], hiRes)
      const img = new Image()
      img.onload = () => {
        if (cancelled) return
        // dekodujemy przed pokazaniem, żeby zmiana href nie dała pustej klatki
        ;(img.decode ? img.decode().catch(() => undefined) : Promise.resolve()).then(() => {
          if (cancelled) return
          setReady((s) => new Set(s).add(url))
          next(i + 1)
        })
      }
      img.onerror = () => {
        if (!cancelled) next(i + 1)
      }
      img.src = url
    }
    next(0)
    return () => {
      cancelled = true
    }
  }, [hiRes])


  const hovered = apartments.find((a) => a.id === state.hoveredId) ?? null
  const selected = apartments.find((a) => a.id === state.selectedId) ?? null
  const focus = hovered ?? selected
  // podświetlenie z rozdziałów strony (typ mieszkania, „kiedy jesteś w domu”) wygrywa z legendą
  const storeSpot = state.spotlight
  const spotIds = useMemo(() => (storeSpot ? new Set(storeSpot.ids) : null), [storeSpot])
  const isSpot = (a: Apartment, dim: boolean) => (spotIds ? spotIds.has(a.id) : spot ? inSpot(a, spot, dim) : false)
  const spotting = Boolean(spotIds || spot)
  // karta nie może zasłaniać mieszkania, o którym mówi: dla niskich pięter idzie do nieba u góry.
  // Podświetlenie grupy z rozdziału zostaje na dole: u góry zakrywało słońce i dach, czyli to, o czym mówi strona
  const cardTop = focus ? focus.floor <= 3 : false
  const selectedId = state.selectedId

  // od góry do dołu — taka sama kolejność dla klawiatury
  const ordered = useMemo(() => [...apartments].sort((a, b) => b.floor - a.floor || a.slot - b.slot), [apartments])
  const sun = focus ? sunWindow(focus.facade, focus.floor) : null

  return (
    <div className="building">
      <div className="building__frame">
        <HourSky />
        <div ref={boxRef} className={`building__box${spotting ? ' is-spotting' : ''}`}>
          <svg
            className="building__svg"
            viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
            role="group"
            aria-label="Bryła budynku. Każde mieszkanie jest przyciskiem; strzałki przechodzą między mieszkaniami."
          >
            <defs>
              <filter id="b-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* łuk słońca: część za budynkiem (wieczór) pod renderami, więc bryła ją zasłania */}
            <HourOrbit layer="back" />

            {/* rendery: bieżący i następny przenikają się wraz z godziną */}
            <HourRenders hiRes={hiRes} ready={ready} />

            <g aria-hidden="true" className="building__labels">
              {Array.from({ length: FLOORS }, (_, f) => {
                const p = pt('S', LEN.S, f * HF + HF / 2)
                return (
                  <g key={f}>
                    {/* papierowa plakietka pod numerem: czytelny także na koronie drzewa */}
                    <rect className="building__floor-chip" x={p[0] - 41} y={p[1] - 8} width={16} height={16} rx={2} />
                    <text className="building__floor" x={p[0] - 33} y={p[1] + 4} textAnchor="middle">
                      {f === 0 ? 'P' : f}
                    </text>
                  </g>
                )
              })}
              <text
                className="building__compass"
                transform={`translate(${ground(-LEN.S / 2, -62)[0]} ${ground(-LEN.S / 2, -62)[1]}) rotate(30)`}
                textAnchor="middle"
              >
                POŁUDNIE
              </text>
              <text
                className="building__compass"
                transform={`translate(${ground(62, LEN.E / 2)[0]} ${ground(62, LEN.E / 2)[1]}) rotate(-30)`}
                textAnchor="middle"
              >
                WSCHÓD
              </text>
            </g>

            {/* łuk słońca: część przed budynkiem (rano i w południe) nad renderami */}
            <HourOrbit layer="front" />

            {/* klikalne pola mieszkań: przezroczyste, pokazują się dopiero przy stanie */}
            {ordered.map((a) => {
              const [d0, d1] = span(a)
              const z0 = a.floor * HF
              const dim = !visibleIds.has(a.id)
              const isHover = a.id === state.hoveredId
              const isSelected = a.id === selectedId
              const cls = [
                'building__cell',
                dim && 'is-dim',
                a.status === 'sprzedane' && 'is-sold',
                a.status === 'rezerwacja' && 'is-hold',
                isHover && 'is-hover',
                isSelected && 'is-selected',
                isSpot(a, dim) && 'is-spot',
              ]
                .filter(Boolean)
                .join(' ')
              const [cx, cy] = pt(a.facade, (d0 + d1) / 2, z0 + HF / 2)
              return (
                <g
                  key={a.id}
                  className={cls}
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
                  <polygon className="building__hit" points={quad(a.facade, d0, d1, z0, z0 + HF)} />
                  {a.status === 'rezerwacja' && !dim && <circle className="building__mark" cx={cx} cy={cy} r="4.5" />}
                </g>
              )
            })}

            {/* obrys najechanego (krem) i wybranego (złoto): ciemna podkładka pod linią, żeby obrys
                miał kontrast także na jasnej fasadzie w południe */}
            {apartments
              .filter((a) => a.id === selectedId || a.id === state.hoveredId)
              .map((a) => {
                const [d0, d1] = span(a)
                const points = quad(a.facade, d0, d1, a.floor * HF, (a.floor + 1) * HF)
                return (
                  <g key={a.id} className={`building__mark-out${a.id === selectedId ? ' is-selected' : ''}`}>
                    <polygon className="building__outline-under" points={points} />
                    <polygon className="building__outline" points={points} filter="url(#b-glow)" />
                  </g>
                )
              })}
          </svg>

          {ready.size === 0 && <span className="building__loading" aria-hidden="true" />}
        </div>

        {/* szklana karta: co jest pod kursorem albo co jest wybrane */}
        <div
          className={`building__card${focus ? ' is-on' : ''}${cardTop ? ' is-top' : ''}${focus && !hovered ? ' is-picked' : ''}`}
          aria-hidden="true"
        >
          {focus ? (
            <>
              <span className="building__card-eyebrow">Mieszkanie {focus.id}</span>
              <strong className="building__card-title">
                {roomsLabel(focus.rooms)} · {formatArea(focus.area)}
              </strong>
              <span className="building__card-meta">
                {floorLabel(focus.floor)} · okna na {FACADE_LABEL[focus.facade]}
                {sun ? ` · słońce ${formatHour(sun.from)}–${formatHour(sun.to)}` : ''}
              </span>
              <span className="building__card-price">
                {formatPrice(focus.price)}
                <span className={`badge badge--${focus.status}`}>{STATUS_LABEL[focus.status]}</span>
              </span>
              <span className="building__card-keys">Strzałki: następne mieszkanie · Enter: otwórz</span>
            </>
          ) : (
            <>
              <span className="building__card-eyebrow">35 mieszkań · 7 kondygnacji</span>
              <strong className="building__card-title building__card-title--pointer">Najedź na okno, kliknij, żeby wejść</strong>
              <strong className="building__card-title building__card-title--touch">Dotknij okna, żeby wejść</strong>
              <span className="building__card-meta building__card-title--pointer">
                Strzałki na klawiaturze przechodzą między mieszkaniami.
              </span>
            </>
          )}
        </div>
      </div>

      {/* podświetlenie z rozdziału (typ, pory w domu) opisuje się w miejscu legendy, nie kartą na rysunku;
          legenda wraca, gdy rozdział oddaje bryłę */}
      {storeSpot ? (
        <p className="building__spotnote">
          <span className="building__spotnote-mark" aria-hidden="true" />
          <span className="building__spotnote-label">{storeSpot.label}</span>
          <span className="building__spotnote-count">{flatsLabel(storeSpot.ids.length)}</span>
        </p>
      ) : (
      <div className="building__legend" role="group" aria-label="Legenda: pokaż na bryle">
        {SPOTS.map(({ key, label }) => {
          const count = apartments.filter((a) => inSpot(a, key, !visibleIds.has(a.id))).length
          // rozdział strony przejął bryłę: legenda nie pokazuje stanu, który teraz nic nie robi
          const on = spot === key && !storeSpot
          return (
            <button
              key={key}
              type="button"
              className={`building__legend-item building__legend-item--${key}${on ? ' is-on' : ''}`}
              aria-pressed={on}
              // aria-disabled, nie disabled: przycisk z fokusem nie może zniknąć spod klawiatury
              aria-disabled={count === 0 && !on}
              onClick={() => {
                if (count === 0 && !on) return
                setSpot(on ? null : key)
              }}
            >
              <span className={`building__swatch building__swatch--${key}`} aria-hidden="true" />
              {label}
              <span className="building__legend-count">{count}</span>
            </button>
          )
        })}
        {/* podpowiedź w rzędzie legendy, pod rysunkiem (na komputerze); na dotyku zostaje karta pod bryłą */}
        <span className="building__legend-hint" aria-hidden="true">
          Najedź na okno, kliknij, żeby wejść
        </span>
      </div>
      )}
    </div>
  )
}
