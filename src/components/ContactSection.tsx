import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import './ContactSection.css'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function goTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  const target = document.getElementById(id)
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  target.focus({ preventScroll: true })
  history.replaceState(null, '', `#${id}`)
}

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

        <p className="contact__label">05 — Kontakt</p>
        <h2 className="contact__title" id="kontakt-title">
          Przyjdź zobaczyć, jak światło <em>wchodzi</em> do mieszkania.
        </h2>
        <p className="contact__lead">
          Pokażemy mieszkanie o tej porze dnia, o której będziesz w nim najczęściej. Umów się na spacer po budowie albo
          zadaj pytanie przy wybranym mieszkaniu.
        </p>
        <div className="contact__actions">
          <a className="btn btn--primary" href="#mieszkania" onClick={(e) => goTo(e, 'mieszkania')}>
            Wybierz mieszkanie
          </a>
          <a className="btn btn--outline" href="#swiatlo" onClick={(e) => goTo(e, 'swiatlo')}>
            Kiedy jesteś w domu?
          </a>
        </div>

        <dl className="contact__info">
          <div className="contact__col">
            <dt>Biuro sprzedaży</dt>
            <dd>ul. Słoneczna 14, Szczecin</dd>
            <dd className="contact__note">adres przykładowy</dd>
          </div>
          <div className="contact__col">
            <dt>Godziny</dt>
            <dd>pon.–pt. 9:00–18:00</dd>
            <dd>sob. 10:00–14:00</dd>
          </div>
          <div className="contact__col">
            <dt>Kontakt</dt>
            <dd>+48 000 000 000</dd>
            <dd>kontakt@atrium-poludnie.example</dd>
          </div>
        </dl>
      </div>
    </section>
    <footer className="contact__footer">
      <div className="contact__inner">
          <p className="contact__foot">
            Atrium Południe to inwestycja fikcyjna. Strona jest demonstracją wyszukiwarki mieszkań: ceny, dostępność,
            wnętrza i nasłonecznienie są przykładowe.
          </p>
      </div>
    </footer>
    </>
  )
}
