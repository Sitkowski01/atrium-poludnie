import { describe, expect, it } from 'vitest'
import { APARTMENTS } from './data'
import { MATCH_FROM, MOMENTS, matchMoments, onlySoldMatch, summarizeMatches } from './light'
import { sunShare, sunWindow } from './sun'

const pick = (...ids: string[]) => MOMENTS.filter((m) => ids.includes(m.id))
const morning = pick('poranek')

describe('matchMoments', () => {
  it('brak pór daje pustą listę', () => {
    expect(matchMoments(APARTMENTS, [])).toEqual([])
  })

  it('zwraca tylko mieszkania z udziałem co najmniej progu', () => {
    const res = matchMoments(APARTMENTS, morning, { includeSold: true })
    expect(res.length).toBeGreaterThan(0)
    for (const m of res) expect(m.share).toBeGreaterThanOrEqual(MATCH_FROM)
    const rejected = APARTMENTS.filter((a) => !res.some((m) => m.apartment.id === a.id))
    for (const a of rejected) {
      const m = morning[0]
      expect(sunShare(a.facade, a.floor, m.from, m.to)).toBeLessThan(MATCH_FROM)
    }
  })

  it('pomija sprzedane, chyba że includeSold', () => {
    const open = matchMoments(APARTMENTS, morning)
    const all = matchMoments(APARTMENTS, morning, { includeSold: true })
    expect(open.every((m) => m.apartment.status !== 'sprzedane')).toBe(true)
    expect(all.some((m) => m.apartment.status === 'sprzedane')).toBe(true)
    expect(all.length).toBeGreaterThan(open.length)
  })

  it('sortuje wg udziału, czasu słońca, piętra i ceny', () => {
    const res = matchMoments(APARTMENTS, pick('poranek', 'popoludnie'))
    for (let i = 1; i < res.length; i++) {
      const a = res[i - 1]
      const b = res[i]
      if (Math.abs(a.share - b.share) >= 0.005) {
        expect(a.share).toBeGreaterThan(b.share)
      } else {
        const durationA = sunWindow(a.apartment.facade, a.apartment.floor)?.total ?? 0
        const durationB = sunWindow(b.apartment.facade, b.apartment.floor)?.total ?? 0
        expect(durationA).toBeGreaterThanOrEqual(durationB)
        if (durationA === durationB) {
          expect(a.apartment.floor).toBeGreaterThanOrEqual(b.apartment.floor)
          if (a.apartment.floor === b.apartment.floor) {
            expect(a.apartment.price).toBeLessThanOrEqual(b.apartment.price)
          }
        }
      }
    }
  })

  it('dla wszystkich pór zaczyna od wyższych pięter od południa', () => {
    const res = matchMoments(APARTMENTS, MOMENTS)
    expect(res).toHaveLength(15)
    expect(res.every((m) => m.apartment.facade === 'S')).toBe(true)
    expect(res[0].apartment.floor).toBe(6)
    expect(res.map((m) => m.apartment.floor)).toEqual(
      res.map((m) => m.apartment.floor).sort((a, b) => b - a),
    )
  })

  it('kolejność nie zależy od kolejności wejścia, także przy pełnym remisie', () => {
    expect(matchMoments([...APARTMENTS].reverse(), MOMENTS)).toEqual(matchMoments(APARTMENTS, MOMENTS))
    const base = APARTMENTS.find((a) => a.facade === 'S' && a.floor === 6)!
    const tied = ['z', 'a', 'm'].map((id) => ({ ...base, id, status: 'wolne' as const }))
    expect(matchMoments(tied, MOMENTS).map((m) => m.apartment.id)).toEqual(['a', 'm', 'z'])
  })

  it('wieczór 18–20:30 nie daje dopasowań dla tych danych', () => {
    expect(matchMoments(APARTMENTS, pick('wieczor'))).toEqual([])
    expect(matchMoments(APARTMENTS, pick('wieczor'), { includeSold: true })).toEqual([])
  })
})

describe('summarizeMatches', () => {
  it('wszystkie pory: całe dostępne południe; wschód kończy słońce około 12:35', () => {
    const summary = summarizeMatches(APARTMENTS, MOMENTS, matchMoments(APARTMENTS, MOMENTS))
    expect(summary.wholeFacade).toBe('S')
    expect(summary.missed).toHaveLength(1)
    expect(summary.missed[0].facade).toBe('E')
    expect(summary.missed[0].sunUntil).toBeGreaterThanOrEqual(12.5)
    expect(summary.missed[0].sunUntil).toBeLessThanOrEqual(12.7)
  })

  it('sam poranek: pasuje cały dostępny wschód, a nie południe', () => {
    const matches = matchMoments(APARTMENTS, morning)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches.every((m) => m.apartment.facade === 'E')).toBe(true)
    expect(matches).toHaveLength(APARTMENTS.filter((a) => a.facade === 'E' && a.status !== 'sprzedane').length)
    expect(summarizeMatches(APARTMENTS, morning, matches).wholeFacade).toBe('E')
  })

  it('brak pór: brak podsumowania nawet przy przekazaniu dopasowań', () => {
    expect(summarizeMatches(APARTMENTS, [], matchMoments(APARTMENTS, MOMENTS)))
      .toEqual({ wholeFacade: null, missed: [] })
  })

  it('brak dostępnych mieszkań nie oznacza całej pasującej elewacji', () => {
    const sold = APARTMENTS.map((a) => ({ ...a, status: 'sprzedane' as const }))
    expect(summarizeMatches(sold, MOMENTS, matchMoments(sold, MOMENTS, { includeSold: true })).wholeFacade).toBeNull()
  })
})

describe('onlySoldMatch', () => {
  it('false przy braku pór i gdy są wolne dopasowania', () => {
    expect(onlySoldMatch(APARTMENTS, [])).toBe(false)
    expect(onlySoldMatch(APARTMENTS, morning)).toBe(false)
  })

  it('true, gdy dopasowane są tylko sprzedane', () => {
    const sold = APARTMENTS.map((a) => ({ ...a, status: 'sprzedane' as const }))
    expect(onlySoldMatch(sold, morning)).toBe(true)
  })

  it('false, gdy nie pasuje nic, także wśród sprzedanych', () => {
    expect(onlySoldMatch(APARTMENTS, pick('wieczor'))).toBe(false)
  })
})
