import { describe, expect, it } from 'vitest'
import { dayTint } from './dayTint'

describe('dayTint', () => {
  it('w południe papier zostaje prawie neutralny', () => {
    expect(dayTint(12).alpha).toBeLessThanOrEqual(0.03)
  })
  it('świt i zachód są cieplejsze i wyraźniejsze niż południe', () => {
    const dawn = dayTint(6.6)
    const sunset = dayTint(19)
    expect(dawn.alpha).toBeGreaterThan(dayTint(12).alpha)
    expect(sunset.alpha).toBeGreaterThan(dayTint(12).alpha)
    expect(sunset.rgb[0]).toBeGreaterThan(sunset.rgb[2]) // więcej czerwieni niż błękitu
  })
  it('nigdy nie przekracza 0,14 krycia (kontrast tekstu --ink-2 zostaje powyżej 4,5:1)', () => {
    for (let h = 0; h <= 24; h += 0.25) expect(dayTint(h).alpha).toBeLessThanOrEqual(0.14)
  })
  it('przechodzi płynnie między punktami', () => {
    const a = dayTint(17.5)
    const b = dayTint(17.55)
    expect(Math.abs(a.alpha - b.alpha)).toBeLessThan(0.005)
  })
})
