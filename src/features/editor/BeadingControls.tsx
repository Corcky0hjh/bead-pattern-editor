import { createPortal } from 'react-dom'
import { ModalDialog } from '../../components/ModalDialog'
import { useEffect, useRef, useState, type ButtonHTMLAttributes } from 'react'
import { ArrowUUpLeft, Eye, Hand, PaintBrush, PaintBucket, Selection, SquareHalf, Stack, Trash, type Icon } from '@phosphor-icons/react'
import type { EditorStateController } from './useEditorState'

const views = [
  { value: 'all', label: '全部图层', icon: Stack },
  { value: 'focus', label: '当前图层', icon: Selection },
  { value: 'reference', label: '已拼参考', icon: SquareHalf },
] as const

function Control({ icon: IconComponent, label, active, color, onClick, pressProps }: { icon: Icon; label: string; active?: boolean; color?: string | null; onClick?: () => void; pressProps?: ButtonHTMLAttributes<HTMLButtonElement> }) {
  return <button {...pressProps} type="button" title={label} aria-label={label} aria-pressed={active} onClick={onClick}
    className={`relative grid touch-none select-none h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-editor-accent active:bg-editor-accent/20 disabled:pointer-events-none disabled:opacity-30 ${active ? 'bg-editor-accent-soft text-editor-accent' : 'text-editor-text hover:bg-editor-surface-soft'}`}>
    <IconComponent size={17} weight="regular" aria-hidden="true" />
    {color ? <span className="absolute bottom-0.5 left-0.5 h-2 w-2 rounded-full border border-editor-elevated" style={{ backgroundColor: color }} aria-hidden="true" /> : null}
  </button>
}

export function BeadingControls({ editor }: { editor: EditorStateController }) {
  const currentView = editor.showingBeadingResult ? 'all' : editor.beadingViewMode
  const viewIndex = views.findIndex(view => view.value === currentView)
  const view = views[viewIndex]
  const next = views[(viewIndex + 1) % views.length]
  const [resetProject, setResetProject] = useState<string | null>(null)
  const point = editor.beadingFillMode === 'point'
  const editorRef = useRef(editor)
  editorRef.current = editor
  const held = useRef(false)
  const release = () => {
    if (!held.current) return
    held.current = false
    editorRef.current.setBeadingPreview(false)
  }
  const begin = () => {
    if (held.current) return
    held.current = true
    editorRef.current.setBeadingPreview(true)
  }
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) release() }
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', onVisibility)
      release()
    }
  }, [editor.activeBeadingProjectId])
  return <><div className="flex shrink-0 items-center gap-0.5" role="toolbar" aria-label="拼豆操作">
    <Control icon={Hand} label="移动画布" active={editor.currentTool === 'pan'} onClick={() => editor.setCurrentTool('pan')} />
    {editor.showingBeadingResult
      ? <Control icon={ArrowUUpLeft} label="继续调整" onClick={editor.continueBeadingAdjustment} />
      : <Control icon={point ? PaintBrush : PaintBucket} color={editor.beadingColor} active={editor.currentTool !== 'pan'}
          label={`${point ? '单点填充' : '区块填充'}，点击切换为${point ? '区块填充' : '单点填充'}`}
          onClick={() => {
            editor.setBeadingFillMode(point ? 'connected' : 'point')
            editor.setCurrentTool('brush')
          }} />}
    <Control icon={view.icon} label={`${view.label}，点击切换为${next.label}`} onClick={() => {
      editor.setBeadingViewMode(next.value)
      if (editor.showingBeadingResult) editor.continueBeadingAdjustment()
    }} />
    <Control icon={Eye} label="按住预览已拼豆子，松开恢复" active={editor.isBeadingPreview} pressProps={{
      onPointerDown: event => {
        if (!event.isPrimary || event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        begin()
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onBlur: release,
      onContextMenu: event => event.preventDefault(),
      onKeyDown: event => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.stopPropagation()
        event.preventDefault()
        if (!event.repeat) begin()
      },
      onKeyUp: event => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.stopPropagation()
        event.preventDefault()
        release()
      },
    }} />
    <Control icon={Trash} label="清空拼豆进度" pressProps={{ disabled: editor.completedBeadCount === 0 }} onClick={() => setResetProject(editor.activeBeadingProjectId)} />
  </div>
  {resetProject !== null && resetProject === editor.activeBeadingProjectId ? createPortal(
    <ModalDialog label="清空拼豆进度" onClose={() => setResetProject(null)} panelClassName="w-full max-w-sm rounded-2xl border border-editor-border bg-editor-elevated p-5 shadow-xl">
      <h2 className="text-sm font-semibold text-editor-strong">清空拼豆进度？</h2>
      <p className="mt-2 text-xs leading-6 text-editor-text">将清空当前作品的已拼标记，保留图纸和颜色图层。清空后可以撤销恢复。</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" data-modal-close className="rounded-lg px-4 py-2 text-xs text-editor-text hover:bg-editor-surface-soft">取消</button>
        <button type="button" className="rounded-lg bg-editor-accent px-4 py-2 text-xs font-semibold text-white" onClick={() => {
          editor.setBeadingPreview(false)
          editor.resetBeadingProgress()
          setResetProject(null)
        }}>清空进度</button>
      </div>
    </ModalDialog>, document.body,
  ) : null}</>
}
