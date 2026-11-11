import type { CSSProperties } from 'react'

/** kolor nieba (rgb) i jego siła o danej godzinie; między punktami płynne przejście */
const KEYS: [hour: number, rgb: [number, number, number], alpha: number][] = [
  [4.5, [70, 80, 130], 0.14], // noc
  [5.5, [140, 100, 150], 0.35], // fiolet przed wschodem
  [6.6, [255, 150, 110], 0.49], // brzoskwiniowy świt
  [8.5, [215, 195, 190], 0.32],
  [11, [150, 185, 228], 0.35], // dzień: chłodny błękit
  [14, [160, 196, 232], 0.39],
  [16.5, [236, 200, 150], 0.35], // złote popołudnie
  [19, [255, 140, 88], 0.53], // zachód
  [20.3, [196, 92, 116], 0.42], // zmierzch
  [21.2, [70, 80, 130], 0.18], // noc
]

function skyAt(hour: number): { rgb: [number, number, number]; alpha: number } {
  if (hour <= KEYS[0][0]) return { rgb: KEYS[0][1], alpha: KEYS[0][2] }
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [h0, c0, a0] = KEYS[i]
    const [h1, c1, a1] = KEYS[i + 1]
    if (hour <= h1) {
      const t = (hour - h0) / (h1 - h0)
      return { rgb: c0.map((v, k) => Math.round(v + (c1[k] - v) * t)) as [number, number, number], alpha: a0 + (a1 - a0) * t }
    }
  }
  const last = KEYS[KEYS.length - 1]
  return { rgb: last[1], alpha: last[2] }
}

/**
 * Niebo za bryłą w kolorze pory dnia: świt brzoskwiniowy, dzień chłodny, zachód pomarańczowy,
 * noc granatowa. Miękka plama za budynkiem, która gaśnie przed brzegami ramki, więc nie ma
 * krawędzi; dzienny render nie stoi już na nocnym tle.
 */
export function SceneSky({ hour }: { hour: number }) {
  const { rgb, alpha } = skyAt(hour)
  return (
    <div
      className="scene-sky"
      aria-hidden="true"
      style={{ '--sky': rgb.join(' '), '--sky-a': alpha.toFixed(3) } as CSSProperties}
    />
  )
}
