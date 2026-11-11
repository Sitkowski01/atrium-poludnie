// Przygotowuje rendery budynku do strony: blender/render/budynek/<hh_mm>.png
// -> public/budynek/<hh_mm>.webp (pełna rozdzielczość) i <hh_mm>-1x.webp (połowa).
// Uruchomienie z katalogu projektu: node blender/budynek-web.mjs   (wymaga ffmpeg)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'blender/render/budynek'
const OUT = 'public/budynek'
mkdirSync(OUT, { recursive: true })
let made = 0
for (const file of readdirSync(SRC).filter((f) => f.endsWith('.png'))) {
  const input = join(SRC, file)
  const name = file.replace('.png', '')
  if (Date.now() - statSync(input).mtimeMs < 5000) continue // Blender jeszcze zapisuje
  for (const [suffix, scale] of [['', 1], ['-1x', 0.5]]) {
    const output = join(OUT, `${name}${suffix}.webp`)
    if (existsSync(output) && statSync(output).mtimeMs > statSync(input).mtimeMs) continue
    execFileSync('ffmpeg', [
      '-v', 'error', '-y', '-i', input,
      '-vf', `scale=iw*${scale}:-1:flags=lanczos`,
      // przezroczystość zostaje: tło daje strona
      '-c:v', 'libwebp', '-quality', '84', '-pix_fmt', 'yuva420p', output,
    ])
    made++
  }
}
console.log(`przygotowano plików: ${made}`)
