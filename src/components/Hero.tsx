import { useCountUp } from '../hooks/useCountUp'
import { useStore } from '../state/store'

const thousands = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 })

export function Hero() {
  const { apartments, limits } = useStore()
  const free = apartments.filter((a) => a.status === 'wolne')
  const cheapest = Math.min(...free.map((a) => a.price))
  // liczby dochodzą przy wejściu; czytnik dostaje od razu wartość końcową
  const freeShown = Math.round(useCountUp(free.length, { from: 0, duration: 1100 }))
  const priceShown = Math.round(useCountUp(cheapest / 1000, { from: (cheapest / 1000) * 0.6, duration: 1100 }))

  return (
    <header className="hero">
      <p className="eyebrow">
        Szczecin · {apartments.length} mieszkań · odbiór 2027
      </p>
      <h1 className="hero__title">
        Dom, w&nbsp;którym <em>słońce</em> ma&nbsp;swój rozkład.
      </h1>
      <p className="hero__lead">
        Wybierz mieszkanie na bryle budynku, zobacz światło o każdej porze dnia i przejdź się po wnętrzu
        w 360°.
      </p>
      <dl className="hero__stats">
        <div>
          <dt>wolnych</dt>
          <dd>
            <span aria-hidden="true">{freeShown}</span>
            <span className="visually-hidden">{free.length}</span>
          </dd>
        </div>
        <div>
          <dt>cena od</dt>
          <dd>
            <span aria-hidden="true">{thousands.format(priceShown)} tys. zł</span>
            <span className="visually-hidden">{thousands.format(cheapest)} zł</span>
          </dd>
        </div>
        <div>
          <dt>metraże</dt>
          <dd>
            {limits.areaMin}–{limits.areaMax}&nbsp;m²
          </dd>
        </div>
      </dl>
    </header>
  )
}
