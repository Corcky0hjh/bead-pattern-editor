import type { CSSProperties } from 'react'
import type { PatternGrid } from '../../core/pattern/grid'

type CanvasStageProps = {
  pattern: PatternGrid
}

export function CanvasStage({ pattern }: CanvasStageProps) {
  return (
    <section
      className="mt-6 rounded-[28px] border border-editor-border bg-editor-surface p-6 shadow-editor"
      aria-label="编辑器画布预览"
    >
      <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label="基础工具">
          <button
            className="rounded-full border border-editor-accent bg-editor-accent-soft px-3.5 py-2 font-inherit text-editor-accent"
            type="button"
          >
            拖拽
          </button>
          <button
            className="rounded-full border border-editor-border bg-editor-surface px-3.5 py-2 font-inherit text-editor-strong"
            type="button"
          >
            画笔
          </button>
          <button
            className="rounded-full border border-editor-border bg-editor-surface px-3.5 py-2 font-inherit text-editor-strong"
            type="button"
          >
            橡皮
          </button>
          <button
            className="rounded-full border border-editor-border bg-editor-surface px-3.5 py-2 font-inherit text-editor-strong"
            type="button"
          >
            填充
          </button>
        </div>
        <button
          className="rounded-full border border-editor-border bg-editor-surface px-3 py-2 font-inherit text-editor-strong"
          type="button"
        >
          导出面板
        </button>
      </div>

      <div className="grid min-h-90 place-items-center overflow-hidden rounded-3xl bg-editor-canvas bg-[linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] bg-[size:24px_24px]">
        <div
          className="grid gap-[5px] rounded-[22px] bg-white/75 p-[22px]"
          style={{
            gridTemplateColumns: `repeat(${pattern.width}, 14px)`,
          }}
        >
          {pattern.cells.map((cell, index) => (
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 rounded-full bg-(--cell-color) shadow-[inset_0_-2px_3px_rgba(0,0,0,0.18)]"
              key={`${cell.color}-${index}`}
              style={{ '--cell-color': cell.color } as CSSProperties}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
