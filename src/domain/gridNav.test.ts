import { describe, expect, it } from 'vitest'
import { nextInGrid } from './gridNav'
import type { GridItem } from './gridNav'

const grid: readonly GridItem[] = Array.from({ length: 35 }, (_, index) => {
  const row = Math.floor(index / 5)
  const col = index % 5
  return { id: `${row}.0${col + 1}`, row, col }
})

const keys = [
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
]

describe('nextInGrid', () => {
  it.each([
    ['ArrowUp', '4.03'],
    ['ArrowDown', '2.03'],
    ['ArrowLeft', '3.02'],
    ['ArrowRight', '3.04'],
    ['Home', '3.01'],
    ['End', '3.05'],
    ['PageUp', '6.03'],
    ['PageDown', '0.03'],
  ])('%s wybiera właściwe mieszkanie', (key, expected) => {
    expect(nextInGrid(grid, '3.03', key)).toBe(expected)
  })

  it.each([
    ['ArrowUp', '6.03'],
    ['ArrowDown', '0.03'],
    ['ArrowLeft', '3.01'],
    ['ArrowRight', '3.05'],
    ['Home', '3.01'],
    ['End', '3.05'],
    ['PageUp', '6.03'],
    ['PageDown', '0.03'],
  ])('%s na krawędzi zwraca null', (key, currentId) => {
    expect(nextInGrid(grid, currentId, key)).toBeNull()
  })

  it.each([
    ['ArrowUp', '4.03', '5.03'],
    ['ArrowDown', '2.03', '1.03'],
    ['ArrowLeft', '3.02', '3.01'],
    ['ArrowRight', '3.04', '3.05'],
  ])('%s omija dziurę i wybiera najbliższy element w tej samej linii', (key, missing, expected) => {
    const items = grid.filter((item) => item.id !== missing)
    expect(nextInGrid(items, '3.03', key)).toBe(expected)
  })

  it.each([
    ['Home', '3.01', '3.02'],
    ['End', '3.05', '3.04'],
    ['PageUp', '6.03', '5.03'],
    ['PageDown', '0.03', '1.03'],
  ])('%s wybiera istniejący skrajny element', (key, missing, expected) => {
    expect(nextInGrid(grid.filter((item) => item.id !== missing), '3.03', key)).toBe(expected)
  })

  it.each(['Tab', 'Enter', 'Escape', '', 'arrowup'])('ignoruje klawisz %s', (key) => {
    expect(nextInGrid(grid, '3.03', key)).toBeNull()
  })

  it.each(keys)('%s obsługuje brak id, pustą listę i pojedynczy element', (key) => {
    expect(nextInGrid(grid, 'nieznane', key)).toBeNull()
    expect(nextInGrid([], '3.03', key)).toBeNull()
    expect(nextInGrid([{ id: '3.03', row: 3, col: 2 }], '3.03', key)).toBeNull()
  })

  it('nie zależy od kolejności elementów, także przy dziurach', () => {
    const items = grid.filter((item) => !['2.03', '3.04', '4.03'].includes(item.id))
    const reversed = [...items].reverse()
    const shuffled = [...items.filter((_, i) => i % 2), ...items.filter((_, i) => i % 2 === 0)]
    for (const item of items) {
      for (const key of keys) {
        const expected = nextInGrid(items, item.id, key)
        expect(nextInGrid(reversed, item.id, key)).toBe(expected)
        expect(nextInGrid(shuffled, item.id, key)).toBe(expected)
      }
    }
  })

  it('nie mutuje tablicy ani jej elementów', () => {
    const items = Object.freeze(grid.map((item) => Object.freeze({ ...item })))
    const before = items.map((item) => ({ ...item }))
    for (const item of items) {
      for (const key of keys) nextInGrid(items, item.id, key)
    }
    expect(items).toEqual(before)
  })
})
