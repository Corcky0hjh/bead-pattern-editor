import { useEffect, useState, type ComponentType, type CSSProperties } from 'react'
import {
  Export,
  GridFour,
  Keyboard,
  Palette,
  X,
  type IconProps,
} from '@phosphor-icons/react'
import { ModalDialog } from '../../../components/ModalDialog'
import type { EditorStateController } from '../useEditorState'
import { CanvasPanel } from './CanvasPanel'
import { ExportPanel } from './ExportPanel'

type SettingsView = 'canvas' | 'theme' | 'export' | 'shortcuts'

const settingsViews: Array<{
  value: SettingsView
  label: string
  icon: ComponentType<IconProps>
}> = [
  { value: 'canvas', label: '画布', icon: GridFour },
  { value: 'theme', label: '主题', icon: Palette },
  { value: 'export', label: '导出', icon: Export },
  { value: 'shortcuts', label: '快捷键', icon: Keyboard },
]

const cardAccents: Record<SettingsView, string> = {
  canvas: '#ff8a3d',
  theme: '#54b79b',
  export: '#5f78d6',
  shortcuts: '#d36b9a',
}

export function CanvasSettingsModal({
  editor,
  onClose,
}: {
  editor: EditorStateController
  onClose: () => void
}) {
  const [view, setView] = useState<SettingsView>('canvas')
  const [contentView, setContentView] = useState<SettingsView>('canvas')

  useEffect(() => {
    if (contentView === view) return
    const timer = window.setTimeout(() => setContentView(view), 180)
    return () => window.clearTimeout(timer)
  }, [contentView, view])

  return (
    <ModalDialog
      label="画布与主题设置"
      onClose={onClose}
      panelClassName="canvas-settings-dialog relative h-[min(760px,94svh)] w-full max-w-6xl"
    >
        <div className="settings-panel-stack h-full min-h-0" aria-label="设置分类">
          {settingsViews.map((item, index) => {
            const Icon = item.icon
            const active = view === item.value
            const activeIndex = settingsViews.findIndex(
              (candidate) => candidate.value === view,
            )
            const relativeIndex =
              (index - activeIndex + settingsViews.length) %
              settingsViews.length
            return (
              <section
                key={item.value}
                className="settings-panel-card"
                data-active={active ? 'true' : 'false'}
                data-position={relativeIndex}
                style={
                  { '--card-accent': cardAccents[item.value] } as CSSProperties
                }
              >
                {active ? (
                  <button
                    data-dialog-initial-focus
                    data-modal-close
                    type="button"
                    className="settings-panel-card__close absolute z-20 grid h-7 w-7 place-items-center rounded-lg bg-transparent transition hover:bg-editor-elevated"
                    aria-label="关闭设置"
                    onClick={onClose}
                  >
                    <X size={14} weight="bold" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="settings-panel-card__identity"
                  aria-current={active ? 'page' : undefined}
                  aria-label={`打开${item.label}设置`}
                  onClick={() => setView(item.value)}
                >
                  <span>0{index + 1}</span>
                  <Icon size={18} weight={active ? 'fill' : 'regular'} />
                  <strong>{item.label}</strong>
                </button>
                <div
                  className="settings-panel-card__body"
                  data-content-active={contentView === item.value ? 'true' : 'false'}
                >
                  {contentView === item.value && item.value === 'canvas' ? <CanvasPanel editor={editor} wide view="canvas" /> : null}
                  {contentView === item.value && item.value === 'theme' ? <CanvasPanel editor={editor} wide view="theme" /> : null}
                  {contentView === item.value && item.value === 'export' ? <ExportPanel editor={editor} /> : null}
                  {contentView === item.value && item.value === 'shortcuts' ? <ShortcutsPanel /> : null}
                </div>
              </section>
            )
          })}
        </div>
    </ModalDialog>
  )
}

const shortcutGroups = [
  {
    title: '工具切换',
    items: [
      ['B', '画笔'],
      ['E', '橡皮'],
      ['F', '填充'],
      ['U', '形状'],
      ['V', '移动画布'],
      ['I', '吸管'],
    ],
  },
  {
    title: '临时操作',
    items: [
      ['Space', '按住移动画布'],
      ['Alt', '按住临时吸管'],
      ['[ / ]', '调整当前绘制工具粗细'],
      ['G', '显示 / 隐藏网格'],
    ],
  },
  {
    title: '历史与视图',
    items: [
      ['Ctrl / Cmd + Z', '撤销'],
      ['Ctrl / Cmd + Y', '重做'],
      ['Ctrl / Cmd + Shift + Z', '重做'],
      ['滚轮', '垂直移动画布'],
      ['Shift + 滚轮', '水平移动画布'],
      ['Ctrl / Cmd + 滚轮', '以指针为中心缩放'],
      ['Ctrl / Cmd + + / -', '放大 / 缩小画布'],
      ['Ctrl / Cmd + 0', '画布适应视口'],
      ['方向键', '微调选区位置'],
      ['Delete / Backspace', '删除选区'],
      ['Enter', '确认浮动选区'],
      ['Esc', '取消当前操作 / 清除选区'],
    ],
  },
] as const

function ShortcutsPanel() {
  return (
    <div className="grid gap-7">
      <div>
        <h2 className="text-xl font-black text-editor-strong">快捷键与快捷操作</h2>
        <p className="mt-1 text-sm text-editor-text">保持手在键盘上，更快完成绘制和调整。</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {shortcutGroups.map((group) => (
          <section key={group.title} className="grid content-start gap-2">
            <h3 className="mb-1 text-sm font-black text-editor-strong">{group.title}</h3>
            {group.items.map(([keys, action]) => (
              <div
                key={keys}
                className="flex min-h-11 items-center justify-between gap-4 border-b border-editor-border py-2"
              >
                <span className="text-xs font-bold text-editor-text">{action}</span>
                <kbd className="shrink-0 rounded-lg border border-editor-border bg-editor-surface-soft px-2 py-1 font-mono text-[11px] font-black text-editor-strong shadow-[0_2px_0_var(--color-editor-border)]">
                  {keys}
                </kbd>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
