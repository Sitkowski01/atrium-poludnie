import { describe, expect, it } from 'vitest'
import { calcMortgage } from './mortgage'

describe('calcMortgage', () => {
  it('zgadza się ze wzorem annuitetu (400 000 zł, 25 lat, 7,5%)', () => {
    // 400000 * 0,00625 / (1 - 1,00625^-300), policzone niezależnie
    const r = calcMortgage({ price: 500000, downPaymentPct: 20, years: 25, ratePct: 7.5 })
    expect(r.downPayment).toBeCloseTo(100000, 6)
    expect(r.loan).toBeCloseTo(400000, 6)
    expect(r.monthly).toBeCloseTo(2955.96, 2)
  })

  it('stopa 0% daje kredyt / liczba miesięcy i brak odsetek', () => {
    const r = calcMortgage({ price: 600000, downPaymentPct: 50, years: 10, ratePct: 0 })
    expect(r.monthly).toBeCloseTo(300000 / 120, 6)
    expect(r.totalInterest).toBeCloseTo(0, 6)
  })

  it('wkład 100% daje zerowy kredyt bez NaN', () => {
    const r = calcMortgage({ price: 500000, downPaymentPct: 100, years: 25, ratePct: 7.5 })
    expect(r.loan).toBe(0)
    expect(r.monthly).toBe(0)
    expect(r.totalPaid).toBe(0)
    expect(r.totalInterest).toBe(0)
    for (const v of Object.values(r)) expect(Number.isNaN(v)).toBe(false)
  })

  it('totalPaid = rata × miesiące, odsetki = totalPaid − kredyt', () => {
    const r = calcMortgage({ price: 750000, downPaymentPct: 30, years: 30, ratePct: 6.2 })
    expect(r.totalPaid).toBeCloseTo(r.monthly * 360, 6)
    expect(r.totalInterest).toBeCloseTo(r.totalPaid - r.loan, 6)
    expect(r.totalInterest).toBeGreaterThan(0)
  })
})
