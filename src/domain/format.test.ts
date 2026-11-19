import { describe, expect, it } from 'vitest'
import { formatArea, formatPerM2, formatPrice } from './format'

describe('grupowanie tysięcy', () => {
  it.each([[13173, '13 173 zł/m²'], [2430, '2 430 zł/m²'], [13173.6, '13 174 zł/m²']] as const)(
    'formatuje cenę za metr %i bez spacji przy ukośniku', (value, expected) => {
      expect(formatPerM2(value).replace(/\s/g, ' ')).toBe(expected)
    },
  )
  it.each([[2430, '2 430 zł'], [411000, '411 000 zł'], [1195000, '1 195 000 zł']] as const)(
    'formatuje cenę %i', (value, expected) => {
      expect(formatPrice(value).replace(/\s/g, ' ')).toBe(expected)
    },
  )
  it('grupuje również powierzchnię, zachowując część dziesiętną', () => {
    expect(formatArea(2430).replace(/\s/g, ' ')).toBe('2 430,0 m²')
  })
})
