import { matchesShortcut, shortcutReleased } from './shortcuts'
import { ExportModal } from './panels/ExportModal'
import { WorkCanvasSizeDialog } from './WorkCanvasSizeDialog'
import { createPortal } from 'react-dom'
import { HeaderIconButton } from '../../components/HeaderIconButton'
import { WorkSaveDialog } from './WorkSaveDialog'
import { WorkBar } from './WorkBar'
import { useEffect, useRef, useState } from 'react'
import { SidebarSimple } from '@phosphor-icons/react'
import { CanvasStage } from '../../platform/web/CanvasStage'
import { BeadingCelebration } from './BeadingCelebration'
import { CanvasSettingsModal } from './panels/CanvasSettingsModal'
import { BeadBoxPanel as ColorPanel, BeadCardBrowser } from './BeadBoxPanel'
import { ImagePanel } from './panels/ImagePanel'
import { BeadingLibraryPanel } from './panels/BeadingLibraryPanel'
import { useEditorState, type EditorTool } from './useEditorState'

const brushSizes = [1, 2, 3, 4, 5]

export function EditorShell() {
  const editor = useEditorState()
  const [settingsHost, setSettingsHost] = useState<HTMLDivElement | null>(null)
  const [headerControls, setHeaderControls] = useState<HTMLDivElement | null>(null)
  const [headerHistory, setHeaderHistory] = useState<HTMLDivElement | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const workPanelRef = useRef<HTMLElement>(null)
  const workPanelToggleRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!panelOpen) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (workPanelRef.current?.contains(target) || workPanelToggleRef.current?.contains(target)) return
      // Portaled dialogs (color cards, deletion confirmation) remain part of the active workflow.
      if (target.closest('[role="dialog"], [role="alertdialog"]')) return
      setPanelOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside, true)
    return () => document.removeEventListener('pointerdown', closeOutside, true)
  }, [panelOpen])
  const [panelTab, setPanelTab] = useState<'colors' | 'beading'>('colors')
  const activePanelTab = editor.editorMode === 'bead' ? 'beading' : panelTab
  const panelTabs = editor.editorMode === 'bead'
    ? [{ value: 'beading', label: '作品' }] as const
    : [{ value: 'colors', label: '豆盒' }, { value: 'beading', label: '作品' }] as const

  function enterBeadingPanel() {
    setPanelTab('beading')
    setPanelOpen(false)
  }

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
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      if (event.target instanceof Element && event.target.closest('[role="dialog"], [role="alertdialog"]')) return
      if (event.repeat && !['undo', 'redo', 'redoAlt', 'smaller', 'larger'].some(id => matchesShortcut(event, id as import('./shortcuts').ShortcutId))) return


      if (matchesShortcut(event, 'save')) { event.preventDefault(); editor.saveWork(); return }

      // 按住 Alt 临时激活吸管(松开恢复)。要在 meta/alt 早返回之前处理。
      // preventDefault 避免 Windows Chrome/Edge 把单按 Alt 解释成"聚焦菜单栏"
      if (matchesShortcut(event, 'holdPick') && editor.editorMode === 'draw') {
        event.preventDefault()
        if (!editor.eyedropperActive && !altEyedropperRef.current) {
          altEyedropperRef.current = true
          editor.setEyedropperActive(true)
        }
      }

      if (matchesShortcut(event, 'undo')) {
        event.preventDefault()
        if (editor.editorMode === 'bead') editor.undoBeadingProgress()
        else editor.undo()
        return
      }
      if (matchesShortcut(event, 'redo') || matchesShortcut(event, 'redoAlt')) {
        event.preventDefault()
        if (editor.editorMode === 'bead') editor.redoBeadingProgress()
        else editor.redo()
        return
      }


      if (matchesShortcut(event, 'holdPan')) {
        if (event.target instanceof Element && event.target.closest('button')) return
        if (editor.currentTool !== 'pan' && previousToolRef.current === null) {
          previousToolRef.current = editor.currentTool
          editor.setCurrentTool('pan')
        }
        event.preventDefault()
        return
      }

      if (editor.editorMode === 'bead') return

      switch (true) {
        case matchesShortcut(event, 'brush'):
          editor.setCurrentTool('brush')
          editor.setEyedropperActive(false)
          break
        case matchesShortcut(event, 'eraser'):
          editor.setCurrentTool('eraser')
          editor.setEyedropperActive(false)
          break
        case matchesShortcut(event, 'fill'):
          editor.setCurrentTool('fill')
          editor.setEyedropperActive(false)
          break
        case matchesShortcut(event, 'shape'):
          editor.setCurrentTool('shape')
          editor.setEyedropperActive(false)
          break
        case matchesShortcut(event, 'pan'):
          editor.setCurrentTool('pan')
          editor.setEyedropperActive(false)
          break
        case matchesShortcut(event, 'eyedropper'):
          editor.setEyedropperActive((value) => !value)
          break
        case matchesShortcut(event, 'grid'):
          editor.toggleShowGrid()
          break
        case matchesShortcut(event, 'smaller'):
          adjustBrushSize(editor, -1)
          break
        case matchesShortcut(event, 'larger'):
          adjustBrushSize(editor, 1)
          break
        default:
          return
      }
      event.preventDefault()
    }

    function handleKeyUp(event: KeyboardEvent) {
      // 松开 Alt:关掉我们因 alt 临时打开的吸管(不影响用户主动按 I 开的);
      // 同时 preventDefault 阻断 Windows Chrome/Edge"Alt 松开聚焦菜单栏"行为
      if (shortcutReleased(event, 'holdPick')) {
        if (altEyedropperRef.current) {
          event.preventDefault()
          altEyedropperRef.current = false
          editor.setEyedropperActive(false)
        }
      }
      if (!shortcutReleased(event, 'holdPan')) return
      if (previousToolRef.current === null) return
      editor.setCurrentTool(previousToolRef.current)
      previousToolRef.current = null
    }

    function restoreTemporaryTools() {
      if (altEyedropperRef.current) {
        altEyedropperRef.current = false
        editor.setEyedropperActive(false)
      }
      if (previousToolRef.current !== null) {
        editor.setCurrentTool(previousToolRef.current)
        previousToolRef.current = null
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) restoreTemporaryTools()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', restoreTemporaryTools)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', restoreTemporaryTools)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [editor])

  return (
    <>
      <BeadingCelebration
        projectId={editor.editorMode === 'bead' ? editor.activeBeadingProjectId : null}
        done={editor.completedBeadCount}
        total={editor.usedCount}
      />
      <div className="editor-workspace">
        <header className="editor-header flex h-10 shrink-0 items-center justify-between gap-2 px-2 pb-1">
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-label="Bead Atelier">
            <span className="grid h-8 w-8 shrink-0 place-content-center" aria-hidden="true"><img src="/logo-bead-b.png" alt="" className="h-12 w-12 max-w-none object-contain" /></span>
            <h1 className="editor-brand-title whitespace-nowrap font-serif text-[15px] font-semibold italic tracking-tight text-editor-strong sm:text-[21px]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>Bead Atelier</h1>
          </div>
          <ImagePanel editor={editor} renderTrigger={openNewWork => <WorkBar editor={editor} settingsHost={settingsHost} onOpenExport={() => setExportOpen(true)} onOpenSettings={() => setSettingsOpen(true)} onNewWork={openNewWork} />} />
          <div className="editor-header-actions flex shrink-0 items-center gap-2">
          <div ref={setHeaderHistory} className="header-history shrink-0" />
          <div className="header-utilities-content" ref={setHeaderControls} />
          <div ref={setSettingsHost} className="relative shrink-0" />
          <div className="relative z-[66] shrink-0">

          <HeaderIconButton
            type="button"
            ref={workPanelToggleRef}
            className="work-panel-toggle"
            aria-label={panelOpen ? '收起工作面板' : '展开工作面板'}
            title={panelOpen ? '收起工作面板' : '展开工作面板'}
            aria-expanded={panelOpen}
            aria-controls="editor-work-panel"
            onClick={() => setPanelOpen((open) => !open)}
          >
            <SidebarSimple size={18} weight="regular" />
          </HeaderIconButton>
          </div>
          </div>
        </header>
        {editor.canvasSizeDialog ? createPortal(<WorkCanvasSizeDialog key={editor.canvasSizeDialog} editor={editor} />, document.body) : null}
        {editor.boxPickerOpen ? <BeadCardBrowser editor={editor} /> : null}
        {editor.workDialog ? <WorkSaveDialog key={editor.workDialog.message} dialog={editor.workDialog} /> : null}
      <div className="editor-workspace-layout" data-panel-open={panelOpen}>
        <section className="relative min-h-0 min-w-0">
          <CanvasStage
            editor={editor}
            headerControls={headerControls}
            headerHistory={headerHistory}
          />
        </section>

        <aside ref={workPanelRef} id="editor-work-panel" aria-label="工作面板" className="editor-work-panel" data-open={panelOpen} aria-hidden={!panelOpen} inert={!panelOpen}>
            <div className="work-panel-tabs flex h-8 items-center gap-1" role="tablist" aria-label="工作面板内容">
              {panelTabs.map((tab) => (
                <button key={tab.value} id={`work-tab-${tab.value}`} type="button" role="tab" aria-selected={activePanelTab === tab.value} aria-controls={`work-panel-${tab.value}`} onClick={() => setPanelTab(tab.value)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${activePanelTab === tab.value ? 'bg-editor-accent-soft text-editor-accent' : 'text-editor-text hover:bg-editor-surface-soft'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

          <div id="work-panel-content" className="flex min-h-0 flex-1 flex-col">
            {editor.editorMode === 'draw' ? <div id="work-panel-colors" hidden={activePanelTab !== 'colors'} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1" role="tabpanel" aria-labelledby="work-tab-colors">
              <ColorPanel editor={editor} />
            </div> : null}
            <div id="work-panel-beading" hidden={activePanelTab !== 'beading'} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2" role="tabpanel" aria-labelledby="work-tab-beading">
              <BeadingLibraryPanel editor={editor} onEnterProject={enterBeadingPanel} />
            </div>
          </div>
        </aside>
      </div>
      </div>
      {exportOpen ? createPortal(<ExportModal editor={editor} onClose={() => setExportOpen(false)} />, document.body) : null}
      {settingsOpen ? (
        <CanvasSettingsModal
          editor={editor}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  )
}

function adjustBrushSize(
  editor: ReturnType<typeof useEditorState>,
  step: number,
) {
  const tool = editor.currentTool
  if (tool !== 'brush' && tool !== 'eraser' && tool !== 'shape') return
  const current =
    tool === 'eraser'
      ? editor.eraserSize
      : tool === 'shape'
        ? editor.shapeStrokeSize
        : editor.brushSize
  const currentIndex = brushSizes.indexOf(current)
  const baseIndex = currentIndex === -1 ? 0 : currentIndex
  const nextIndex = Math.min(
    brushSizes.length - 1,
    Math.max(0, baseIndex + step),
  )
  const next = brushSizes[nextIndex]
  if (tool === 'eraser') {
    editor.setEraserMode('brush')
    editor.setEraserSize(next)
  } else {
    if (tool === 'shape') {
      editor.setShapeStyle('outline')
      editor.setShapeStrokeSize(next)
    } else {
      editor.setBrushSize(next)
    }
  }
}
