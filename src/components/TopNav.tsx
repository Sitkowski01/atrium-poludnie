import { useEffect, useRef, useState, type MouseEvent } from 'react'

type Section = 'budynek' | 'typy' | 'swiatlo' | 'mieszkania' | 'kontakt'

const LINKS: { id: Section; label: string }[] = [
  { id: 'budynek', label: 'Budynek' },
  { id: 'typy', label: 'Typy' },
  { id: 'swiatlo', label: 'Światło' },
  { id: 'mieszkania', label: 'Mieszkania' },
  { id: 'kontakt', label: 'Kontakt' },
]

/** rozdziały w kolejności na stronie; przed pierwszym z nich aktywna jest bryła */
const CHAPTERS: Section[] = ['typy', 'swiatlo', 'mieszkania', 'kontakt']

/** Aktywny jest ostatni rozdział, którego nagłówek dojechał pod pasek; wcześniej — bryła. */
function currentSection(): Section {
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 76
  // koniec strony: ostatni rozdział może być za krótki, żeby jego nagłówek dojechał pod pasek
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) return 'kontakt'
  let active: Section = 'budynek'
  for (const id of CHAPTERS) {
    const el = document.getElementById(id)
    if (el && el.getBoundingClientRect().top <= header + 120) active = id
  }
  return active
}

/**
 * Nawigacja nagłówka. Na szerokim ekranie bryła jest przyklejona po prawej, więc zwykły
 * link #budynek nie miał dokąd przewinąć i nic się nie działo; tu wraca na górę strony,
 * gdzie bryła stoi obok wstępu, a sama sekcja dostaje fokus i krótki błysk.
 */
export function TopNav() {
  const [active, setActive] = useState<Section>('budynek')

  const flashTimer = useRef(0)
  // po kliknięciu linku nasłuch przewijania nie zmienia podświetlenia, dopóki ruch się nie skończy
  const locked = useRef(false)
  const lockTimer = useRef(0)
  const unlockRef = useRef<() => void>(() => {})
  const armLock = () => {
    locked.current = true
    window.clearTimeout(lockTimer.current)
    lockTimer.current = window.setTimeout(() => unlockRef.current(), 900)
  }

  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setActive(currentSection()))
    }
    const unlock = () => {
      window.clearTimeout(lockTimer.current)
      locked.current = false
      update()
    }
    unlockRef.current = unlock
    const onScroll = () => {
      if (locked.current) armLock()
      else update()
    }
    const onScrollEnd = () => {
      if (locked.current) unlock()
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scrollend', onScrollEnd)
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(lockTimer.current)
      window.clearTimeout(flashTimer.current)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scrollend', onScrollEnd)
      window.removeEventListener('resize', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (id: Section) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return
    const el = document.getElementById(id)
    if (!el) return
    e.preventDefault()
    armLock()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth'
    if (id === 'budynek' && getComputedStyle(el).position === 'sticky') {
      window.scrollTo({ top: 0, behavior })
      el.classList.remove('is-flash')
      void el.offsetWidth // restart animacji przy kolejnym kliknięciu
      el.classList.add('is-flash')
      window.clearTimeout(flashTimer.current)
      flashTimer.current = window.setTimeout(() => el.classList.remove('is-flash'), 1200)
    } else {
      el.scrollIntoView({ behavior, block: 'start' })
    }
    el.focus({ preventScroll: true })
    history.replaceState(null, '', `#${id}`)
    setActive(id)
  }

  return (
    <nav className="topbar__nav" aria-label="Sekcje strony">
      {LINKS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          className={active === id ? 'is-active' : undefined}
          aria-current={active === id ? 'location' : undefined}
          onClick={go(id)}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
