import { useMemo } from 'react'
import { DAY_END, DAY_START, sunAt } from '../domain/sun'

type P = [number, number]

interface Props {
  hour: number
  /** 'back' — część łuku za budynkiem (pod renderami), 'front' — przed nim (nad renderami) */
  layer: 'back' | 'front'
  /** środek łuku w poziomie, linia horyzontu i półosie (jednostki rysunku) */
  cx: number
  horizon: number
  rx: number
  ry: number
}

const RAD = Math.PI / 180
const C = 0.866
/** największe przesunięcie w bok: słońce na południowym zachodzie (225°) albo północnym wschodzie (45°) */
const SIDE_MAX = Math.SQRT2 * C

/**
 * Łuk słońca nad bryłą. W poziomie: prawdziwa składowa kierunku słońca w tym kadrze (kamera patrzy
 * z południowego wschodu, więc rano słońce jest po prawej, przy ścianie wschodniej, a po południu
 * po lewej, przy południowej). W pionie: wysokość nad horyzontem z sunAt(), tego samego modelu,
 * którym Blender oświetla rendery. Od ok. 15:30 słońce jest po drugiej stronie budynku niż
 * patrzący, więc ta część łuku leży pod renderami i zachód chowa się za bryłą — tak jak na
 * renderach widoczne ściany są wtedy w cieniu.
 */
function place(hour: number, cx: number, horizon: number, rx: number, ry: number) {
  const { azimuth, elevation } = sunAt(hour)
  const az = azimuth * RAD
  const side = (Math.sin(az) + Math.cos(az)) * C // >0 w prawo (wschód), <0 w lewo (południe/zachód)
  // łagodny szczyt: wysokie słońce trochę ściśnięte, żeby łuk zmieścił się w kadrze bez płaskiej „półki”
  const lift = Math.pow(Math.max(0, elevation) / 60, 0.7)
  return {
    p: [cx + (side / SIDE_MAX) * rx, horizon - lift * ry] as P,
    // patrzący stoi na południowym wschodzie: słońce od północnego zachodu jest za budynkiem
    behind: Math.cos(az) - Math.sin(az) > 0,
    elevation,
  }
}

const STEP = 0.2

interface Sample {
  h: number
  p: P
  behind: boolean
}

/** odcinki próbek po jednej stronie budynku; każdy domknięty pierwszą próbką z drugiej strony (bez przerwy na styku) */
function runsOf(samples: readonly Sample[], want: boolean): P[][] {
  const runs: P[][] = []
  let run: P[] = []
  samples.forEach((s, i) => {
    if (s.behind === want) run.push(s.p)
    else if (run.length) {
      runs.push([...run, s.p])
      run = []
    }
    if (i === samples.length - 1 && run.length) runs.push(run)
  })
  return runs
}

export function SunOrbit({ hour, layer, cx, horizon, rx, ry }: Props) {
  const want = layer === 'back'
  // próbki dnia i stały tor liczone raz, nie co klatkę (godzina zmienia się co klatkę przy odtwarzaniu)
  const samples = useMemo<Sample[]>(() => {
    const out: Sample[] = []
    for (let i = 0; DAY_START + i * STEP <= DAY_END + 1e-9; i++) {
      const h = DAY_START + i * STEP
      const { p, behind } = place(h, cx, horizon, rx, ry)
      out.push({ h, p, behind })
    }
    return out
  }, [cx, horizon, rx, ry])
  const track = useMemo(() => runsOf(samples, want), [samples, want])
  const d = (ps: P[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')

  // przebyta część: próbki do bieżącej godziny, a na końcu dokładnie pozycja tarczy
  const sunNow = place(hour, cx, horizon, rx, ry)
  const before = samples.filter((s) => s.h <= hour + 1e-9)
  const passed = runsOf(before, want)
  const open = before.length > 0 && before[before.length - 1].behind === want && sunNow.behind === want
  if (open && passed.length) passed[passed.length - 1].push(sunNow.p)

  const sun = sunNow
  const showDisc = sun.behind === want && sun.elevation > -1
  const [sx, sy] = sun.p
  const glow = Math.max(0.35, Math.min(1, sun.elevation / 10))

  return (
    <g className={`sunpath sunpath--${layer}`} aria-hidden="true">
      {layer === 'front' && (
        <defs>
          <radialGradient id="sun-halo">
            <stop offset="0" stopColor="#ffd98a" stopOpacity="0.6" />
            <stop offset="0.4" stopColor="#f0b23a" stopOpacity="0.18" />
            <stop offset="1" stopColor="#f0b23a" stopOpacity="0" />
          </radialGradient>
        </defs>
      )}
      {track.map((t, i) => (
        <path key={`t${i}`} className="sunpath__track" d={d(t)} />
      ))}
      {passed.map((t, i) => t.length > 1 && <path key={`p${i}`} className="sunpath__passed" d={d(t)} />)}
      {/* słońce za budynkiem: na pierwszym planie tylko przerywany kontur — widać, gdzie jest, i że zasłania je bryła */}
      {layer === 'front' && sun.behind && sun.elevation > -1 && (
        <circle className="sunpath__ghost" cx={sx} cy={sy} r="11" />
      )}
      {showDisc && (
        <g style={{ opacity: glow }}>
          <circle cx={sx} cy={sy} r="54" fill="url(#sun-halo)" />
          <circle className="sunpath__disc" cx={sx} cy={sy} r="11" />
        </g>
      )}
    </g>
  )
}
