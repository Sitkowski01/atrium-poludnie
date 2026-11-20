import { useEffect, useRef } from 'react'
import { dayTint } from '../domain/dayTint'
import { useHour } from '../state/store'

/**
 * Strona oddycha porą dnia: suwak pod bryłą barwi też papier całej strony (świt, złote popołudnie,
 * zmierzch). Rysuje warstwę światła pod treścią; te same zmienne dostaje pasek nagłówka (app.css).
 * Zmienne ustawiamy tylko na tych dwóch elementach, nie na <html>: zmiana na korzeniu przeliczała style
 * całej strony w każdej klatce przelotu słońca.
 */
export function DayLight() {
  const { hour } = useHour()
  const { rgb, alpha } = dayTint(hour)
  const [r, g, b] = rgb
  const layer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const targets = [layer.current, document.querySelector<HTMLElement>('.topbar')]
    for (const el of targets) {
      if (!el) continue
      el.style.setProperty('--day-r', String(r))
      el.style.setProperty('--day-g', String(g))
      el.style.setProperty('--day-b', String(b))
      el.style.setProperty('--day-a', alpha.toFixed(3))
    }
  }, [r, g, b, alpha])
  return <div ref={layer} className="daylight" aria-hidden="true" />
}
