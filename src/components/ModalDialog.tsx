import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useModalDialog } from './useModalDialog'

export function ModalDialog({
  label,
  onClose,
  panelClassName,
  children,
  dismissDisabled = false,
}: {
  label: string
  onClose: () => void
  panelClassName: string
  dismissDisabled?: boolean
  children: ReactNode
}) {
  const [closing, setClosing] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const requestClose = useCallback(() => {
    if (dismissDisabled || closeTimerRef.current !== null) return
    setClosing(true)
    closeTimerRef.current = window.setTimeout(onClose, 180)
  }, [onClose, dismissDisabled])
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
        if (event.target.closest('[role="dialog"]') !== event.currentTarget) return
        if (!event.target.closest('[data-modal-close]')) return
        event.preventDefault()
        event.stopPropagation()
        requestClose()
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <section ref={dialogRef} tabIndex={-1} className={`${panelClassName} outline-none`}>
        {children}
      </section>
    </div>
  )
}
