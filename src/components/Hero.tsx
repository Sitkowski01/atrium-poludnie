import { formatPrice } from '../domain/format'
import { useStore } from '../state/store'

export function Hero() {
  const { apartments, limits } = useStore()
  const free = apartments.filter((a) => a.status === 'wolne')
  const cheapest = Math.min(...free.map((a) => a.price))

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
          <dd>{free.length}</dd>
        </div>
        <div>
          <dt>cena od</dt>
          <dd>{formatPrice(cheapest)}</dd>
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
