import type { MouseEvent } from 'react'
import { formatHour } from '../domain/format'
import { MOMENTS } from '../domain/light'
import { useStore } from '../state/store'
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
  ['kontakt', 'Kontakt'],
] as const


export function ContactSection() {
  // spacer o porze, którą użytkownik wskazał w „Kiedy jesteś w domu?” — obietnica z tytułu, konkretnie
  const { state } = useStore()
  const moments = MOMENTS.filter((m) => state.filters.home.includes(m.id))
  const when = moments.map((m) => `${m.label.toLowerCase()} (${formatHour(m.from)}–${formatHour(m.to)})`).join(' albo ')
  const subject = `Spacer po Atrium Południe${moments.length ? ` — ${moments.map((m) => m.label.toLowerCase()).join(', ')}` : ''}`
  const body = moments.length ? `Dzień dobry, chcę zobaczyć mieszkanie o porze, o której bywam w domu: ${when}.` : ''
  const mailto = `mailto:kontakt@atrium-poludnie.example?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`
  return (
    <>
    <section className="contact" id="kontakt" tabIndex={-1} aria-labelledby="kontakt-title">
      <div className="contact__inner">
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
              {moments.length ? (
                <>
                  Pokażemy mieszkanie o porze, o której bywasz w domu: <strong>{when}</strong>.
                </>
              ) : (
                <>
                  Pokażemy mieszkanie o tej porze dnia, o której będziesz w nim najczęściej. Umów się na spacer po
                  budowie albo zadaj pytanie przy wybranym mieszkaniu.
                </>
              )}
            </p>
            <div className="contact__actions">
              {/* rozdział kończy się tym, o czym mówi: umówieniem spaceru */}
              <a
                className="btn btn--primary"
                href={mailto}
              >
                Umów spacer
                <span aria-hidden="true">→</span>
              </a>
              <a className="btn btn--outline" href="#mieszkania" onClick={(e) => goTo(e, 'mieszkania')}>
                Wybierz mieszkanie
              </a>
            </div>
          </div>

          <div className="contact__office">
            <h3 className="contact__office-title" id="biuro-title">
              Biuro sprzedaży
            </h3>
            <p className="contact__address">
              ul. Słoneczna 14
              <br />
              71-000 Szczecin
            </p>
            <p className="contact__note">adres przykładowy, inwestycja fikcyjna</p>

            {/* godziny jak w rozkładzie jazdy: dzień, kropkowana prowadnica, godziny */}
            <ul className="contact__hours-list">
              {OPEN.map((o) => (
                <li key={o.days} className="contact__open">
                  <span className="contact__open-days">{o.days}</span>
                  <span className="contact__open-lead" aria-hidden="true" />
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
          </div>
        </div>
      </div>
    </section>
    {/* stopka jak tabliczka rysunkowa w rogu planu: nazwa, rozdziały, dane inwestycji, numer arkusza */}
    <footer className="site-footer">
      <div className="contact__inner site-footer__inner">
        <div className="site-footer__cell site-footer__brand">
          <a className="site-footer__logo" href="#top" onClick={(e) => goTo(e, 'top')}>
            Atrium <em>Południe</em>
          </a>
          <p className="site-footer__note">
            Inwestycja fikcyjna. Strona jest demonstracją wyszukiwarki mieszkań: ceny, dostępność, wnętrza
            i nasłonecznienie są przykładowe.
          </p>
        </div>
        <nav className="site-footer__cell" aria-label="Stopka">
          <p className="site-footer__label" aria-hidden="true">
            Rozdziały
          </p>
          <ul className="site-footer__nav">
            {NAV.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`} onClick={(e) => goTo(e, id)}>
                  <span className="site-footer__num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {label}
                  <span className="site-footer__go" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-footer__cell">
          <p className="site-footer__label">Inwestycja</p>
          <dl className="site-footer__spec">
            <div>
              <dt>Miejsce</dt>
              <dd>Szczecin, ul. Słoneczna 14</dd>
            </div>
            <div>
              <dt>Odbiór</dt>
              <dd>2027</dd>
            </div>
            <div>
              <dt>Budynek</dt>
              <dd>35 mieszkań · 7 kondygnacji</dd>
            </div>
          </dl>
        </div>
        <div className="site-footer__base">
          <span>
            Arkusz 05 / 05<span className="site-footer__drawing"> · rysunek A-05 · listopad 2026</span>
          </span>
          <a className="site-footer__top" href="#top" onClick={(e) => goTo(e, 'top')}>
            Do góry
            <span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </footer>
    </>
  )
}
