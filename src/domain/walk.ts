import type { Room } from './types'

/**
 * Strona pomieszczenia na rzucie. 'down' to ściana z oknami (y rośnie w dół),
 * 'up' to strona wejścia do mieszkania.
 */
export type Side = 'up' | 'right' | 'down' | 'left'

/**
 * drzwi     — otwór drzwiowy 0,9 m
 * przejscie — szeroki otwór bez skrzydła (hol → salon)
 * otwarte   — brak ściany (kuchnia otwarta na salon, hol z korytarzem)
 * balkon    — drzwi balkonowe
 */
export type LinkType = 'drzwi' | 'przejscie' | 'otwarte' | 'balkon'

export interface Link {
  /** indeksy w tablicy plan */
  from: number
  to: number
  /** po której stronie pomieszczenia `from` leży przejście */
  side: Side
  type: LinkType
  /** wspólny odcinek ściany: położenie ściany i zakres wzdłuż niej, w metrach rzutu */
  at: number
  start: number
  end: number
}

export const SIDES: readonly Side[] = ['up', 'right', 'down', 'left']
const OPPOSITE: Record<Side, Side> = { up: 'down', down: 'up', left: 'right', right: 'left' }
export const opposite = (side: Side): Side => OPPOSITE[side]

/** Najkrótszy wspólny odcinek, w którym mieszczą się drzwi. */
const MIN_DOOR = 0.95
const EPS = 1e-6

interface Shared {
  side: Side
  at: number
  start: number
  end: number
}

/** Wspólny odcinek ściany widziany z pomieszczenia a; null, gdy się nie stykają. */
function shared(a: Room, b: Room): Shared | null {
  const overlapY = (): [number, number] => [Math.max(a.y, b.y), Math.min(a.y + a.h, b.y + b.h)]
  const overlapX = (): [number, number] => [Math.max(a.x, b.x), Math.min(a.x + a.w, b.x + b.w)]
  const make = (side: Side, at: number, [start, end]: [number, number]): Shared | null =>
    end - start > 0.05 ? { side, at, start, end } : null
  if (Math.abs(a.x + a.w - b.x) < EPS) return make('right', b.x, overlapY())
  if (Math.abs(b.x + b.w - a.x) < EPS) return make('left', a.x, overlapY())
  if (Math.abs(a.y + a.h - b.y) < EPS) return make('down', b.y, overlapX())
  if (Math.abs(b.y + b.h - a.y) < EPS) return make('up', a.y, overlapX())
  return null
}

const length = (s: Shared) => s.end - s.start

/**
 * Przejścia między pomieszczeniami mieszkania, w obu kierunkach.
 * Jedyne źródło prawdy o tym, gdzie są drzwi: korzysta z niego spacer na stronie
 * i skrypt Blendera, który z tych samych danych wycina otwory w ścianach.
 */
export function links(plan: readonly Room[]): Link[] {
  const pairs: { i: number; j: number; s: Shared }[] = []
  for (let i = 0; i < plan.length; i++) {
    for (let j = i + 1; j < plan.length; j++) {
      const s = shared(plan[i], plan[j])
      if (s) pairs.push({ i, j, s })
    }
  }
  const kinds = (p: { i: number; j: number }) => [plan[p.i].kind, plan[p.j].kind]
  const has = (p: { i: number; j: number }, a: Room['kind'], b: Room['kind']) => {
    const [x, y] = kinds(p)
    return (x === a && y === b) || (x === b && y === a)
  }

  const chosen = new Map<(typeof pairs)[number], LinkType>()
  const interior = pairs.filter((p) => !kinds(p).includes('balkon'))

  for (const p of interior) {
    if (has(p, 'kuchnia', 'salon') || has(p, 'hol', 'hol')) chosen.set(p, 'otwarte')
    else if (has(p, 'hol', 'salon') && length(p.s) >= MIN_DOOR) chosen.set(p, 'przejscie')
    else if (kinds(p).includes('hol') && !kinds(p).includes('lazienka') && length(p.s) >= MIN_DOOR)
      chosen.set(p, 'drzwi')
  }

  // łazienka ma dokładnie jedne drzwi: najchętniej z holu, przez najdłuższą wspólną ścianę
  plan.forEach((room, index) => {
    if (room.kind !== 'lazienka') return
    const candidates = interior
      .filter((p) => (p.i === index || p.j === index) && length(p.s) >= MIN_DOOR)
      .sort(
        (p, q) =>
          Number(kinds(q).includes('hol')) - Number(kinds(p).includes('hol')) || length(q.s) - length(p.s),
      )
    if (candidates[0]) chosen.set(candidates[0], 'drzwi')
  })

  // nic nie może zostać odcięte: dołącz brakujące pomieszczenia od strony już dostępnej
  const start = plan.findIndex((r) => r.kind === 'hol')
  const reach = new Set<number>(start >= 0 ? [start] : [])
  const spread = () => {
    let grew = true
    while (grew) {
      grew = false
      for (const [p] of chosen) {
        if (reach.has(p.i) !== reach.has(p.j)) {
          reach.add(p.i)
          reach.add(p.j)
          grew = true
        }
      }
    }
  }
  spread()
  for (;;) {
    const bridge = interior
      .filter((p) => !chosen.has(p) && reach.has(p.i) !== reach.has(p.j) && length(p.s) >= MIN_DOOR)
      .filter((p) => plan[reach.has(p.i) ? p.i : p.j].kind !== 'lazienka')
      .sort(
        (p, q) =>
          Number(kinds(p).includes('kuchnia')) - Number(kinds(q).includes('kuchnia')) ||
          length(q.s) - length(p.s),
      )[0]
    if (!bridge) break
    chosen.set(bridge, 'drzwi')
    spread()
  }

  for (const p of pairs) {
    if (has(p, 'salon', 'balkon')) chosen.set(p, 'balkon')
  }

  const out: Link[] = []
  for (const [p, type] of chosen) {
    const { at, start: s0, end: s1 } = p.s
    out.push({ from: p.i, to: p.j, side: p.s.side, type, at, start: s0, end: s1 })
    out.push({ from: p.j, to: p.i, side: opposite(p.s.side), type, at, start: s0, end: s1 })
  }
  return out
}

/** Odległość od ścian, poniżej której kamera nie staje. */
const WALL_CLEARANCE = 0.45

/**
 * Miejsce, z którego robimy panoramę pomieszczenia: tuż za wejściem, jak fotograf
 * nieruchomości, a nie na środku pokoju (tam stoi łóżko albo stół i widać gołe ściany).
 * Korzysta z tego przeglądarka spaceru i skrypt Blendera, więc punkty przejść
 * zawsze wskazują drzwi widziane z miejsca kamery.
 */
export function viewpoint(plan: readonly Room[], index: number, all: readonly Link[]): { x: number; y: number } {
  const r = plan[index]
  const clampX = (x: number) => Math.min(r.x + r.w - WALL_CLEARANCE, Math.max(r.x + WALL_CLEARANCE, x))
  const clampY = (y: number) => Math.min(r.y + r.h - WALL_CLEARANCE, Math.max(r.y + WALL_CLEARANCE, y))
  const center = { x: r.x + r.w / 2, y: r.y + r.h / 2 }
  if (r.kind === 'balkon') return center

  // hol z wejściem do mieszkania (górna ściana obrysu): stajemy za drzwiami wejściowymi
  const isEntrance = r.kind === 'hol' && Math.abs(r.y) < EPS && plan.findIndex((p) => p.kind === 'hol') === index
  if (isEntrance) {
    return { x: clampX(center.x), y: clampY(r.y + Math.min(0.85, r.h * 0.4)) }
  }

  const entries = all.filter((l) => l.to === index)
  if (entries.length === 0) return center
  const fromKind = (l: Link) => plan[l.from].kind
  const rank = (l: Link) => (fromKind(l) === 'hol' ? 0 : l.type === 'balkon' ? 2 : 1)
  const entry = [...entries].sort((a, b) => rank(a) - rank(b) || b.end - b.start - (a.end - a.start))[0]

  const mid = (entry.start + entry.end) / 2
  // entry.side to strona pomieszczenia źródłowego; do tego pokoju wchodzimy w tę samą stronę
  switch (entry.side) {
    case 'down':
      return { x: clampX(mid), y: clampY(entry.at + Math.min(0.85, r.h * 0.4)) }
    case 'up':
      return { x: clampX(mid), y: clampY(entry.at - Math.min(0.85, r.h * 0.4)) }
    case 'right':
      return { x: clampX(entry.at + Math.min(0.85, r.w * 0.4)), y: clampY(mid) }
    case 'left':
      return { x: clampX(entry.at - Math.min(0.85, r.w * 0.4)), y: clampY(mid) }
  }
}

/** Obrót o 90°: w prawo (zgodnie z ruchem wskazówek zegara, patrząc na rzut) albo w lewo. */
export function turn(side: Side, direction: 'left' | 'right'): Side {
  const i = SIDES.indexOf(side)
  return SIDES[(i + (direction === 'right' ? 1 : 3)) % 4]
}

/**
 * Dokąd można przejść z pomieszczenia `from`, patrząc w stronę `side`.
 * Kolejność jak na ekranie, od lewej do prawej: patrząc w dół albo w lewo rzutu,
 * większe współrzędne są po lewej ręce.
 */
export function exits(all: readonly Link[], from: number, side: Side): Link[] {
  const flip = side === 'down' || side === 'left' ? -1 : 1
  return all.filter((l) => l.from === from && l.side === side).sort((a, b) => (a.start - b.start) * flip)
}
