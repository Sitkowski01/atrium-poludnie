import { describe, expect, it } from 'vitest'
import { APARTMENTS } from './data'
import type { Room } from './types'
import { exits, links, opposite, SIDES, turn } from './walk'
import type { Link, Side } from './walk'

const TOLERANCE = 1e-8
// Niezależny wzorzec kierunków: testy nie wyprowadzają oczekiwań z SIDES.
const clockwise: readonly Side[] = ['up', 'right', 'down', 'left']
const reverse: Record<Side, Side> = { up: 'down', right: 'left', down: 'up', left: 'right' }

function reachable(all: readonly Link[], start: number): number[] {
  const visited = new Set([start])
  const pending = [start]
  while (pending.length) {
    const current = pending.pop()!
    for (const link of all.filter((candidate) => candidate.from === current)) {
      if (!visited.has(link.to)) {
        visited.add(link.to)
        pending.push(link.to)
      }
    }
  }
  return [...visited].sort((a, b) => a - b)
}

function touches(a: Room, b: Room): boolean {
  const horizontalOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const verticalOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  const verticalWall = Math.abs(a.x + a.w - b.x) < TOLERANCE ||
    Math.abs(b.x + b.w - a.x) < TOLERANCE
  const horizontalWall = Math.abs(a.y + a.h - b.y) < TOLERANCE ||
    Math.abs(b.y + b.h - a.y) < TOLERANCE
  return (verticalWall && verticalOverlap > TOLERANCE) ||
    (horizontalWall && horizontalOverlap > TOLERANCE)
}

describe.each(APARTMENTS)('links — mieszkanie $id', (apartment) => {
  const { id, plan } = apartment
  const all = links(plan)

  it('każde przejście ma odwrotne o tym samym typie i odcinku', () => {
    for (const link of all) {
      expect(all, `${id}: brak odwrotności ${JSON.stringify(link)}`).toContainEqual({
        ...link, from: link.to, to: link.from, side: reverse[link.side],
      })
    }
  })

  it('z pierwszego holu można dojść do każdego pomieszczenia, także balkonu', () => {
    const start = plan.findIndex((room) => room.kind === 'hol')
    expect(start, `${id}: brak holu`).toBeGreaterThanOrEqual(0)
    expect(reachable(all, start), `${id}: nieosiągalne pomieszczenia`).toEqual(plan.map((_, i) => i))
  })

  it('każda łazienka ma dokładnie jedno przejście typu drzwi', () => {
    plan.forEach((room, index) => {
      if (room.kind !== 'lazienka') return
      const outgoing = all.filter((link) => link.from === index)
      expect(outgoing, `${id}: łazienka ${index}`).toHaveLength(1)
      expect(outgoing[0].type, `${id}: typ wejścia do łazienki ${index}`).toBe('drzwi')
    })
  })

  it('każda kuchnia stykająca się z salonem ma z nim otwarte przejście', () => {
    plan.forEach((kitchen, from) => {
      if (kitchen.kind !== 'kuchnia') return
      plan.forEach((living, to) => {
        if (living.kind !== 'salon' || !touches(kitchen, living)) return
        expect(all, `${id}: kuchnia ${from} → salon ${to}`).toEqual(expect.arrayContaining([
          expect.objectContaining({ from, to, type: 'otwarte' }),
        ]))
      })
    })
  })

  it('balkon łączy się wyłącznie z salonem, typem balkon i od dołu salonu', () => {
    plan.forEach((room, index) => {
      if (room.kind !== 'balkon') return
      const outgoing = all.filter((link) => link.from === index)
      expect(outgoing.length, `${id}: balkon ${index} bez wejścia`).toBeGreaterThan(0)
      for (const link of outgoing) {
        expect(plan[link.to].kind, `${id}: sąsiad balkonu ${index}`).toBe('salon')
        expect(link.type, `${id}: typ wejścia na balkon ${index}`).toBe('balkon')
        expect(link.side, `${id}: balkon ${index} musi być pod salonem`).toBe('up')
        expect(all, `${id}: wejście z salonu na balkon ${index}`).toContainEqual({
          ...link, from: link.to, to: index, side: 'down',
        })
      }
    })
  })

  it('drzwi i przejścia mają wspólny odcinek co najmniej 0,95 m', () => {
    for (const link of all.filter((l) => l.type === 'drzwi' || l.type === 'przejscie')) {
      expect(link.end - link.start, `${id}: ${JSON.stringify(link)}`)
        .toBeGreaterThanOrEqual(0.95 - TOLERANCE)
    }
  })

  it('strona i odcinek przejścia zgadzają się z geometrią obu pomieszczeń', () => {
    for (const link of all) {
      const a = plan[link.from]
      const b = plan[link.to]
      const message = `${id}: geometria ${JSON.stringify(link)}`
      const vertical = link.side === 'left' || link.side === 'right'
      const fromWall = { up: a.y, right: a.x + a.w, down: a.y + a.h, left: a.x }
      const toWall = { up: b.y + b.h, right: b.x, down: b.y, left: b.x + b.w }
      expect(link.at, message).toBeCloseTo(fromWall[link.side], 8)
      expect(link.at, message).toBeCloseTo(toWall[link.side], 8)
      const lower = vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x)
      const upper = vertical ? Math.min(a.y + a.h, b.y + b.h) : Math.min(a.x + a.w, b.x + b.w)
      expect(link.start, message).toBeGreaterThanOrEqual(lower - TOLERANCE)
      expect(link.end, message).toBeLessThanOrEqual(upper + TOLERANCE)
      expect(link.end, message).toBeGreaterThan(link.start)
    }
  })

  it('przejścia łączą wyłącznie stykające się pomieszczenia', () => {
    for (const link of all) {
      expect(plan[link.from], `${id}: nieznane from ${link.from}`).toBeDefined()
      expect(plan[link.to], `${id}: nieznane to ${link.to}`).toBeDefined()
      expect(touches(plan[link.from], plan[link.to]), `${id}: ${JSON.stringify(link)}`).toBe(true)
    }
  })

  it('nie ma przejścia pomieszczenia do samego siebie', () => {
    for (const link of all) expect(link.to, `${id}: from=${link.from}`).not.toBe(link.from)
  })

  it('nie ma duplikatów pary from/to', () => {
    const pairs = all.map((link) => `${link.from}:${link.to}`)
    expect(new Set(pairs).size, `${id}: powtórzone przejścia ${pairs.join(', ')}`).toBe(pairs.length)
  })
})

describe('kierunki', () => {
  it('SIDES zawiera cztery strony w kolejności zgodnej z ruchem wskazówek zegara', () => {
    expect(SIDES).toEqual(clockwise)
  })

  it.each(clockwise)('cztery obroty w prawo z %s wracają do początku', (side) => {
    let result = side
    for (let i = 0; i < 4; i++) result = turn(result, 'right')
    expect(result).toBe(side)
  })

  it.each(clockwise)('obrót w lewo, potem w prawo z %s znosi się', (side) => {
    expect(turn(turn(side, 'left'), 'right')).toBe(side)
  })

  it.each(clockwise)('obrót w prawo z %s daje kolejną stronę', (side) => {
    expect(turn(side, 'right')).toBe(clockwise[(clockwise.indexOf(side) + 1) % 4])
  })

  it.each(clockwise)('opposite(%s) wskazuje przeciwną stronę', (side) => {
    expect(opposite(side)).toBe(reverse[side])
  })

  it.each(clockwise)('opposite jest inwolucją dla %s', (side) => {
    expect(opposite(opposite(side))).toBe(side)
  })

  it.each(clockwise)('opposite(%s) zgadza się z dwoma obrotami', (side) => {
    expect(opposite(side)).toBe(turn(turn(side, 'right'), 'right'))
  })
})

describe('exits', () => {
  // Celowo przemieszana kolejność i przejścia rozpraszające dla każdej strony.
  const all: Link[] = clockwise.flatMap((side) => [3, 1, 2].map((start) => ({
    from: 0, to: start, side, start, end: start + 1, at: 0, type: 'drzwi' as const,
  })))
  for (const side of clockwise) {
    all.push({ from: 9, to: 0, side, start: 0, end: 1, at: 0, type: 'drzwi' })
  }

  it.each(clockwise)('filtruje dokładnie from i side=%s', (side) => {
    const result = exits(all, 0, side)
    expect(result).toHaveLength(3)
    expect(result.every((link) => link.from === 0 && link.side === side)).toBe(true)
    expect(result).toEqual(expect.arrayContaining(all.filter((link) => link.from === 0 && link.side === side)))
  })

  it.each(clockwise)('sortuje wyjścia na stronie %s od lewej na ekranie', (side) => {
    const expected = side === 'up' || side === 'right' ? [1, 2, 3] : [3, 2, 1]
    expect(exits(all, 0, side).map((link) => link.start)).toEqual(expected)
  })

  it('zwraca pustą tablicę, gdy nie ma pasujących przejść', () => {
    expect(exits(all, 99, 'down')).toEqual([])
    expect(exits([], 0, 'up')).toEqual([])
  })

  it('2.01: dwa dolne wyjścia z korytarza prowadzą najpierw do prawego pokoju', () => {
    const apartment = APARTMENTS.find((a) => a.id === '2.01')!
    const corridor = apartment.plan.findIndex((room) => room.label === 'Korytarz')
    expect(corridor, '2.01: brak korytarza').toBeGreaterThanOrEqual(0)
    const result = exits(links(apartment.plan), corridor, 'down')
    const bedrooms = apartment.plan.map((room, index) => ({ room, index }))
      .filter(({ room }) => room.kind === 'sypialnia')
      .sort((a, b) => b.room.x - a.room.x)
    expect(bedrooms, '2.01: dwa pokoje pod korytarzem').toHaveLength(2)
    expect(result.map((link) => link.to), '2.01: kolejność wyjść z korytarza')
      .toEqual(bedrooms.map(({ index }) => index))
  })
})

const room = (kind: Room['kind'], x: number, y: number, w: number, h: number): Room =>
  ({ kind, label: kind, x, y, w, h })

describe('małe plany zbudowane ręcznie', () => {
  it('nie tworzy drzwi na odcinku krótszym niż 0,95 m', () => {
    const plan: Room[] = [room('hol', 0, 0, 2, 2), room('sypialnia', 2, 1.1, 2, 2)]
    expect(links(plan), 'wspólna ściana ma tylko 0,9 m').toEqual([])
  })

  it('dobudowuje drzwi do pokoju bez bezpośredniego połączenia z holem', () => {
    const plan: Room[] = [
      room('hol', 0, 0, 2, 2), room('salon', 2, 0, 2, 2), room('sypialnia', 4, 0, 2, 2),
    ]
    const all = links(plan)
    expect(all).toContainEqual({ from: 1, to: 2, side: 'right', type: 'drzwi', at: 4, start: 0, end: 2 })
    expect(all).toContainEqual({ from: 2, to: 1, side: 'left', type: 'drzwi', at: 4, start: 0, end: 2 })
    expect(reachable(all, 0)).toEqual([0, 1, 2])
  })

  it('nie rzuca wyjątku dla planu bez holu', () => {
    const plan: Room[] = [room('kuchnia', 0, 0, 2, 2), room('salon', 2, 0, 2, 2)]
    expect(() => links(plan)).not.toThrow()
  })
})
