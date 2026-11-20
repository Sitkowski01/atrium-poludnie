import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import { formatArea, formatHour, formatPrice, freeLabel } from '../domain/format'
import { sunRange, sunWindow } from '../domain/sun'
import type { Facade } from '../domain/types'
import { useStore, type Spotlight } from '../state/store'
import { SunBar } from './SunBar'
import './TypeGallery.css'

/**
 * Skala arkusza: rendery rzutów są kadrowane każdy osobno, więc mają różną liczbę pikseli na metr
 * (zmierzone na wyciętych rzutach: 96–147 px/m). Mnożnik sprowadza wszystkie do skali największego typu;
 * wtedy 5 m to zawsze ok. 43,6% boku rzutu i podziałka na arkuszu jest prawdziwa.
 */
const PLAN_SCALE: Record<number, number> = { 0: 0.835, 1: 0.727, 2: 1, 3: 0.744, 4: 0.653 }

interface TypeInfo {
  name: string
  note: string
  alt: string
  alt3d: string
}

const TYPE_INFO: Record<number, TypeInfo> = {
  0: {
    name: 'Trzy pokoje',
    note: 'od południa, z balkonem',
    alt: 'Salon w mieszkaniu trzypokojowym',
    alt3d: 'Makieta 3D mieszkania trzypokojowego z góry',
  },
  1: {
    name: 'Dwa pokoje',
    note: 'od południa',
    alt: 'Salon w mieszkaniu dwupokojowym od południa',
    alt3d: 'Makieta 3D mieszkania dwupokojowego od południa, z góry',
  },
  2: {
    name: 'Cztery pokoje',
    note: 'narożne, południe i wschód',
    alt: 'Salon w mieszkaniu czteropokojowym',
    alt3d: 'Makieta 3D mieszkania czteropokojowego z góry',
  },
  3: {
    name: 'Dwa pokoje',
    note: 'od wschodu, poranne słońce',
    alt: 'Salon w mieszkaniu dwupokojowym od wschodu',
    alt3d: 'Makieta 3D mieszkania dwupokojowego od wschodu, z góry',
  },
  4: {
    name: 'Kawalerka',
    note: 'od wschodu',
    alt: 'Salon w kawalerce',
    alt3d: 'Makieta 3D kawalerki z góry',
  },
}

const ORDER = [2, 0, 1, 3, 4]
const SLATS = Array.from({ length: 8 }, (_, i) => i)

interface TypeCard {
  slot: number
  info: TypeInfo
  rooms: number
  area: number
  facade: Facade
  free: number
  priceFrom: number | null
  sun: ReturnType<typeof sunRange>
  spot: Spotlight
}

export function TypeGallery() {
  const { apartments, dispatch } = useStore()

  const cards = useMemo<TypeCard[]>(
    () =>
      ORDER.flatMap((slot) => {
        const list = apartments.filter((a) => a.slot === slot)
        if (list.length === 0) return []
        const first = list[0]
        const info = TYPE_INFO[slot]
        const open = list.filter((a) => a.status !== 'sprzedane')
        return [
          {
            slot,
            info,
            rooms: first.rooms,
            area: first.area,
            facade: first.facade,
            free: list.filter((a) => a.status === 'wolne').length,
            priceFrom: open.length ? Math.min(...open.map((a) => a.price)) : null,
            sun: sunRange(first.facade),
            spot: { ids: list.map((a) => a.id), label: `${info.name}, ${info.note}` },
          },
        ]
      }),
    [apartments],
  )

  // spotlight ustawiony przez tę galerię: sprzątamy go przy odmontowaniu
  const ownSpot = useRef<Spotlight | null>(null)
  useEffect(
    () => () => {
      if (ownSpot.current) dispatch({ type: 'spotlight', spot: null, owner: ownSpot.current })
    },
    [dispatch],
  )

  const goToSearch = (card: TypeCard) => {
    dispatch({ type: 'resetFilters' })
    dispatch({ type: 'setFilters', patch: { rooms: [card.rooms], facade: card.facade } })
    dispatch({ type: 'spotlight', spot: null, owner: card.spot })
    ownSpot.current = null
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = document.getElementById('mieszkania')
    if (target) {
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      target.focus({ preventScroll: true })
    }
  }

  return (
    <div className="typegal">
      {cards.map((card, i) => (
        <TypeButton
          key={card.slot}
          card={card}
          featured={i === 0}
          index={i + 1}
          onActive={(on) => {
            ownSpot.current = on ? card.spot : null
            dispatch(on ? { type: 'spotlight', spot: card.spot } : { type: 'spotlight', spot: null, owner: card.spot })
          }}
          onPick={() => goToSearch(card)}
        />
      ))}
    </div>
  )
}

function TypeButton({
  card,
  featured,
  index,
  onActive,
  onPick,
}: {
  card: TypeCard
  featured: boolean
  index: number
  onActive: (on: boolean) => void
  onPick: () => void
}) {
  const { slot, info, area, free, priceFrom } = card
  // żaluzje: undefined = jeszcze nie ruszane (bez animacji przy ładowaniu), 'in' / 'out' = kierunek
  const [blinds, setBlinds] = useState<'in' | 'out' | undefined>(undefined)
  const hover = useRef(false)
  const focus = useRef(false)

  const sync = () => {
    const on = hover.current || focus.current
    setBlinds((prev) => (on ? 'in' : prev === undefined ? undefined : 'out'))
    onActive(on)
  }

  const base = import.meta.env.BASE_URL
  const priceText = priceFrom == null ? 'wyprzedane' : `od ${formatPrice(priceFrom)}`
  // jedna opowieść o słońcu na całej stronie: tak jak w hero — 3. piętro jako odniesienie, parter jako różnica
  const ref = sunWindow(card.facade, 3)
  const low = sunWindow(card.facade, 0)
  const span = (w: { from: number; to: number }) => `${formatHour(w.from)}–${formatHour(w.to)}`
  const lowDiffers = Boolean(ref && low && (Math.abs(ref.from - low.from) > 0.05 || Math.abs(ref.to - low.to) > 0.05))
  const sunText = ref
    ? `salon ${span(ref)} (3. piętro)${lowDiffers && low ? ` · parter ${span(low)}` : ''}`
    : 'bez bezpośredniego słońca'
  const sunLabel = ref
    ? `słońce w salonie ${span(ref)} na 3. piętrze${lowDiffers && low ? `, na parterze ${span(low)}` : ''}`
    : sunText
  const label = `${info.name}, ${info.note}, ${formatArea(area)}, ${priceText}${
    priceFrom == null ? '' : `, ${freeLabel(free)}`
  }, ${sunLabel} — pokaż w wyszukiwarce`

  return (
    <button
      type="button"
      className={`typecard${featured ? ' typecard--featured' : ''}`}
      aria-label={label}
      data-blinds={blinds}
      onPointerEnter={(e) => {
        if (e.pointerType === 'touch') return
        hover.current = true
        sync()
      }}
      onPointerLeave={() => {
        if (!hover.current) return
        hover.current = false
        sync()
      }}
      onFocus={(e: FocusEvent<HTMLButtonElement>) => {
        if (!e.currentTarget.matches(':focus-visible')) return
        focus.current = true
        sync()
      }}
      onBlur={() => {
        if (!focus.current) return
        focus.current = false
        sync()
      }}
      onClick={() => {
        hover.current = false
        focus.current = false
        setBlinds((prev) => (prev ? 'out' : prev))
        onPick()
      }}
    >
      {/* rzuty w jednej skali: kawalerka jest na arkuszu mniejsza niż cztery pokoje (skala ~ √metrażu) */}
      <span className="typecard__media" style={{ ['--plan' as string]: String(PLAN_SCALE[slot] ?? 1) }}>
        {featured && (
          <span className="typecard__sheet" aria-hidden="true">
            rzuty w jednej skali
          </span>
        )}
        <span className="typecard__area" aria-hidden="true">
          {formatArea(area)}
        </span>
        {/* najpierw układ (makiety różnią się między typami), żaluzje odsłaniają światło we wnętrzu */}
        <img
          className="typecard__img typecard__img--base"
          src={`${base}rzut3d/s${slot}-arkusz.webp`}
          alt=""
          // rzuty (razem ok. 370 kB) pobierają się od razu, z niskim priorytetem: skok z menu do „Typów” nie trafia na puste arkusze
          fetchPriority="low"
          decoding="async"
        />
        <img
          className="typecard__img typecard__img--reveal"
          src={`${base}okladki/s${slot}.webp`}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <span className="typecard__blinds" aria-hidden="true">
          {SLATS.map((n) => (
            <span key={n} style={{ ['--i' as string]: n }} />
          ))}
        </span>
      </span>
      {/* wpis jak w katalogu: numer typu na kresce, nazwa i cena w jednym rzędzie, dane pod spodem */}
      <span className="typecard__body">
        <span className="typecard__num" aria-hidden="true">
          T{index}
          <span className="typecard__num-rule" />
          {/* podziałka przy numerze każdego typu: wszędzie tej samej długości, bo skala jest wspólna */}
          <span className="typecard__scalebar">
            <span className="typecard__scalebar-bar" />
            <span className="typecard__scalebar-label">0</span>
            <span className="typecard__scalebar-label">5 m</span>
          </span>
        </span>
        <span className="typecard__name">{info.name}</span>
        <span className="typecard__price">{priceText}</span>
        <span className="typecard__facts">
          {info.note}
        </span>
        <span className="typecard__free">{priceFrom != null ? freeLabel(free) : ''}</span>
        <span className="typecard__sun">
          <SunBar sun={ref} />
          <span className="typecard__sun-label">
            {sunText}
          </span>
        </span>
      </span>
    </button>
  )
}
