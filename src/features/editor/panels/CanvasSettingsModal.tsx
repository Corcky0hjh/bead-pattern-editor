import { useState, type ComponentType } from 'react'
import {
  Export,
  GridFour,
  Palette,
  X,
  type IconProps,
} from '@phosphor-icons/react'
import { useModalDialog } from '../../../components/useModalDialog'
import type { EditorStateController } from '../useEditorState'
import { CanvasPanel } from './CanvasPanel'
import { ExportPanel } from './ExportPanel'

type SettingsView = 'canvas' | 'theme' | 'export'

const settingsViews: Array<{
  value: SettingsView
  label: string
  icon: ComponentType<IconProps>
}> = [
  { value: 'canvas', label: '画布', icon: GridFour },
  { value: 'theme', label: '主题', icon: Palette },
  { value: 'export', label: '导出', icon: Export },
]

export function CanvasSettingsModal({
  editor,
  onClose,
}: {
  editor: EditorStateController
  onClose: () => void
}) {
  const dialogRef = useModalDialog(onClose)
  const [view, setView] = useState<SettingsView>('canvas')

  return (
    <div
      className="canvas-settings-backdrop fixed inset-0 z-[70] grid place-items-center bg-black/40 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="画布与主题设置"
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="canvas-settings-dialog grid h-[min(760px,94svh)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[18px] border border-editor-border bg-editor-surface shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-editor-border px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-editor-strong">设置</h2>
            <p className="mt-1 text-xs text-editor-text">画布、主题与作品输出</p>
          </div>
          <button
            data-dialog-initial-focus
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl bg-editor-surface-soft text-editor-strong transition hover:bg-editor-elevated"
            aria-label="关闭设置"
            onClick={onClose}
          >
            <X size={17} weight="bold" />
          </button>
        </header>
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[176px_minmax(0,1fr)] md:grid-rows-1">
          <nav
            className="flex gap-1 overflow-x-auto border-b border-editor-border p-3 [scrollbar-width:none] md:flex-col md:overflow-visible md:border-r md:border-b-0 md:p-4 [&::-webkit-scrollbar]:hidden"
            aria-label="设置分类"
          >
            {settingsViews.map((item) => {
              const Icon = item.icon
              const active = view === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
                    active
                      ? 'bg-editor-surface-soft text-editor-accent shadow-[inset_3px_0_0_var(--color-editor-accent)]'
                      : 'text-editor-text hover:bg-editor-surface-soft hover:text-editor-strong'
                  }`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setView(item.value)}
                >
                  <Icon size={17} weight="regular" />
                  {item.label}
                </button>
              )
            })}
          </nav>
          <main className="min-h-0 overflow-y-auto p-4 sm:p-5">
            {view === 'canvas' ? (
              <CanvasPanel editor={editor} wide view="canvas" />
            ) : null}
            {view === 'theme' ? (
              <CanvasPanel editor={editor} wide view="theme" />
            ) : null}
            {view === 'export' ? (
              <ExportPanel editor={editor} />
            ) : null}
          </main>
        </div>
      </section>
    </div>
  )
}
