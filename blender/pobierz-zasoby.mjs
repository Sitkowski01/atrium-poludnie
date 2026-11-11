// Pobiera modele i tekstury z Poly Haven (CC0) do blender/assets/.
// Uruchomienie z katalogu projektu: node blender/pobierz-zasoby.mjs
// Zasoby są poza repozytorium (blender/.gitignore); ten skrypt pozwala je odtworzyć.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const API = 'https://api.polyhaven.com/files/'
const UA = { 'User-Agent': 'atrium-demo' }
const ROOT = 'blender/assets'

export const TEXTURES = [
  'herringbone_parquet', // podłogi pokoi
  'painted_plaster_wall', // ściany
  'long_white_tiles', // ściany łazienki
  'large_grey_tiles', // podłoga łazienki
  'large_floor_tiles_02', // podłoga kuchni i holu
  'marble_01', // blaty
  'wool_boucle', // sofa
  'rough_linen', // pościel, zasłony
  'poly_wool_herringbone', // dywan
  'oak_veneer_01', // meble
]

export const MODELS = [
  'modern_arm_chair_01',
  'mid_century_lounge_chair',
  'modern_wooden_cabinet',
  'coffee_table_round_01',
  'side_table_01',
  'modern_ceiling_lamp_01',
  'desk_lamp_arm_01',
  'potted_plant_01',
  'potted_plant_02',
  'potted_plant_04',
  'ceramic_vase_01',
  'decorative_book_set_01',
  'standing_picture_frame_01',
  'hanging_picture_frame_01',
  'wicker_basket_01',
  'wooden_display_shelves_01',
  // za oknami: prawdziwe drzewa zamiast brył
  'island_tree_02',
  'tree_small_02',
  'shrub_02',
]

async function json(url) {
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

async function download(url, path) {
  if (existsSync(path)) return false
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
  return true
}

let fetched = 0
for (const id of TEXTURES) {
  const files = await json(API + id)
  // mapy: kolor, chropowatość, normalne w konwencji OpenGL (Blender)
  for (const [key, name] of [['Diffuse', 'diff'], ['Rough', 'rough'], ['nor_gl', 'nor']]) {
    const entry = files[key]?.['2k']?.jpg ?? files[key]?.['1k']?.jpg
    if (!entry) {
      console.warn(`brak mapy ${key} dla ${id}`)
      continue
    }
    if (await download(entry.url, join(ROOT, 'tex', id, `${name}.jpg`))) fetched++
  }
}

for (const id of MODELS) {
  const files = await json(API + id)
  const gltf = files.gltf?.['1k']?.gltf
  if (!gltf) {
    console.warn(`brak glTF dla ${id}`)
    continue
  }
  const dir = join(ROOT, 'models', id)
  if (await download(gltf.url, join(dir, `${id}.gltf`))) fetched++
  for (const [rel, inc] of Object.entries(gltf.include ?? {})) {
    if (await download(inc.url, join(dir, rel))) fetched++
  }
}
console.log(`pobrano plików: ${fetched}`)
