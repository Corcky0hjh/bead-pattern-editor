import type { ReactNode } from 'react'
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
  const dialogRef = useModalDialog(onClose)

  return (
    <div
      className="app-modal-backdrop fixed inset-0 z-[70] grid place-items-center bg-black/40 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section ref={dialogRef} tabIndex={-1} className={panelClassName}>
        {children}
      </section>
    </div>
  )
}
