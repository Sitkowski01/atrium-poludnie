import type { Apartment, Facade, Room, Status } from './types'

export const FLOORS = 7
export const SLOTS_PER_FLOOR = 5

interface Template {
  rooms: number
  facade: Facade
  planW: number
  planH: number
  plan: Room[]
  balcony: Room
}

const r = (kind: Room['kind'], label: string, x: number, y: number, w: number, h: number): Room => ({
  kind,
  label,
  x,
  y,
  w,
  h,
})

/** Jeden szablon na pozycję na piętrze. Pomieszczenia wypełniają obrys bez dziur. */
const TEMPLATES: Template[] = [
  {
    // slot 0 — trzy pokoje, południe
    rooms: 3,
    facade: 'S',
    planW: 8.4,
    planH: 7.6,
    plan: [
      r('hol', 'Hol', 0, 0, 3.0, 2.4),
      r('lazienka', 'Łazienka', 3.0, 0, 2.4, 2.4),
      r('kuchnia', 'Kuchnia', 5.4, 0, 3.0, 2.4),
      r('sypialnia', 'Sypialnia', 0, 2.4, 2.8, 5.2),
      r('sypialnia', 'Pokój', 2.8, 2.4, 2.6, 5.2),
      r('salon', 'Salon', 5.4, 2.4, 3.0, 5.2),
    ],
    balcony: r('balkon', 'Balkon', 5.4, 7.6, 3.0, 1.4),
  },
  {
    // slot 1 — dwa pokoje, południe
    rooms: 2,
    facade: 'S',
    planW: 6.0,
    planH: 7.0,
    plan: [
      r('hol', 'Hol', 0, 0, 2.2, 2.2),
      r('lazienka', 'Łazienka', 2.2, 0, 1.8, 2.2),
      r('kuchnia', 'Kuchnia', 4.0, 0, 2.0, 2.2),
      r('sypialnia', 'Sypialnia', 0, 2.2, 2.6, 4.8),
      r('salon', 'Salon', 2.6, 2.2, 3.4, 4.8),
    ],
    balcony: r('balkon', 'Balkon', 2.6, 7.0, 3.4, 1.3),
  },
  {
    // slot 2 — cztery pokoje, narożne, południe
    rooms: 4,
    facade: 'S',
    planW: 10.6,
    planH: 8.2,
    plan: [
      r('hol', 'Hol', 0, 0, 3.4, 2.6),
      r('lazienka', 'Łazienka', 3.4, 0, 2.2, 2.6),
      r('kuchnia', 'Kuchnia', 5.6, 0, 3.0, 2.6),
      r('sypialnia', 'Gabinet', 8.6, 0, 2.0, 2.6),
      r('sypialnia', 'Sypialnia', 0, 2.6, 3.0, 5.6),
      r('sypialnia', 'Pokój', 3.0, 2.6, 2.8, 5.6),
      r('salon', 'Salon', 5.8, 2.6, 4.8, 5.6),
    ],
    balcony: r('balkon', 'Taras', 5.8, 8.2, 4.8, 1.5),
  },
  {
    // slot 3 — dwa pokoje, wschód
    rooms: 2,
    facade: 'E',
    planW: 6.6,
    planH: 7.2,
    plan: [
      r('hol', 'Hol', 0, 0, 2.4, 2.4),
      r('lazienka', 'Łazienka', 2.4, 0, 2.0, 2.4),
      r('kuchnia', 'Kuchnia', 4.4, 0, 2.2, 2.4),
      r('salon', 'Salon', 0, 2.4, 3.8, 4.8),
      r('sypialnia', 'Sypialnia', 3.8, 2.4, 2.8, 4.8),
    ],
    balcony: r('balkon', 'Balkon', 0, 7.2, 3.8, 1.3),
  },
  {
    // slot 4 — kawalerka, wschód
    rooms: 1,
    facade: 'E',
    planW: 5.2,
    planH: 6.0,
    plan: [
      r('hol', 'Hol', 0, 0, 1.8, 2.0),
      r('lazienka', 'Łazienka', 1.8, 0, 1.6, 2.0),
      r('kuchnia', 'Aneks', 3.4, 0, 1.8, 2.0),
      r('salon', 'Pokój dzienny', 0, 2.0, 5.2, 4.0),
    ],
    balcony: r('balkon', 'Balkon', 1.0, 6.0, 3.2, 1.2),
  },
]

function statusOf(floor: number, slot: number): Status {
  const h = (floor * 7 + slot * 13 + 3) % 10
  if (h <= 1) return 'sprzedane'
  if (h === 2) return 'rezerwacja'
  return 'wolne'
}

function build(): Apartment[] {
  const list: Apartment[] = []
  for (let floor = 0; floor < FLOORS; floor++) {
    for (let slot = 0; slot < SLOTS_PER_FLOOR; slot++) {
      const t = TEMPLATES[slot]
      const area = Math.round(t.planW * t.planH * 10) / 10
      // kawalerki mają balkon co drugie piętro — elewacja nie jest monotonna
      const balcony = slot !== 4 || floor % 2 === 0
      const jitter = (((floor * 37 + slot * 91) % 7) - 3) * 40
      const perM2 =
        11800 +
        floor * 230 +
        (t.facade === 'S' ? 450 : 0) +
        (slot === 2 ? 350 : 0) +
        (area < 35 ? 1500 : area < 50 ? 650 : 0) +
        jitter
      const price = Math.round((area * perM2) / 1000) * 1000
      list.push({
        id: `${floor}.0${slot + 1}`,
        floor,
        slot,
        facade: t.facade,
        rooms: t.rooms,
        area,
        price,
        pricePerM2: Math.round(price / area),
        status: statusOf(floor, slot),
        balcony,
        planW: t.planW,
        planH: t.planH,
        plan: balcony ? [...t.plan, t.balcony] : [...t.plan],
      })
    }
  }
  return list
}

/** 35 mieszkań: 7 kondygnacji × 5. Dane są deterministyczne. */
export const APARTMENTS: readonly Apartment[] = build()
