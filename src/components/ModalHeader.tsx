import type { ReactNode } from 'react'
import { X } from '@phosphor-icons/react'

export function ModalCloseButton({ label = '关闭弹窗', disabled, className = '', initialFocus }: { label?: string; disabled?: boolean; className?: string; initialFocus?: boolean }) {
  return <button type="button" data-modal-close data-dialog-initial-focus={initialFocus || undefined} aria-label={label} title="关闭" disabled={disabled} className={'modal-close-button ' + className}><X size={18} weight="regular" aria-hidden="true"/></button>
}

export function ModalHeader({ title, description, disabled, className = '' }: { title: string; description?: ReactNode; disabled?: boolean; className?: string }) {
  return <header className={'modal-header ' + className}>
    <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-editor-strong">{title}</h2>{description ? <p className="mt-1 text-xs leading-5 text-editor-text">{description}</p> : null}</div>
    <ModalCloseButton label={'关闭' + title} disabled={disabled}/>
  </header>
}
