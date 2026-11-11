// Przygotowuje panoramy do strony: blender/render/pano6/<id>/<i>.jpg (6144 × 3072) ->
//   public/pano/<id>/<i>.webp     3072 × 1536, wczytywana zawsze (okno spaceru, telefon)
//   public/pano/<id>/<i>-hi.webp  6144 × 3072, doczytywana przy szerokim płótnie i pełnym ekranie
// Uruchomienie z katalogu projektu: node blender/pano-web.mjs [katalog_renderów]   (wymaga ffmpeg)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = process.argv[2] ?? 'blender/render/pano6'
const OUT = 'public/pano'
const VARIANTS = [
  // podstawowa: lanczos z pełnej rozdzielczości jest ostrzejsza niż render od razu w 3072
  { suffix: '', width: 3072, quality: '88' },
  { suffix: '-hi', width: 6144, quality: '84' },
]
let made = 0
let total = 0
for (const id of readdirSync(SRC)) {
  mkdirSync(join(OUT, id), { recursive: true })
  for (const file of readdirSync(join(SRC, id)).filter((f) => f.endsWith('.jpg'))) {
    total++
    const input = join(SRC, id, file)
    // pomijamy takie, które Blender dopiero zapisuje
    if (Date.now() - statSync(input).mtimeMs < 5000) continue
    for (const v of VARIANTS) {
      const output = join(OUT, id, file.replace('.jpg', `${v.suffix}.webp`))
      if (existsSync(output) && statSync(output).mtimeMs > statSync(input).mtimeMs) continue
      // -preset photo i metoda 6: lepsze detale (fugi, krawędzie mebli) przy tym samym rozmiarze
      execFileSync('ffmpeg', [
        '-v', 'error', '-y', '-i', input,
        '-vf', `scale=${v.width}:${v.width / 2}:flags=lanczos`,
        '-c:v', 'libwebp', '-preset', 'photo', '-compression_level', '6', '-quality', v.quality,
        output,
      ])
      made++
    }
  }
}
console.log(`panoram: ${total}, plików przygotowano teraz: ${made}`)
