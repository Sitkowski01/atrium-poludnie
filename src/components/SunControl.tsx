import { useEffect, useRef, useState } from 'react'
import { formatHour } from '../domain/format'
import { DAY_END, DAY_START } from '../domain/sun'
import { useStore } from '../state/store'
import './SunControl.css'

const PRESETS = [
  { label: 'Rano', hour: 8 },
  { label: 'Południe', hour: 13 },
  { label: 'Wieczór', hour: 19 },
]

/** Godzin symulacji na sekundę podczas odtwarzania. */
const SPEED = 1.6

export function SunControl() {
  const { state, dispatch } = useStore()
  const [playing, setPlaying] = useState(false)
  const hourRef = useRef(state.hour)
  hourRef.current = state.hour

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let h = hourRef.current
    let sent = h
    const tick = (now: number) => {
      // ktoś przesunął suwak w trakcie odtwarzania — jedziemy dalej od jego wartości
      if (hourRef.current !== sent) h = hourRef.current
      h += ((now - last) / 1000) * SPEED
      last = now
      if (h > DAY_END) h = DAY_START
      sent = Math.round(h * 20) / 20
      dispatch({ type: 'setHour', hour: sent })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, dispatch])

  // otwarty panel zasłania przycisk zatrzymania, więc odtwarzanie kończy się samo
  const panelOpen = state.selectedId !== null
  useEffect(() => {
    if (panelOpen) setPlaying(false)
  }, [panelOpen])

  const setHour = (hour: number) => {
    setPlaying(false)
    dispatch({ type: 'setHour', hour })
  }

  return (
    <div className="sun-control">
      <button
        type="button"
        className="btn sun-control__play"
        onClick={() => setPlaying((p) => !p)}
      >
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
        {playing ? 'Zatrzymaj' : 'Odtwórz dzień'}
      </button>

      <label className="sun-control__slider">
        <span className="sun-control__label">
          Pora dnia <strong>{formatHour(state.hour)}</strong>
        </span>
        <input
          type="range"
          min={DAY_START}
          max={DAY_END}
          step={0.05}
          value={state.hour}
          aria-valuetext={formatHour(state.hour)}
          onChange={(e) => setHour(Number(e.target.value))}
        />
      </label>

      <div className="sun-control__presets" role="group" aria-label="Szybki wybór pory dnia">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="chip"
            aria-pressed={state.hour === p.hour}
            onClick={() => setHour(p.hour)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
