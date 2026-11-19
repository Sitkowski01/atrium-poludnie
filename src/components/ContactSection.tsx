import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import './ContactSection.css'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function goTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    // fokus wraca na początek strony: następny Tab idzie od góry, nie od stopki
    document.getElementById('top')?.focus({ preventScroll: true })
    history.replaceState(null, '', location.pathname + location.search)
    return
  }
  const target = document.getElementById(id)
  if (!target) return
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  target.focus({ preventScroll: true })
  history.replaceState(null, '', `#${id}`)
}

const OPEN = [
  { days: 'pon.–pt.', from: 9, to: 18 },
  { days: 'sobota', from: 10, to: 14 },
] as const

const NAV = [
  ['budynek', 'Budynek'],
  ['typy', 'Typy'],
  ['swiatlo', 'Światło'],
  ['mieszkania', 'Mieszkania'],
] as const

/** godzina na osi 5:00–21:00, jak pasek słońca */
const pos = (h: number) => `${(((h - 5) / 16) * 100).toFixed(2)}%`

export function ContactSection() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    let frame = 0
    let listening = false
    const update = () => {
      frame = 0
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const start = vh
      const end = vh * 0.2
      const p = (start - rect.top) / (start - end)
      el.style.setProperty('--p', String(Math.min(1, Math.max(0, p))))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const start = () => {
      if (listening) return
      listening = true
      update()
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll)
    }
    const stop = () => {
      listening = false
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
      frame = 0
    }
    const apply = () => {
      if (mq?.matches) {
        stop()
        el.style.setProperty('--p', '0.5')
      } else {
        start()
      }
    }
    apply()
    mq?.addEventListener('change', apply)
    return () => {
      mq?.removeEventListener('change', apply)
      stop()
    }
  }, [])

  return (
    <>
    <section className="contact" id="kontakt" tabIndex={-1} aria-labelledby="kontakt-title" ref={ref}>
      <div className="contact__inner">
        <div className="contact__horizon" aria-hidden="true">
          <div className="contact__track">
            <span className="contact__sun" />
          </div>
          <div className="contact__hours">
            <span>5:00</span>
            <span>13:00</span>
            <span>21:00</span>
          </div>
        </div>

        <div className="contact__grid">
          <div className="contact__main">
            <p className="contact__label">
              <span className="contact__label-num">05</span>
              <span>Kontakt</span>
            </p>
            <h2 className="contact__title" id="kontakt-title">
              Przyjdź zobaczyć, jak światło <em>wchodzi</em> do mieszkania.
            </h2>
            <p className="contact__lead">
              Pokażemy mieszkanie o tej porze dnia, o której będziesz w nim najczęściej. Umów się na spacer po budowie
              albo zadaj pytanie przy wybranym mieszkaniu.
            </p>
            <div className="contact__actions">
              <a className="btn btn--primary" href="#mieszkania" onClick={(e) => goTo(e, 'mieszkania')}>
                Wybierz mieszkanie
              </a>
              <a className="btn btn--outline" href="#swiatlo" onClick={(e) => goTo(e, 'swiatlo')}>
                Kiedy jesteś w domu?
              </a>
            </div>
          </div>

          <aside className="contact__office" aria-labelledby="biuro-title">
            <h3 className="contact__office-title" id="biuro-title">
              Biuro sprzedaży
            </h3>
            <p className="contact__address">
              ul. Słoneczna 14
              <br />
              71-000 Szczecin
            </p>
            <p className="contact__note">adres przykładowy, inwestycja fikcyjna</p>

            {/* godziny otwarcia na tej samej osi dnia co słońce w mieszkaniach */}
            <ul className="contact__hours-list">
              {OPEN.map((o) => (
                <li key={o.days} className="contact__open">
                  <span className="contact__open-days">{o.days}</span>
                  <span className="contact__open-bar" aria-hidden="true">
                    <span style={{ left: pos(o.from), right: `calc(100% - ${pos(o.to)})` }} />
                  </span>
                  <span className="contact__open-time">
                    {o.from}:00–{o.to}:00
                  </span>
                </li>
              ))}
            </ul>

            <dl className="contact__lines">
              <div>
                <dt>Telefon</dt>
                <dd>
                  <a href="tel:+48000000000">+48 000 000 000</a>
                </dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>
                  <a href="mailto:kontakt@atrium-poludnie.example">kontakt@atrium-poludnie.example</a>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </section>
    <footer className="site-footer">
      <div className="contact__inner site-footer__inner">
        <nav className="site-footer__nav" aria-label="Stopka">
          {NAV.map(([id, label], i) => (
            <a key={id} href={`#${id}`} onClick={(e) => goTo(e, id)}>
              <span className="site-footer__num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              {label}
            </a>
          ))}
        </nav>
        <a className="site-footer__top" href="#top" onClick={(e) => goTo(e, 'top')}>
          Do góry
          <span aria-hidden="true">↑</span>
        </a>
        {/* logotyp na całą szerokość: podpis pod stroną zamiast kolejnego rzędu linków */}
        <a className="site-footer__mark" href="#top" onClick={(e) => goTo(e, 'top')}>
          Atrium <em>Południe</em>
        </a>
        <p className="site-footer__note">
          Atrium Południe to inwestycja fikcyjna. Strona jest demonstracją wyszukiwarki mieszkań: ceny, dostępność,
          wnętrza i nasłonecznienie są przykładowe.
        </p>
        <p className="site-footer__credit">Rendery: Blender Cycles · Szczecin 2027</p>
      </div>
    </footer>
    </>
  )
}
