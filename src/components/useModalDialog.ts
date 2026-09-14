import { useEffect, useEffectEvent, useRef } from 'react'

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

let bodyLocks = 0
let savedOverflow = ''

export function useModalDialog(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeDialog = useEffectEvent(onClose)

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    if (bodyLocks++ === 0) savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const dialog = dialogRef.current
    const initialFocus =
      dialog?.querySelector<HTMLElement>('[data-dialog-initial-focus]') ??
      dialog
    const initialFocusFrame = window.requestAnimationFrame(() =>
      initialFocus?.focus(),
    )

    function handleKeyDown(event: KeyboardEvent) {
      const topmostDialog = [
        ...document.querySelectorAll<HTMLElement>('[role="dialog"]'),
      ].at(-1)
      if (topmostDialog && !topmostDialog.contains(dialog)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        closeDialog()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ]
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(initialFocusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      if (--bodyLocks === 0) document.body.style.overflow = savedOverflow
      window.requestAnimationFrame(() => previousFocus?.isConnected && previousFocus.focus())
    }
  }, [])

  return dialogRef
}
