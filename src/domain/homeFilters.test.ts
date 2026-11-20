import { describe, expect, it } from 'vitest'
import { APARTMENTS } from './data'
import { activeFilterChips } from './activeFilters'
import { applyFilters, countActive, defaultFilters, limitsOf, sortApartments } from './filter'
import { MATCH_FROM, MOMENTS, homeHours, matchMoments } from './light'
import { sunShare, sunWindow } from './sun'

const limits = limitsOf(APARTMENTS)
const base = defaultFilters(limits)
const home = ['poranek', 'popoludnie']
const moments = MOMENTS.filter((m) => home.includes(m.id))
const ids = (list: readonly { id: string }[]) => list.map((a) => a.id)

describe('pory w domu jako kryterium jednej listy', () => {
  it('puste home zachowuje wszystkie mieszkania i pozostałe kryteria', () => {
    expect(base.home).toEqual([])
    expect(applyFilters(APARTMENTS, base, [])).toEqual(APARTMENTS)
    expect(applyFilters(APARTMENTS, { ...base, rooms: [2] }, [])).toEqual(APARTMENTS.filter((a) => a.rooms === 2))
  })

  it('poranek i popołudnie z onlyAvailable dają dotychczasowe 16 dopasowań', () => {
    const result = applyFilters(APARTMENTS, { ...base, home, onlyAvailable: true }, [])
    expect(result).toHaveLength(16)
    expect(ids(result).sort()).toEqual(ids(matchMoments(APARTMENTS, moments).map((m) => m.apartment)).sort())
  })

  it('filtr pór pomija sprzedane, tak jak licznik w rozdziale „Światło”', () => {
    const result = applyFilters(APARTMENTS, { ...base, home }, [])
    expect(result.some((a) => a.status === 'sprzedane')).toBe(false)
    expect(ids(result).sort()).toEqual(ids(matchMoments(APARTMENTS, moments).map((m) => m.apartment)).sort())
  })

  it('łączy pory z pokojami, ceną, piętrem, ekspozycją i ulubionymi', () => {
    const result = applyFilters(APARTMENTS, { ...base, home, rooms: [2], facade: 'S', floorMin: 3, priceMax: 900000, onlyFavourites: true }, ['3.02', '5.02'])
    const expected = matchMoments(APARTMENTS, moments).map((m) => m.apartment)
      .filter((a) => a.rooms === 2 && a.facade === 'S' && a.floor >= 3 && a.price <= 900000 && ['3.02', '5.02'].includes(a.id))
    expect(result.length).toBeGreaterThan(0)
    expect(ids(result).sort()).toEqual(ids(expected).sort())
  })

  it('dla wszystkich 31 zestawów pór stosuje ważony próg MATCH_FROM', () => {
    for (let mask = 1; mask < 1 << MOMENTS.length; mask++) {
      const selected = MOMENTS.filter((_, i) => mask & (1 << i))
      const result = applyFilters(APARTMENTS, { ...base, home: selected.map((m) => m.id) }, [])
      const expected = APARTMENTS.filter((a) => a.status !== 'sprzedane' && selected.reduce((sum, m) =>
        sum + sunShare(a.facade, a.floor, m.from, m.to) * (m.to - m.from), 0) / homeHours(selected) >= MATCH_FROM)
      expect(result).toEqual(expected)
    }
  })

  it('wieczór bez słońca nie daje wyników', () => {
    expect(applyFilters(APARTMENTS, { ...base, home: ['wieczor'] }, [])).toEqual([])
  })

  it('liczy kilka pór jako jeden filtr', () => {
    expect(countActive(base, limits)).toBe(0)
    expect(countActive({ ...base, home }, limits)).toBe(1)
    expect(countActive({ ...base, home, onlyAvailable: true }, limits)).toBe(2)
  })

  it('tworzy jeden chip w kolejności dnia i czyści tylko home', () => {
    const chips = activeFilterChips({ ...base, home: [...home].reverse(), rooms: [2] }, limits)
    expect(chips[0]).toEqual({ id: 'home', label: 'w domu: poranek, popołudnie', patch: { home: [] } })
    expect(chips[1].label).toBe('2 pokoje')
  })

  it.each([moments, [MOMENTS[0]], [MOMENTS[2]], MOMENTS].map((selection) => ({ selection })))('sortuje jak matchMoments, także sprzedane i remisy ($selection)', ({ selection }) => {
    const matches = matchMoments(APARTMENTS, selection, { includeSold: true })
    const list = matches.map((m) => m.apartment).reverse()
    const original = [...list]
    expect(sortApartments(list, 'sun-home', selection)).toEqual(matches.map((m) => m.apartment))
    expect(list).toEqual(original)
  })

  it('bez pór sortuje po cenie, a sortowanie nigdy nie usuwa mieszkań', () => {
    expect(sortApartments(APARTMENTS, 'sun-home')).toEqual(sortApartments(APARTMENTS, 'price-asc'))
    expect(sortApartments(APARTMENTS, 'sun-home', [])).toEqual(sortApartments(APARTMENTS, 'price-asc'))
    expect(sortApartments(APARTMENTS, 'sun-home', moments)).toHaveLength(APARTMENTS.length)
  })
})

describe('sortowanie domyślne „Polecane”', () => {
  it('sprzedane na końcu, a w każdym typie od największego słońca', () => {
    const sorted = sortApartments(APARTMENTS, 'sun-desc')
    const firstSold = sorted.findIndex((a) => a.status === 'sprzedane')
    expect(sorted.slice(firstSold).every((a) => a.status === 'sprzedane')).toBe(true)
    const sun = (a: (typeof APARTMENTS)[number]) => sunWindow(a.facade, a.floor)?.total ?? 0
    for (const slot of [0, 1, 2, 3, 4]) {
      const free = sorted.filter((a) => a.slot === slot && a.status === 'wolne')
      for (let i = 1; i < free.length; i++) expect(sun(free[i])).toBeLessThanOrEqual(sun(free[i - 1]) + 1e-9)
    }
  })
  it('na początku listy stoją różne typy, nie siedem takich samych kawalerek', () => {
    const first = sortApartments(APARTMENTS, 'sun-desc').slice(0, 8)
    expect(new Set(first.map((a) => a.slot)).size).toBeGreaterThan(1)
  })
})
