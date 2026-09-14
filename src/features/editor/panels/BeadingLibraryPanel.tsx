import { ImagePanel } from './ImagePanel'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, PencilSimple, Play, Trash } from '@phosphor-icons/react'
import { ModalDialog } from '../../../components/ModalDialog'
import { parsePatternGrid } from '../../../core/pattern/grid'
import type { BeadingProjectSummary, EditorStateController } from '../useEditorState'

export function BeadingLibraryPanel({ editor, onEnterProject }: { editor: EditorStateController; onEnterProject?: (id: string) => void }) {
  const [pendingDelete, setPendingDelete] = useState<BeadingProjectSummary | null>(null)
  return <div className="grid gap-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-editor-text">{editor.beadingProjects.length} 个作品</span>
      <ImagePanel editor={editor} compact />
    </div>
    {editor.beadingProjects.length === 0 ? <p className="py-4 text-xs leading-6 text-editor-text">保存绘制中的图纸后，会出现在作品库。每个作品都可以继续绘制或进行拼豆。</p> : null}
    {editor.beadingProjects.map(project => {
      const stats = getProjectStats(project)
      return <article key={project.id} className={`rounded-2xl border p-3 ${editor.currentWork?.id === project.id ? 'border-editor-accent bg-editor-accent-soft/40' : 'border-editor-border bg-editor-surface-soft/50'}`}>
        <div className="flex items-center gap-3">
          <PatternPreview project={project} />
          <div className="min-w-0 flex-1">
            <button type="button" title="重命名作品" aria-label={`重命名 ${project.name}`} className="block max-w-full truncate text-left text-xs font-semibold text-editor-strong" onClick={() => editor.requestRenameWork(project.id)}>{project.name}</button>
            <p className="mt-1 text-[10px] tabular-nums text-editor-text">{stats.completed === stats.total && stats.total > 0 ? '已完成' : stats.completed > 0 ? '拼豆中' : '尚未开始拼豆'} · {stats.completed} / {stats.total}</p>
            <p className="mt-1 text-[9px] text-editor-text/60">{new Date(project.updatedAt).toLocaleString()}</p>
          </div>
          <button type="button" aria-label={`删除作品 ${project.name}`} className="rounded-lg p-1.5 text-editor-text hover:text-red-500" onClick={() => setPendingDelete(project)}><Trash size={14} /></button>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-editor-elevated py-2 text-xs text-editor-strong" onClick={async () => { if (await editor.openWork(project.id, 'draw')) onEnterProject?.(project.id) }}><PencilSimple size={14} />继续绘制</button>
          <button type="button" disabled={stats.total === 0} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-editor-accent-soft py-2 text-xs text-editor-accent disabled:opacity-30" onClick={async () => { if (await editor.openWork(project.id, 'bead')) onEnterProject?.(project.id) }}><Play size={14} />{stats.completed > 0 ? '继续拼豆' : '开始拼豆'}</button>
        </div>
      </article>
    })}
    {editor.currentWork ? <button type="button" className="flex items-center justify-center gap-1 rounded-lg py-2 text-xs text-editor-text hover:bg-editor-surface-soft" onClick={() => editor.saveWork(true)}><Copy size={14} />当前作品另存为新作品</button> : null}
    {pendingDelete ? createPortal(<ModalDialog label="删除作品" onClose={() => setPendingDelete(null)} panelClassName="w-full max-w-sm rounded-2xl bg-editor-elevated p-5 shadow-xl">
      <h2 className="text-sm font-semibold text-editor-strong">删除 {pendingDelete.name}？</h2>
      <p className="mt-2 text-xs leading-6 text-editor-text">图纸和所属拼豆进度将一起删除，无法恢复。</p>
      <div className="mt-4 flex justify-end gap-2"><button type="button" data-modal-close className="rounded-lg px-3 py-2 text-xs">取消</button><button type="button" className="rounded-lg bg-red-500 px-3 py-2 text-xs text-white" onClick={() => { editor.deleteBeadingProject(pendingDelete.id); setPendingDelete(null) }}>删除作品</button></div>
    </ModalDialog>, document.body) : null}
  </div>
}

function PatternPreview({ project }: { project: BeadingProjectSummary }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const pattern = parsePatternGrid(project.pattern)
    if (!canvas || !pattern) return
    const context = canvas.getContext('2d')
    if (!context) return
    const scale = Math.min(canvas.width / pattern.width, canvas.height / pattern.height)
    const width = pattern.width * scale
    const height = pattern.height * scale
    const left = (canvas.width - width) / 2
    const top = (canvas.height - height) / 2
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#fffaf2'
    context.fillRect(0, 0, canvas.width, canvas.height)
    pattern.cells.forEach((cell, index) => {
      if (!cell.color || cell.isExternal) return
      context.fillStyle = cell.color
      context.fillRect(
        left + (index % pattern.width) * scale,
        top + Math.floor(index / pattern.width) * scale,
        Math.ceil(scale),
        Math.ceil(scale),
      )
    })
  }, [project.pattern])
  return (
    <canvas
      ref={canvasRef}
      width={152}
      height={104}
      className="h-[52px] w-[76px] rounded-xl border border-editor-border bg-editor-elevated"
    />
  )
}

function getProjectStats(project: BeadingProjectSummary) {
  const pattern = parsePatternGrid(project.pattern)
  if (!pattern) return { completed: 0, total: 0, percent: 0 }
  let total = 0
  pattern.cells.forEach((cell) => {
    if (cell.color && !cell.isExternal) total += 1
  })
  const completed = project.completed.filter((index) => {
    const cell = pattern.cells[index]
    return Boolean(cell?.color && !cell.isExternal)
  }).length
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}
