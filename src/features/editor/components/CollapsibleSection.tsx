import { useState, type ReactNode } from 'react'

type CollapsibleSectionProps = {
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="shrink-0 rounded-3xl border border-editor-border bg-editor-surface">
      <button
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="block text-base font-bold text-editor-strong">
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-xs leading-5 text-editor-text">
              {description}
            </span>
          ) : null}
        </span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-editor-surface-soft text-sm font-black text-editor-strong">
          {open ? '−' : '+'}
        </span>
      </button>

      {open ? (
        <div className="border-t border-editor-border px-5 py-5">
          {children}
        </div>
      ) : null}
    </section>
  )
}
