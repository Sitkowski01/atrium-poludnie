import { defaultFilters } from './filter'
import { floorLabel, roomsLabel } from './format'
import type { Filters, Limits } from './types'

export interface ActiveFilterChip {
  /** stabilny klucz chipa, np. "rooms-3" */
  id: string
  /** etykieta po polsku, np. "3 pokoje" */
  label: string
  /** patch do `setFilters`, który przywraca tylko ten warunek do wartości domyślnej */
  patch: Partial<Filters>
}

const num = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 })

const areaText = (n: number) => `${num.format(n)} m²`

/** 900000 -> "do 900 tys. zł", 912500 -> "do 912,5 tys. zł" */
export function priceMaxLabel(n: number): string {
  return `do ${num.format(n / 1000)} tys. zł`
}

function floorsLabel(min: number, max: number, d: Filters): string {
  if (min === max) return floorLabel(min)
  if (min === d.floorMin) return `od parteru do ${max}. piętra`
  if (max === d.floorMax) return `od ${min}. piętra`
  return `piętra ${min}–${max}`
}

/** Chipy aktywnych filtrów, w kolejności: pokoje, ekspozycja, cena, metraż, piętra, flagi. */
export function activeFilterChips(f: Filters, limits: Limits): ActiveFilterChip[] {
  const d = defaultFilters(limits)
  const chips: ActiveFilterChip[] = []

  for (const n of f.rooms) {
    chips.push({
      id: `rooms-${n}`,
      label: roomsLabel(n),
      patch: { rooms: f.rooms.filter((r) => r !== n) },
    })
  }
  if (f.facade !== 'all') {
    chips.push({
      id: 'facade',
      label: f.facade === 'S' ? 'od południa' : 'od wschodu',
      patch: { facade: d.facade },
    })
  }
  if (f.priceMax !== d.priceMax) {
    chips.push({ id: 'price', label: priceMaxLabel(f.priceMax), patch: { priceMax: d.priceMax } })
  }
  if (f.areaMin !== d.areaMin || f.areaMax !== d.areaMax) {
    const minSet = f.areaMin !== d.areaMin
    const maxSet = f.areaMax !== d.areaMax
    const label =
      minSet && maxSet
        ? `${num.format(f.areaMin)}–${areaText(f.areaMax)}`
        : minSet
          ? `od ${areaText(f.areaMin)}`
          : `do ${areaText(f.areaMax)}`
    chips.push({ id: 'area', label, patch: { areaMin: d.areaMin, areaMax: d.areaMax } })
  }
  if (f.floorMin !== d.floorMin || f.floorMax !== d.floorMax) {
    chips.push({
      id: 'floors',
      label: floorsLabel(f.floorMin, f.floorMax, d),
      patch: { floorMin: d.floorMin, floorMax: d.floorMax },
    })
  }
  if (f.onlyAvailable) {
    chips.push({ id: 'available', label: 'bez sprzedanych', patch: { onlyAvailable: false } })
  }
  if (f.onlyFavourites) {
    chips.push({ id: 'favourites', label: 'tylko ulubione', patch: { onlyFavourites: false } })
  }
  return chips
}
