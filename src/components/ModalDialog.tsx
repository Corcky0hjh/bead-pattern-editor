import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useModalDialog } from './useModalDialog'

export function ModalDialog({
  label,
  onClose,
  panelClassName,
  children,
}: {
  label: string
  onClose: () => void
  panelClassName: string
  children: ReactNode
}) {
  const [closing, setClosing] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const requestClose = useCallback(() => {
    if (closeTimerRef.current !== null) return
    setClosing(true)
    closeTimerRef.current = window.setTimeout(onClose, 180)
  }, [onClose])
  const dialogRef = useModalDialog(requestClose)

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    },
    [],
  )

  return (
    <div
      className="app-modal-backdrop fixed inset-0 z-[70] grid place-items-center bg-black/40 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-closing={closing ? 'true' : 'false'}
      onClickCapture={(event) => {
        if (!(event.target instanceof Element)) return
        if (!event.target.closest('[data-modal-close]')) return
        event.preventDefault()
        event.stopPropagation()
        requestClose()
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <section ref={dialogRef} tabIndex={-1} className={panelClassName}>
        {children}
      </section>
    </div>
  )
}
