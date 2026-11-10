import type { Apartment, Filters, Limits, SortKey } from './types'

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
  return list.filter(
    (a) =>
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

export function sortApartments(list: readonly Apartment[], key: SortKey): Apartment[] {
  const out = [...list]
  switch (key) {
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
  if (f.rooms.length > 0) n++
  if (f.areaMin !== d.areaMin || f.areaMax !== d.areaMax) n++
  if (f.priceMax !== d.priceMax) n++
  if (f.floorMin !== d.floorMin || f.floorMax !== d.floorMax) n++
  if (f.facade !== 'all') n++
  if (f.onlyAvailable) n++
  if (f.onlyFavourites) n++
  return n
}
