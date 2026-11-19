import { describe, expect, it } from 'vitest'
import { sunAt, sunCaption, sunFrom, sunRange, sunWindow } from './sun'
import { FLOORS } from './data'

describe('sunRange — zakres wszystkich pięter', () => {
  it.each(['S', 'E'] as const)('obejmuje skrajne godziny elewacji %s', (facade) => {
    const windows = Array.from({ length: FLOORS }, (_, floor) => sunWindow(facade, floor)!)
    const range = sunRange(facade)!
    expect(range.from).toBe(Math.min(...windows.map((window) => window.from)))
    expect(range.to).toBe(Math.max(...windows.map((window) => window.to)))
    expect(range.from).toBeLessThanOrEqual(windows[3].from)
    expect(range.to).toBeGreaterThanOrEqual(windows[3].to)
    expect(range).not.toEqual({ from: windows[0].from, to: windows[0].to })
  })
  it('rozróżnia wschód i południe', () => {
    expect(sunRange('E')!.from).toBeLessThan(sunRange('S')!.from)
    expect(sunRange('E')!.to).toBeLessThan(sunRange('S')!.to)
  })
})

describe('sunFrom — kierunek padania światła', () => {
  it('osiem kierunków głównych', () => {
    const cases: [number, string][] = [
      [0, 'z północy'],
      [45, 'z północnego wschodu'],
      [90, 'ze wschodu'],
      [135, 'z południowego wschodu'],
      [180, 'z południa'],
      [225, 'z południowego zachodu'],
      [270, 'z zachodu'],
      [315, 'z północnego zachodu'],
    ]
    for (const [azimuth, expected] of cases) {
      expect(sunFrom(azimuth)).toBe(expected)
    }
  })

  it('granice sektorów: 22 i 23 stopnie, 337 i 338 stopni', () => {
    expect(sunFrom(22)).toBe('z północy')
    expect(sunFrom(23)).toBe('z północnego wschodu')
    expect(sunFrom(337)).toBe('z północnego zachodu')
    expect(sunFrom(338)).toBe('z północy')
  })

  it('dokładnie 22,5 stopnia zaokrągla się w górę (Math.round(0.5) = 1)', () => {
    expect(sunFrom(22.5)).toBe('z północnego wschodu')
  })

  it('dokładnie 337,5 stopnia zawija się do północy (7,5 zaokrągla się do 8, a 8 % 8 = 0)', () => {
    expect(sunFrom(337.5)).toBe('z północy')
  })

  it('zawija azymuty spoza 0..360', () => {
    expect(sunFrom(360)).toBe('z północy')
    expect(sunFrom(405)).toBe('z północnego wschodu')
    expect(sunFrom(-45)).toBe('z północnego zachodu')
    expect(sunFrom(-90)).toBe('z zachodu')
  })

  it('jest spójna z modelem dnia: start, południe, koniec', () => {
    // sunAt: azymut = 50 + t * 260, t = (h - 5) / 16 -> 50, 180, 310 stopni
    expect(sunFrom(sunAt(5).azimuth)).toBe('z północnego wschodu')
    expect(sunFrom(sunAt(13).azimuth)).toBe('z południa')
    expect(sunFrom(sunAt(21).azimuth)).toBe('z północnego zachodu')
  })
})

describe('sunCaption — podpis pod suwakiem pory dnia', () => {
  it('w dzień podaje kierunek i wysokość słońca', () => {
    expect(sunCaption(13)).toBe('słońce z południa · 60° nad horyzontem')
  })
  it('przed wschodem i po zachodzie mówi to wprost', () => {
    expect(sunCaption(4.5)).toBe('słońce jeszcze nie wzeszło')
    expect(sunCaption(21.5)).toBe('słońce już zaszło')
  })
})
