// Przygotowuje panoramy do strony: blender/render/pano/<id>/<i>.jpg -> public/pano/<id>/<i>.webp.
// Uruchomienie z katalogu projektu: node blender/pano-web.mjs   (wymaga ffmpeg)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'blender/render/pano'
const OUT = 'public/pano'
let made = 0
let total = 0
for (const id of readdirSync(SRC)) {
  mkdirSync(join(OUT, id), { recursive: true })
  for (const file of readdirSync(join(SRC, id)).filter((f) => f.endsWith('.jpg'))) {
    total++
    const input = join(SRC, id, file)
    const output = join(OUT, id, file.replace('.jpg', '.webp'))
    // pomijamy gotowe oraz takie, które Blender dopiero zapisuje
    if (Date.now() - statSync(input).mtimeMs < 5000) continue
    if (existsSync(output) && statSync(output).mtimeMs > statSync(input).mtimeMs) continue
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', input, '-c:v', 'libwebp', '-quality', '86', output])
    made++
  }
}
console.log(`panoram: ${total}, przygotowano teraz: ${made}`)
