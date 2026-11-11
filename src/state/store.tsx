import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { APARTMENTS } from '../domain/data'
import { applyFilters, defaultFilters, limitsOf, sortApartments } from '../domain/filter'
import type { Apartment, Filters, Limits, SortKey } from '../domain/types'

interface FullState {
  filters: Filters
  sort: SortKey
  /** pora dnia dla symulacji słońca, 5..21 */
  hour: number
  /** użytkownik sam ustawił godzinę albo otworzył mieszkanie: przelot przy wejściu ma się zatrzymać */
  introCancelled: boolean
  hoveredId: string | null
  selectedId: string | null
  favourites: string[]
  /** mieszkania podświetlone na bryle przez sekcję strony (typ, „kiedy jesteś w domu”); null = brak */
  /**
   * Podświetlenia z rozdziałów jako stos: na bryle widać ostatnie dodane. Rozdział gasi tylko
   * swoje, więc karta typu, która na chwilę nadpisze „Światło”, nie zostawi bryły pustej.
   */
  spotlights: readonly Spotlight[]
}

export interface Spotlight {
  ids: readonly string[]
  /** krótki opis dla karty przy bryle i czytnika, np. „4 pokoje, narożne” */
  label: string
}

/**
 * Stan bez godziny. Godzina zmienia się co klatkę (przelot słońca, odtwarzanie dnia),
 * więc ma osobny kontekst — inaczej każdy krok przerysowywałby listę i filtry.
 */
export type State = Omit<FullState, 'hour' | 'introCancelled' | 'spotlights'> & {
  /** to, co widać na bryle: ostatnie podświetlenie ze stosu */
  spotlight: Spotlight | null
}

export interface Hour {
  hour: number
  introCancelled: boolean
}

export type Action =
  | { type: 'setFilters'; patch: Partial<Filters> }
  | { type: 'resetFilters' }
  | { type: 'setSort'; sort: SortKey }
  /** byUser: ruch suwaka, preset, odtwarzanie — przerywa przelot przy wejściu */
  | { type: 'setHour'; hour: number; byUser?: boolean }
  | { type: 'cancelIntro' }
  | { type: 'hover'; id: string | null }
  | { type: 'select'; id: string | null }
  | { type: 'toggleFavourite'; id: string }
  /** owner: gasząc (spot: null), podaj swoje podświetlenie — cudze zostaje nietknięte */
  | { type: 'spotlight'; spot: Spotlight | null; owner?: Spotlight | null }

const LIMITS = limitsOf(APARTMENTS)
const STORAGE_KEY = 'atrium-poludnie:ulubione'
const KNOWN_IDS = new Set(APARTMENTS.map((a) => a.id))

function loadFavourites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string' && KNOWN_IDS.has(x)))]
  } catch {
    return []
  }
}

function reducer(state: FullState, action: Action): FullState {
  switch (action.type) {
    case 'setFilters':
      return { ...state, filters: { ...state.filters, ...action.patch } }
    case 'resetFilters':
      return { ...state, filters: defaultFilters(LIMITS) }
    case 'setSort':
      return { ...state, sort: action.sort }
    case 'setHour': {
      const introCancelled = state.introCancelled || Boolean(action.byUser)
      return state.hour === action.hour && introCancelled === state.introCancelled
        ? state
        : { ...state, hour: action.hour, introCancelled }
    }
    case 'cancelIntro':
      return state.introCancelled ? state : { ...state, introCancelled: true }
    case 'hover':
      return state.hoveredId === action.id ? state : { ...state, hoveredId: action.id }
    case 'select':
      if (state.selectedId === action.id) return state
      // otwarcie mieszkania kończy przelot; zamknięcie czyści najechanie (na dotyku nie przychodzi mouseleave)
      return action.id
        ? { ...state, selectedId: action.id, introCancelled: true }
        : { ...state, selectedId: null, hoveredId: null }
    case 'spotlight': {
      if (action.spot) {
        // ustawienie: na wierzch stosu (bez duplikatu tego samego podświetlenia)
        if (state.spotlights[state.spotlights.length - 1] === action.spot) return state
        return { ...state, spotlights: [...state.spotlights.filter((s) => s !== action.spot), action.spot] }
      }
      // zgaszenie z właścicielem: tylko jego wpis; bez właściciela: wszystko
      if (action.owner === undefined || action.owner === null) {
        return state.spotlights.length ? { ...state, spotlights: [] } : state
      }
      const owner = action.owner
      return state.spotlights.includes(owner) ? { ...state, spotlights: state.spotlights.filter((s) => s !== owner) } : state
    }
    case 'toggleFavourite': {
      const has = state.favourites.includes(action.id)
      return {
        ...state,
        favourites: has
          ? state.favourites.filter((id) => id !== action.id)
          : [...state.favourites, action.id],
      }
    }
  }
}

export interface Store {
  state: State
  dispatch: Dispatch<Action>
  /** wszystkie mieszkania */
  apartments: readonly Apartment[]
  /** po filtrach i sortowaniu */
  visible: Apartment[]
  visibleIds: ReadonlySet<string>
  selected: Apartment | null
  limits: Limits
}

const Ctx = createContext<Store | null>(null)
const HourCtx = createContext<Hour | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [full, dispatch] = useReducer(reducer, undefined, () => ({
    filters: defaultFilters(LIMITS),
    sort: 'price-asc' as SortKey,
    hour: 10,
    introCancelled: false,
    hoveredId: null,
    selectedId: null,
    favourites: loadFavourites(),
    spotlights: [],
  }))
  const { filters, sort, hoveredId, selectedId, favourites, spotlights } = full
  const spotlight = spotlights.length ? spotlights[spotlights.length - 1] : null
  const state = useMemo<State>(
    () => ({ filters, sort, hoveredId, selectedId, favourites, spotlight }),
    [filters, sort, hoveredId, selectedId, favourites, spotlight],
  )
  const hour = useMemo<Hour>(
    () => ({ hour: full.hour, introCancelled: full.introCancelled }),
    [full.hour, full.introCancelled],
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.favourites))
    } catch {
      // prywatne okno albo zablokowany zapis — ulubione żyją tylko do odświeżenia
    }
  }, [state.favourites])

  const visible = useMemo(
    () => sortApartments(applyFilters(APARTMENTS, state.filters, state.favourites), state.sort),
    [state.filters, state.favourites, state.sort],
  )
  const visibleIds = useMemo(() => new Set(visible.map((a) => a.id)), [visible])
  const selected = useMemo(
    () => APARTMENTS.find((a) => a.id === state.selectedId) ?? null,
    [state.selectedId],
  )

  const value = useMemo<Store>(
    () => ({ state, dispatch, apartments: APARTMENTS, visible, visibleIds, selected, limits: LIMITS }),
    [state, visible, visibleIds, selected],
  )

  return (
    <Ctx.Provider value={value}>
      <HourCtx.Provider value={hour}>{children}</HourCtx.Provider>
    </Ctx.Provider>
  )
}

/** pora dnia; używają jej tylko komponenty, które naprawdę ją pokazują */
export function useHour(): Hour {
  const h = useContext(HourCtx)
  if (!h) throw new Error('useHour poza StoreProvider')
  return h
}

export function useStore(): Store {
  const store = useContext(Ctx)
  if (!store) throw new Error('useStore poza StoreProvider')
  return store
}
