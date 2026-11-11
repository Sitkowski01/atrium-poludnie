import { useEffect, useRef, useState, type PointerEvent } from 'react'
import './PanoView.css'

export interface Hotspot {
  key: string
  /** kierunek w stopniach: 0 = środek panoramy (strona wejścia), 90 = w prawo */
  angle: number
  /** odległość w metrach */
  distance: number
  label: string
  onGo: () => void
}

interface Props {
  /** panorama równoprostokątna 2:1; środek obrazu to kierunek 0° */
  src: string
  /** obrót w poziomie w stopniach, bez zawijania; dodatni = w prawo */
  yaw: number
  /** pochylenie w stopniach; dodatnie = w górę */
  pitch: number
  /** płynne dojście do yaw/pitch (obrót przyciskiem); przeciąganie idzie bez wygładzania */
  animate: boolean
  /** krótki najazd przed przejściem do następnego pomieszczenia */
  leaving: boolean
  alt: string
  hotspots: Hotspot[]
  onLook: (yaw: number, pitch: number) => void
}

const FOV = 100 // poziomy kąt widzenia w stopniach na szerokim ekranie
const VFOV = 90 // najwyżej tyle w pionie: na telefonie w pionie 100° w poziomie dawało ok. 140° i „rybie oko”
const DROP = 0.85 // punkt przejścia wisi tyle metrów pod linią wzroku
const PITCH_LIMIT = 60
const RAD = Math.PI / 180
/**
 * Ogniskowa w pikselach: na szerokim ekranie z kąta poziomego, na wąskim i wysokim z pionowego,
 * zawsze ta, która daje węższy kadr, więc obraz nigdy nie jest rozciągany na boki ani w pionie.
 */
const focalFor = (w: number, h: number) =>
  Math.max(w / 2 / Math.tan((FOV * RAD) / 2), h / 2 / Math.tan((VFOV * RAD) / 2))
/** podstawowa panorama ma 3072 px na 360°; ostrą doczytujemy, gdy ekran potrzebuje wyraźnie więcej */
const SHARP_FROM = (3072 / 360) * 1.1 // pikseli urządzenia na stopień w środku kadru
const sharpUrl = (src: string) => src.replace(/\.webp$/, '-hi.webp')
/** adresy ostrych wersji, których nie ma na serwerze: nie pobieramy ich drugi raz */
const missingSharp = new Set<string>()

const VERTEX = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`

// Dla każdego piksela liczymy promień widzenia i czytamy kolor z panoramy.
// Jeden prostokąt na cały ekran: nie ma geometrii, więc nie ma szwów ani przycinania.
const FRAGMENT = `
precision highp float;
uniform sampler2D tex;
uniform vec2 res;
uniform float yaw;
uniform float pitch;
uniform float focal;
void main() {
  vec2 p = gl_FragCoord.xy - res * 0.5;
  vec3 d = normalize(vec3(p.x, p.y, -focal));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
  float cy = cos(yaw), sy = sin(yaw);
  d = vec3(d.x * cy - d.z * sy, d.y, d.x * sy + d.z * cy);
  float lon = atan(d.x, -d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  gl_FragColor = texture2D(tex, vec2(lon / 6.28318530718 + 0.5, 0.5 - lat / 3.14159265359));
}`

interface Scene {
  gl: WebGLRenderingContext | WebGL2RenderingContext
  uniforms: Record<'res' | 'yaw' | 'pitch' | 'focal', WebGLUniformLocation | null>
  /** WebGL2 albo tekstura o wymiarach potęgi dwójki: wolno zawijać w poziomie */
  webgl2: boolean
  maxTexture: number
  texture: WebGLTexture | null
}

function createScene(canvas: HTMLCanvasElement): Scene | null {
  // WebGL2 pozwala zawijać tekstury o dowolnych wymiarach (panoramy mają 3072 × 1536 i 6144 × 3072)
  const gl2 = canvas.getContext('webgl2', { antialias: false, alpha: false })
  const gl = gl2 ?? canvas.getContext('webgl', { antialias: false, alpha: false })
  if (!gl || gl.isContextLost()) return null
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
  }
  const vs = compile(gl.VERTEX_SHADER, VERTEX)
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!vs || !fs || !program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const a = gl.getAttribLocation(program, 'a')
  gl.enableVertexAttribArray(a)
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return {
    gl,
    webgl2: Boolean(gl2),
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    texture,
    uniforms: {
      res: gl.getUniformLocation(program, 'res'),
      yaw: gl.getUniformLocation(program, 'yaw'),
      pitch: gl.getUniformLocation(program, 'pitch'),
      focal: gl.getUniformLocation(program, 'focal'),
    },
  }
}

const isPow2 = (n: number) => (n & (n - 1)) === 0

/** Wgrywa panoramę; za dużą zmniejsza przez canvas 2D, zawijanie tylko tam, gdzie wolno. */
function upload(scene: Scene, image: HTMLImageElement): boolean {
  const { gl } = scene
  let source: TexImageSource = image
  let w = image.naturalWidth
  let h = image.naturalHeight
  if (w > scene.maxTexture) {
    const k = scene.maxTexture / w
    const c = document.createElement('canvas')
    c.width = Math.floor(w * k)
    c.height = Math.floor(h * k)
    const ctx = c.getContext('2d')
    if (!ctx) return false
    ctx.drawImage(image, 0, 0, c.width, c.height)
    source = c
    w = c.width
    h = c.height
  }
  const wrap = scene.webgl2 || (isPow2(w) && isPow2(h)) ? gl.REPEAT : gl.CLAMP_TO_EDGE
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source)
  return true
}

/**
 * Panorama 360° rysowana jednym shaderem WebGL, bez bibliotek.
 * Przeciąganie obraca widok; punkty przejść to zwykłe przyciski HTML ustawiane
 * w miejscu, w które rzutuje się kierunek drzwi.
 */
export function PanoView({ src, yaw, pitch, animate, leaving, alt, hotspots, onLook }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<Scene | null>(null)
  const ready = useRef(false)
  /** src, którego ostra wersja jest już w teksturze */
  const sharp = useRef<string | null>(null)
  // to, co faktycznie jest na ekranie; przy obrocie przyciskiem dogania wartości docelowe
  const shown = useRef({ yaw, pitch })
  const target = useRef({ yaw, pitch, animate })
  target.current = { yaw, pitch, animate }
  const raf = useRef(0)
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed' | 'nogl'>('loading')
  // panorama, której podstawowa wersja jest w teksturze (status zostaje 'ready' między pokojami)
  const [loaded, setLoaded] = useState<string | null>(null)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [, setFrame] = useState(0) // odświeża pozycje punktów przejść w trakcie animacji

  const draw = () => {
    const s = scene.current
    const el = canvas.current
    if (!s || !el || !ready.current) return
    s.gl.viewport(0, 0, el.width, el.height)
    s.gl.uniform2f(s.uniforms.res, el.width, el.height)
    s.gl.uniform1f(s.uniforms.yaw, shown.current.yaw * RAD)
    s.gl.uniform1f(s.uniforms.pitch, shown.current.pitch * RAD)
    s.gl.uniform1f(s.uniforms.focal, focalFor(el.width, el.height))
    s.gl.drawArrays(s.gl.TRIANGLE_STRIP, 0, 4)
  }

  // kontekst WebGL i tekstura
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    let cancelled = false
    let image: HTMLImageElement | null = null
    const setup = () => {
      const created = createScene(el)
      scene.current = created
      if (!created) {
        setStatus('nogl')
        return false
      }
      return true
    }
    if (!setup()) return
    const onLoad = () => {
      if (cancelled || !scene.current || !image) return
      if (scene.current.gl.isContextLost()) return
      if (!upload(scene.current, image)) {
        setStatus('failed')
        return
      }
      sharp.current = null // podstawowa w teksturze: ostra wersja wczyta się od nowa
      ready.current = true
      setStatus('ready')
      setLoaded(src)
      draw()
    }
    image = new Image()
    image.onload = onLoad
    image.onerror = () => !cancelled && setStatus('failed')
    image.src = src
    // telefon może odebrać kontekst (np. po powrocie z innej aplikacji): odtwarzamy scenę i teksturę
    const lost = (e: Event) => {
      e.preventDefault()
      ready.current = false
      setStatus('loading')
      setLoaded(null)
    }
    const restored = () => {
      if (cancelled || !setup()) return
      if (image?.complete && image.naturalWidth) onLoad()
    }
    el.addEventListener('webglcontextlost', lost)
    el.addEventListener('webglcontextrestored', restored)
    return () => {
      cancelled = true
      ready.current = false
      cancelAnimationFrame(raf.current)
      el.removeEventListener('webglcontextlost', lost)
      el.removeEventListener('webglcontextrestored', restored)
      // bez loseContext(): StrictMode uruchamia efekt drugi raz na tym samym canvasie,
      // a utracony kontekst nie dałby się już użyć; canvas i tak znika razem z komponentem
      const old = scene.current
      if (old?.texture && !old.gl.isContextLost()) old.gl.deleteTexture(old.texture)
      scene.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  // ostra wersja (6144 px) dochodzi dopiero, gdy płótno jest na tyle szerokie, że podstawowa
  // (3072 px, ok. 8,5 px na stopień) byłaby rozciągana: duże okno, pełny ekran, ekran retina
  useEffect(() => {
    const el = canvas.current
    if (loaded !== src || !el || focalFor(el.width, el.height) * RAD < SHARP_FROM || sharp.current === src) return
    const s = scene.current
    if (!s || s.maxTexture < 6144) return
    const url = sharpUrl(src)
    if (missingSharp.has(url)) return
    let cancelled = false
    const hi = new Image()
    hi.onload = () => {
      ;(hi.decode ? hi.decode().catch(() => undefined) : Promise.resolve()).then(() => {
        if (cancelled || !scene.current || !ready.current) return
        if (scene.current.gl.isContextLost()) return
        if (!upload(scene.current, hi)) return
        sharp.current = src
        draw()
      })
    }
    hi.onerror = () => {
      missingSharp.add(url)
    }
    hi.src = url
    return () => {
      cancelled = true
      hi.onload = null
      hi.onerror = null
      hi.src = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, src, size.w, size.h])

  // rozmiar płótna podąża za rozmiarem ramki
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const w = el.clientWidth
      const h = el.clientHeight
      if (canvas.current) {
        canvas.current.width = Math.max(1, Math.round(w * ratio))
        canvas.current.height = Math.max(1, Math.round(h * ratio))
      }
      setSize({ w, h })
      draw()
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // dojście do zadanego kierunku: od razu przy przeciąganiu, płynnie przy obrocie przyciskiem
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    const step = () => {
      const t = target.current
      const dy = t.yaw - shown.current.yaw
      const dp = t.pitch - shown.current.pitch
      const done = !t.animate || (Math.abs(dy) < 0.05 && Math.abs(dp) < 0.05)
      shown.current = done ? { yaw: t.yaw, pitch: t.pitch } : { yaw: shown.current.yaw + dy * 0.18, pitch: shown.current.pitch + dp * 0.18 }
      draw()
      setFrame((n) => n + 1)
      if (!done) raf.current = requestAnimationFrame(step)
    }
    step()
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yaw, pitch, animate])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, yaw: shown.current.yaw, pitch: shown.current.pitch, moved: false }
    justDragged.current = false
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5) return
      d.moved = true
      justDragged.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    // stopnie na piksel w środku kadru: obraz pod palcem przesuwa się razem z nim
    const perPx = 1 / (focalFor(e.currentTarget.clientWidth, e.currentTarget.clientHeight) * RAD)
    // obraz idzie za palcem: przeciągnięcie w prawo to spojrzenie w lewo
    onLook(d.yaw - dx * perPx, Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, d.pitch + dy * perPx)))
  }
  const endDrag = () => {
    drag.current = null
  }

  /** miejsce na ekranie, w które rzutuje się kierunek; null, gdy jest poza polem widzenia */
  const project = (angle: number, distance: number) => {
    const a = angle * RAD
    const dist = Math.max(distance, 1.5)
    let x = Math.sin(a) * dist
    let y = -DROP
    let z = -Math.cos(a) * dist
    const cy = Math.cos(-shown.current.yaw * RAD)
    const sy = Math.sin(-shown.current.yaw * RAD)
    ;[x, z] = [x * cy - z * sy, x * sy + z * cy]
    const cp = Math.cos(-shown.current.pitch * RAD)
    const sp = Math.sin(-shown.current.pitch * RAD)
    ;[y, z] = [y * cp - z * sp, y * sp + z * cp]
    if (z > -0.05) return null
    const focal = focalFor(size.w, size.h)
    const px = size.w / 2 + (focal * x) / -z
    const py = size.h / 2 - (focal * y) / -z
    if (px < -40 || px > size.w + 40 || py < -40 || py > size.h + 40) return null
    return { left: px, top: Math.min(py, size.h - 46) }
  }

  return (
    <div
      ref={wrap}
      className={`pano${leaving ? ' pano--leaving' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <canvas
        ref={canvas}
        className="pano__canvas"
        role={status === 'ready' ? 'img' : undefined}
        aria-label={status === 'ready' ? alt : undefined}
        aria-hidden={status === 'ready' ? undefined : true}
      />
      {status === 'ready' &&
        hotspots.map((h) => {
          const at = project(h.angle, h.distance) ?? (h.key === focusedKey ? { left: 24, top: size.h - 46 } : null)
          if (!at) return null
          return (
            <button
              key={h.key}
              type="button"
              className="pano__spot"
              style={at}
              aria-label={`Przejdź do: ${h.label}`}
              onFocus={() => setFocusedKey(h.key)}
              onBlur={() => setFocusedKey((k) => (k === h.key ? null : k))}
              onClick={(e) => {
                // e.detail === 0: Enter albo Spacja — wtedy wcześniejsze przeciąganie nie ma znaczenia
                if (e.detail === 0 || !justDragged.current) h.onGo()
              }}
            >
              <span className="pano__spot-ring" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="26" height="26">
                  <path
                    d="M6 14.5 L12 8.5 L18 14.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="pano__spot-label">{h.label}</span>
            </button>
          )
        })}
      {status === 'failed' && <p className="pano__missing">Tego widoku jeszcze nie ma</p>}
      {status === 'nogl' && (
        <p className="pano__missing">Ta przeglądarka nie wyświetla panoram 360°. Przejścia działają z listy pod spodem.</p>
      )}
      {status === 'loading' && <span className="pano__loading" aria-hidden="true" />}
    </div>
  )
}
