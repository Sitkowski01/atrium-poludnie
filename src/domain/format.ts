import type { Facade, Status } from './types'

const money = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 })
const area = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** "754 000 zł" */
export const formatPrice = (n: number) => `${money.format(n)} zł`

/** "63,8 m²" */
export const formatArea = (n: number) => `${area.format(n)} m²`

/** 9.25 -> "9:15" */
export function formatHour(h: number): string {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${hh}:${String(mm).padStart(2, '0')}`
}

/** 8.25 -> "8 h 15 min" */
export function formatDuration(h: number): string {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  if (hh === 0) return `${mm} min`
  return mm === 0 ? `${hh} h` : `${hh} h ${mm} min`
}

export const floorLabel = (floor: number) => (floor === 0 ? 'parter' : `${floor}. piętro`)

export const roomsLabel = (n: number) => (n === 1 ? '1 pokój' : `${n} pokoje`)

export const FACADE_LABEL: Record<Facade, string> = { S: 'południe', E: 'wschód' }

export const STATUS_LABEL: Record<Status, string> = {
  wolne: 'wolne',
  rezerwacja: 'rezerwacja',
  sprzedane: 'sprzedane',
}

/** 1 wolne, 2 wolne, 5 wolnych, 12 wolnych, 22 wolne */
export function freeLabel(n: number): string {
  const last = n % 10
  const teen = n % 100 >= 12 && n % 100 <= 14
  return n === 1 || (last >= 2 && last <= 4 && !teen) ? `${n} wolne` : `${n} wolnych`
}
