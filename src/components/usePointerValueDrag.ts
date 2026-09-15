import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

/** Capture one pointer; unrelated fingers cannot take over an active control. */
export function usePointerValueDrag<T>(calculate: (event: ReactPointerEvent<HTMLDivElement>) => T, preview: (value: T) => void, commit: (value: T) => void) {
  const callbacks = useRef({ calculate, preview, commit })
  useLayoutEffect(() => { callbacks.current = { calculate, preview, commit } }, [calculate, preview, commit])
  const drag = useRef<{ id: number; element: HTMLDivElement; value: T } | null>(null)
  const finish = useCallback(() => {
    const active = drag.current
    if (!active) return
    drag.current = null
    if (active.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id)
    callbacks.current.commit(active.value)
  }, [])
  useEffect(() => {
    window.addEventListener('blur', finish)
    return () => { window.removeEventListener('blur', finish); drag.current = null }
  }, [finish])
  return {
    onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      if (drag.current || event.button !== 0) return
      event.preventDefault()
      const value = callbacks.current.calculate(event)
      drag.current = { id: event.pointerId, element: event.currentTarget, value }
      event.currentTarget.setPointerCapture(event.pointerId)
      callbacks.current.preview(value)
    },
    onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      if (drag.current?.id !== event.pointerId) return
      event.preventDefault()
      drag.current.value = callbacks.current.calculate(event)
      callbacks.current.preview(drag.current.value)
    },
    onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
      if (drag.current?.id !== event.pointerId) return
      drag.current.value = callbacks.current.calculate(event)
      finish()
    },
    onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) { if (drag.current?.id === event.pointerId) finish() },
    onLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) { if (drag.current?.id === event.pointerId) finish() },
  }
}
