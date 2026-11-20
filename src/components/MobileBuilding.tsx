import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../state/store'
import './MobileBuilding.css'

export function MobileBuilding() {
  const { state } = useStore()
  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const [scene, setScene] = useState<HTMLElement | null>(null)
  const chip = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(true)
  const sceneHeight = useRef(0)
  const active = phase !== 'closed'

  useEffect(() => {
    const building = document.getElementById('budynek')
    const slot = document.querySelector<HTMLElement>('.stage__slot')
    const end = document.querySelector<HTMLElement>('.stage__end')
    if (!building || !slot || !end) return
    let frame = 0
    // przycisk nie zasłania treści, którą właśnie czytasz: chowa się przy przewijaniu w dół,
    // wraca przy ruchu w górę albo chwilę po zatrzymaniu
    let lastY = window.scrollY
    let goingDown = false
    let idle = 0
    const update = () => {
      frame = 0
      const mobile = window.innerWidth <= 980
      const inRange = mobile && slot.getBoundingClientRect().bottom <= 0 && end.getBoundingClientRect().top > window.innerHeight
      const y = window.scrollY
      if (Math.abs(y - lastY) > 4) goingDown = y > lastY
      lastY = y
      setVisible(inRange && !goingDown)
      if (!mobile) setPhase('closed')
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
      window.clearTimeout(idle)
      idle = window.setTimeout(() => {
        goingDown = false
        if (!frame) frame = requestAnimationFrame(update)
      }, 900)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(idle)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  // Panel mieszkania przejmuje fokus; nie oddajemy go wtedy przyciskowi pod dialogiem.
  useLayoutEffect(() => {
    if (state.selectedId !== null) {
      restoreFocus.current = false
      setPhase('closed')
    }
  }, [state.selectedId])

  useLayoutEffect(() => {
    if (!active || !scene) return
    const slot = scene.parentElement!
    const previousHeight = slot.style.minHeight
    const previousOverflow = document.body.style.overflow
    slot.style.minHeight = `${sceneHeight.current}px`
    scene.classList.add('is-sheet')
    scene.setAttribute('role', 'dialog')
    scene.setAttribute('aria-modal', 'true')
    document.body.style.overflow = 'hidden'

    // Wyłączamy tło, zachowując tę samą scenę i jej stan WebGL.
    const background: { element: HTMLElement; inert: boolean }[] = []
    let branch: HTMLElement = scene
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== branch &&
            !sibling.matches('.mobile-building__scrim, .mobile-building__chip, dialog')) {
          background.push({ element: sibling, inert: sibling.inert })
          sibling.inert = true
        }
      }
      branch = branch.parentElement
      if (branch === document.body) break
    }
    closeButton.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setPhase('closing')
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(scene.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length && !element.closest('[inert]'))
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || !scene.contains(document.activeElement))) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !scene.contains(document.activeElement))) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      scene.classList.remove('is-sheet', 'is-sheet-open')
      scene.removeAttribute('role')
      scene.removeAttribute('aria-modal')
      slot.style.minHeight = previousHeight
      document.body.style.overflow = previousOverflow
      background.forEach(({ element, inert }) => { element.inert = inert })
      if (restoreFocus.current) {
        (window.innerWidth <= 980 ? chip.current : scene)?.focus({ preventScroll: true })
      }
    }
  }, [active, scene])

  useLayoutEffect(() => {
    if (!active || !scene) return
    let frame = 0
    let nextFrame = 0
    let timer = 0
    if (phase === 'open') {
      frame = requestAnimationFrame(() => {
        nextFrame = requestAnimationFrame(() => scene.classList.add('is-sheet-open'))
      })
    } else {
      scene.classList.remove('is-sheet-open')
      timer = window.setTimeout(() => setPhase('closed'),
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350)
    }
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(nextFrame)
      clearTimeout(timer)
    }
  }, [active, phase, scene])

  const open = () => {
    const building = document.getElementById('budynek')
    if (!building || window.innerWidth > 980 || state.selectedId !== null) return
    restoreFocus.current = true
    sceneHeight.current = building.getBoundingClientRect().height
    setScene(building)
    setPhase('open')
  }

  return <>
    <button ref={chip} type="button"
      className={`mobile-building__chip${visible && state.selectedId === null ? ' is-visible' : ''}`}
      aria-expanded={active} aria-controls="budynek" onClick={open}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="m9 1 7 4v8l-7 4-7-4V5Zm0 8 7-4M9 9 2 5m7 4v8" />
      </svg>
      Bryła
      {state.spotlight && <span className="mobile-building__dot" aria-hidden="true" />}
    </button>
    {active && <div className="mobile-building__scrim" aria-hidden="true" onClick={() => setPhase('closing')} />}
    {active && scene && createPortal(
      <header className="mobile-building__head">
        <div><h2>Bryła</h2>{state.spotlight && <p>{state.spotlight.label}</p>}</div>
        <button ref={closeButton} type="button" className="mobile-building__close"
          aria-label="Zamknij bryłę" onClick={() => setPhase('closing')}>
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>, scene,
    )}
  </>
}
