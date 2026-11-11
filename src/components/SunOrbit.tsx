import { DAY_END, DAY_START, sunAt } from '../domain/sun'

type P = [number, number]

interface Props {
  hour: number
  /** 'back' — część drogi za budynkiem (pod renderami), 'front' — przed nim (nad renderami) */
  layer: 'back' | 'front'
  /** środek bryły na rysunku */
  cx: number
  cy: number
  /** półosie orbity na rysunku */
  rx: number
  ry: number
}

const C = 0.866
const S = 0.5
const RAD = Math.PI / 180
/** po tej stronie budynku orbita jest o tyle ciaśniejsza, żeby wieczorne słońce chowało się za bryłą */
const BEHIND_SHRINK = 0.1

/**
 * Gdzie stoi słońce względem bryły. Kierunek na rysunku to prawdziwy kierunek słońca (sunAt(),
 * ten sam, z którego Blender oświetla rendery) w rzucie kamery, która patrzy z południowego
 * wschodu: rano i w południe słońce jest przed budynkiem, od strony patrzącego, i świeci
 * na widoczne ściany; po ok. 15:30 przechodzi za budynek i chowa się za nim przy zachodzie.
 */
function place(hour: number, cx: number, cy: number, rx: number, ry: number) {
  const { azimuth, elevation } = sunAt(hour)
  const az = azimuth * RAD
  const el = Math.max(elevation, 0) * RAD
  // kierunek do słońca: e = na wschód, n = na północ, z = w górę; rzut jak w Building.tsx
  const e = Math.sin(az) * Math.cos(el)
  const n = Math.cos(az) * Math.cos(el)
  const z = Math.sin(el)
  const angle = Math.atan2((e - n) * S - z, (e + n) * C)
  // >0: słońce po drugiej stronie budynku niż patrzący (kamera patrzy na północny zachód)
  const depth = (n - e) / Math.SQRT2
  const k = 1 - BEHIND_SHRINK * Math.max(0, depth / Math.max(Math.cos(el), 0.01))
  return {
    p: [cx + Math.cos(angle) * rx * k, cy + Math.sin(angle) * ry * k] as P,
    behind: depth > 0,
    elevation,
  }
}

export function SunOrbit({ hour, layer, cx, cy, rx, ry }: Props) {
  const want = layer === 'back'
  // droga dnia podzielona na odcinki po tej samej stronie budynku
  const runs: P[][] = []
  let run: P[] = []
  for (let h = DAY_START; h <= DAY_END + 1e-6; h += 0.2) {
    const { p, behind } = place(h, cx, cy, rx, ry)
    if (behind === want) run.push(p)
    else if (run.length) {
      run.push(p) // domyka odcinek na granicy, żeby nie było przerwy
      runs.push(run)
      run = []
    }
  }
  if (run.length) runs.push(run)
  const d = (ps: P[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')

  const sun = place(hour, cx, cy, rx, ry)
  const showDisc = sun.behind === want && sun.elevation > -2
  const [sx, sy] = sun.p
  const glow = Math.max(0.45, Math.min(1, sun.elevation / 12))
  // promień tylko wtedy, gdy słońce świeci na widoczne ściany; kończy się przed budynkiem
  const k = 0.3
  const ray = !sun.behind && sun.elevation > 0

  return (
    <g className={`sunorbit sunorbit--${layer}`} aria-hidden="true">
      {layer === 'front' && (
        <defs>
          <radialGradient id="sunorbit-halo">
            <stop offset="0" stopColor="#ffd98a" stopOpacity="0.6" />
            <stop offset="0.4" stopColor="#f0b23a" stopOpacity="0.18" />
            <stop offset="1" stopColor="#f0b23a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sunorbit-ray" gradientUnits="userSpaceOnUse" x1={sx} y1={sy} x2={sx + (cx - sx) * k} y2={sy + (cy - sy) * k}>
            <stop offset="0" stopColor="#ffd98a" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {runs.map((r, i) => (
        <path key={i} className="sunorbit__track" d={d(r)} />
      ))}
      {showDisc && (
        <g style={{ opacity: glow }}>
          {ray && <line className="sunorbit__ray" x1={sx} y1={sy} x2={sx + (cx - sx) * k} y2={sy + (cy - sy) * k} stroke="url(#sunorbit-ray)" />}
          <circle cx={sx} cy={sy} r="40" fill="url(#sunorbit-halo)" />
          <circle className="sunorbit__disc" cx={sx} cy={sy} r="11" />
        </g>
      )}
    </g>
  )
}
