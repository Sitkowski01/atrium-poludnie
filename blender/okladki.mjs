// Z renderów wnętrz przygotowuje obrazy dla panelu mieszkania (wymaga ffmpeg):
//   public/okladki/<id>.webp — płaskie ujęcie salonu w stronę okna (okładka panelu)
//   public/rzut3d/<id>.webp  — makieta mieszkania z góry, przycięta do obrysu
// Uruchomienie z katalogu projektu: node blender/okladki.mjs [katalog panoram, domyślnie blender/render/pano2]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PANO = process.argv[2] ?? 'blender/render/pano2'
const TOP = 'blender/render/gora'
const plans = JSON.parse(readFileSync('blender/plany.json', 'utf8'))
mkdirSync('public/okladki', { recursive: true })
mkdirSync('public/rzut3d', { recursive: true })

const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args])
let made = 0
for (const p of plans) {
  const salon = p.plan.findIndex((r) => r.kind === 'salon')
  const pano = join(PANO, p.id, `${salon}.jpg`)
  if (existsSync(pano)) {
    // środek panoramy patrzy w stronę wejścia; 180° to okna salonu
    ff(['-i', pano, '-vf', 'v360=e:flat:yaw=180:pitch=-6:h_fov=84:v_fov=44:w=1240:h=620', '-c:v', 'libwebp', '-quality', '82', join('public/okladki', `${p.id}.webp`)])
    made++
  }
  const top = join(TOP, p.id, 'gora.jpg')
  if (existsSync(top)) {
    ff(['-i', top, '-vf', 'crop=iw*0.86:ih*0.86,scale=1100:-1', '-c:v', 'libwebp', '-quality', '84', join('public/rzut3d', `${p.id}.webp`)])
    made++
  }
}
console.log(`przygotowano obrazów: ${made}`)
