import { describe, expect, it } from 'vitest'
import { formatArea, formatPrice } from './format'

describe('grupowanie tysięcy', () => {
  it.each([[2430, '2 430 zł'], [411000, '411 000 zł'], [1195000, '1 195 000 zł']] as const)(
    'formatuje cenę %i', (value, expected) => {
      expect(formatPrice(value).replace(/\s/g, ' ')).toBe(expected)
    },
  )
  it('grupuje również powierzchnię, zachowując część dziesiętną', () => {
    expect(formatArea(2430).replace(/\s/g, ' ')).toBe('2 430,0 m²')
  })
})
