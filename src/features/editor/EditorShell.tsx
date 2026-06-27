import { useEffect, useRef } from 'react'
import { CanvasStage } from '../../platform/web/CanvasStage'
import { CollapsibleSection } from './components/CollapsibleSection'
import { CanvasPanel } from './panels/CanvasPanel'
import { ColorPanel } from './panels/ColorPanel'
import { ExportPanel } from './panels/ExportPanel'
import { ImagePanel } from './panels/ImagePanel'
import { useEditorState, type EditorTool } from './useEditorState'

const brushSizes = [1, 2, 3, 5]
const zoomMin = 50
const zoomMax = 220
const zoomStep = 10

export function EditorShell() {
  const editor = useEditorState()
  const previousToolRef = useRef<EditorTool | null>(null)
  // 记录"是否因为按住 Alt 而激活了临时吸管"。松开 Alt 时只关掉我们自己开的那次,
  // 不影响用户主动开/关的吸管状态。
  const altEyedropperRef = useRef(false)

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (target.isContentEditable) return true
      return false
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return

      const key = event.key
      const lower = key.toLowerCase()
      const meta = event.ctrlKey || event.metaKey

      // 按住 Alt 临时激活吸管(松开恢复)。要在 meta/alt 早返回之前处理。
      // preventDefault 避免 Windows Chrome/Edge 把单按 Alt 解释成"聚焦菜单栏"
      if (event.altKey && !meta) {
        event.preventDefault()
        if (!altEyedropperRef.current) {
          altEyedropperRef.current = true
          editor.setEyedropperActive(true)
        }
      }

      if (meta && lower === 'z' && !event.shiftKey) {
        event.preventDefault()
        editor.undo()
        return
      }
      if ((meta && lower === 'y') || (meta && lower === 'z' && event.shiftKey)) {
        event.preventDefault()
        editor.redo()
        return
      }

      // Ctrl/Cmd + +/-/0  缩放
      if (meta && (key === '+' || key === '=' || key === '-' || key === '0')) {
        event.preventDefault()
        if (key === '0') editor.setZoom(100)
        else if (key === '-') adjustZoom(editor, -zoomStep)
        else adjustZoom(editor, zoomStep)
        return
      }

      // 无修饰键的 +/-/0 也支持
      if (!meta && !event.altKey && !event.shiftKey) {
        if (key === '+' || key === '=') {
          adjustZoom(editor, zoomStep)
          event.preventDefault()
          return
        }
        if (key === '-') {
          adjustZoom(editor, -zoomStep)
          event.preventDefault()
          return
        }
        if (key === '0') {
          editor.setZoom(100)
          event.preventDefault()
          return
        }
      }

      if (meta || event.altKey) return

      if (key === ' ') {
        if (editor.currentTool !== 'pan' && previousToolRef.current === null) {
          previousToolRef.current = editor.currentTool
          editor.setCurrentTool('pan')
        }
        event.preventDefault()
        return
      }

      switch (lower) {
        case 'b':
          editor.setCurrentTool('brush')
          editor.setEyedropperActive(false)
          break
        case 'e':
          editor.setCurrentTool('eraser')
          editor.setEyedropperActive(false)
          break
        case 'f':
          editor.setCurrentTool('fill')
          editor.setEyedropperActive(false)
          break
        case 'v':
          editor.setCurrentTool('pan')
          editor.setEyedropperActive(false)
          break
        case 'i':
          editor.setEyedropperActive((value) => !value)
          break
        case 'g':
          editor.toggleShowGrid()
          break
        case '[':
          adjustBrushSize(editor, -1)
          break
        case ']':
          adjustBrushSize(editor, 1)
          break
        default:
          return
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      // 松开 Alt:关掉我们因 alt 临时打开的吸管(不影响用户主动按 I 开的);
      // 同时 preventDefault 阻断 Windows Chrome/Edge"Alt 松开聚焦菜单栏"行为
      if (event.key === 'Alt' || (!event.altKey && altEyedropperRef.current)) {
        if (altEyedropperRef.current) {
          event.preventDefault()
          altEyedropperRef.current = false
          editor.setEyedropperActive(false)
        }
      }
      if (event.key !== ' ') return
      if (previousToolRef.current === null) return
      editor.setCurrentTool(previousToolRef.current)
      previousToolRef.current = null
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [editor])

  return (
    <div className="mx-auto grid max-w-[1760px] grid-cols-1 gap-5 2xl:h-full 2xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <aside className="order-2 grid overflow-visible gap-3 2xl:order-1 2xl:min-h-0 2xl:max-h-full 2xl:grid-rows-[auto_minmax(0,1fr)]">
        <div className="shrink-0 rounded-3xl border border-editor-border bg-editor-surface p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-editor-accent uppercase">
            Bead Pattern Editor
          </p>
          <h1 className="mt-2 text-2xl leading-tight font-black tracking-[-0.04em] text-editor-strong">
            拼豆图纸工作台
          </h1>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-visible 2xl:overflow-y-auto">
          <CollapsibleSection title="画布设置" defaultOpen>
            <CanvasPanel editor={editor} />
          </CollapsibleSection>

          <CollapsibleSection title="照片转图纸">
            <ImagePanel editor={editor} />
          </CollapsibleSection>

          <CollapsibleSection title="导出与存档">
            <ExportPanel editor={editor} />
          </CollapsibleSection>
        </div>
      </aside>

      <section className="order-1 min-w-0 2xl:order-2 2xl:min-h-0">
        <CanvasStage editor={editor} />
      </section>

      <aside className="order-3 overflow-visible 2xl:min-h-0 2xl:max-h-full">
        <div className="grid max-h-full content-start gap-3 overflow-visible 2xl:overflow-y-auto">
          <CollapsibleSection title="颜色" defaultOpen>
            <ColorPanel editor={editor} />
          </CollapsibleSection>
        </div>
      </aside>
    </div>
  )
}

function adjustBrushSize(
  editor: ReturnType<typeof useEditorState>,
  step: number,
) {
  const tool = editor.currentTool
  if (tool !== 'brush' && tool !== 'eraser') return
  const current = tool === 'brush' ? editor.brushSize : editor.eraserSize
  const currentIndex = brushSizes.indexOf(current)
  const baseIndex = currentIndex === -1 ? 0 : currentIndex
  const nextIndex = Math.min(
    brushSizes.length - 1,
    Math.max(0, baseIndex + step),
  )
  const next = brushSizes[nextIndex]
  if (tool === 'brush') editor.setBrushSize(next)
  else editor.setEraserSize(next)
}

function adjustZoom(
  editor: ReturnType<typeof useEditorState>,
  delta: number,
) {
  const next = Math.min(zoomMax, Math.max(zoomMin, editor.zoom + delta))
  editor.setZoom(next)
}
