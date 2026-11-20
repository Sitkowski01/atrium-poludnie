import { useEffect, useRef, useState } from 'react'
import { formatHour } from '../domain/format'
import { DAY_END, DAY_START, sunAt, sunCaption } from '../domain/sun'
import { useHour, useStore } from '../state/store'
import { cancelHourTween, tweenHour } from '../state/tweenHour'
import './SunControl.css'

const PRESETS = [
  { label: 'Rano', hour: 8 },
  { label: 'W południe', hour: 13 },
  { label: 'Wieczór', hour: 19 },
]

/** Godzin symulacji na sekundę podczas odtwarzania. */
const SPEED = 1.6

export function SunControl() {
  const { state, dispatch } = useStore()
  const { hour, introCancelled } = useHour()
  const [playing, setPlaying] = useState(false)
  const hourRef = useRef(hour)
  hourRef.current = hour
  const cancelledRef = useRef(introCancelled)
  cancelledRef.current = introCancelled

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let h = hourRef.current
    // dwie ostatnio wysłane wartości: render z poprzedniej klatki mógł jeszcze nie dojść
    let sent: number | null = null
    let prev: number | null = null
    const tick = (now: number) => {
      // ktoś inny przestawił godzinę (np. pora dnia w „Kiedy jesteś w domu?”): oddajemy mu ją i stajemy
      if (sent !== null && hourRef.current !== sent && hourRef.current !== prev) {
        setPlaying(false)
        return
      }
      h += ((now - last) / 1000) * SPEED
      last = now
      if (h > DAY_END) h = DAY_START
      prev = sent
      sent = Math.round(h * 20) / 20
      dispatch({ type: 'setHour', hour: sent, byUser: true })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, dispatch])

  // moment podpisu: przy wejściu słońce wschodzi i dochodzi do 10:00; ruch użytkownika albo otwarcie
  // mieszkania (introCancelled) przerywa. Kroki przelotu idą bez byUser, więc same siebie nie anulują.
  useEffect(() => {
    const reduce =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const from = 5.6
    const to = hourRef.current
    let raf = 0
    let t0 = 0
    const tick = (now: number) => {
      if (cancelledRef.current) return
      if (!t0) t0 = now
      const p = Math.min(1, (now - t0) / 2600)
      const eased = 1 - (1 - p) ** 3
      dispatch({ type: 'setHour', hour: Math.round((from + (to - from) * eased) * 20) / 20 })
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    const start = window.setTimeout(() => {
      if (cancelledRef.current) return
      raf = requestAnimationFrame(tick)
    }, 700)
    return () => {
      window.clearTimeout(start)
      cancelAnimationFrame(raf)
    }
  }, [dispatch])

  // otwarty panel zasłania przycisk zatrzymania, więc odtwarzanie kończy się samo
  const panelOpen = state.selectedId !== null
  useEffect(() => {
    if (panelOpen) setPlaying(false)
  }, [panelOpen])

  const setHour = (next: number) => {
    setPlaying(false)
    cancelHourTween()
    dispatch({ type: 'setHour', hour: next, byUser: true })
  }
  // szybki wybór: bryła przechodzi do tej pory płynnie, przez kolejne rendery, bez skoku
  const glideTo = (next: number) => {
    setPlaying(false)
    dispatch({ type: 'cancelIntro' })
    tweenHour(next, (h) => dispatch({ type: 'setHour', hour: h, byUser: true }))
  }

  return (
    <div className="sun-control">
      <button
        type="button"
        className="btn sun-control__play"
        onClick={() => {
          dispatch({ type: 'cancelIntro' })
          cancelHourTween()
          setPlaying((p) => !p)
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          {playing ? (
            <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          ) : (
            <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
          )}
        </svg>
        <span className="sun-control__play-label">{playing ? 'Zatrzymaj' : 'Odtwórz dzień'}</span>
      </button>

      <label className="sun-control__slider">
        <span className="sun-control__label">
          <span className="sun-control__caption">Pora dnia</span>
          <strong>{formatHour(hour)}</strong>
        </span>
        <input
          type="range"
          className="range--sun"
          min={DAY_START}
          max={DAY_END}
          step={0.05}
          value={hour}
          aria-valuetext={`${formatHour(hour)}, ${sunCaption(hour)}`}
          onChange={(e) => setHour(Number(e.target.value))}
        />
        {/* skąd pada światło o tej godzinie; czytnik dostaje to w aria-valuetext suwaka */}
        <span className="sun-control__sun" aria-hidden="true">
          <Compass hour={hour} />
          {sunCaption(hour)}
        </span>
      </label>

      <div className="sun-control__presets" role="group" aria-label="Szybki wybór pory dnia">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="chip"
            aria-pressed={hour === p.hour}
            onClick={() => glideTo(p.hour)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Strzałka jak na rysunku architekta: „N” u góry, igła wskazuje, skąd świeci słońce (azymut). */
function Compass({ hour }: { hour: number }) {
  const { azimuth, elevation } = sunAt(hour)
  const up = elevation > 0
  return (
    <svg className="sun-control__compass" viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false">
      <text x="9" y="5" textAnchor="middle" className="sun-control__compass-n">
        N
      </text>
      <g transform={`rotate(${azimuth.toFixed(1)} 9 11)`}>
        <path d="M9 5.5 L11 11 L9 10 L7 11 Z" className={up ? 'is-up' : 'is-down'} />
        <path d="M9 10 L9 16" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
      </g>
    </svg>
  )
}
