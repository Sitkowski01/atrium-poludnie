/**
 * Światło dnia na papierze strony: delikatny odcień, który przesuwa się z porą dnia.
 * Świt różowo-brzoskwiniowy, południe prawie neutralne, popołudnie złote, zachód bursztynowy,
 * zmierzch fioletowy. Krycie najwyżej ok. 0,1 — tekst trzyma kontrast o każdej porze.
 */
type Key = [hour: number, rgb: [number, number, number], alpha: number]

const KEYS: Key[] = [
  [4.5, [96, 100, 150], 0.08], // noc
  [5.6, [170, 120, 160], 0.08], // fiolet przed wschodem
  [6.6, [255, 160, 120], 0.09], // brzoskwiniowy świt
  [9, [255, 214, 170], 0.04],
  [12, [210, 220, 235], 0.02], // południe: prawie nic, ledwie chłodniej
  [14.5, [230, 220, 200], 0.02],
  [16.5, [245, 196, 120], 0.07], // złote popołudnie
  [19, [240, 140, 90], 0.1], // zachód
  [20.3, [170, 110, 150], 0.09], // zmierzch
  [21.2, [96, 100, 150], 0.09], // noc
]

export interface DayTint {
  rgb: [number, number, number]
  alpha: number
}

export function dayTint(hour: number): DayTint {
  if (hour <= KEYS[0][0]) return { rgb: KEYS[0][1], alpha: KEYS[0][2] }
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [h0, c0, a0] = KEYS[i]
    const [h1, c1, a1] = KEYS[i + 1]
    if (hour <= h1) {
      const t = (hour - h0) / (h1 - h0)
      return {
        rgb: c0.map((v, k) => Math.round(v + (c1[k] - v) * t)) as [number, number, number],
        alpha: a0 + (a1 - a0) * t,
      }
    }
  }
  const last = KEYS[KEYS.length - 1]
  return { rgb: last[1], alpha: last[2] }
}
