import { useEffect, useMemo, useRef, useState, type FocusEvent, type PointerEvent } from 'react'
import { formatArea, formatHour, formatPrice, freeLabel } from '../domain/format'
import { sunRange, sunWindow } from '../domain/sun'
import type { Facade } from '../domain/types'
import { useStore, type Spotlight } from '../state/store'
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
const SHORT_NAMES: Record<number, string> = {
  2: 'Cztery pokoje', 0: 'Trzy pokoje', 1: 'Dwa pokoje, południe',
  3: 'Dwa pokoje, wschód', 4: 'Kawalerka',
}

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
  const [active, setActive] = useState<number | null>(null)
  const interactions = useRef(new Map<string, TypeCard>())

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
    interactions.current.clear()
    setActive(null)
    dispatch({ type: 'resetFilters' })
    dispatch({ type: 'setFilters', patch: { rooms: [card.rooms], facade: card.facade } })
    dispatch({ type: 'spotlight', spot: null, owner: ownSpot.current ?? card.spot })
    ownSpot.current = null
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = document.getElementById('mieszkania')
    if (target) {
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      target.focus({ preventScroll: true })
    }
  }

  const onActive = (card: TypeCard, source: string, on: boolean) => {
    interactions.current.delete(source)
    if (on) interactions.current.set(source, card)
    const next = [...interactions.current.values()].at(-1) ?? null
    if (ownSpot.current && ownSpot.current !== next?.spot) {
      dispatch({ type: 'spotlight', spot: null, owner: ownSpot.current })
    }
    ownSpot.current = next?.spot ?? null
    setActive(next?.slot ?? null)
    if (next) dispatch({ type: 'spotlight', spot: next.spot })
  }

  const plan = (card: TypeCard) => (
    <TypePlan key={card.slot} card={card} active={active === card.slot}
      onActive={(on) => onActive(card, `plan-${card.slot}`, on)}
      onPick={() => goToSearch(card)} />
  )

  return (
    <div className="typegal">
      <figure className="typesheet" data-active={active !== null}>
        <figcaption className="typesheet__heading">
          <span>Rzuty w jednej skali</span><span>Arkusz A-02</span>
        </figcaption>
        <div className="typesheet__row">{cards.filter((card) => ORDER.indexOf(card.slot) < 3).map(plan)}</div>
        <div className="typesheet__row">
          {cards.filter((card) => ORDER.indexOf(card.slot) >= 3).map(plan)}
          <div className="typesheet__legend">
            <div className="typesheet__scale">
              <span className="typesheet__scale-bar" />
              <span>0</span><span>5 m</span>
            </div>
          </div>
        </div>
      </figure>
      <table className="typetable" aria-label="Porównanie typów mieszkań">
        <thead><tr>
          <th scope="col">Typ</th><th scope="col">Metraż</th>
          <th scope="col">Słońce w salonie</th><th scope="col">Cena od</th><th scope="col">Wolne</th>
        </tr></thead>
        <tbody>{cards.map((card) => (
          <TypeRow key={card.slot} card={card} active={active === card.slot}
            onActive={(on) => onActive(card, `row-${card.slot}`, on)}
            onPick={() => goToSearch(card)} />
        ))}</tbody>
      </table>
    </div>
  )
}

interface TypeInteractionProps {
  card: TypeCard
  active: boolean
  onActive: (on: boolean) => void
  onPick: () => void
}

// Osobne refy zachowują fokus po zejściu kursora i hover po utracie fokusu.
function useTypeInteraction(onActive: (on: boolean) => void, onPick: () => void) {
  const hover = useRef(false)
  const focus = useRef(false)
  const sync = () => onActive(hover.current || focus.current)
  return {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'touch') return
      hover.current = true
      sync()
    },
    onPointerLeave: () => {
      if (!hover.current) return
      hover.current = false
      sync()
    },
    onFocus: (e: FocusEvent<HTMLButtonElement>) => {
      if (!e.currentTarget.matches(':focus-visible')) return
      focus.current = true
      sync()
    },
    onBlur: () => {
      if (!focus.current) return
      focus.current = false
      sync()
    },
    onClick: () => {
      hover.current = false
      focus.current = false
      onPick()
    },
  }
}

function presentation(card: TypeCard) {
  const ref = sunWindow(card.facade, 3)
  const low = sunWindow(card.facade, 0)
  const span = (w: { from: number; to: number }) => `${formatHour(w.from)}\u2060–\u2060${formatHour(w.to)}`
  const lowDiffers = Boolean(ref && low && (Math.abs(ref.from - low.from) > 0.05 || Math.abs(ref.to - low.to) > 0.05))
  const sun = ref ? span(ref) : 'bez bezpośredniego słońca'
  const ground = lowDiffers && low ? `parter ${span(low)}` : null
  const price = card.priceFrom == null ? 'wyprzedane' : formatPrice(card.priceFrom)
  const sunLabel = ref ? `słońce w salonie ${sun} na 3. piętrze${ground ? `, ${ground}` : ''}` : sun
  return {
    sun, ground, price,
    label: `${card.info.name}, ${card.info.note}, ${formatArea(card.area)}, ${card.priceFrom == null ? price : `od ${price}`}, ${freeLabel(card.free)}, ${sunLabel} — pokaż w wyszukiwarce`,
  }
}

function TypePlan({ card, active, onActive, onPick }: TypeInteractionProps) {
  const handlers = useTypeInteraction(onActive, onPick)
  return (
    <button type="button" className="typesheet__plan" data-active={active}
      style={{ ['--plan' as string]: PLAN_SCALE[card.slot] }}
      aria-label={presentation(card).label} {...handlers}>
      <img src={`${import.meta.env.BASE_URL}rzut3d/s${card.slot}-arkusz.webp`}
        width={1100} height={1100} alt="" fetchPriority="low" decoding="async" />
      <span className="typesheet__caption">
        <span className="typesheet__title">
          <span className="typesheet__number">T{ORDER.indexOf(card.slot) + 1}</span>{' '}
          <span className="typesheet__name">{SHORT_NAMES[card.slot]}</span>
        </span>
        <span className="typesheet__area">{formatArea(card.area)}</span>
      </span>
    </button>
  )
}

function TypeRow({ card, active, onActive, onPick }: TypeInteractionProps) {
  const { onPointerEnter, onPointerLeave, ...buttonHandlers } = useTypeInteraction(onActive, onPick)
  const { sun, ground, price, label } = presentation(card)
  const exposure = card.slot === 2 ? 'południe i wschód' : card.slot < 2 ? 'południe' : 'wschód'
  return (
    <tr data-active={active} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <td className="typetable__type">
        <button type="button" aria-label={label} {...buttonHandlers}>
          <span className="typesheet__number">T{ORDER.indexOf(card.slot) + 1}</span>{' '}
          {SHORT_NAMES[card.slot]}
          <span className="typetable__arrow" aria-hidden="true">→</span>
        </button>
        <span className="typetable__note">{card.info.note}</span>
      </td>
      <td className="typetable__area">{formatArea(card.area)}</td>
      <td className="typetable__sun">
        <span className="typetable__range">{sun}</span>
        <span className="typetable__note">3. piętro{ground && <> · <span className="typetable__range">{ground}</span></>}</span>
      </td>
      <td className="typetable__price">{price}</td>
      <td className="typetable__free">{card.free}</td>
      <td className="typetable__mobile" colSpan={5}>
        <span>{formatArea(card.area)}</span> · {exposure} · słońce {sun} · {freeLabel(card.free)}
        {ground && <> · {ground}</>}
      </td>
    </tr>
  )
}
