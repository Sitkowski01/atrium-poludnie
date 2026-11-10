import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Apartment } from '../domain/types'
import './InquiryForm.css'

const MAX_MESSAGE = 600

interface Values {
  name: string
  email: string
  phone: string
  message: string
  consent: boolean
}

type Errors = Partial<Record<keyof Values, string>>

const ORDER: (keyof Values)[] = ['name', 'email', 'phone', 'message', 'consent']

function validate(v: Values): Errors {
  const errors: Errors = {}
  if (v.name.trim().length < 2) errors.name = 'Podaj imię (min. 2 znaki).'
  const email = v.email.trim()
  if (!email) errors.email = 'Podaj adres e-mail.'
  else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email)) errors.email = 'Podaj poprawny adres e-mail.'
  const phone = v.phone.trim()
  if (phone) {
    const digits = phone.replace(/\D/g, '').length
    if (!/^\+?[\d\s-]+$/.test(phone) || digits < 9 || digits > 15) {
      errors.phone = 'Numer: 9–15 cyfr, dozwolone spacje, + i -.'
    }
  }
  if (!v.consent) errors.consent = 'Zgoda jest wymagana, aby wysłać zapytanie.'
  return errors
}

export function InquiryForm({ apartment }: { apartment: Apartment }) {
  const defaultMessage = `Dzień dobry, proszę o kontakt w sprawie mieszkania ${apartment.id}.`
  const [values, setValues] = useState<Values>({
    name: '',
    email: '',
    phone: '',
    message: defaultMessage,
    consent: false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [attempted, setAttempted] = useState(false)
  const [sentName, setSentName] = useState<string | null>(null)

  const refs = useRef<Partial<Record<keyof Values, HTMLInputElement | HTMLTextAreaElement | null>>>({})
  const doneRef = useRef<HTMLDivElement>(null)

  const wasSent = useRef(false)
  useEffect(() => {
    if (sentName !== null) {
      doneRef.current?.focus()
      wasSent.current = true
    } else if (wasSent.current) {
      // powrót z potwierdzenia: przycisk zniknął, fokus trafia na pierwsze pole
      wasSent.current = false
      refs.current.name?.focus()
    }
  }, [sentName])

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    const next = { ...values, [key]: value }
    setValues(next)
    if (attempted) setErrors(validate(next))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const found = validate(values)
    setAttempted(true)
    setErrors(found)
    const first = ORDER.find((k) => found[k])
    if (first) {
      refs.current[first]?.focus()
      return
    }
    setSentName(values.name.trim())
  }

  const reset = () => {
    setValues((v) => ({ ...v, message: defaultMessage, consent: false }))
    setErrors({})
    setAttempted(false)
    setSentName(null)
  }

  if (sentName !== null) {
    return (
      <div className="inquiry__done" role="status" tabIndex={-1} ref={doneRef}>
        <span className="inquiry__done-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
            <path
              className="inquiry__done-check"
              d="M14 25 L21 32 L34 17"
              pathLength={1}
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="inquiry__done-title">Dziękujemy, {sentName}.</p>
        <p className="inquiry__done-demo">To demo — wiadomość nie została nigdzie wysłana.</p>
        <button type="button" className="btn" onClick={reset}>
          Napisz kolejną
        </button>
      </div>
    )
  }

  const text = (key: 'name' | 'email' | 'phone') => (e: ChangeEvent<HTMLInputElement>) =>
    update(key, e.target.value)
  const idOf = (k: keyof Values) => `inquiry-${apartment.id}-${k}`
  const fieldProps = (k: keyof Values) => ({
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `${idOf(k)}-error` : undefined,
  })
  const error = (k: keyof Values) =>
    errors[k] ? (
      <span className="field__error inquiry__error" id={`${idOf(k)}-error`}>
        <svg className="inquiry__error-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
          <path d="M8 1.5 15 14H1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 6.2v3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.8" r="0.9" fill="currentColor" />
        </svg>
        <span>{errors[k]}</span>
      </span>
    ) : null

  return (
    <form className="inquiry" noValidate onSubmit={onSubmit}>
      {apartment.status === 'sprzedane' && (
        <p className="inquiry__notice inquiry__notice--sold">To mieszkanie jest już sprzedane. Napisz, a wskażemy podobne.</p>
      )}
      {apartment.status === 'rezerwacja' && (
        <p className="inquiry__notice inquiry__notice--hold">Mieszkanie jest zarezerwowane. Możemy wpisać Cię na listę oczekujących.</p>
      )}

      <div className="field">
        <label className="field__label" htmlFor={idOf('name')}>
          Imię
        </label>
        <input
          id={idOf('name')}
          type="text"
          required
          autoComplete="given-name"
          value={values.name}
          onChange={text('name')}
          ref={(el) => {
            refs.current.name = el
          }}
          {...fieldProps('name')}
        />
        {error('name')}
      </div>

      <div className="field">
        <label className="field__label" htmlFor={idOf('email')}>
          E-mail
        </label>
        <input
          id={idOf('email')}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={values.email}
          onChange={text('email')}
          ref={(el) => {
            refs.current.email = el
          }}
          {...fieldProps('email')}
        />
        {error('email')}
      </div>

      <div className="field">
        <label className="field__label" htmlFor={idOf('phone')}>
          Telefon (opcjonalnie)
        </label>
        <input
          id={idOf('phone')}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={values.phone}
          onChange={text('phone')}
          ref={(el) => {
            refs.current.phone = el
          }}
          {...fieldProps('phone')}
        />
        {error('phone')}
      </div>

      <div className="field">
        <label className="field__label" htmlFor={idOf('message')}>
          Wiadomość
        </label>
        <textarea
          id={idOf('message')}
          rows={4}
          maxLength={MAX_MESSAGE}
          value={values.message}
          onChange={(e) => update('message', e.target.value)}
          ref={(el) => {
            refs.current.message = el
          }}
        />
        <span className="inquiry__counter">
          {values.message.length} / {MAX_MESSAGE}
        </span>
      </div>

      <div className="inquiry__consent-wrap">
        <label className="inquiry__consent">
          <input
            type="checkbox"
            required
            checked={values.consent}
            onChange={(e) => update('consent', e.target.checked)}
            ref={(el) => {
              refs.current.consent = el
            }}
            {...fieldProps('consent')}
          />
          <span>Zgadzam się na kontakt w sprawie tego zapytania.</span>
        </label>
        {error('consent')}
      </div>

      <button type="submit" className="btn btn--primary inquiry__submit">
        Zapytaj o mieszkanie {apartment.id}
      </button>
    </form>
  )
}
