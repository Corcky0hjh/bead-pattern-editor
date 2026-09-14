import {
  FileArrowDown,
  FileArrowUp,
  FileCsv,
  Image,
  ListChecks,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import type { EditorStateController } from '../useEditorState'

export function ExportPanel({ editor }: { editor: EditorStateController }) {
  const hasColors = editor.colorStats.length > 0

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8">
      <ExportSection title="成品图片" description="用于制作、分享或打印的图纸文件">
        <ExportAction
          icon={<Image />}
          title="带色号图纸"
          description="包含网格、色号与拼豆颜色"
          action="导出 PNG"
          primary
          disabled={!hasColors}
          onClick={editor.exportPatternImage}
        />
        <ExportAction
          icon={<ListChecks />}
          title="采购清单"
          description="按品牌和色号汇总所需拼豆"
          action="导出 PNG"
          disabled={!hasColors}
          onClick={editor.exportShoppingListImage}
        />
        <ExportAction
          icon={<Image />}
          title="纯色块图纸"
          description="不显示色号的干净图纸"
          action="导出 PNG"
          onClick={editor.exportPng}
        />
      </ExportSection>

      <ExportSection title="数据清单" description="用于整理、统计或继续处理">
        <ExportAction
          icon={<FileCsv />}
          title="配色清单"
          description="导出颜色及使用数量"
          action="导出 CSV"
          disabled={!hasColors}
          onClick={editor.exportColorList}
        />
      </ExportSection>

      <ExportSection title="工程文件" description="保留可继续编辑的完整工程">
        <ExportAction
          icon={<FileArrowDown />}
          title="导出工程文件"
          description="下载当前作品的图纸内容"
          action="导出文件"
          onClick={editor.exportJson}
        />
        <label className="grid min-h-16 cursor-pointer gap-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <ActionIcon>{<FileArrowUp />}</ActionIcon>
          <span>
            <span className="block text-xs font-bold text-editor-strong">导入工程文件</span>
            <span className="mt-1 block text-[11px] text-editor-text">打开之前导出的工程</span>
          </span>
          <span className="rounded-xl border border-editor-border px-3 py-2 text-xs font-bold text-editor-strong transition hover:bg-editor-surface-soft">
            选择文件
          </span>
          <input
            accept="application/json"
            className="sr-only"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void editor.importJson(file)
              event.target.value = ''
            }}
          />
        </label>
      </ExportSection>
    </div>
  )
}

function ExportSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4">
      <header>
        <h3 className="text-sm font-black text-editor-strong">{title}</h3>
        <p className="mt-1 text-xs text-editor-text">{description}</p>
      </header>
      <div className="divide-y divide-editor-border border-y border-editor-border">
        {children}
      </div>
    </section>
  )
}

function ExportAction({
  icon,
  title,
  description,
  action,
  primary = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  action: string
  primary?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <div className="grid min-h-16 gap-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <ActionIcon>{icon}</ActionIcon>
      <div>
        <p className="text-xs font-bold text-editor-strong">{title}</p>
        <p className="mt-1 text-[11px] text-editor-text">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        className={`h-9 rounded-xl px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${
          primary
            ? 'bg-editor-accent text-white hover:brightness-105'
            : 'border border-editor-border text-editor-strong hover:bg-editor-surface-soft'
        }`}
        onClick={onClick}
      >
        {action}
      </button>
    </div>
  )
}

function ActionIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-editor-surface-soft text-editor-text [&>svg]:h-[18px] [&>svg]:w-[18px]">
      {children}
    </span>
  )
}
