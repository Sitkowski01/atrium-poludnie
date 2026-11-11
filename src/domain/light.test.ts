import { describe, expect, it } from 'vitest'
import { APARTMENTS } from './data'
import { MATCH_FROM, MOMENTS, matchMoments, onlySoldMatch } from './light'
import { sunShare } from './sun'

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

  it('sortuje wg udziału malejąco, potem wg ceny rosnąco', () => {
    const res = matchMoments(APARTMENTS, pick('poranek', 'popoludnie'))
    for (let i = 1; i < res.length; i++) {
      const a = res[i - 1]
      const b = res[i]
      expect(a.share).toBeGreaterThanOrEqual(b.share)
      if (a.share === b.share) expect(a.apartment.price).toBeLessThanOrEqual(b.apartment.price)
    }
  })

  it('wieczór 18–20:30 nie daje dopasowań dla tych danych', () => {
    expect(matchMoments(APARTMENTS, pick('wieczor'))).toEqual([])
    expect(matchMoments(APARTMENTS, pick('wieczor'), { includeSold: true })).toEqual([])
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
