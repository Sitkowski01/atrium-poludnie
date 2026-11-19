import { useState, type CSSProperties } from 'react'
import { formatPrice } from '../domain/format'
import { calcMortgage } from '../domain/mortgage'
import { useCountUp } from '../hooks/useCountUp'
import './MortgageCalculator.css'

const decimal = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function MortgageCalculator({ price }: { price: number }) {
  const [downPct, setDownPct] = useState(20)
  const [years, setYears] = useState(25)
  const [rate, setRate] = useState(7.5)

  const res = calcMortgage({ price, downPaymentPct: downPct, years, ratePct: rate })
  const interestPct = res.totalPaid > 0 ? Math.round((res.totalInterest / res.totalPaid) * 100) : 0
  const capitalPct = res.totalPaid > 0 ? 100 - interestPct : 0

  const monthlyFinal = Math.round(res.monthly)
  const monthlyShown = Math.round(useCountUp(res.monthly, { duration: 350 }))
  const loanShown = Math.round(useCountUp(res.loan, { duration: 350 }))
  const interestShown = Math.round(useCountUp(res.totalInterest, { duration: 350 }))

  return (
    <section className="mortgage" aria-label="Kalkulator raty">

      <label className="mortgage__slider">
        <span className="mortgage__label">
          Wkład własny
          <strong>
            {downPct}% · {formatPrice(res.downPayment)}
          </strong>
        </span>
        <input
          type="range"
          min={10}
          max={80}
          step={5}
          value={downPct}
          style={{ '--pct': `${(downPct - 10) / (80 - 10) * 100}%` } as CSSProperties}
          aria-valuetext={`${downPct}%, ${formatPrice(res.downPayment)}`}
          onChange={(e) => setDownPct(Number(e.target.value))}
        />
      </label>

      <label className="mortgage__slider">
        <span className="mortgage__label">
          Okres kredytu
          <strong>{years} lat</strong>
        </span>
        <input
          type="range"
          min={5}
          max={35}
          step={1}
          value={years}
          style={{ '--pct': `${(years - 5) / (35 - 5) * 100}%` } as CSSProperties}
          aria-valuetext={`${years} lat`}
          onChange={(e) => setYears(Number(e.target.value))}
        />
      </label>

      <label className="mortgage__slider">
        <span className="mortgage__label">
          Oprocentowanie
          <strong>{decimal.format(rate)}%</strong>
        </span>
        <input
          type="range"
          min={4}
          max={12}
          step={0.1}
          value={rate}
          style={{ '--pct': `${(rate - 4) / (12 - 4) * 100}%` } as CSSProperties}
          aria-valuetext={`${decimal.format(rate)}%`}
          onChange={(e) => setRate(Number(e.target.value))}
        />
      </label>

      <div className="mortgage__result">
        <p className="mortgage__monthly">
          <span className="mortgage__monthly-value" aria-hidden="true">
            {formatPrice(monthlyShown)}
          </span>
          <span className="mortgage__monthly-unit">/ miesiąc</span>
        </p>
        <span className="visually-hidden" aria-live="polite">
          Rata miesięczna: {formatPrice(monthlyFinal)}
        </span>
        <dl className="mortgage__facts">
          <div>
            <dt>Kwota kredytu</dt>
            <dd aria-hidden="true">{formatPrice(loanShown)}</dd>
            <dd className="visually-hidden">{formatPrice(Math.round(res.loan))}</dd>
          </div>
          <div>
            <dt>Suma odsetek</dt>
            <dd aria-hidden="true">{formatPrice(interestShown)}</dd>
            <dd className="visually-hidden">{formatPrice(Math.round(res.totalInterest))}</dd>
          </div>
        </dl>

        <div
          className="mortgage__bar"
          role="img"
          aria-label={`Kapitał ${capitalPct}%, odsetki ${interestPct}% sumy spłat`}
        >
          <span className="mortgage__bar-capital" style={{ width: `${capitalPct}%` }} />
          <span className="mortgage__bar-interest" style={{ width: `${interestPct}%` }} />
        </div>
        <ul className="mortgage__legend">
          <li>
            <span className="mortgage__swatch mortgage__swatch--capital" aria-hidden="true" />
            Kapitał {capitalPct}%
          </li>
          <li>
            <span className="mortgage__swatch mortgage__swatch--interest" aria-hidden="true" />
            Odsetki {interestPct}%
          </li>
        </ul>
      </div>

      <p className="mortgage__note">Symulacja poglądowa. Nie stanowi oferty kredytowej.</p>
    </section>
  )
}
