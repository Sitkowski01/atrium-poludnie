/**
 * Płynne przestawienie godziny (przyciski „Rano”, pory w „Kiedy jesteś w domu?”): zamiast skoku
 * bryła przechodzi przez kolejne rendery jak krótki film. Jedno przejście naraz; suwak je przerywa.
 */
let raf = 0

/** bieżąca godzina ze sklepu (ustawiana przy każdym renderze dostawcy), żeby przejście wiedziało, skąd rusza */
export const liveHour = { current: 10 }

export function cancelHourTween() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

export function tweenHour(to: number, set: (hour: number) => void, duration = 650) {
  cancelHourTween()
  const from = liveHour.current
  const reduce =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || Math.abs(to - from) < 0.05 || typeof requestAnimationFrame === 'undefined') {
    set(to)
    return
  }
  // dłuższy skok trwa trochę dłużej, ale nigdy ponad sekundę
  const ms = Math.min(1000, duration + Math.abs(to - from) * 25)
  let t0 = 0
  const tick = (now: number) => {
    if (!t0) t0 = now
    const p = Math.min(1, (now - t0) / ms)
    const eased = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2
    set(p < 1 ? Math.round((from + (to - from) * eased) * 20) / 20 : to)
    raf = p < 1 ? requestAnimationFrame(tick) : 0
  }
  raf = requestAnimationFrame(tick)
}
