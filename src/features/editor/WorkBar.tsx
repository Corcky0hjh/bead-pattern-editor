import { ArrowCounterClockwise, FloppyDisk, PencilSimple, Play } from '@phosphor-icons/react'
import type { EditorStateController } from './useEditorState'

export function WorkBar({ editor, onOpenLibrary }: { editor: EditorStateController; onOpenLibrary: () => void }) {
  const warning = editor.editorMode === 'draw' && (editor.currentWork?.completed.length ?? 0) > 0
  return <div className="flex min-h-8 min-w-0 shrink-0 items-center gap-1 px-2" aria-label="当前作品">
    {editor.currentWork ? <button type="button" className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-editor-strong" onClick={onOpenLibrary} title={warning ? '此作品已有拼豆进度，修改图纸并保存后会重置进度' : '打开作品库'}>
      {editor.currentWork?.name ?? '未命名作品'}{editor.isWorkDirty ? ' · 未保存' : ''}
      {warning ? <span className="ml-1 text-[10px] font-normal text-editor-accent">修改保存会重置进度</span> : null}
    </button> : <span className="min-w-0 flex-1 truncate text-xs font-semibold text-editor-strong">未命名作品{editor.isWorkDirty ? ' · 未保存' : ''}</span>}
    {editor.isWorkDirty && editor.currentWork ? <button type="button" aria-label="放弃未保存修改" title="放弃未保存修改" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-editor-text hover:bg-editor-surface-soft" onClick={editor.discardWorkChanges}><ArrowCounterClockwise size={15} /></button> : null}
    <button type="button" aria-label="保存作品" title="保存作品（Ctrl / Cmd + S）" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-editor-accent hover:bg-editor-accent-soft" onClick={() => editor.saveWork()}><FloppyDisk size={16} /></button>
    <div className="flex shrink-0 gap-0.5 rounded-lg bg-editor-surface-soft p-0.5" role="group" aria-label="作品模式">
      <button type="button" aria-label="绘制作品" aria-pressed={editor.editorMode === 'draw'} title="绘制作品" className={`flex h-6 items-center gap-1 rounded-md px-2 text-[11px] ${editor.editorMode === 'draw' ? 'bg-editor-elevated text-editor-accent' : 'text-editor-text'}`} onClick={() => { if (editor.editorMode !== 'draw') editor.leaveBeadingMode() }}><PencilSimple size={14} /><span>绘制</span></button>
      <button type="button" aria-label="拼豆作品" aria-pressed={editor.editorMode === 'bead'} title="拼豆作品" className={`flex h-6 items-center gap-1 rounded-md px-2 text-[11px] ${editor.editorMode === 'bead' ? 'bg-editor-elevated text-editor-accent' : 'text-editor-text'}`} onClick={editor.startBeadingWork}><Play size={14} /><span>拼豆</span></button>
    </div>
  </div>
}
