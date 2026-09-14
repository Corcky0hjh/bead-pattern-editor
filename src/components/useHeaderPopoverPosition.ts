import { useLayoutEffect, type RefObject } from 'react'

/** All Header menus center on their trigger and share viewport edge spacing. */
export function useHeaderPopoverPosition(open: boolean, triggerRef: RefObject<HTMLElement | null>, panelRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const trigger = triggerRef.current
      const panel = panelRef.current
      const container = panel?.offsetParent
      if (!trigger || !panel || !(container instanceof HTMLElement)) return
      const viewport = window.visualViewport
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16
      const bounds = trigger.getBoundingClientRect()
      const origin = container.getBoundingClientRect()
      const scale = origin.width / (container.offsetWidth || origin.width) || 1
      panel.style.maxWidth = Math.max(1, (rightEdge - leftEdge) / scale) + 'px'
      const width = panel.getBoundingClientRect().width
      const centered = bounds.left + bounds.width / 2 - width / 2
      const left = Math.max(leftEdge, Math.min(centered, rightEdge - width))
      panel.style.right = 'auto'
      panel.style.left = (left - origin.left) / scale + 'px'
      panel.style.top = (bounds.bottom - origin.top + 10) / scale + 'px'
      const bottomEdge = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8
      panel.style.maxHeight = Math.max(1, (bottomEdge - bounds.bottom - 10) / scale) + 'px'
    }
    position()
    const observer = new ResizeObserver(position)
    if (triggerRef.current) {
      observer.observe(triggerRef.current)
      const header = triggerRef.current.closest('header')
      if (header) observer.observe(header)
    }
    if (panelRef.current) observer.observe(panelRef.current)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
    }
  }, [open, triggerRef, panelRef])
}
