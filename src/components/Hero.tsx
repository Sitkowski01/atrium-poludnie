import { formatPrice } from '../domain/format'
import { useCountUp } from '../hooks/useCountUp'
import { useStore } from '../state/store'

export function Hero() {
  const { apartments, limits } = useStore()
  const free = apartments.filter((a) => a.status === 'wolne')
  const cheapest = Math.min(...free.map((a) => a.price))
  // liczby dochodzą przy wejściu; czytnik dostaje od razu wartość końcową
  const freeShown = Math.round(useCountUp(free.length, { from: 0, duration: 900 }))
  const priceShown = Math.round(useCountUp(cheapest, { from: cheapest * 0.6, duration: 900 }) / 1000) * 1000

  return (
    <header className="hero">
      <div>
        <p className="eyebrow">Szczecin · {apartments.length} mieszkań · odbiór 2027</p>
        <h1 className="hero__title">
          Atrium <em>Południe</em>
        </h1>
        <p className="hero__lead">
          Wybierz mieszkanie prosto na bryle budynku i sprawdź, o której godzinie słońce wpada do salonu.
        </p>
      </div>
      <dl className="hero__stats">
        <div>
          <dt>wolnych mieszkań</dt>
          <dd>
            <span aria-hidden="true">{freeShown}</span>
            <span className="visually-hidden">{free.length}</span>
          </dd>
        </div>
        <div>
          <dt>cena od</dt>
          <dd>
            <span aria-hidden="true">{formatPrice(priceShown)}</span>
            <span className="visually-hidden">{formatPrice(cheapest)}</span>
          </dd>
        </div>
        <div>
          <dt>metraże</dt>
          <dd>
            {limits.areaMin}–{limits.areaMax} m²
          </dd>
        </div>
      </dl>
    </header>
  )
}
