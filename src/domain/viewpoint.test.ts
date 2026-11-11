import { describe, expect, it } from 'vitest'
import { APARTMENTS } from './data'
import plansJson from '../../blender/plany.json'
import { links, viewpoint } from './walk'

describe('punkt widzenia panoramy', () => {
  for (const a of APARTMENTS.filter((x) => x.floor === 2 || (x.floor === 1 && x.slot === 4))) {
    const all = links(a.plan)
    a.plan.forEach((room, i) => {
      it(`${a.id} ${room.label}: wewnątrz pomieszczenia, z dala od ścian`, () => {
        const v = viewpoint(a.plan, i, all)
        expect(v.x).toBeGreaterThanOrEqual(room.x + 0.4)
        expect(v.x).toBeLessThanOrEqual(room.x + room.w - 0.4)
        expect(v.y).toBeGreaterThanOrEqual(room.y + 0.4)
        expect(v.y).toBeLessThanOrEqual(room.y + room.h - 0.4)
      })
    })
  }

  it('w pokojach z drzwiami z korytarza kamera stoi przy wejściu, nie na środku', () => {
    const a = APARTMENTS.find((x) => x.id === '2.01')!
    const all = links(a.plan)
    const i = a.plan.findIndex((r) => r.label === 'Sypialnia')
    const room = a.plan[i]
    const v = viewpoint(a.plan, i, all)
    // sypialnia ma drzwi w górnej ścianie (z korytarza)
    expect(v.y).toBeLessThan(room.y + room.h / 2)
  })
})

describe('zgodność z danymi dla Blendera', () => {
  it('plany.json ma te same przejścia i punkty kamer, które liczy strona', () => {
    const plans = plansJson as unknown as {
      id: string
      plan: Parameters<typeof links>[0]
      links: ReturnType<typeof links>
      views: { x: number; y: number }[]
    }[]
    expect(plans.length).toBeGreaterThan(0)
    for (const p of plans) {
      const all = links(p.plan)
      // panoramy renderuje się z plany.json — po zmianie logiki trzeba uruchomić blender/eksport.mjs
      expect(p.links, p.id).toEqual(all.filter((l) => l.from < l.to))
      p.plan.forEach((_, i) => {
        const v = viewpoint(p.plan, i, all)
        expect(p.views[i].x, `${p.id} pokój ${i}`).toBeCloseTo(v.x, 6)
        expect(p.views[i].y, `${p.id} pokój ${i}`).toBeCloseTo(v.y, 6)
      })
    }
  })
})
