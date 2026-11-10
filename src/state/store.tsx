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

export interface State {
  filters: Filters
  sort: SortKey
  /** pora dnia dla symulacji słońca, 5..21 */
  hour: number
  hoveredId: string | null
  selectedId: string | null
  favourites: string[]
}

export type Action =
  | { type: 'setFilters'; patch: Partial<Filters> }
  | { type: 'resetFilters' }
  | { type: 'setSort'; sort: SortKey }
  | { type: 'setHour'; hour: number }
  | { type: 'hover'; id: string | null }
  | { type: 'select'; id: string | null }
  | { type: 'toggleFavourite'; id: string }

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

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setFilters':
      return { ...state, filters: { ...state.filters, ...action.patch } }
    case 'resetFilters':
      return { ...state, filters: defaultFilters(LIMITS) }
    case 'setSort':
      return { ...state, sort: action.sort }
    case 'setHour':
      return state.hour === action.hour ? state : { ...state, hour: action.hour }
    case 'hover':
      return state.hoveredId === action.id ? state : { ...state, hoveredId: action.id }
    case 'select':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id }
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    filters: defaultFilters(LIMITS),
    sort: 'price-asc' as SortKey,
    hour: 10,
    hoveredId: null,
    selectedId: null,
    favourites: loadFavourites(),
  }))

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

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const store = useContext(Ctx)
  if (!store) throw new Error('useStore poza StoreProvider')
  return store
}
