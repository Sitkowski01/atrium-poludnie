import { useEffect } from 'react'

/**
 * Koniec sceny: przyklejona bryła gaśnie dokładnie wtedy, gdy koniec sceny (znacznik `.stage__end`)
 * wchodzi w okno — zanim zacznie odjeżdżać ucięta pod pasek. Wygaszenie kończy się
 * `visibility: hidden`, więc nie zostaje półprzezroczysty „znak wodny”.
 * Nasłuch przewijania, nie IntersectionObserver: skok z dołu strony na górę nie przecina progu
 * i obserwator nie zgłaszał zmiany (bryła zostawała ukryta).
 */
export function StageRelease() {
  useEffect(() => {
    const end = document.querySelector<HTMLElement>('.stage__end')
    const scene = document.querySelector<HTMLElement>('.stage__scene')
    if (!end || !scene) return
    let frame = 0
    const update = () => {
      frame = 0
      scene.classList.toggle('is-released', end.getBoundingClientRect().top < window.innerHeight)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  return null
}
