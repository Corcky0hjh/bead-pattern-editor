import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ModalDialog } from '../../components/ModalDialog'

export function WorkSaveDialog({ dialog }: { dialog: { message: string; name?: string; title: string; confirmLabel: string; resolve: (value: string | null) => void } }) {
  const [name, setName] = useState(dialog.name ?? '')
  const naming = dialog.name !== undefined
  return createPortal(<ModalDialog label={dialog.title} onClose={() => dialog.resolve(null)} panelClassName="w-full max-w-sm rounded-3xl bg-editor-surface p-5 text-editor-strong shadow-xl">
    <form onSubmit={event => { event.preventDefault(); if (!naming || name.trim()) dialog.resolve(naming ? name.trim() : 'confirm') }}>
      <h2 className="mb-3 text-base font-semibold">{dialog.title}</h2>
      <p className="mb-4 text-sm text-editor-muted">{dialog.message}</p>
      {naming ? <input autoFocus aria-label="作品名称" value={name} onChange={event => setName(event.target.value)} className="mb-4 w-full rounded-xl border border-editor-border bg-editor-elevated px-3 py-2 outline-none focus:border-editor-accent" /> : null}
      <div className="flex justify-end gap-2">
        <button type="button" data-modal-close className="rounded-xl px-4 py-2 text-sm hover:bg-editor-surface-soft">取消</button>
        <button type="submit" disabled={naming && !name.trim()} className="rounded-xl bg-editor-accent px-4 py-2 text-sm text-white disabled:opacity-40">{dialog.confirmLabel}</button>
      </div>
    </form>
  </ModalDialog>, document.body)
}
