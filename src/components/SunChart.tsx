import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { formatDuration, formatHour } from '../domain/format'
import { DAY_END, DAY_START, SUN_THRESHOLD, directSun, sunAt, sunWindow } from '../domain/sun'
import type { Facade } from '../domain/types'
import './SunChart.css'

const WIDTH = 360
const HEIGHT = 150
const LEFT = 0
const RIGHT = WIDTH
const TOP = 16
const BASE = 142
const xAt = (hour: number) => LEFT + ((hour - DAY_START) / (DAY_END - DAY_START)) * (RIGHT - LEFT)
const yAt = (value: number) => BASE - value * (BASE - TOP)

export function SunChart({
  facade,
  floor,
  hour,
  home = [],
  homeNote,
  children,
}: {
  facade: Facade
  floor: number
  hour: number
  /** godziny w domu (z „Kiedy jesteś w domu?”): cienki tor pod osią, jak na paskach w liście */
  home?: readonly (readonly [number, number])[]
  homeNote?: string
  children?: ReactNode
}) {
  const clipId = useId()
  const plotRef = useRef<HTMLDivElement>(null)
  const [plotWidth, setPlotWidth] = useState(WIDTH)
  useEffect(() => {
    const plot = plotRef.current
    if (!plot || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width))
    observer.observe(plot)
    return () => observer.disconnect()
  }, [])
  const window = sunWindow(facade, floor)
  const currentHour = Math.max(DAY_START, Math.min(DAY_END, hour))
  const value = directSun(facade, floor, currentHour)
  // Wysokość słońca jest niezależna od ekspozycji i piętra mieszkania.
  const plottedValue = (h: number) => Math.max(0, sunAt(h).elevation) / 60
  const markerX = xAt(currentHour)
  const labelX = Math.max(28, Math.min(plotWidth - 28, markerX / WIDTH * plotWidth))
  const markerY = yAt(plottedValue(currentHour))
  const profile = Array.from({ length: (DAY_END - DAY_START) * 60 + 1 }, (_, i) => ({ hour: DAY_START + i / 60 }))
  const samples = profile.filter((sample) => Math.abs(sample.hour - currentHour) > 1e-6)
  samples.push({ hour: currentHour })
  samples.sort((a, b) => a.hour - b.hour)
  const line = samples.map((sample, index) =>
    `${index === 0 ? 'M' : 'L'} ${xAt(sample.hour)} ${yAt(plottedValue(sample.hour))}`,
  ).join(' ')
  const ticks = Array.from({ length: (DAY_END - DAY_START) / 2 + 1 }, (_, i) => DAY_START + i * 2)
  const labels = [5, 9, 13, 17, 21]
  const peak = profile.reduce((best, sample) =>
    plottedValue(sample.hour) > plottedValue(best.hour) ? sample : best,
  )
  const peakX = Math.max(90, Math.min(plotWidth - 90, xAt(peak.hour) / WIDTH * plotWidth))
  const svgScale = WIDTH / Math.max(1, plotWidth)
  const peakY = yAt(plottedValue(peak.hour))
  // Kadruj pustą przestrzeń nad krzywą; etykiety mieszczą się wewnątrz SVG.
  const plotTop = peakY - 32 * svgScale
  const plotHeight = HEIGHT - plotTop
  const summary = window
    ? `Słońce w oknach salonu: ${formatHour(window.from)}–${formatHour(window.to)} · łącznie ${formatDuration(window.total)}`
    : 'Brak bezpośredniego słońca w oknach salonu'
  const current = `${formatHour(currentHour)} · ${value > SUN_THRESHOLD ? 'słońce w salonie' : 'salon w cieniu'}`

  return (
    <div className="sun-chart">
      <p className="sun-chart__summary">
        {window ? `${formatHour(window.from)}–${formatHour(window.to)} · łącznie ${formatDuration(window.total)}` : summary}
      </p>
      {homeNote && <p className="sun-chart__home-note">{homeNote}</p>}
      <div className="sun-chart__plot" ref={plotRef}>
      <svg
        className="sun-chart__svg"
        viewBox={`0 ${plotTop} ${WIDTH} ${plotHeight}`}
        width="100%"
        role="img"
        aria-label={`Wysokość słońca nad horyzontem od ${formatHour(DAY_START)} do ${formatHour(DAY_END)}. Zacieniony pas: ${summary}. ${current}.`}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={`${line} L ${RIGHT} ${BASE} L ${LEFT} ${BASE} Z`} />
          </clipPath>
        </defs>
        {window && <rect className="sun-chart__window" x={xAt(window.from)} y={TOP}
          width={xAt(window.to) - xAt(window.from)} height={BASE - TOP} clipPath={`url(#${clipId})`} />}
        <path className="sun-chart__curve" d={line} />
        <path className="sun-chart__baseline" d={`M ${LEFT} ${BASE} H ${RIGHT}`} />
        {home.map(([a, b]) => (
          <path key={`${a}-${b}`} className="sun-chart__home" d={`M ${xAt(a)} ${BASE + 6} H ${xAt(b)}`} />
        ))}
        {ticks.map((tick) => (
          <g key={tick}>
            <path className="sun-chart__tick" d={`M ${xAt(tick)} ${BASE} v 5`} />
          </g>
        ))}
        <path className="sun-chart__marker" d={`M ${markerX} ${markerY} V ${BASE}`} />
        <circle className="sun-chart__point" cx={markerX} cy={markerY} r="4.5" />
        {window && Math.abs(labelX - peakX) >= 120 && (
          <text
            className="sun-chart__peak"
            x={peakX * svgScale}
            y={peakY - 8 * svgScale}
            style={{ fontSize: `${12 * svgScale}px` }}
          >
            najwyżej {formatHour(peak.hour)}
          </text>
        )}
      </svg>
      <span className="sun-chart__label" aria-hidden="true" style={{
        left: `${labelX}px`,
        top: `calc(${(markerY - 4.5 - plotTop) / plotHeight * 100}% - 8px)`,
      }}>{formatHour(currentHour)}</span>
      </div>
      <div className="sun-chart__axis" aria-hidden="true">
        {labels.map((tick) => (
          <span key={tick} style={{ left: `${xAt(tick) / WIDTH * 100}%` }}>{tick}:00</span>
        ))}
      </div>
      <p className="sun-chart__legend">Krzywa: wysokość słońca · pas: słońce w salonie</p>
      {children}
    </div>
  )
}
