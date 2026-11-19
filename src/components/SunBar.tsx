import { formatHour } from '../domain/format'
import { DAY_END, DAY_START, type SunWindow } from '../domain/sun'
import './SunBar.css'

interface Props {
  /** godziny słońca w salonie; null = bez bezpośredniego słońca */
  sun: SunWindow | null
  /** okno godzin wybrane przez użytkownika („kiedy jestem w domu”), rysowane jako ramka */
  want?: readonly [number, number] | null
  /** kilka okien naraz (np. poranek i popołudnie) */
  wants?: readonly (readonly [number, number])[]
  /** bieżąca pora dnia z suwaka: cienka kreska */
  now?: number | null
  /** z podziałką 6 · 12 · 18 pod spodem */
  ticks?: boolean
  className?: string
}

const SPAN = DAY_END - DAY_START
const pct = (h: number) => `${(((Math.min(DAY_END, Math.max(DAY_START, h)) - DAY_START) / SPAN) * 100).toFixed(2)}%`

/**
 * Dzień od 5:00 do 21:00 jako pasek: pomarańczowy odcinek to słońce w salonie, ramka to okno, w którym
 * użytkownik jest w domu, kreska to godzina z suwaka. Ten sam pasek w wyszukiwarce, w sekcji
 * „Światło” i w kartach typów, więc oko uczy się go raz.
 */
export function SunBar({ sun, want = null, wants = [], now = null, ticks = false, className = '' }: Props) {
  const frames = want ? [want, ...wants] : wants
  const label = sun
    ? `Słońce w salonie ${formatHour(sun.from)}–${formatHour(sun.to)}`
    : 'Bez bezpośredniego słońca w salonie'
  return (
    <span className={`sunbar${ticks ? ' sunbar--ticks' : ''} ${className}`.trim()} role="img" aria-label={label}>
      <span className="sunbar__track" aria-hidden="true">
        {sun && <span className="sunbar__sun" style={{ left: pct(sun.from), right: `calc(100% - ${pct(sun.to)})` }} />}
        {frames.map(([a, b]) => (
          <span key={`${a}-${b}`} className="sunbar__want" style={{ left: pct(a), right: `calc(100% - ${pct(b)})` }} />
        ))}
        {now != null && <span className="sunbar__now" style={{ left: pct(now) }} />}
      </span>
      {ticks && (
        <span className="sunbar__ticks" aria-hidden="true">
          {[6, 9, 12, 15, 18].map((h) => (
            <span key={h} style={{ left: pct(h) }}>
              {h}
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
