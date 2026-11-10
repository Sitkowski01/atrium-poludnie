import { useEffect, useRef } from 'react'
import {
  FACADE_LABEL,
  STATUS_LABEL,
  floorLabel,
  formatArea,
  formatHour,
  formatPrice,
  roomsLabel,
} from '../domain/format'
import { DAY_END, DAY_START } from '../domain/sun'
import { useStore } from '../state/store'
import './DetailPanel.css'
import { FloorPlan } from './FloorPlan'
import { InquiryForm } from './InquiryForm'
import { MortgageCalculator } from './MortgageCalculator'
import { SunChart } from './SunChart'

export function DetailPanel() {
  const { selected, state, dispatch } = useStore()
  const ref = useRef<HTMLDialogElement>(null)
  const pressedOnBackdrop = useRef(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (selected && !dialog.open) dialog.showModal()
    if (!selected && dialog.open) dialog.close()
  }, [selected])

  const close = () => dispatch({ type: 'select', id: null })
  const a = selected
  const isFavourite = a ? state.favourites.includes(a.id) : false

  return (
    <dialog
      ref={ref}
      className="detail"
      aria-label={a ? `Mieszkanie ${a.id}` : undefined}
      onClose={close}
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
        <div className="detail__body">
          <header className="detail__head">
            <div>
              <p className="eyebrow">Mieszkanie</p>
              <h2 className="detail__title">
                {a.id}
              </h2>
            </div>
            <div className="detail__actions">
              <button
                type="button"
                className={`btn detail__fav${isFavourite ? ' is-on' : ''}`}
                onClick={() => dispatch({ type: 'toggleFavourite', id: a.id })}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"
                    fill={isFavourite ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
                {isFavourite ? 'W ulubionych' : 'Do ulubionych'}
              </button>
              <button type="button" className="btn detail__close" aria-label="Zamknij szczegóły" onClick={close}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          <div className="detail__price">
            <strong>{formatPrice(a.price)}</strong>
            <span>{formatPrice(a.pricePerM2)} / m²</span>
            <span className={`badge badge--${a.status}`}>{STATUS_LABEL[a.status]}</span>
          </div>

          <dl className="detail__facts">
            <div>
              <dt>Pokoje</dt>
              <dd>{roomsLabel(a.rooms)}</dd>
            </div>
            <div>
              <dt>Powierzchnia</dt>
              <dd>{formatArea(a.area)}</dd>
            </div>
            <div>
              <dt>Kondygnacja</dt>
              <dd>{floorLabel(a.floor)}</dd>
            </div>
            <div>
              <dt>Okna salonu</dt>
              <dd>{FACADE_LABEL[a.facade]}</dd>
            </div>
            <div>
              <dt>Balkon</dt>
              <dd>{a.balcony ? 'tak' : 'nie'}</dd>
            </div>
          </dl>

          <section className="detail__section" aria-labelledby="detail-plan">
            <h3 id="detail-plan">Rzut</h3>
            <FloorPlan apartment={a} />
          </section>

          <section className="detail__section" aria-labelledby="detail-sun">
            <h3 id="detail-sun">Słońce w salonie</h3>
            <SunChart facade={a.facade} floor={a.floor} hour={state.hour} />
            <label className="detail__hour">
              <span>
                Pora dnia <strong>{formatHour(state.hour)}</strong>
              </span>
              <input
                type="range"
                min={DAY_START}
                max={DAY_END}
                step={0.05}
                value={state.hour}
                aria-valuetext={formatHour(state.hour)}
                onChange={(e) => dispatch({ type: 'setHour', hour: Number(e.target.value) })}
              />
            </label>
          </section>

          <section className="detail__section" aria-labelledby="detail-loan">
            <h3 id="detail-loan">Rata kredytu</h3>
            <MortgageCalculator key={a.id} price={a.price} />
          </section>

          <section className="detail__section" aria-labelledby="detail-ask">
            <h3 id="detail-ask">Zapytaj o to mieszkanie</h3>
            <InquiryForm key={a.id} apartment={a} />
          </section>
        </div>
      )}
    </dialog>
  )
}
