import { describe, expect, it } from 'vitest'
import { activeFilterChips } from './activeFilters'
import { defaultFilters } from './filter'
import type { Limits } from './types'

const limits: Limits = { areaMin: 30, areaMax: 90, priceMin: 400000, priceMax: 1200000, floorMax: 6 }
const base = defaultFilters(limits)

describe('activeFilterChips', () => {
  it('nic nie zwraca dla filtrów domyślnych', () => {
    expect(activeFilterChips(base, limits)).toEqual([])
  })

  it('daje osobny chip na każdą liczbę pokoi i usuwa tylko tę liczbę', () => {
    const chips = activeFilterChips({ ...base, rooms: [3, 1, 2] }, limits)
    expect(chips.map((c) => c.label)).toEqual(['3 pokoje', '1 pokój', '2 pokoje'])
    expect(chips[0].patch).toEqual({ rooms: [1, 2] })
  })

  it('opisuje ekspozycję i cenę', () => {
    const chips = activeFilterChips({ ...base, facade: 'E', priceMax: 900000 }, limits)
    expect(chips.map((c) => c.label)).toEqual(['od wschodu', 'do 900 tys. zł'])
    expect(chips[0].patch).toEqual({ facade: 'all' })
    expect(chips[1].patch).toEqual({ priceMax: 1200000 })
  })

  it('opisuje metraż i przywraca oba końce', () => {
    const [min] = activeFilterChips({ ...base, areaMin: 45 }, limits)
    expect(min.label).toBe('od 45 m²')
    expect(min.patch).toEqual({ areaMin: 30, areaMax: 90 })
    const [both] = activeFilterChips({ ...base, areaMin: 45, areaMax: 70 }, limits)
    expect(both.label).toBe('45–70 m²')
  })

  it('opisuje piętra zwięźle', () => {
    const label = (floorMin: number, floorMax: number) =>
      activeFilterChips({ ...base, floorMin, floorMax }, limits)[0].label
    expect(label(0, 3)).toBe('od parteru do 3. piętra')
    expect(label(2, 5)).toBe('piętra 2–5')
    expect(label(4, 6)).toBe('od 4. piętra')
    expect(label(0, 0)).toBe('parter')
    expect(label(3, 3)).toBe('3. piętro')
  })

  it('obsługuje flagi', () => {
    const chips = activeFilterChips({ ...base, onlyAvailable: true, onlyFavourites: true }, limits)
    expect(chips.map((c) => c.label)).toEqual(['bez sprzedanych', 'tylko ulubione'])
    expect(chips[1].patch).toEqual({ onlyFavourites: false })
  })
})
