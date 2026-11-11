import { describe, expect, it } from 'vitest'
import { DAY_END, DAY_START, sunShare, sunWindow } from './sun'
import type { Facade } from './types'

const FACADES: Facade[] = ['S', 'E']
const FLOORS = [1, 2, 3, 4, 5, 6]

describe('sunShare — udział okna godzin ze słońcem w salonie', () => {
  it('zawsze mieści się w zakresie 0..1', () => {
    const windows: [number, number][] = [[5, 21], [8, 12], [12, 13], [16, 19], [0, 24], [9.3, 17.7]]
    for (const facade of FACADES) {
      for (const floor of FLOORS) {
        for (const [from, to] of windows) {
          const share = sunShare(facade, floor, from, to)
          expect(share).toBeGreaterThanOrEqual(0)
          expect(share).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('okno całkowicie wewnątrz okna słońca daje 1', () => {
    const w = sunWindow('S', 6)
    expect(w).not.toBeNull()
    expect(w!.from).toBeLessThanOrEqual(11)
    expect(w!.to).toBeGreaterThanOrEqual(14)
    expect(sunShare('S', 6, 11, 14)).toBe(1)
  })

  it('okno bez słońca daje 0 (elewacja wschodnia po południu)', () => {
    const w = sunWindow('E', 3)
    // wschodnia elewacja traci słońce przed 17:00
    expect(w === null || w.to < 17).toBe(true)
    expect(sunShare('E', 3, 17, 20)).toBe(0)
  })

  it('zgodność z sunWindow: dla całego dnia udział ≈ (total + krok) / (dzień + krok)', () => {
    const step = 1 / 12
    for (const facade of FACADES) {
      for (const floor of FLOORS) {
        const w = sunWindow(facade, floor)
        const share = sunShare(facade, floor, DAY_START, DAY_END)
        if (w === null) {
          expect(share).toBe(0)
        } else {
          expect(share).toBeGreaterThan(0)
          expect(Math.abs(share - (w.total + step) / (DAY_END - DAY_START + step))).toBeLessThan(0.02)
        }
      }
    }
  })

  it('kolejność argumentów nie ma znaczenia', () => {
    for (const facade of FACADES) {
      for (const floor of FLOORS) {
        expect(sunShare(facade, floor, 15, 9)).toBe(sunShare(facade, floor, 9, 15))
      }
    }
  })

  it('puste okno daje 0', () => {
    expect(sunShare('S', 6, 12, 12)).toBe(0)
    expect(sunShare('E', 2, 8, 8)).toBe(0)
  })

  it('okno poza dniem daje 0 (przycięte do DAY_START..DAY_END)', () => {
    expect(sunShare('S', 6, 0, 4)).toBe(0)
    expect(sunShare('S', 6, 22, 23)).toBe(0)
    expect(sunShare('E', 3, 0, 4)).toBe(0)
  })

  it('okno obejmujące cały dzień i więcej daje to samo co sam dzień', () => {
    expect(sunShare('S', 4, 0, 24)).toBe(sunShare('S', 4, DAY_START, DAY_END))
  })

  it('popołudnie na południowej elewacji: niższe piętro nie ma większego udziału niż wyższe', () => {
    let prev = -1
    for (const floor of FLOORS) {
      const share = sunShare('S', floor, 16, 19)
      expect(share).toBeGreaterThanOrEqual(prev)
      prev = share
    }
  })

  it('pamięć podręczna nie zmienia wyniku', () => {
    const first = sunShare('S', 3, 9.25, 15.5)
    expect(sunShare('S', 3, 9.25, 15.5)).toBe(first)
    expect(sunShare('S', 3, 15.5, 9.25)).toBe(first)
  })
})
