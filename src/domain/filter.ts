import type { Apartment, Filters, Limits, SortKey } from './types'
import { MOMENTS, matchMoments, type Moment } from './light'
import { sunWindow } from './sun'

export function limitsOf(list: readonly Apartment[]): Limits {
  const areas = list.map((a) => a.area)
  const prices = list.map((a) => a.price)
  return {
    areaMin: Math.floor(Math.min(...areas)),
    areaMax: Math.ceil(Math.max(...areas)),
    priceMin: Math.floor(Math.min(...prices) / 10000) * 10000,
    priceMax: Math.ceil(Math.max(...prices) / 10000) * 10000,
    floorMax: Math.max(...list.map((a) => a.floor)),
  }
}

export function defaultFilters(l: Limits): Filters {
  return {
    home: [],
    rooms: [],
    areaMin: l.areaMin,
    areaMax: l.areaMax,
    priceMax: l.priceMax,
    floorMin: 0,
    floorMax: l.floorMax,
    facade: 'all',
    onlyAvailable: false,
    onlyFavourites: false,
  }
}

export function applyFilters(
  list: readonly Apartment[],
  f: Filters,
  favourites: readonly string[],
): Apartment[] {
  const homeIds = f.home.length
    ? new Set(matchMoments(list, MOMENTS.filter((m) => f.home.includes(m.id)), { includeSold: true }).map((m) => m.apartment.id))
    : null
  return list.filter(
    (a) =>
      (!homeIds || homeIds.has(a.id)) &&
      (f.rooms.length === 0 || f.rooms.includes(a.rooms)) &&
      a.area >= f.areaMin &&
      a.area <= f.areaMax &&
      a.price <= f.priceMax &&
      a.floor >= f.floorMin &&
      a.floor <= f.floorMax &&
      (f.facade === 'all' || a.facade === f.facade) &&
      (!f.onlyAvailable || a.status !== 'sprzedane') &&
      (!f.onlyFavourites || favourites.includes(a.id)),
  )
}

export function sortApartments(list: readonly Apartment[], key: SortKey, home: readonly Moment[] = []): Apartment[] {
  const out = [...list]
  switch (key) {
    case 'sun-home': {
      if (home.length === 0) return sortApartments(list, 'price-asc')
      const ranks = new Map(matchMoments(list, home, { includeSold: true }).map((m, i) => [m.apartment.id, i]))
      // Sortowanie nie usuwa danych: niedopasowane trafiają za dopasowane, według ceny.
      return out.sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity) || a.price - b.price)
    }
    case 'sun-desc': {
      // „Polecane”: najpierw dostępne (wolne, potem zarezerwowane, sprzedane na końcu); w każdym typie
      // od największego słońca, a typy na przemian — pierwsze wiersze to pięć różnych układów i dwie strony budynku
      const sun = (a: Apartment) => sunWindow(a.facade, a.floor)?.total ?? 0
      const rank = { wolne: 0, rezerwacja: 1, sprzedane: 2 } as const
      const byType = new Map<number, Apartment[]>()
      for (const a of [...out].sort((x, y) => sun(y) - sun(x) || y.floor - x.floor || x.price - y.price)) {
        byType.set(a.slot, [...(byType.get(a.slot) ?? []), a])
      }
      const pos = new Map<string, number>()
      for (const list of byType.values()) list.forEach((a, i) => pos.set(a.id, i))
      return out.sort(
        (a, b) =>
          rank[a.status] - rank[b.status] ||
          (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0) ||
          sun(b) - sun(a) ||
          a.slot - b.slot,
      )
    }
    case 'price-asc':
      return out.sort((a, b) => a.price - b.price)
    case 'price-desc':
      return out.sort((a, b) => b.price - a.price)
    case 'area-desc':
      return out.sort((a, b) => b.area - a.area || a.price - b.price)
    case 'floor-desc':
      return out.sort((a, b) => b.floor - a.floor || a.slot - b.slot)
  }
}

/** Ile filtrów różni się od ustawień domyślnych. */
export function countActive(f: Filters, l: Limits): number {
  const d = defaultFilters(l)
  let n = 0
  if (f.home.length > 0) n++
  if (f.rooms.length > 0) n++
  if (f.areaMin !== d.areaMin || f.areaMax !== d.areaMax) n++
  if (f.priceMax !== d.priceMax) n++
  if (f.floorMin !== d.floorMin || f.floorMax !== d.floorMax) n++
  if (f.facade !== 'all') n++
  if (f.onlyAvailable) n++
  if (f.onlyFavourites) n++
  return n
}
