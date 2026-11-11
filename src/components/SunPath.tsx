import { useEffect, useLayoutEffect, useRef } from 'react'
import { DAY_END, DAY_START, sunAt, sunFrom } from '../domain/sun'

type P = [number, number]

interface Props {
  hour: number
  /** środek łuku w poziomie i linia horyzontu (współrzędne rysunku) */
  cx: number
  horizon: number
  /** półosie łuku: rx w poziomie, ry dla najwyższego słońca w ciągu dnia */
  rx: number
  ry: number
  /** granice rysunku, żeby podpis nie wyszedł poza kadr */
  minX: number
  maxX: number
  /** 'sky' — łuk i tarcza pod renderami; 'label' — sam podpis nad nimi */
  layer: 'sky' | 'label'
}

const PEAK = 60 // najwyższe słońce w modelu sunAt()

/**
 * Łuk słońca na niebie za bryłą: wschód po prawej (tam stoi elewacja wschodnia),
 * zachód po lewej, wysokość tarczy to wysokość słońca z modelu sunAt(), którym Blender
 * ustawia światło na renderach. Rysowany pod renderami, więc budynek go zasłania.
 */
export function SunPath({ hour, cx, horizon, rx, ry, minX, maxX, layer }: Props) {
  const labelRef = useRef<SVGTextElement>(null)
  const at = (h: number): P => {
    const { azimuth, elevation } = sunAt(h)
    const t = (azimuth - 50) / 260 // 0 = wschód (rano), 1 = zachód (wieczór)
    return [cx + rx * Math.cos(Math.PI * t), horizon - ry * (Math.max(elevation, 0) / PEAK)]
  }
  const step = 0.25
  const track: P[] = []
  const passed: P[] = []
  for (let h = DAY_START; h <= DAY_END + 1e-6; h += step) {
    const p = at(h)
    track.push(p)
    if (h <= hour) passed.push(p)
  }
  passed.push(at(hour))
  const d = (ps: P[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')

  const sun = sunAt(hour)
  const [sx, sy] = at(hour)
  const up = Math.max(0, Math.min(1, sun.elevation / 10)) // przy horyzoncie tarcza gaśnie

  // podpis trzyma się tarczy, ale nie wychodzi poza kadr; szerokość zależy od kroju i rozmiaru ekranu,
  // więc ją mierzymy: po każdym renderze, po wczytaniu fontu i po zmianie rozmiaru okna
  const place = useRef(() => {})
  place.current = () => {
    const el = labelRef.current
    if (!el || typeof el.getComputedTextLength !== 'function') return
    const half = el.getComputedTextLength() / 2 + 10
    el.setAttribute('x', String(Math.max(minX + half, Math.min(maxX - half, sx))))
  }
  useLayoutEffect(() => place.current())
  useEffect(() => {
    if (layer !== 'label') return
    let alive = true
    const again = () => alive && place.current()
    document.fonts?.ready.then(again)
    window.addEventListener('resize', again)
    return () => {
      alive = false
      window.removeEventListener('resize', again)
    }
  }, [layer])

  if (layer === 'label') {
    return (
      <text ref={labelRef} className="sunpath__label" x={sx} y={sy + 34} textAnchor="middle" aria-hidden="true">
        słońce {sunFrom(sun.azimuth)}
      </text>
    )
  }

  return (
    <g className="sunpath" aria-hidden="true">
      <defs>
        <radialGradient id="sun-halo">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.6" />
          <stop offset="0.4" stopColor="#f0b23a" stopOpacity="0.18" />
          <stop offset="1" stopColor="#f0b23a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path className="sunpath__track" d={d(track)} />
      {passed.length > 1 && <path className="sunpath__passed" d={d(passed)} />}
      <g style={{ opacity: 0.3 + 0.7 * up }}>
        <circle cx={sx} cy={sy} r="54" fill="url(#sun-halo)" />
        <circle className="sunpath__disc" cx={sx} cy={sy} r="11" />
      </g>
    </g>
  )
}
