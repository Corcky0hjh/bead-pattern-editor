import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Play, Snowflake, Trash } from '@phosphor-icons/react'
import { ModalDialog } from '../../../components/ModalDialog'
import { parsePatternGrid } from '../../../core/pattern/grid'
import {
  maxBeadingProjects,
  type BeadingProjectSummary,
  type EditorStateController,
} from '../useEditorState'

export function BeadingLibraryPanel({
  editor,
  section = 'all',
}: {
  editor: EditorStateController
  section?: 'all' | 'current' | 'history'
}) {
  const [confirmFreeze, setConfirmFreeze] = useState(false)
  const [pendingDelete, setPendingDelete] =
    useState<BeadingProjectSummary | null>(null)
  const isFull = editor.beadingProjects.length >= maxBeadingProjects

  return (
    <div className="grid gap-3">
      {section !== 'history' && (editor.editorMode === 'draw' ? (
        <button
          type="button"
          disabled={isFull || editor.usedCount === 0}
          className="group grid min-h-20 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-editor-accent/25 bg-editor-accent-soft p-4 text-left transition hover:border-editor-accent/45 hover:bg-editor-accent/15 disabled:cursor-default disabled:opacity-45"
          onClick={() => setConfirmFreeze(true)}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-editor-accent text-white shadow-sm">
            <Snowflake size={21} weight="fill" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm font-black text-editor-strong">
              冻结图纸并开始拼豆
            </strong>
            <span className="mt-1 block text-[11px] leading-4 text-editor-text">
              保存为独立副本，后续绘制不会影响它
            </span>
          </span>
          <Play size={18} weight="fill" className="text-editor-accent" />
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-editor-text">当前图纸</p>
              <p className="mt-1 truncate text-xs font-bold text-editor-strong" title={editor.activeBeadingProject?.name}>
                {editor.activeBeadingProject?.name ?? '拼豆副本'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="返回绘制模式"
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold text-editor-text transition hover:bg-editor-surface-soft hover:text-editor-strong"
            onClick={editor.leaveBeadingMode}
          >
            <ArrowLeft size={15} weight="bold" />
            返回绘制
          </button>
        </div>
      ))}

      {section !== 'current' ? <>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-black text-editor-strong">拼豆历史</span>
        <span className="text-[10px] font-bold tabular-nums text-editor-text">
          {editor.beadingProjects.length} / {maxBeadingProjects}
        </span>
      </div>

      {isFull && editor.editorMode === 'draw' ? (
        <p className="rounded-2xl bg-editor-surface-soft px-3 py-2 text-[11px] leading-5 text-editor-text">
          已达到 10 份上限，删除一份历史后才能冻结新图纸。
        </p>
      ) : null}

      {editor.beadingProjects.length > 0 ? (
        <div className="grid gap-2">
          {editor.beadingProjects.map((project) => (
            <BeadingProjectCard
              key={project.id}
              project={project}
              active={project.id === editor.activeBeadingProjectId}
              onOpen={() => editor.openBeadingProject(project.id)}
              onDelete={() => setPendingDelete(project)}
            />
          ))}
        </div>
      ) : (
        <p className="border-t border-editor-border py-4 text-xs leading-5 text-editor-text">
          还没有拼豆副本。完成图纸后，从这里冻结并开始拼豆。
        </p>
      )}

      </> : null}
      {confirmFreeze ? (
        <ModalDialog
          label="冻结图纸并开始拼豆"
          onClose={() => setConfirmFreeze(false)}
          panelClassName="w-full max-w-md rounded-[28px] border border-editor-border bg-editor-elevated p-6 shadow-2xl"
        >
          <div className="grid gap-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-editor-accent-soft text-editor-accent">
                <Snowflake size={21} weight="fill" />
              </span>
              <div>
                <h2 className="text-base font-black text-editor-strong">
                  冻结当前图纸？
                </h2>
                <p className="mt-2 text-sm leading-6 text-editor-text">
                  当前图纸会保存成一份独立拼豆副本。之后返回绘制并修改原图，不会改变这份副本和它的拼豆进度。
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-editor-surface-soft px-4 py-3 text-xs text-editor-text">
              本地还可保存 {maxBeadingProjects - editor.beadingProjects.length}{' '}
              份拼豆副本。
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-modal-close
                className="rounded-xl bg-editor-surface-soft px-4 py-2 text-sm font-bold text-editor-strong"
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-xl bg-editor-accent px-4 py-2 text-sm font-black text-white"
                onClick={() => {
                  editor.createBeadingProject()
                  setConfirmFreeze(false)
                }}
              >
                冻结并开始
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}
      {pendingDelete ? (
        <ModalDialog
          label="删除拼豆副本"
          onClose={() => setPendingDelete(null)}
          panelClassName="w-full max-w-sm rounded-[28px] border border-editor-border bg-editor-elevated p-6 shadow-2xl"
        >
          <div className="grid gap-5">
            <div>
              <h2 className="text-base font-black text-editor-strong">
                删除这份拼豆副本？
              </h2>
              <p className="mt-2 text-sm leading-6 text-editor-text">
                “{pendingDelete.name}”的冻结图纸和拼豆进度都会从本地删除，无法恢复。
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-modal-close
                className="rounded-xl bg-editor-surface-soft px-4 py-2 text-sm font-bold text-editor-strong"
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white"
                onClick={() => {
                  editor.deleteBeadingProject(pendingDelete.id)
                  setPendingDelete(null)
                }}
              >
                删除副本
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}
    </div>
  )
}

function BeadingProjectCard({
  project,
  active,
  onOpen,
  onDelete,
}: {
  project: BeadingProjectSummary
  active: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const stats = getProjectStats(project)
  return (
    <div
      role="button"
      tabIndex={0}
      className={`grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-2 text-left transition ${
        active
          ? 'border-editor-accent bg-editor-accent-soft'
          : 'border-editor-border bg-editor-surface-soft hover:border-editor-accent/30'
      }`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen()
      }}
    >
      <PatternPreview project={project} />
      <span className="min-w-0">
        <strong className="block truncate text-[11px] font-black text-editor-strong">
          {project.name}
        </strong>
        <span className="mt-1 block text-[10px] font-bold tabular-nums text-editor-text">
          {stats.completed} / {stats.total} 颗 · {stats.percent}%
        </span>
        <span className="mt-0.5 block text-[9px] text-editor-text/70">
          {new Date(project.updatedAt).toLocaleString()}
        </span>
      </span>
      <span className="grid gap-1">
        <span className="grid h-7 w-7 place-items-center rounded-lg text-editor-accent">
          <Play size={13} weight="fill" />
        </span>
        <button
          type="button"
          aria-label="删除拼豆副本"
          className="grid h-7 w-7 place-items-center rounded-lg text-editor-text transition hover:bg-editor-elevated hover:text-red-500"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Trash size={13} />
        </button>
      </span>
    </div>
  )
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
