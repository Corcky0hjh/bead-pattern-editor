import type { ReactNode } from 'react'
type Props = {
  info?: ReactNode
  onCancel?: () => void
  onBack?: () => void
  onConfirm?: () => void | Promise<void>
  label?: string
  disabled?: boolean
  busy?: boolean
  submit?: boolean
}

export function WorkCreationActions({ info, onCancel, onBack, onConfirm, label = '创建作品', disabled, busy, submit }: Props) {
  const cancel = <button type="button" data-modal-close={onCancel ? undefined : true} disabled={busy} onClick={onCancel}>取消</button>
  return <footer className="work-creation-actions">
    {info ? <div className="min-w-0 text-[10px] leading-4 tabular-nums text-editor-text">{info}</div> : cancel}
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {info ? cancel : null}
      {onBack ? <button type="button" disabled={busy} onClick={onBack}>上一步</button> : null}
      <button type={submit ? 'submit' : 'button'} data-primary="true" disabled={disabled || busy} onClick={onConfirm}>{busy ? '处理中…' : label}</button>
    </div>
  </footer>
}
