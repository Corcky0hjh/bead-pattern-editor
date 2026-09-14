import { ModalCloseButton } from '../../../components/ModalHeader'
import { useShortcuts, shortcutDefinitions, shortcutLabel, shortcutFromEvent, setShortcut, resetShortcuts, type ShortcutId } from '../shortcuts'
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import {
  GridFour,
  Keyboard,
  ArrowCounterClockwise,
  Palette,
  type IconProps,
} from '@phosphor-icons/react'
import { ModalDialog } from '../../../components/ModalDialog'
import type { EditorStateController } from '../useEditorState'
import { CanvasPanel } from './CanvasPanel'

type SettingsView = 'canvas' | 'theme' | 'shortcuts'

const settingsViews: Array<{
  value: SettingsView
  label: string
  icon: ComponentType<IconProps>
}> = [
  { value: 'canvas', label: '画布', icon: GridFour },
  { value: 'theme', label: '主题', icon: Palette },
  { value: 'shortcuts', label: '快捷键', icon: Keyboard },
]

const cardAccents: Record<SettingsView, string> = {
  canvas: '#ff8a3d',
  theme: '#54b79b',
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
                  <ModalCloseButton label="关闭设置" initialFocus className="settings-panel-card__close absolute z-20"/>
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
                  {contentView === item.value && item.value === 'shortcuts' ? <ShortcutsPanel /> : null}
                </div>
              </section>
            )
          })}
        </div>
    </ModalDialog>
  )
}

function ShortcutsPanel() {
  const bindings = useShortcuts()
  const [query, setQuery] = useState('')
  const pendingAlt = useRef(false)
  const [recording, setRecording] = useState<ShortcutId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const groups = [...new Set(shortcutDefinitions.map(item => item[2]))]
  const matches = shortcutDefinitions.filter(([id,label]) => (label + ' ' + shortcutLabel(bindings[id])).toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="mx-auto grid w-full max-w-4xl gap-5">
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-editor-accent-soft text-editor-accent"><Keyboard size={22}/></span><div><h2 className="text-sm font-semibold text-editor-strong">快捷键</h2><p className="mt-1 text-xs text-editor-text">点击按键修改，自动保存</p></div></div>
    <input type="search" aria-label="查找快捷键" placeholder="搜索操作或按键" value={query} onChange={event=>setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-editor-border bg-editor-elevated px-3 text-[13px] text-editor-strong outline-none focus:border-editor-accent" />
    <div className="grid gap-4 lg:grid-cols-2">{groups.map(group => {
      const items = matches.filter(item => item[2] === group)
      if (!items.length) return null
      return <section key={group}>
        <h3 className="mb-2 px-1 text-xs font-semibold text-editor-strong">{group}</h3>
        <div className="grid gap-1 rounded-2xl bg-editor-elevated/60 p-2">{items.map(([id,label])=><div key={id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-2">
          <span className="text-xs text-editor-text">{label}</span>
          <button type="button" aria-label={'修改'+label+'快捷键'} aria-pressed={recording===id}
            className={'max-w-full rounded-lg border px-2 py-1 font-mono text-[11px] leading-5 transition focus-visible:outline-2 focus-visible:outline-editor-accent '+(recording===id?'border-editor-accent bg-editor-accent-soft text-editor-accent':'border-editor-border/70 bg-editor-surface text-editor-strong shadow-[0_2px_0_var(--color-editor-border)] hover:border-editor-accent hover:text-editor-accent')}
            onClick={()=>{setRecording(recording===id?null:id);setError(null)}}
            onBlur={()=>{pendingAlt.current=false;setRecording(null);setError(null)}}
            onKeyDown={event=>{
              if (recording!==id) return
              event.preventDefault();event.stopPropagation()
              if (event.repeat || event.nativeEvent.isComposing) return
              if (event.key === 'Alt') { pendingAlt.current = true; return }
              pendingAlt.current = false
              const key=shortcutFromEvent(event.nativeEvent)
              if (!key) return
              if (event.key==='Tab') { setError('Tab 保留用于界面焦点切换'); return }
              const message=setShortcut(id,key)
              setError(message)
              if (!message) setRecording(null)
            }} onKeyUp={event=>{
              if (recording!==id || event.key!=='Alt' || !pendingAlt.current) return
              pendingAlt.current = false
              event.preventDefault();event.stopPropagation()
              const message=setShortcut(id,'alt')
              setError(message)
              if (!message) setRecording(null)
            }}>
            {recording===id?'请按下新快捷键…':shortcutLabel(bindings[id])}
          </button>
          {recording===id && error ? <p role="alert" className="w-full text-xs text-editor-accent">{error}</p>:null}
        </div>)}</div>
      </section>
    })}</div>
    {!matches.length ? <p className="py-5 text-center text-xs text-editor-text">没有匹配的快捷键</p>:null}
    <p className="text-xs leading-6 text-editor-text/70">滚轮移动画布 · Shift + 滚轮横向移动 · Ctrl / Cmd + 滚轮缩放。滚轮手势保持固定。</p>
    <div className="flex justify-end"><button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs text-editor-text/70 transition hover:bg-editor-accent-soft/50 hover:text-editor-accent" onClick={()=>{setRecording(null);setError(resetShortcuts())}}><ArrowCounterClockwise size={16}/>恢复默认快捷键</button></div>
    {!recording && error ? <p role="alert" className="text-xs text-editor-accent">{error}</p>:null}
  </div>
}
