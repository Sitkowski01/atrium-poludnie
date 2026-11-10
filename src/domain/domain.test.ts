import { describe, expect, it } from 'vitest'
import { APARTMENTS } from './data'
import { applyFilters, countActive, defaultFilters, limitsOf, sortApartments } from './filter'
import { formatDuration, formatHour } from './format'
import { directSun, facadeLight, sunAt, sunWindow } from './sun'

describe('dane', () => {
  it('35 mieszkań o unikalnych numerach', () => {
    expect(APARTMENTS).toHaveLength(35)
    expect(new Set(APARTMENTS.map((a) => a.id)).size).toBe(35)
  })

  it('pomieszczenia wypełniają obrys, a metraż z nich wynika', () => {
    for (const a of APARTMENTS) {
      const inside = a.plan.filter((r) => r.kind !== 'balkon')
      const sum = inside.reduce((s, r) => s + r.w * r.h, 0)
      expect(sum).toBeCloseTo(a.planW * a.planH, 6)
      expect(a.area).toBeCloseTo(sum, 1)
      for (const r of inside) {
        expect(r.x + r.w).toBeLessThanOrEqual(a.planW + 1e-9)
        expect(r.y + r.h).toBeLessThanOrEqual(a.planH + 1e-9)
      }
      expect(a.plan.some((r) => r.kind === 'balkon')).toBe(a.balcony)
    }
  })

  it('wyższe piętro tego samego typu nie jest tańsze o więcej niż wahanie', () => {
    const low = APARTMENTS.find((a) => a.id === '0.01')!
    const high = APARTMENTS.find((a) => a.id === '6.01')!
    expect(high.price).toBeGreaterThan(low.price)
  })
})

describe('słońce', () => {
  it('noc poza dniem, szczyt około 13', () => {
    expect(sunAt(4).elevation).toBeLessThan(0)
    expect(sunAt(13).elevation).toBeCloseTo(60, 5)
    expect(sunAt(13).azimuth).toBeCloseTo(180, 5)
  })

  it('wschód świeci rano, południe po południu', () => {
    expect(facadeLight('E', 8)).toBeGreaterThan(0.8)
    expect(facadeLight('E', 17)).toBe(0)
    expect(facadeLight('S', 13)).toBeCloseTo(1, 5)
    expect(directSun('E', 6, 16)).toBe(0)
    expect(directSun('S', 6, 15)).toBeGreaterThan(0)
  })

  it('niższe piętra tracą popołudniowe słońce wcześniej', () => {
    const ground = sunWindow('S', 0)!
    const top = sunWindow('S', 6)!
    expect(top.to).toBeGreaterThan(ground.to + 1)
    expect(top.total).toBeGreaterThan(ground.total)
  })
})

describe('filtry', () => {
  const limits = limitsOf(APARTMENTS)
  const base = defaultFilters(limits)

  it('ustawienia domyślne niczego nie ukrywają', () => {
    expect(applyFilters(APARTMENTS, base, [])).toHaveLength(35)
    expect(countActive(base, limits)).toBe(0)
  })

  it('łączy warunki', () => {
    const f = { ...base, rooms: [3, 4], facade: 'S' as const, floorMin: 4, onlyAvailable: true }
    const out = applyFilters(APARTMENTS, f, [])
    expect(out.length).toBeGreaterThan(0)
    for (const a of out) {
      expect([3, 4]).toContain(a.rooms)
      expect(a.floor).toBeGreaterThanOrEqual(4)
      expect(a.status).not.toBe('sprzedane')
    }
    expect(countActive(f, limits)).toBe(4)
  })

  it('ulubione i sortowanie', () => {
    const out = applyFilters(APARTMENTS, { ...base, onlyFavourites: true }, ['2.03', '5.01'])
    expect(out.map((a) => a.id).sort()).toEqual(['2.03', '5.01'])
    const sorted = sortApartments(APARTMENTS, 'price-desc')
    expect(sorted[0].price).toBeGreaterThanOrEqual(sorted[34].price)
    expect(APARTMENTS[0].id).toBe('0.01')
  })
})

describe('formatowanie', () => {
  it('godziny i czas trwania', () => {
    expect(formatHour(9.25)).toBe('9:15')
    expect(formatHour(13)).toBe('13:00')
    expect(formatDuration(8.25)).toBe('8 h 15 min')
    expect(formatDuration(0.5)).toBe('30 min')
  })
})
