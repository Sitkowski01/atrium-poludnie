import { sunShare, sunWindow } from './sun'
import type { Apartment, Facade } from './types'

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
  { id: 'przedpoludnie', label: 'Przedpołudnie', note: 'praca z domu', from: 9, to: 12 },
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
  /** Drugi klucz kolejności: najwcześniejsze słońce w wybranych godzinach w domu. */
  firstSunAt: number
}

/** Łączna długość wybranych pór w domu, w godzinach. */
export function homeHours(moments: readonly Moment[]): number {
  return moments.reduce((total, moment) => total + (moment.to - moment.from), 0)
}

/**
 * Mieszkania, w których słońce wpada do salonu przez większość czasu, gdy użytkownik jest w domu.
 * Sprzedane pomijamy. Kolejność: udział, najwcześniejsze słońce w domu,
 * całodzienne słońce, piętro, cena, identyfikator.
 * Różnicę udziału poniżej 0.005 traktujemy jako remis. Brak pór = brak wyników.
 */
export function matchMoments(
  apartments: readonly Apartment[],
  moments: readonly Moment[],
  opts: { includeSold?: boolean } = {},
): Match[] {
  const total = homeHours(moments)
  if (total <= 0) return []
  return apartments
    .filter((a) => opts.includeSold || a.status !== 'sprzedane')
    .map((a) => {
      const sun = sunWindow(a.facade, a.floor)
      const firstSunAt = moments.reduce((earliest, moment) => {
        if (!sun) return earliest
        const from = Math.max(moment.from, sun.from)
        const to = Math.min(moment.to, sun.to)
        return from < to ? Math.min(earliest, from) : earliest
      }, Infinity)
      return {
        apartment: a,
        share: moments.reduce((s, m) => s + sunShare(a.facade, a.floor, m.from, m.to) * (m.to - m.from), 0) / total,
        firstSunAt,
      }
    })
    .filter((m) => m.share >= MATCH_FROM)
    .sort((x, y) => {
      if (Math.abs(y.share - x.share) >= 0.005) return y.share - x.share
      const a = x.apartment
      const b = y.apartment
      return (
        x.firstSunAt - y.firstSunAt ||
        (sunWindow(b.facade, b.floor)?.total ?? 0) - (sunWindow(a.facade, a.floor)?.total ?? 0) ||
        b.floor - a.floor ||
        a.price - b.price ||
        a.id.localeCompare(b.id)
      )
    })
}

export interface MatchSummary {
  /** Wszystkie niesprzedane mieszkania tej elewacji pasują, a z innych żadne. */
  wholeFacade: Facade | null
  /** Elewacje bez dopasowań, z końcem słońca na referencyjnym piętrze 3. */
  missed: { facade: Facade; sunUntil: number | null }[]
}

export function summarizeMatches(
  apartments: readonly Apartment[],
  moments: readonly Moment[],
  matches: readonly Match[],
): MatchSummary {
  if (moments.length === 0) return { wholeFacade: null, missed: [] }
  const facades: Facade[] = ['S', 'E']
  const available = apartments.filter((a) => a.status !== 'sprzedane')
  const matchedIds = new Set(matches.map((m) => m.apartment.id))
  const matched = available.filter((a) => matchedIds.has(a.id))
  const wholeFacade = facades.find((facade) =>
    matched.some((a) => a.facade === facade) &&
    matched.every((a) => a.facade === facade) &&
    available.filter((a) => a.facade === facade).every((a) => matchedIds.has(a.id)),
  ) ?? null
  // elewacja bez dostępnych mieszkań (wszystko sprzedane) nie „odpada przez słońce”, więc jej nie tłumaczymy
  const missed = facades
    .filter((facade) => available.some((a) => a.facade === facade))
    .filter((facade) => !matched.some((a) => a.facade === facade))
    .map((facade) => ({ facade, sunUntil: sunWindow(facade, 3)?.to ?? null }))
  return { wholeFacade, missed }
}

/** Brak wolnych dopasowań, ale takie mieszkania istnieją wśród sprzedanych. */
export function onlySoldMatch(apartments: readonly Apartment[], moments: readonly Moment[]): boolean {
  return (
    matchMoments(apartments, moments).length === 0 && matchMoments(apartments, moments, { includeSold: true }).length > 0
  )
}
