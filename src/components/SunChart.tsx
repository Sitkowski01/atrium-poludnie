import { useId } from 'react'
import { formatDuration, formatHour } from '../domain/format'
import { DAY_END, DAY_START, SUN_THRESHOLD, directSun, sunProfile, sunWindow } from '../domain/sun'
import type { Facade } from '../domain/types'
import './SunChart.css'

const WIDTH = 360
const HEIGHT = 150
const LEFT = 12
const RIGHT = WIDTH - 12
const TOP = 38
const BASE = 142
const xAt = (hour: number) => LEFT + ((hour - DAY_START) / (DAY_END - DAY_START)) * (RIGHT - LEFT)
const yAt = (value: number) => BASE - value * (BASE - TOP)

export function SunChart({ facade, floor, hour }: { facade: Facade; floor: number; hour: number }) {
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
  const samples = sunProfile(facade, floor, 1 / 12)
    .filter((sample) => Math.abs(sample.hour - currentHour) > 1e-6)
  samples.push({ hour: currentHour, value })
  samples.sort((a, b) => a.hour - b.hour)
  const line = samples.map((sample, index) =>
    `${index === 0 ? 'M' : 'L'} ${xAt(sample.hour)} ${yAt(plottedValue(sample.hour, sample.value))}`,
  ).join(' ')
  const ticks = [DAY_START, (DAY_START + DAY_END) / 2, DAY_END]
  const summary = window
    ? `Słońce w oknach salonu: ${formatHour(window.from)}–${formatHour(window.to)} · łącznie ${formatDuration(window.total)}`
    : 'Brak bezpośredniego słońca w oknach salonu'
  const current = `${formatHour(currentHour)} · ${value > SUN_THRESHOLD ? 'słońce w salonie' : 'salon w cieniu'}`

  return (
    <div className="sun-chart">
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
        <path className="sun-chart__curve" d={line} />
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
      <div className="sun-chart__axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} style={{ left: `${xAt(tick) / WIDTH * 100}%` }}>{formatHour(tick)}</span>
        ))}
      </div>
      <p className="sun-chart__legend"><span aria-hidden="true" />słońce w salonie</p>
      <p className="sun-chart__summary">{summary}</p>
    </div>
  )
}
