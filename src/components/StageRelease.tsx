import { useEffect } from 'react'

/**
 * Koniec sceny: gdy kontakt wchodzi na ekran, przyklejona bryła gaśnie, zamiast wyjeżdżać pod pasek
 * ucięta w połowie. Działa tylko tam, gdzie scena jest przyklejona (szeroki ekran).
 */
export function StageRelease() {
  useEffect(() => {
    const contact = document.getElementById('kontakt')
    const scene = document.querySelector<HTMLElement>('.stage__scene')
    if (!contact || !scene || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => scene.classList.toggle('is-released', e.isIntersecting),
      { rootMargin: '0px 0px -35% 0px', threshold: 0 },
    )
    io.observe(contact)
    return () => io.disconnect()
  }, [])
  return null
}
