import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  FACADE_LABEL,
  STATUS_LABEL,
  floorLabel,
  formatArea,
  formatHour,
  formatPrice,
  formatPerM2,
  roomsLabel,
} from '../domain/format'
import { DAY_END, DAY_START, sunWindow, sunShare } from '../domain/sun'
import type { Apartment } from '../domain/types'
import { useHour, useStore } from '../state/store'
import { cancelHourTween } from '../state/tweenHour'
import './DetailPanel.css'
import { FloorPlan } from './FloorPlan'
import { InquiryForm } from './InquiryForm'
import { MortgageCalculator } from './MortgageCalculator'
import { SunChart } from './SunChart'
import { MOMENTS, homeHours } from '../domain/light'
import { WalkViewer } from './WalkViewer'

const PLAN_SCALE: Record<number, number> = { 0: 0.835, 1: 0.727, 2: 1, 3: 0.744, 4: 0.653 }

function Plan({ apartment }: { apartment: Apartment }) {
  const [mode, setMode] = useState<'2d' | '3d'>('3d')
  const [ready, setReady] = useState(false)
  const src3d = `${import.meta.env.BASE_URL}rzut3d/s${apartment.slot}-arkusz.webp`
  // makietę wczytujemy w tle; do tego czasu (a przy braku pliku na stałe) widać rzut 2D bez przełącznika
  useEffect(() => {
    setReady(false)
    const img = new Image()
    img.onload = () => setReady(true)
    img.src = src3d
    return () => {
      img.onload = null
    }
  }, [src3d])
  const show3d = mode === '3d' && ready
  return (
    <>
      {ready && (
        <div className="detail__switch" role="group" aria-label="Widok rzutu">
          <button type="button" className="chip" aria-pressed={mode === '3d'} onClick={() => setMode('3d')}>
            Makieta 3D
          </button>
          <button type="button" className="chip" aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>
            Rzut z wymiarami
          </button>
        </div>
      )}
      {show3d ? (
        <figure className="detail__plan3d" style={{ '--plan-scale': PLAN_SCALE[apartment.slot] } as CSSProperties}>
          <img
            src={src3d}
            alt={`Makieta mieszkania ${apartment.id} z góry, z umeblowaniem`}
          />
          <figcaption className="detail__plan-area">{formatArea(apartment.area)}</figcaption>
          <span className="detail__scalebar" aria-label="Podziałka: 5 metrów">
            <span>0</span><span>5 m</span>
            <span className="detail__scalebar-bar" />
          </span>
        </figure>
      ) : (
        <FloorPlan apartment={apartment} />
      )}
    </>
  )
}

export function DetailPanel() {
  const { selected, state, dispatch } = useStore()
  const { hour } = useHour()
  const ref = useRef<HTMLDialogElement>(null)
  const pressedOnBackdrop = useRef(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (selected && !dialog.open) dialog.showModal()
    if (!selected && dialog.open) dialog.close()
    dialog.scrollTop = 0
    setScrolled(false)
  }, [selected])

  const [askVisible, setAskVisible] = useState(false)
  const selectedId = selected?.id ?? null

  // pasek z przyciskiem chowamy, gdy sekcja formularza zajmuje dół panelu
  useEffect(() => {
    setAskVisible(false)
    const root = ref.current
    if (!selectedId || !root || typeof IntersectionObserver === 'undefined') return
    const section = root.querySelector('#detail-ask-section')
    if (!section) return
    const observer = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1]
        if (!last) return
        // pasek zaraz będzie inert: fokus z niego przechodzi do pierwszego pola formularza, nie na body
        const dock = root.querySelector('.detail__dock')
        if (last.isIntersecting && dock?.contains(document.activeElement)) {
          section.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
        }
        setAskVisible(last.isIntersecting)
      },
      { root, rootMargin: '0px 0px -15% 0px', threshold: 0 },
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [selectedId])

  const close = () => dispatch({ type: 'select', id: null })
  const a = selected
  const isFavourite = a ? state.favourites.includes(a.id) : false
  const sun = a ? sunWindow(a.facade, a.floor) : null
  // wątek „Kiedy jesteś w domu?”: te same pory i ten sam wynik co w liście, także na wykresie słońca
  const moments = MOMENTS.filter((m) => state.filters.home.includes(m.id))
  const homeTotal = homeHours(moments)
  const homeBands = moments.map((m) => [m.from, m.to] as const)
  const homeNote =
    a && homeTotal > 0
      ? `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(
          moments.reduce((s, m) => s + sunShare(a.facade, a.floor, m.from, m.to) * (m.to - m.from), 0),
        )} z ${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(homeTotal)} h w słońcu, kiedy jesteś w domu (${moments.map((m) => m.label.toLowerCase()).join(', ')})`
      : undefined

  return (
    <dialog
      ref={ref}
      className="detail"
      aria-label={a ? `Mieszkanie ${a.id}` : undefined}
      onClose={close}
      onScroll={(event) => setScrolled(event.currentTarget.scrollTop >= 120)}
      // zamykamy tylko, gdy naciśnięcie i puszczenie trafiły w tło —
      // przeciągnięcie zaznaczenia z pola formularza nie zamyka panelu
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === ref.current
      }}
      onClick={(e) => {
        if (e.target === ref.current && pressedOnBackdrop.current) close()
      }}
    >
      {a && (
        <div className="detail__body" key={a.id}>
          <div className={`detail__compact${scrolled ? ' is-visible' : ''}`}>
            <span>{a.id} · {formatPrice(a.price)}</span>
            <button type="button" className="detail__icon" aria-label="Zamknij szczegóły" onClick={close}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <header className="detail__head">
            <div className="detail__head-top">
              <button
                type="button"
                className={`detail__icon detail__fav${isFavourite ? ' is-on' : ''}`}
                aria-pressed={isFavourite}
                aria-label={isFavourite ? `Usuń mieszkanie ${a.id} z ulubionych` : `Dodaj mieszkanie ${a.id} do ulubionych`}
                onClick={() => dispatch({ type: 'toggleFavourite', id: a.id })}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"
                    fill={isFavourite ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button type="button" className="detail__icon" aria-label="Zamknij szczegóły" onClick={close}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="detail__head-copy">
              <p className="eyebrow">
                {floorLabel(a.floor)} · {FACADE_LABEL[a.facade]}
              </p>
              <h2 className="detail__title">Mieszkanie {a.id}</h2>
            </div>
          </header>

          <div className="detail__price">
            <strong>{formatPrice(a.price)}</strong>
            <span>{formatPerM2(a.pricePerM2)}</span>
            <span className={`badge badge--${a.status}`}>{STATUS_LABEL[a.status]}</span>
          </div>

          <dl className="detail__facts">
            <div>
              <dt>Pokoje</dt>
              <dd>{a.rooms}</dd>
            </div>
            <div>
              <dt>Powierzchnia</dt>
              <dd>{formatArea(a.area)}</dd>
            </div>
            <div>
              <dt>Słońce</dt>
              <dd>{sun ? `${formatHour(sun.from)}–${formatHour(sun.to)}` : 'brak'}</dd>
            </div>
            <div>
              <dt>Balkon</dt>
              <dd>{a.balcony ? 'tak' : 'nie'}</dd>
            </div>
          </dl>
          <p className="visually-hidden">{roomsLabel(a.rooms)}</p>

          <section className="detail__section" aria-labelledby="detail-walk">
            <div className="detail__section-head">
              <h3 id="detail-walk">Spacer 360°</h3>
              <span className="detail__hint">przeciągnij, żeby się rozejrzeć</span>
            </div>
            <WalkViewer key={a.id} apartment={a} />
          </section>

          <section className="detail__section" aria-labelledby="detail-plan">
            <div className="detail__section-head">
              <h3 id="detail-plan">Rzut</h3>
            </div>
            <Plan apartment={a} />
          </section>

          <section className="detail__section" aria-labelledby="detail-sun">
            <div className="detail__section-head">
              <h3 id="detail-sun">Słońce w salonie</h3>
            </div>
            <SunChart facade={a.facade} floor={a.floor} hour={hour} home={homeBands} homeNote={homeNote}>
            <label className="detail__hour">
              <span className="visually-hidden">Pora dnia</span>
              <input
                className="range--sun"
                type="range"
                min={DAY_START}
                max={DAY_END}
                step={0.05}
                value={hour}
                style={{ '--pct': `${(hour - DAY_START) / (DAY_END - DAY_START) * 100}%` } as CSSProperties}
                aria-valuetext={formatHour(hour)}
                onChange={(e) => {
                  cancelHourTween()
                  dispatch({ type: 'setHour', hour: Number(e.target.value), byUser: true })
                }}
              />
            </label>
            </SunChart>
          </section>

          <MortgageCalculator key={a.id} price={a.price} />

          <section className="detail__section" id="detail-ask-section" aria-labelledby="detail-ask">
            <div className="detail__section-head">
              <h3 id="detail-ask">Zapytaj o to mieszkanie</h3>
            </div>
            <InquiryForm key={a.id} apartment={a} />
          </section>

          {/* opakowanie bez pudełka: inert z powiększonego spaceru trafia tutaj, a inert samego paska
              ustawia React, więc dwa źródła nie nadpisują sobie nawzajem atrybutu */}
          <div className="detail__dock-slot">
            <div className={`detail__dock${askVisible ? ' detail__dock--hidden' : ''}`} inert={askVisible}>
            <span>
              <strong>{formatPrice(a.price)}</strong> · {roomsLabel(a.rooms)}
            </span>
            <a
              className="btn btn--primary"
              href="#detail-ask-section"
              onClick={(e) => {
                e.preventDefault()
                const section = document.getElementById('detail-ask-section')
                if (!section) return
                const reduce =
                  typeof window.matchMedia === 'function' &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches
                section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
                section.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
              }}
            >
              Zapytaj o mieszkanie
            </a>
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}
