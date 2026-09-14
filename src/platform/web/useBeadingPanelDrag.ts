import { useLayoutEffect, useRef, useState, type RefObject, type PointerEvent } from 'react'

import { getElementContentBounds, getToolbarDockEdge, toolbarDockDelay } from './toolbarDrag'

type Position = { x: number; y: number }
type Dock = 'top' | 'bottom' | null

export function useBeadingPanelDrag(enabled: boolean, panel: RefObject<HTMLDivElement | null>, viewport: RefObject<HTMLElement | null>, closeOptions: () => void) {
  const gesture = useRef<{ id: number; x: number; y: number; origin: Position; moved: boolean } | null>(null)
  const [settling, setSettling] = useState(false)
  const motion = useRef<Animation | null>(null)
  const releaseRect = useRef<{ left: number; top: number } | null>(null)
  const [panelHeight, setPanelHeight] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const collapsedRef = useRef(false)
  const [dock, setDock] = useState<Dock>(null)
  const dockRef = useRef<Dock>(null)
  const [candidate, setCandidate] = useState<Dock>(null)
  const [ready, setReady] = useState<Dock>(null)
  const candidateRef = useRef<Dock>(null)
  const enteredAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearCandidate = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    candidateRef.current = null
    setCandidate(null)
    setReady(null)
  }
  const detect = (event: PointerEvent<HTMLButtonElement>) => {
    const stage = viewport.current
    if (!stage || event.shiftKey || collapsedRef.current) return null
    const rect = stage.getBoundingClientRect()
    return getToolbarDockEdge({ pointerX: event.clientX - rect.left, pointerY: event.clientY - rect.top, bounds: getElementContentBounds(stage), currentEdge: candidateRef.current, allowedEdges: ['top', 'bottom'] }) as Dock
  }
  const updateCandidate = (event: PointerEvent<HTMLButtonElement>) => {
    const next = detect(event)
    if (next === candidateRef.current) return
    clearCandidate()
    candidateRef.current = next
    setCandidate(next)
    enteredAt.current = performance.now()
    if (next) timer.current = setTimeout(() => {
      timer.current = null
      if (gesture.current?.moved && candidateRef.current === next) setReady(next)
    }, toolbarDockDelay)
  }
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 })
  const offsetRef = useRef(offset)
  // Viewport-relative coordinates survive both width changes and viewport movement.
  const position = useRef<Position | null>(null)
  const [dragging, setDragging] = useState(false)
  const place = (next: Position) => {
    const bounds = viewport.current?.getBoundingClientRect()
    const rect = panel.current?.getBoundingClientRect()
    if (!bounds || !rect) return
    const width = collapsedRef.current || gesture.current?.moved ? 44 : rect.width
    const height = collapsedRef.current || gesture.current?.moved ? 44 : rect.height
    const content = getElementContentBounds(viewport.current!)
    const maxX = Math.max(content.left, content.right - width)
    const maxY = Math.max(content.top, content.bottom - height)
    const target = { x: Math.max(content.left, Math.min(maxX, next.x)), y: Math.max(content.top, Math.min(maxY, next.y)) }
    const result = {
      x: target.x + bounds.left - (rect.left - offsetRef.current.x),
      y: target.y + bounds.top - (rect.top - offsetRef.current.y),
    }
    position.current = target
    offsetRef.current = result
    panel.current!.style.setProperty('transform', `translate3d(${result.x}px, ${result.y}px, 0)`)
    setOffset(previous => previous.x === result.x && previous.y === result.y ? previous : result)
  }
  const reconcile = () => {
    if (motion.current) return
    const bounds = viewport.current?.getBoundingClientRect()
    const rect = panel.current?.getBoundingClientRect()
    if (!bounds || !rect) return
    const contentHeight = panel.current?.querySelector('[data-beading-step-bar]')?.getBoundingClientRect().height ?? rect.height
    setPanelHeight(contentHeight)
    if (dockRef.current) {
      offsetRef.current = { x: 0, y: 0 }
      panel.current!.style.setProperty('transform', '')
      setOffset(previous => previous.x === 0 && previous.y === 0 ? previous : { x: 0, y: 0 })
    } else {
      const content = getElementContentBounds(viewport.current!)
      place(position.current ?? { x: content.left + (content.width - rect.width) / 2, y: content.bottom - rect.height - 8 })
    }
  }
  useLayoutEffect(() => {
    if (!enabled || !dragging) return
    let frame = 0
    const followLayout = () => {
      reconcile()
      frame = requestAnimationFrame(followLayout)
    }
    frame = requestAnimationFrame(followLayout)
    return () => cancelAnimationFrame(frame)
  }, [enabled, dragging])
  const toggleCollapsed = () => {
    if (!collapsedRef.current) {
      // Keep the ball at the grip's current position when leaving the dock row.
      const bounds = viewport.current?.getBoundingClientRect()
      const rect = panel.current?.getBoundingClientRect()
      if (bounds && rect) position.current = { x: rect.left - bounds.left, y: rect.top - bounds.top }
      clearCandidate()
      dockRef.current = null
      setDock(null)
    }
    collapsedRef.current = !collapsedRef.current
    setCollapsed(collapsedRef.current)
    closeOptions()
  }
  useLayoutEffect(() => {
    if (!enabled || !panel.current || !viewport.current) return
    const observer = new ResizeObserver(reconcile)
    observer.observe(panel.current)
    observer.observe(viewport.current)
    return () => {
      observer.disconnect()
      motion.current?.cancel()
      motion.current = null
      if (timer.current !== null) clearTimeout(timer.current)
      gesture.current = null
    }
  }, [enabled, panel, viewport])
  useLayoutEffect(() => {
    // Measuring docking geometry must update before paint to prevent a visible jump.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (enabled) reconcile()
  }, [collapsed, dock, ready, enabled])
  useLayoutEffect(() => {
    const from = releaseRect.current
    const element = panel.current
    if (!enabled || !from || !element) return
    releaseRect.current = null
    reconcile()
    const to = element.getBoundingClientRect()
    const base = dockRef.current ? { x: 0, y: 0 } : offsetRef.current
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate) {
      // Reduced motion has no animation finish event to clear this state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettling(false)
      return
    }
    const animation = element.animate([
      { transform: `translate3d(${base.x + from.left - to.left}px, ${base.y + from.top - to.top}px, 0)` },
      { transform: `translate3d(${base.x}px, ${base.y}px, 0)` },
    ], { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
    motion.current = animation
    animation.onfinish = () => {
      if (motion.current !== animation) return
      motion.current = null
      setSettling(false)
      reconcile()
    }
  }, [dragging, dock, enabled])
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const start = gesture.current
    if (start?.id !== event.pointerId) return
    if (start.moved) {
      const rect = panel.current?.getBoundingClientRect()
      if (rect) releaseRect.current = { left: rect.left, top: rect.top }
      setSettling(true)
    }
    gesture.current = null
    setDragging(false)
    if (event.type === 'pointerup') {
      if (!start.moved) toggleCollapsed()
      else {
        const edge = detect(event)
        const next = edge && edge === candidateRef.current && performance.now() - enteredAt.current >= toolbarDockDelay ? edge : null
        dockRef.current = next
        setDock(next)
      }
    }
    clearCandidate()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return {
    offset, dragging, collapsed, visualCollapsed: collapsed || dragging || settling, dock, panelHeight, candidate: ready ? null : candidate, ready,
    handleProps: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (!event.isPrimary || event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        closeOptions()
        clearCandidate()
        // Interrupt the visual flight at its current position before starting a new drag.
        const visual = panel.current?.getBoundingClientRect()
        motion.current?.cancel()
        motion.current = null
        releaseRect.current = null
        setSettling(false)
        const bounds = viewport.current?.getBoundingClientRect()
        const rect = visual ?? panel.current?.getBoundingClientRect()
        if (!bounds || !rect) return
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: { x: rect.left - bounds.left, y: rect.top - bounds.top }, moved: false }
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        const start = gesture.current
        if (!start || start.id !== event.pointerId) return
        if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6) return
        start.moved = true
        const wasDocked = dockRef.current !== null
        dockRef.current = null
        setDock(null)
        setDragging(true)
        const next = { x: start.origin.x + event.clientX - start.x, y: start.origin.y + event.clientY - start.y }
        place(next)
        // Reapply after React restores the floating width; do not retain the old full-width clamp.
        if (wasDocked) position.current = next
        updateCandidate(event)
      },
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
      onClick: (event: { detail: number }) => { if (event.detail === 0) toggleCollapsed() },
    },
  }
}
