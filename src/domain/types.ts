/** Elewacja, na którą wychodzą okna salonu. S = południe, E = wschód. */
export type Facade = 'S' | 'E'

export type Status = 'wolne' | 'rezerwacja' | 'sprzedane'

export type RoomKind = 'salon' | 'sypialnia' | 'kuchnia' | 'lazienka' | 'hol' | 'balkon'

/**
 * Prostokątne pomieszczenie na rzucie. Jednostka: metry.
 * (0,0) to lewy górny róg obrysu mieszkania, oś y rośnie w dół.
 * Ściana z oknami to dolna krawędź obrysu (y = planH).
 * Balkon leży poza obrysem: y >= planH.
 */
export interface Room {
  kind: RoomKind
  label: string
  x: number
  y: number
  w: number
  h: number
}

export interface Apartment {
  /** np. "3.02" — piętro.numer */
  id: string
  /** 0 = parter, 6 = ostatnie piętro */
  floor: number
  /** pozycja na piętrze 0..4; 0–2 elewacja południowa, 3–4 wschodnia */
  slot: number
  facade: Facade
  /** liczba pokoi (salon + sypialnie) */
  rooms: number
  /** powierzchnia w m², bez balkonu */
  area: number
  /** cena w zł */
  price: number
  pricePerM2: number
  status: Status
  balcony: boolean
  /** szerokość i głębokość obrysu w metrach */
  planW: number
  planH: number
  /** pomieszczenia; zawiera balkon, jeśli balcony === true */
  plan: Room[]
}

export interface Filters {
  /** identyfikatory pór w domu; pusta tablica = brak kryterium */
  home: string[]
  /** wybrane liczby pokoi; pusta tablica = wszystkie */
  rooms: number[]
  areaMin: number
  areaMax: number
  priceMax: number
  floorMin: number
  floorMax: number
  facade: Facade | 'all'
  /** ukryj sprzedane */
  onlyAvailable: boolean
  onlyFavourites: boolean
}

export type SortKey = 'price-asc' | 'price-desc' | 'area-desc' | 'floor-desc' | 'sun-home'

/** Zakresy wyliczone z danych — granice suwaków w filtrach. */
export interface Limits {
  areaMin: number
  areaMax: number
  priceMin: number
  priceMax: number
  floorMax: number
}
