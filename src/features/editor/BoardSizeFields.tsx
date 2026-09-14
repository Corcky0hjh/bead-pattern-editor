import { ArrowsLeftRight } from '@phosphor-icons/react'
import { HeaderIconButton } from '../../components/HeaderIconButton'

export function BoardSizeFields({ width, height, onChange, onBlur }: {
  width: string; height: string
  onChange: (width: string, height: string) => void
  onBlur?: () => void
}) {
  return <div className="board-size-fields grid gap-3" role="group" aria-label="拼盘尺寸">
    <div className="flex items-end gap-2">{(['宽', '高'] as const).map((label, index) => <label key={label} className="min-w-0 flex-1 text-xs text-editor-text">{label}<input aria-label={'画板' + label} type="number" min={4} max={512} step={1} required value={index ? height : width} onBlur={onBlur} onChange={event => index ? onChange(width, event.target.value) : onChange(event.target.value, height)} className="mt-1.5 h-10 w-full rounded-xl border border-editor-border bg-editor-elevated px-3 text-sm tabular-nums text-editor-strong outline-none focus:border-editor-accent" /></label>)}<HeaderIconButton aria-label="交换宽高" title="交换宽高" className="mb-1" onClick={() => onChange(height, width)}><ArrowsLeftRight size={18}/></HeaderIconButton></div>
    <div className="grid grid-cols-3 gap-1.5">{[[29,29],[58,58],[52,52],[104,104],[58,29],[104,52]].map(([w,h]) => <button key={w+'x'+h} type="button" aria-pressed={Number(width)===w && Number(height)===h} onClick={() => onChange(String(w), String(h))} className={'h-9 rounded-lg text-xs tabular-nums transition '+(Number(width)===w && Number(height)===h ? 'bg-editor-accent-soft text-editor-accent' : 'bg-editor-elevated text-editor-text hover:bg-editor-surface-soft')}>{w} × {h}</button>)}</div>
  </div>
}
