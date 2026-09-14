import { HeaderIconButton } from '../../../components/HeaderIconButton'
import { ImagePanel } from './ImagePanel'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, PencilSimple, Play, Trash, Plus } from '@phosphor-icons/react'
import { ModalDialog } from '../../../components/ModalDialog'
import { parsePatternGrid } from '../../../core/pattern/grid'
import type { BeadingProjectSummary, EditorStateController } from '../useEditorState'

export function BeadingLibraryPanel({ editor, onEnterProject }: { editor: EditorStateController; onEnterProject?: (id: string) => void }) {
  const [pendingDelete, setPendingDelete] = useState<BeadingProjectSummary | null>(null)
  return <div className="grid gap-3">
    <div className="flex items-center justify-between gap-2 px-1">
      <span className="text-xs tabular-nums text-editor-text">{editor.beadingProjects.length} 个作品</span>
    </div>
    {editor.beadingProjects.length === 0 ? <p className="py-4 text-xs leading-6 text-editor-text">保存绘制中的图纸后，会显示在这里。每个作品都可以继续绘制或进行拼豆。</p> : null}
    {editor.beadingProjects.map(project => {
      const stats = getProjectStats(project)
      const active = editor.currentWork?.id === project.id
      const done = stats.total > 0 && stats.completed === stats.total
      return <article key={project.id} aria-current={active ? 'true' : undefined} className={'group rounded-2xl border p-3 transition-colors ' + (active ? 'border-editor-accent/40 bg-editor-accent-soft/60' : 'border-editor-border/60 bg-editor-elevated/70 hover:bg-editor-elevated')}>
        <div className="flex items-start gap-3">
          <PatternPreview project={project} />
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex min-h-8 items-center"><button type="button" title="重命名作品" aria-label={'重命名 ' + project.name} className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold leading-6 text-editor-strong hover:text-editor-accent" onClick={() => editor.requestRenameWork(project.id)}>{project.name}</button></div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] leading-4"><span className={done ? 'text-editor-accent' : 'text-editor-text'}>{done ? '已完成' : stats.completed > 0 ? '拼豆中' : '未开始'}</span></div>
            <time dateTime={new Date(project.updatedAt).toISOString()} title={new Date(project.updatedAt).toLocaleString()} className="mt-1.5 block text-[10px] tabular-nums text-editor-text/60">{new Date(project.updatedAt).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})} 更新</time>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1" role="group" aria-label={project.name + '操作'}>
            <HeaderIconButton aria-label={'复制作品 ' + project.name} title="复制作品" onClick={() => editor.copyWork(project.id)}><Copy size={16}/></HeaderIconButton>
            <HeaderIconButton aria-label={'删除作品 ' + project.name} title="删除作品" onClick={() => setPendingDelete(project)}><Trash size={16}/></HeaderIconButton>
          </div>
        </div>
        <div className="mb-3 mt-3"><div className="mb-1.5 flex items-center justify-between text-[10px] tabular-nums text-editor-text"><span>{stats.completed.toLocaleString()} / {stats.total.toLocaleString()} 颗</span><span>{stats.percent}%</span></div><div role="progressbar" aria-label={project.name + '拼豆进度'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent} className="h-1 overflow-hidden rounded-full bg-editor-surface-soft"><div className="h-full rounded-full bg-editor-accent transition-[width]" style={{width:stats.percent+'%'}}/></div></div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-editor-surface-soft text-xs text-editor-strong transition hover:bg-editor-accent-soft hover:text-editor-accent active:scale-[.98]" onClick={async () => { if (await editor.openWork(project.id, 'draw')) onEnterProject?.(project.id) }}><PencilSimple size={15} />继续绘制</button>
          <button type="button" disabled={stats.total === 0} className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-editor-accent-soft text-xs text-editor-accent transition hover:bg-editor-accent hover:text-white active:scale-[.98] disabled:pointer-events-none disabled:opacity-35" onClick={async () => { if (await editor.openWork(project.id, 'bead')) onEnterProject?.(project.id) }}><Play size={15} />{done ? '查看成品' : stats.completed > 0 ? '继续拼豆' : '开始拼豆'}</button>
        </div>
      </article>
    })}
    <ImagePanel editor={editor} renderTrigger={openNewWork => <button type="button" aria-label="新建作品" title="新建作品" onClick={openNewWork} className="flex h-16 w-full items-center justify-center rounded-2xl border border-dashed border-editor-border bg-editor-elevated/30 text-editor-text transition hover:border-editor-accent hover:bg-editor-accent-soft hover:text-editor-accent active:scale-[.99]"><Plus size={22}/></button>} />
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
      width={160}
      height={160}
      aria-label={project.name + '缩略图'}
      className="h-20 w-20 shrink-0 rounded-xl bg-editor-surface-soft"
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
