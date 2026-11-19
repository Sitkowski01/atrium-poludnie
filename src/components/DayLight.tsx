import { useEffect } from 'react'
import { dayTint } from '../domain/dayTint'
import { useHour } from '../state/store'

/**
 * Strona oddycha porą dnia: suwak pod bryłą barwi też papier całej strony (świt, złote popołudnie,
 * zmierzch). Komponent nic nie rysuje — ustawia tylko zmienne na <html>, z których korzysta app.css.
 */
export function DayLight() {
  const { hour } = useHour()
  const { rgb, alpha } = dayTint(hour)
  const [r, g, b] = rgb
  useEffect(() => {
    const s = document.documentElement.style
    s.setProperty('--day-r', String(r))
    s.setProperty('--day-g', String(g))
    s.setProperty('--day-b', String(b))
    s.setProperty('--day-a', alpha.toFixed(3))
  }, [r, g, b, alpha])
  return null
}
