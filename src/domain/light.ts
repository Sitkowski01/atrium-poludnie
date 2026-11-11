import { sunShare } from './sun'
import type { Apartment } from './types'

/** Pora dnia, którą użytkownik spędza w domu. Godziny w ułamkach (18.5 = 18:30). */
export interface Moment {
  id: string
  label: string
  /** krótko, z życia: po co ktoś jest wtedy w domu */
  note: string
  from: number
  to: number
}

export const MOMENTS: readonly Moment[] = [
  { id: 'poranek', label: 'Poranek', note: 'kawa, zanim wyjdziesz', from: 6, to: 9 },
  { id: 'przedpoludnie', label: 'Przed południem', note: 'praca z domu', from: 9, to: 12 },
  { id: 'poludnie', label: 'Południe', note: 'obiad, dzieci po szkole', from: 12, to: 15 },
  { id: 'popoludnie', label: 'Popołudnie', note: 'powrót, odpoczynek', from: 15, to: 18 },
  { id: 'wieczor', label: 'Wieczór', note: 'kolacja przy zachodzie', from: 18, to: 20.5 },
]

/** Od tej części „czasu w domu” ze słońcem w salonie mieszkanie uznajemy za dopasowane. */
export const MATCH_FROM = 0.5

export interface Match {
  apartment: Apartment
  /** jaka część czasu w domu ma słońce w salonie (0..1), ważona długością pór */
  share: number
}

/**
 * Mieszkania, w których słońce wpada do salonu przez większość czasu, gdy użytkownik jest w domu.
 * Sprzedane pomijamy. Kolejność: najlepszy udział, potem cena. Brak pór = brak wyników.
 */
export function matchMoments(apartments: readonly Apartment[], moments: readonly Moment[]): Match[] {
  const total = moments.reduce((s, m) => s + (m.to - m.from), 0)
  if (total <= 0) return []
  return apartments
    .filter((a) => a.status !== 'sprzedane')
    .map((a) => ({
      apartment: a,
      share: moments.reduce((s, m) => s + sunShare(a.facade, a.floor, m.from, m.to) * (m.to - m.from), 0) / total,
    }))
    .filter((m) => m.share >= MATCH_FROM)
    .sort((x, y) => y.share - x.share || x.apartment.price - y.apartment.price)
}
