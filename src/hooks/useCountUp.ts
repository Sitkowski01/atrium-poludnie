import { useEffect, useRef, useState } from 'react'

interface Options {
  /** czas dojścia do nowej wartości w ms */
  duration?: number
  /** wartość startowa przy pierwszym renderze; domyślnie od razu wartość docelowa */
  from?: number
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Liczba, która płynnie „dochodzi” do wartości docelowej.
 * Zwraca wartość niezaokrągloną — zaokrągla i formatuje widok.
 * Przy prefers-reduced-motion zwraca od razu wartość docelową.
 *
 * Animowaną wartość pokazuj z aria-hidden, a wartość końcową podawaj
 * czytnikom osobno, żeby nie ogłaszały stanów pośrednich.
 */
export function useCountUp(target: number, { duration = 500, from }: Options = {}): number {
  const [value, setValue] = useState(from ?? target)
  const current = useRef(from ?? target)

  useEffect(() => {
    const start = current.current
    if (start === target) return
    if (reducedMotion()) {
      current.current = target
      setValue(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - (1 - p) ** 3
      current.current = start + (target - start) * eased
      setValue(current.current)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
