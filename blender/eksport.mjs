// Eksportuje rzuty i przejścia do blender/plany.json.
// Uruchomienie z katalogu projektu: node blender/eksport.mjs   (Node 24 czyta .ts bez kompilacji)
import { writeFileSync } from 'node:fs'
import { APARTMENTS } from '../src/domain/data.ts'
import { links } from '../src/domain/walk.ts'

// piętro 2: każdy typ ma tam balkon; kawalerka na piętrze 1 jest bez balkonu (wariant s4n)
const variants = [0, 1, 2, 3, 4].map((slot) => ({ id: `s${slot}`, floor: 2, slot }))
variants.push({ id: 's4n', floor: 1, slot: 4 })

const out = variants.map(({ id, floor, slot }) => {
  const a = APARTMENTS.find((x) => x.floor === floor && x.slot === slot)
  return {
    id,
    slot,
    facade: a.facade,
    planW: a.planW,
    planH: a.planH,
    plan: a.plan,
    // każde przejście raz (from < to); Blender wycina z tego otwory
    links: links(a.plan).filter((l) => l.from < l.to),
  }
})
writeFileSync(new URL('./plany.json', import.meta.url), JSON.stringify(out, null, 1))
for (const o of out) {
  console.log(
    `${o.id}:`,
    o.links.map((l) => `${o.plan[l.from].label}→${o.plan[l.to].label} (${l.type})`).join(', '),
  )
}
