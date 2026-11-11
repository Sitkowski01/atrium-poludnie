import { useEffect, useState, type MouseEvent } from 'react'

type Section = 'mieszkania' | 'budynek'

const LINKS: { id: Section; label: string }[] = [
  { id: 'mieszkania', label: 'Mieszkania' },
  { id: 'budynek', label: 'Budynek' },
]

/** Sekcja „Mieszkania” jest aktywna, gdy jej nagłówek dojechał pod pasek; wcześniej — bryła. */
function currentSection(): Section {
  const list = document.getElementById('mieszkania')
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 76
  if (!list) return 'budynek'
  return list.getBoundingClientRect().top <= header + 120 ? 'mieszkania' : 'budynek'
}

/**
 * Nawigacja nagłówka. Na szerokim ekranie bryła jest przyklejona po prawej, więc zwykły
 * link #budynek nie miał dokąd przewinąć i nic się nie działo; tu wraca na górę strony,
 * gdzie bryła stoi obok wstępu, a sama sekcja dostaje fokus i krótki błysk.
 */
export function TopNav() {
  const [active, setActive] = useState<Section>('budynek')

  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setActive(currentSection()))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const go = (id: Section) => (e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id)
    if (!el) return
    e.preventDefault()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth'
    if (id === 'budynek' && getComputedStyle(el).position === 'sticky') {
      window.scrollTo({ top: 0, behavior })
      el.classList.remove('is-flash')
      void el.offsetWidth // restart animacji przy kolejnym kliknięciu
      el.classList.add('is-flash')
      window.setTimeout(() => el.classList.remove('is-flash'), 1200)
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
