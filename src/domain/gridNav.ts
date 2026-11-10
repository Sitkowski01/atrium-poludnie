export interface GridItem {
  id: string
  /** kondygnacja; większa = wyżej */
  row: number
  /** pozycja na piętrze; mniejsza = bardziej w lewo */
  col: number
}

/**
 * Zwraca id elementu, na który ma przejść fokus po naciśnięciu klawisza,
 * albo null, gdy klawisz nie dotyczy nawigacji lub nie ma dokąd przejść.
 */
export function nextInGrid(
  items: readonly GridItem[],
  currentId: string,
  key: string,
): string | null {
  const current = items.find((item) => item.id === currentId)
  if (!current) return null

  let candidates: GridItem[]
  let compare: (a: GridItem, b: GridItem) => number
  switch (key) {
    case 'ArrowUp':
      candidates = items.filter((item) => item.col === current.col && item.row > current.row)
      compare = (a, b) => a.row - b.row
      break
    case 'ArrowDown':
      candidates = items.filter((item) => item.col === current.col && item.row < current.row)
      compare = (a, b) => b.row - a.row
      break
    case 'ArrowLeft':
      candidates = items.filter((item) => item.row === current.row && item.col < current.col)
      compare = (a, b) => b.col - a.col
      break
    case 'ArrowRight':
      candidates = items.filter((item) => item.row === current.row && item.col > current.col)
      compare = (a, b) => a.col - b.col
      break
    case 'Home':
    case 'End':
      candidates = items.filter((item) => item.row === current.row)
      compare = key === 'Home' ? (a, b) => a.col - b.col : (a, b) => b.col - a.col
      break
    case 'PageUp':
    case 'PageDown':
      candidates = items.filter((item) => item.col === current.col)
      compare = key === 'PageUp' ? (a, b) => b.row - a.row : (a, b) => a.row - b.row
      break
    default:
      return null
  }

  const target = candidates.sort(compare)[0]
  return target && target.id !== currentId ? target.id : null
}
