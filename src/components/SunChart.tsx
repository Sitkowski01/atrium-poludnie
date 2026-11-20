import { useId, type ReactNode } from 'react'
import { formatDuration, formatHour } from '../domain/format'
import { DAY_END, DAY_START, SUN_THRESHOLD, directSun, sunProfile, sunWindow } from '../domain/sun'
import type { Facade } from '../domain/types'
import './SunChart.css'

const WIDTH = 360
const HEIGHT = 150
const LEFT = 0
const RIGHT = WIDTH
const TOP = 38
const BASE = 142
const xAt = (hour: number) => LEFT + ((hour - DAY_START) / (DAY_END - DAY_START)) * (RIGHT - LEFT)
const yAt = (value: number) => BASE - value * (BASE - TOP)

export function SunChart({ facade, floor, hour, children }: { facade: Facade; floor: number; hour: number; children?: ReactNode }) {
  const gradientId = useId()
  const window = sunWindow(facade, floor)
  const currentHour = Math.max(DAY_START, Math.min(DAY_END, hour))
  const value = directSun(facade, floor, currentHour)
  // Rampa 35 minut dotyczy wyłącznie rysunku; godziny i opis bierzemy z modelu.
  const plottedValue = (h: number, raw: number) => {
    if (!window) return raw
    const t = Math.max(0, Math.min(1, (h - window.from) / (35 / 60), (window.to - h) / (35 / 60)))
    return raw * t * t * (3 - 2 * t)
  }
  const markerX = xAt(currentHour)
  const labelX = Math.max(28, Math.min(WIDTH - 28, markerX))
  // Znacznik korzysta z tej samej rampy co krzywa, również między próbkami.
  const profile = sunProfile(facade, floor, 1 / 12)
  const samples = profile.filter((sample) => Math.abs(sample.hour - currentHour) > 1e-6)
  samples.push({ hour: currentHour, value })
  samples.sort((a, b) => a.hour - b.hour)
  // Pomarańczowy ślad tylko nad osią: odcinki zerowe zostają neutralne.
  const litLine = samples.map((sample, index) => {
    const lit = plottedValue(sample.hour, sample.value) > 0
    const previous = samples[index - 1]
    const next = samples[index + 1]
    const previousLit = previous && plottedValue(previous.hour, previous.value) > 0
    const nextLit = next && plottedValue(next.hour, next.value) > 0
    if (!lit && !previousLit && !nextLit) return ''
    return `${previousLit || (lit && index > 0) ? 'L' : 'M'} ${xAt(sample.hour)} ${yAt(plottedValue(sample.hour, sample.value))}`
  }).join(' ')
  const line = samples.map((sample, index) =>
    `${index === 0 ? 'M' : 'L'} ${xAt(sample.hour)} ${yAt(plottedValue(sample.hour, sample.value))}`,
  ).join(' ')
  const ticks = Array.from({ length: (DAY_END - DAY_START) / 2 + 1 }, (_, i) => DAY_START + i * 2)
  const labels = [DAY_START, (DAY_START + DAY_END) / 2, DAY_END]
  const peak = profile.reduce((best, sample) =>
    plottedValue(sample.hour, sample.value) > plottedValue(best.hour, best.value) ? sample : best,
  )
  const summary = window
    ? `Słońce w oknach salonu: ${formatHour(window.from)}–${formatHour(window.to)} · łącznie ${formatDuration(window.total)}`
    : 'Brak bezpośredniego słońca w oknach salonu'
  const current = `${formatHour(currentHour)} · ${value > SUN_THRESHOLD ? 'słońce w salonie' : 'salon w cieniu'}`

  return (
    <div className="sun-chart">
      <div className="sun-chart__plot">
      <svg
        className="sun-chart__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label={`Nasłonecznienie od ${formatHour(DAY_START)} do ${formatHour(DAY_END)}. ${summary}. ${current}.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop className="sun-chart__gradient-start" offset="0%" />
            <stop className="sun-chart__gradient-end" offset="100%" />
          </linearGradient>
        </defs>
        <path d={`${line} L ${RIGHT} ${BASE} L ${LEFT} ${BASE} Z`} fill={`url(#${gradientId})`} />
        <path className="sun-chart__curve" d={litLine} />
        <path className="sun-chart__baseline" d={`M ${LEFT} ${BASE} H ${RIGHT}`} />
        {ticks.map((tick) => (
          <g key={tick}>
            <path className="sun-chart__tick" d={`M ${xAt(tick)} ${BASE} v 5`} />
          </g>
        ))}
        <path className="sun-chart__marker" d={`M ${markerX} ${TOP - 6} V ${BASE}`} />
        <circle className="sun-chart__point" cx={markerX} cy={yAt(plottedValue(currentHour, value))} r="4.5" />
        <rect className="sun-chart__label-background" x={labelX - 26} y="5" width="52" height="23" rx="6" />
        <text className="sun-chart__label" x={labelX} y="20">{formatHour(currentHour)}</text>
      </svg>
      {window && (
        <p
          className="sun-chart__peak"
          style={{
            left: `clamp(90px, ${xAt(peak.hour) / WIDTH * 100}%, calc(100% - 90px))`,
            top: `${yAt(plottedValue(peak.hour, peak.value)) / HEIGHT * 100}%`,
          }}
        >
          najwięcej słońca {formatHour(peak.hour)}
        </p>
      )}
      </div>
      {children}
      <div className="sun-chart__axis" aria-hidden="true">
        {labels.map((tick) => (
          <span key={tick} style={{ left: `${xAt(tick) / WIDTH * 100}%` }}>{formatHour(tick)}</span>
        ))}
      </div>
      <p className="sun-chart__summary">
        {window ? <>
          <span>{formatHour(window.from)}–{formatHour(window.to)}</span>
          <span>łącznie {formatDuration(window.total)}</span>
        </> : summary}
      </p>
    </div>
  )
}
