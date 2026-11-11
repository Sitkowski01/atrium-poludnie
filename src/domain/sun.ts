import type { Facade } from './types'

/**
 * Uproszczony model słońca dla długiego letniego dnia (ok. 53°N).
 * Nie jest to efemeryda — ma dawać wiarygodny, powtarzalny obraz.
 */
export const DAY_START = 5
export const DAY_END = 21

/** Azymut normalnej elewacji, stopnie zgodnie z ruchem wskazówek zegara od północy. */
const NORMAL: Record<Facade, number> = { S: 180, E: 90 }

const rad = (deg: number) => (deg * Math.PI) / 180

export interface SunState {
  hour: number
  /** stopnie: 90 = wschód, 180 = południe, 270 = zachód */
  azimuth: number
  /** stopnie nad horyzontem; ujemne = noc */
  elevation: number
  /** 0 = noc, 1 = pełny dzień */
  daylight: number
}

export function sunAt(hour: number): SunState {
  const t = (hour - DAY_START) / (DAY_END - DAY_START)
  const azimuth = 50 + t * 260
  const elevation = t < 0 || t > 1 ? -8 : 60 * Math.sin(Math.PI * t)
  const daylight = Math.max(0, Math.min(1, elevation / 14))
  return { hour, azimuth, elevation, daylight }
}

/** Kierunek, z którego pada światło, po polsku („z południa”, „ze wschodu”); azymut w stopniach od północy. */
export function sunFrom(azimuth: number): string {
  const names = ['z północy', 'z północnego wschodu', 'ze wschodu', 'z południowego wschodu', 'z południa', 'z południowego zachodu', 'z zachodu', 'z północnego zachodu']
  return names[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8]
}

/** Podpis pod suwakiem pory dnia, np. „słońce z południa · 55° nad horyzontem”. */
export function sunCaption(hour: number): string {
  const sun = sunAt(hour)
  // zaokrąglone, bo sin(π) daje ok. 7e-15 zamiast 0 i o 21:00 wychodziło „0° nad horyzontem”
  if (Math.round(sun.elevation) <= 0) return hour < 12 ? 'słońce jeszcze nie wzeszło' : 'słońce już zaszło'
  return `słońce ${sunFrom(sun.azimuth)} · ${Math.round(sun.elevation)}° nad horyzontem`
}

/** Jak mocno elewacja jest oświetlona (0..1) — do cieniowania bryły. */
export function facadeLight(facade: Facade, hour: number): number {
  const sun = sunAt(hour)
  if (sun.elevation <= 0) return 0
  return Math.max(0, Math.cos(rad(sun.azimuth - NORMAL[facade]))) * sun.daylight
}

/**
 * Kąt, poniżej którego słońce jest zasłonięte dla danego piętra.
 * Od południowego zachodu stoi sąsiedni budynek, więc niskie piętra
 * tracą popołudniowe słońce wcześniej.
 */
function obstruction(floor: number, azimuth: number): number {
  const below = 6 - floor
  return azimuth > 200 ? 10 + below * 6 : 4 + below * 3.5
}

/** Bezpośrednie słońce w oknach salonu (0..1) o danej godzinie. */
export function directSun(facade: Facade, floor: number, hour: number): number {
  const sun = sunAt(hour)
  if (sun.elevation <= obstruction(floor, sun.azimuth)) return 0
  const facing = Math.cos(rad(sun.azimuth - NORMAL[facade]))
  if (facing <= 0) return 0
  return facing * Math.cos(rad(sun.elevation))
}

export interface SunWindow {
  /** pierwsza i ostatnia godzina ze słońcem w oknach */
  from: number
  to: number
  /** łączny czas w godzinach */
  total: number
}

const STEP = 1 / 12

/** Od tej wartości directSun liczymy jako słońce w oknach. Jedno miejsce dla listy, wykresu i bryły. */
export const SUN_THRESHOLD = 0.05

const windowCache = new Map<string, SunWindow | null>()

export function sunWindow(facade: Facade, floor: number): SunWindow | null {
  const key = `${facade}${floor}`
  const cached = windowCache.get(key)
  if (cached !== undefined) return cached
  const result = computeSunWindow(facade, floor)
  windowCache.set(key, result)
  return result
}

function computeSunWindow(facade: Facade, floor: number): SunWindow | null {
  let from = -1
  let to = -1
  let count = 0
  for (let h = DAY_START; h <= DAY_END + 1e-9; h += STEP) {
    if (directSun(facade, floor, h) > SUN_THRESHOLD) {
      if (from < 0) from = h
      to = h
      count++
    }
  }
  if (from < 0) return null
  return { from, to, total: (count - 1) * STEP }
}

export interface SunSample {
  hour: number
  value: number
}

/** Przebieg nasłonecznienia w ciągu dnia — dane do wykresu. */
export function sunProfile(facade: Facade, floor: number, step = 0.5): SunSample[] {
  const out: SunSample[] = []
  for (let h = DAY_START; h <= DAY_END + 1e-9; h += step) {
    out.push({ hour: Math.round(h * 100) / 100, value: directSun(facade, floor, h) })
  }
  return out
}

const shareCache = new Map<string, number>()

/**
 * Jaka część okna godzin [from, to] ma bezpośrednie słońce w salonie (0..1), próbkowanie co 5 minut.
 * Odpowiada na pytanie „czy słońce jest wtedy, kiedy jestem w domu”. Puste okno (from >= to) daje 0.
 */
export function sunShare(facade: Facade, floor: number, from: number, to: number): number {
  const a = Math.max(DAY_START, Math.min(from, to))
  const b = Math.min(DAY_END, Math.max(from, to))
  if (b - a < 1e-9) return 0
  const key = `${facade}${floor}:${a.toFixed(3)}-${b.toFixed(3)}`
  const cached = shareCache.get(key)
  if (cached !== undefined) return cached
  const step = 1 / 12
  let lit = 0
  let all = 0
  for (let h = a; h <= b + 1e-9; h += step) {
    all++
    if (directSun(facade, floor, h) > SUN_THRESHOLD) lit++
  }
  const result = all ? lit / all : 0
  shareCache.set(key, result)
  return result
}
