/**
 * Światło dnia na papierze strony: delikatny odcień, który przesuwa się z porą dnia.
 * Świt różowo-brzoskwiniowy, południe prawie neutralne, popołudnie złote, zachód bursztynowy,
 * zmierzch fioletowy. Krycie najwyżej 0,14 — tekst trzyma kontrast o każdej porze.
 */
type Key = [hour: number, rgb: [number, number, number], alpha: number]

const KEYS: Key[] = [
  [4.5, [96, 100, 150], 0.08], // noc
  [5.6, [160, 130, 175], 0.07], // fiolet przed wschodem
  [6.6, [255, 175, 135], 0.06], // krótki brzoskwiniowy świt
  [8, [150, 190, 238], 0.14], // poranek: chłodny, błękitny, wyraźnie inny niż południe i wieczór
  [12, [210, 220, 235], 0.02], // południe: prawie nic
  [14.5, [235, 222, 198], 0.02],
  [16.5, [245, 196, 120], 0.07], // złote popołudnie
  [19, [240, 150, 60], 0.14], // bursztyn przed zachodem
  [20.3, [190, 120, 140], 0.09], // po zachodzie: róż w fiolet
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
