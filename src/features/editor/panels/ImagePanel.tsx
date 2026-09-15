import { ModalHeader } from '../../../components/ModalHeader'
import { constrainImagePlacement } from '../../../core/image/placementBounds'
import { WorkCreationActions } from '../WorkCreationActions'
import { BoardSizeFields } from '../BoardSizeFields'
import { WorkCanvasSizeDialog } from '../WorkCanvasSizeDialog'
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { boxLabel, readBox, toBoxColor } from '../beadBox'
import { brands, getBrandColors, type BrandId, type BeadColor } from '../../../core/color'
import { createPortal } from 'react-dom'
import { ModalDialog } from '../../../components/ModalDialog'
import { ArrowCounterClockwise, Plus, FilePlus, ImageSquare, FileCode } from '@phosphor-icons/react'
import {
  conversionAlgorithmOptions,
  type ConversionAlgorithm,
  type ImageFitMode,
  type ImagePlacement,
} from '../../../core/image/conversion'
import {
  MAX_PATTERN_SIDE,
  MIN_PATTERN_SIDE,
  type PatternGrid,
} from '../../../core/pattern/grid'
import { Dropdown } from '../../../components/Dropdown'
import { Slider } from '../../../components/Slider'
import {
  remapPatternColors,
  type EditorStateController,
  type ImageConversionOptions,
} from '../useEditorState'

type ImagePanelProps = {
  editor: EditorStateController
  compact?: boolean
  renderTrigger?: (openNewWork: () => void) => ReactNode
}

type ConversionDraft = {
  algorithm: ConversionAlgorithm
  fit: ImageFitMode
  rows: number
  cols: number
  colorLimit: number
  mergeThreshold: number
  detectBackground: boolean
}

type WorkbenchStepId = 1 | 2 | 3

const steps: Array<{ id: WorkbenchStepId; title: string }> = [
  { id: 1, title: '构图与尺寸' },
  { id: 2, title: '色卡与转换' },
  { id: 3, title: '预览修正' },
]

const boardSizeMin = MIN_PATTERN_SIDE
const boardSizeMax = MAX_PATTERN_SIDE
const colorLimitDefault = 32
const colorLimitMax = 128

export function ImagePanel({ editor, compact = false, renderTrigger }: ImagePanelProps) {
  const [newKind, setNewKind] = useState<'blank' | 'image' | 'project'>('blank')
  const [projectFile, setProjectFile] = useState<File | null>(null)
  const [projectBusy, setProjectBusy] = useState(false)
  const projectInputRef = useRef<HTMLInputElement>(null)
  function openNewWork() { setNewKind('blank'); setProjectFile(null); setImportFile(null); setNewMenuOpen(true) }
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const importTriggerRef = useRef<HTMLButtonElement | null>(null)


  return (
    <div className={renderTrigger ? "flex min-w-8 flex-1" : "grid gap-3"}>
      {renderTrigger ? renderTrigger(openNewWork) : <button
        ref={importTriggerRef}
        type="button"
        aria-label={'新建作品'}
        title="新建作品"
        className={compact ? 'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-editor-text transition hover:bg-editor-accent-soft hover:text-editor-accent focus-visible:outline-2 focus-visible:outline-editor-accent' : 'group grid min-h-24 cursor-pointer gap-2 rounded-3xl border border-editor-border bg-editor-elevated/70 px-4 py-4 text-left transition hover:bg-editor-elevated hover:shadow-sm'}
        onClick={openNewWork}
      >
        {compact ? <Plus size={19} weight="regular" aria-hidden="true" /> : <><span className="flex items-center justify-between gap-3">
          <span className="text-sm font-black text-editor-strong">
            新建作品
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-editor-accent text-lg font-black text-white transition group-hover:scale-105">
            +
          </span>
        </span>
        <span className="text-xs leading-5 text-editor-text">
          创建空白画布，或从图片生成作品
        </span>
        </>}
      </button>}
      {newMenuOpen ? createPortal(<ModalDialog dismissDisabled={projectBusy} label="新建作品" onClose={() => { if (!projectBusy) setNewMenuOpen(false) }} panelClassName={"new-work-dialog flex w-full max-w-sm max-h-[94dvh] flex-col overflow-hidden rounded-3xl bg-editor-surface p-4 shadow-xl" + (newKind==='image' && importFile ? " new-work-dialog--image" : "")}>
        <ModalHeader title="新建作品" disabled={projectBusy}/>
        <div className="mb-3 grid shrink-0 grid-cols-3 gap-1" role="tablist" aria-label="新建方式">{[{id:'blank' as const,label:'空白画布',icon:FilePlus},{id:'image' as const,label:'图片导入',icon:ImageSquare},{id:'project' as const,label:'工程导入',icon:FileCode}].map(({id,label,icon:Icon})=><button type="button" key={id} disabled={projectBusy} role="tab" aria-selected={newKind===id} onClick={()=>setNewKind(id)} className={'flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs transition '+(newKind===id?'bg-editor-accent-soft text-editor-accent':'text-editor-text hover:bg-editor-surface-soft')}><Icon size={16}/>{label}</button>)}</div>
        <div className={newKind==='image' && importFile ? 'hidden' : 'min-h-0 overflow-y-auto'}>
        {newKind==='blank' ? <WorkCanvasSizeDialog editor={editor} embedded onCreated={()=>setNewMenuOpen(false)}/> : newKind==='image' ? <div className="grid gap-4"><p className="text-[13px] leading-6 text-editor-text">选择图片，调整构图、尺寸和豆色，确认转换后创建新作品。</p><button type="button" onClick={()=>fileInputRef.current?.click()} className="flex min-h-28 items-center justify-center gap-2 rounded-2xl border border-dashed border-editor-border text-sm text-editor-accent hover:bg-editor-accent-soft"><ImageSquare size={22}/>选择图片</button><WorkCreationActions disabled/></div> : <div className="grid gap-4"><p className="text-[13px] leading-6 text-editor-text">导入之前导出的 JSON 图纸，恢复画板尺寸和豆色，创建为新作品。</p><button type="button" disabled={projectBusy} onClick={()=>projectInputRef.current?.click()} className="flex min-h-24 min-w-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-editor-border px-3 text-sm text-editor-accent hover:bg-editor-accent-soft"><FileCode size={22} className="shrink-0"/><span className="truncate">{projectFile?.name ?? '选择工程文件'}</span></button><WorkCreationActions busy={projectBusy} disabled={!projectFile} onConfirm={async()=>{if(!projectFile||projectBusy)return;setProjectBusy(true);try{const created=await editor.createWorkFromJson(projectFile);if(created)setNewMenuOpen(false)}finally{setProjectBusy(false)}}}/></div>}
        </div>
        {importFile ? <div className={newKind==='image' ? 'new-work-image-content min-h-0 flex-1' : 'hidden'}><ImageImportContent editor={editor} initialFile={importFile} onCancel={()=>setImportFile(null)} onClose={()=>setNewMenuOpen(false)}/></div> : null}
      </ModalDialog>, document.body) : null}
      <input ref={projectInputRef} type="file" accept=".json,application/json" className="hidden" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)setProjectFile(file)}}/>
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const nextFile = event.target.files?.[0] ?? null
          event.target.value = ''
          if (!nextFile) return
          setImportFile(nextFile)
        }}
      />

    </div>
  )
}

function ImageImportContent({
  editor,
  initialFile,
  onClose,
  onCancel,
}: {
  editor: EditorStateController
  initialFile: File | null
  onCancel: () => void
  onClose: () => void
}) {
  const file = initialFile
  const [activeStep, setActiveStep] = useState<WorkbenchStepId>(1)
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<WorkbenchStepId>(1)
  const [paletteSources, setPaletteSources] = useState<Array<BrandId | 'custom'>>([editor.currentBrand])
  const sourceColors = useMemo(()=>readBox(paletteSources.flatMap(source => (source === 'custom' ? editor.customPalette : getBrandColors(source)).map(color=>toBoxColor(color, source === 'custom' ? undefined : source)))), [paletteSources, editor.customPalette])
  const [includeUnusedColors, setIncludeUnusedColors] = useState(false)
  const conversionColors = sourceColors
  const [previewing, setPreviewing] = useState(false)
  const previewRequestIdRef = useRef(0)
  const previewPendingRef = useRef(false)
  const [previewStatus, setPreviewStatus] = useState(
    initialFile ? '准备生成预览' : '先导入图片',
  )
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [placement, setPlacement] = useState<ImagePlacement>({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
  })
  const [draft, setDraft] = useState<ConversionDraft>(() => ({
    algorithm: editor.converter,
    fit: editor.imageFitMode,
    rows: editor.rows,
    cols: editor.cols,
    colorLimit: colorLimitDefault,
    mergeThreshold: 10,
    detectBackground: editor.detectBackground,
  }))
  const [basePattern, setBasePattern] = useState<PatternGrid | null>(null)
  const [previewPattern, setPreviewPattern] = useState<PatternGrid | null>(null)
  const [excludedColors, setExcludedColors] = useState<Set<string>>(new Set())
  const excludedColorsRef = useRef(excludedColors)

  useEffect(() => {
    excludedColorsRef.current = excludedColors
  }, [excludedColors])

  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : null
    // The URL is an external resource; recreate it after Strict Mode cleanup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageUrl(url)
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [file])

  const conversionOptions = useMemo<ImageConversionOptions>(() => {
    return {
      width: draft.cols,
      height: draft.rows,
      algorithm: draft.algorithm,
      fit: draft.fit,
      colorLimit: draft.colorLimit,
      mergeThreshold: draft.mergeThreshold,
      detectBackground: draft.detectBackground,
      placement,
    }
  }, [draft, placement])
  const canGenerate = Boolean(file) && conversionColors.length > 0
  const availablePaletteKey = useMemo(
    () =>
      conversionColors
        .map((color) => color.hex.toLowerCase())
        .sort()
        .join('|'),
    [conversionColors],
  )
  const postprocessDisabled = draft.algorithm === 'atkinson'
  const paletteCountText = `${conversionColors.length} 色`
  const previewStats = useMemo(
    () => buildColorStats(previewPattern, { ...editor, palette: sourceColors, currentBrand: editor.currentBrand }),
    [editor, previewPattern, sourceColors],
  )

  function changeBoardSize(nextDraft: SetStateAction<ConversionDraft>) {
    const resolved =
      typeof nextDraft === 'function' ? nextDraft(draft) : nextDraft
    setDraft(resolved)
    if (
      imageSize &&
      (resolved.cols !== draft.cols || resolved.rows !== draft.rows)
    ) {
      setPlacement(
        fitImageToBoard(imageSize, resolved.cols, resolved.rows, 'contain'),
      )
    }
  }

  function handleImageLoad(nextSize: { width: number; height: number }) {
    if (imageSize?.width === nextSize.width && imageSize.height === nextSize.height) return
    setImageSize(nextSize)
    setPlacement(fitImageToBoard(nextSize, draft.cols, draft.rows, 'contain'))
  }

  const generatePreview = useEffectEvent(async (sourceFile = file) => {
    if (!sourceFile) return
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId
    previewPendingRef.current = true
    setPreviewing(true)
    setPreviewStatus('正在生成预览...')
    try {
      const nextBase = await editor.generateImagePattern(
        sourceFile,
        conversionOptions,
        conversionColors,
      )
      if (previewRequestIdRef.current !== requestId) return
      const remapped = remapPatternColors(nextBase, excludedColorsRef.current)
      setBasePattern(nextBase)
      excludedColorsRef.current = remapped.applied
      setExcludedColors(remapped.applied)
      setPreviewPattern(remapped.pattern)
      setPreviewStatus(
        `预览 ${nextBase.width} × ${nextBase.height}，${buildColorStats(remapped.pattern, editor).length} 色`,
      )
    } catch (error) {
      if (previewRequestIdRef.current !== requestId) return
      console.error('[ImageImportModal] preview failed:', error)
      const message = error instanceof Error ? error.message : String(error)
      setPreviewStatus(`预览失败：${message}`)
    } finally {
      if (previewRequestIdRef.current === requestId) {
        previewPendingRef.current = false
        setPreviewing(false)
      }
    }
  })

  useEffect(() => {
    if (!file || !canGenerate || activeStep < 2) {
      previewRequestIdRef.current += 1
      previewPendingRef.current = false
      const frame = window.requestAnimationFrame(() => setPreviewing(false))
      return () => window.cancelAnimationFrame(frame)
    }
    previewRequestIdRef.current += 1
    previewPendingRef.current = true
    const frame = window.requestAnimationFrame(() => setPreviewing(true))
    const timer = window.setTimeout(() => {
      void generatePreview(file)
    }, 360)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [
    activeStep,
    availablePaletteKey,
    canGenerate,
    conversionOptions,
    editor.currentBrand,
    file,
  ])

  function applyExcluded(nextExcluded: Set<string>) {
    if (!basePattern) return
    const remapped = remapPatternColors(basePattern, nextExcluded)
    if (remapped.applied.size !== nextExcluded.size) {
      setPreviewStatus('部分颜色无法排除：没有其他已用颜色可替代')
    }
    excludedColorsRef.current = remapped.applied
    setExcludedColors(remapped.applied)
    setPreviewPattern(remapped.pattern)
  }

  function excludeColor(hex: string) {
    const next = new Set(excludedColors)
    next.add(hex.toLowerCase())
    applyExcluded(next)
  }

  function restoreColor(hex: string) {
    const next = new Set(excludedColors)
    next.delete(hex.toLowerCase())
    applyExcluded(next)
  }

  function unlockStep(step: WorkbenchStepId) {
    setMaxUnlockedStep((current) => (step > current ? step : current))
    setActiveStep(step)
  }

  function continueStep() {
    if (activeStep === 1 && file) {
      unlockStep(2)
      return
    }
    if (activeStep === 2 && previewPattern && !previewPendingRef.current) {
      unlockStep(3)
      return
    }
  }

  async function applyToEditor() {
    if (!previewPattern || previewPendingRef.current || !canGenerate) return
    const usedHexes = new Set(previewPattern.cells.filter(cell => cell.color && !cell.isExternal).map(cell => cell.color!.toLowerCase()))
    const importedBox = conversionColors.filter(color => usedHexes.has(color.hex.toLowerCase()) || (includeUnusedColors && !excludedColors.has(color.hex.toLowerCase())))
    const created = await editor.createWorkFromImage(previewPattern, conversionOptions, {
      file,
      beadBox: importedBox,
      excludedColors,
      status: `已应用 ${previewPattern.width} × ${previewPattern.height} 图纸`,
    })
    if (created) onClose()
  }

  const canContinue =
    activeStep === 1
      ? Boolean(file)
      : activeStep < 3
        ? Boolean(previewPattern) && !previewing && canGenerate
        : false

  return (
    <>
        <div className="image-workbench-body grid min-h-0 overflow-hidden lg:grid-cols-[minmax(360px,0.86fr)_minmax(0,1.14fr)]">
          <section className="image-workbench-settings grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] border-r border-editor-border">
            <Stepper
              activeStep={activeStep}
              maxUnlockedStep={maxUnlockedStep}
              onSelect={setActiveStep}
            />

            <div className="image-workbench-fields min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2">
              {activeStep === 1 ? (
                <StepCard>
                  <BoardSizeControls draft={draft} onChange={changeBoardSize} />
                </StepCard>
              ) : null}

              {activeStep === 2 ? (
                <StepCard>
                  <div className="conversion-palette grid gap-2">
                    <div className="flex items-center justify-between text-xs text-editor-text"><span>豆色卡</span><span className="tabular-nums">{paletteCountText}</span></div>
                    <Dropdown ariaLabel="选择转换豆色卡" value={paletteSources[0] ?? 'custom'} selectedValues={paletteSources} placeholder="选择豆色卡，可多选" onChange={value=>{const source=value as BrandId | 'custom';setPaletteSources(previous=>previous.includes(source)?previous.filter(item=>item!==source):[...previous,source]);setExcludedColors(new Set());excludedColorsRef.current=new Set()}} options={[...brands.filter(b=>b.available).map(b=>({value:b.id,label:b.label})),{value:'custom',label:'我的豆色卡'}]}/>
                    {!sourceColors.length ? <p className="text-xs text-editor-text">请至少选择一张有颜色的豆色卡。</p> : null}
                  </div>
                  <ConversionSettings
                    draft={draft}
                    postprocessDisabled={postprocessDisabled}
                    onChange={setDraft}
                  />
                </StepCard>
              ) : null}

              {activeStep === 3 ? (
                <StepCard>
                  <ColorExclusionPanel
                    excludedColors={[...excludedColors].sort()}
                    palette={sourceColors}
                    stats={previewStats}
                    onExclude={excludeColor}
                    onRestore={restoreColor}
                  />
                  <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 border-t border-editor-border/60 px-1 pb-1 pt-3">
                    <span className="min-w-0"><span className="block text-xs font-semibold text-editor-strong">同时加入未使用豆色</span><span id="import-box-description" className="mt-1 block text-[11px] leading-5 text-editor-text">默认仅加入图纸实际用色。开启后，所选色卡中其余未被排除的颜色也会加入作品豆盒，不会改变图纸。</span></span>
                    <span className="relative inline-flex shrink-0 items-center"><input type="checkbox" role="switch" aria-label="同时加入未使用豆色" aria-describedby="import-box-description" className="peer sr-only" checked={includeUnusedColors} onChange={event => setIncludeUnusedColors(event.target.checked)}/><span className="h-6 w-11 rounded-full bg-editor-border transition-colors peer-checked:bg-editor-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-editor-accent"/><span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"/></span>
                  </label>
                </StepCard>
              ) : null}
            </div>

            <WorkCreationActions info={imageSize ? <span className="whitespace-nowrap">{imageSize.width} × {imageSize.height}</span> : undefined} onCancel={onCancel} onBack={activeStep > 1 ? ()=>setActiveStep((activeStep - 1) as WorkbenchStepId) : undefined} label={activeStep < 3 ? '继续' : '创建作品'} disabled={activeStep < 3 ? !canContinue : !previewPattern || previewing || !canGenerate} onConfirm={activeStep < 3 ? continueStep : applyToEditor}/>
          </section>

          {activeStep === 1 ? (
            <aside className="min-h-0 bg-editor-elevated/35 p-5">
              <PlacementStage
                cols={draft.cols}
                imageSize={imageSize}
                imageUrl={imageUrl}
                placement={placement}
                rows={draft.rows}
                onReset={()=>{if(imageSize)setPlacement(fitImageToBoard(imageSize, draft.cols, draft.rows, 'contain'))}}
                onImageLoad={handleImageLoad}
                onPlacementChange={next=>setPlacement(imageSize ? constrainImagePlacement(next, imageSize, draft.cols, draft.rows) : next)}
              />
            </aside>
          ) : (
            <PreviewPane
              draft={draft}
              pattern={previewPattern}
              previewing={previewing}
              status={previewStatus}
              canvasSettings={editor.canvasSettings}
            />
          )}
        </div>

    </>
  )
}

function Stepper({
  activeStep,
  maxUnlockedStep,
  onSelect,
}: {
  activeStep: WorkbenchStepId
  maxUnlockedStep: WorkbenchStepId
  onSelect: (step: WorkbenchStepId) => void
}) {
  return (
    <nav className="image-workbench-steps" aria-label="图片导入步骤">
      <div className="image-step-track">
        {steps.map((step, index) => <div key={step.id} className="image-step-node">
          <button type="button" aria-label={step.title} aria-current={step.id === activeStep ? 'step' : undefined}
            disabled={step.id > maxUnlockedStep} onClick={() => onSelect(step.id)}>
            {String(step.id).padStart(2, '0')}
          </button>
          {index < steps.length - 1 ? <span className="image-step-connector" aria-hidden="true"/> : null}
        </div>)}
      </div>
    </nav>
  )
}

function BoardSizeControls({ draft, onChange }: { draft: ConversionDraft; onChange: Dispatch<SetStateAction<ConversionDraft>> }) {
  const [width, setWidth] = useState(String(draft.cols))
  const [height, setHeight] = useState(String(draft.rows))
  return <BoardSizeFields width={width} height={height} onBlur={()=>{setWidth(String(draft.cols));setHeight(String(draft.rows))}} onChange={(w,h)=>{
    setWidth(w);setHeight(h)
    const cols=Number(w), rows=Number(h)
    if ([cols,rows].every(n=>Number.isInteger(n)&&n>=boardSizeMin&&n<=boardSizeMax)) onChange(previous=>({...previous,cols,rows}))
  }}/>
}

function PlacementStage({
  onReset,
  cols,
  imageUrl,
  imageSize,
  placement,
  rows,
  onImageLoad,
  onPlacementChange,
}: {
  onReset: () => void
  cols: number
  imageUrl: string | null
  imageSize: { width: number; height: number } | null
  placement: ImagePlacement
  rows: number
  onImageLoad: (size: { width: number; height: number }) => void
  onPlacementChange: (placement: ImagePlacement) => void
}) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [activeDragMode, setActiveDragMode] = useState<
    'move' | 'scale' | 'rotate' | null
  >(null)
  const dragRef = useRef<{
    mode: 'move' | 'scale' | 'rotate'
    startX: number
    startY: number
    startAngle: number
    startPlacement: ImagePlacement
  } | null>(null)

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function beginDrag(
    mode: 'move' | 'scale' | 'rotate',
    event: PointerEvent<HTMLElement>,
  ) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const boardRect = stageRef.current
      ?.querySelector('[data-placement-board="true"]')
      ?.getBoundingClientRect()
    const center = boardRect
      ? imageCenterInBoardRect(placement, imageSize, boardRect)
      : { x: event.clientX, y: event.clientY }
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startAngle: Math.atan2(
        event.clientY - center.y,
        event.clientX - center.x,
      ),
      startPlacement: placement,
    }
    setActiveDragMode(mode)
  }

  function updateDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || !boardSize) return
    if (drag.mode === 'scale') {
      const boardRect = stageRef.current
        ?.querySelector('[data-placement-board="true"]')
        ?.getBoundingClientRect()
      if (!boardRect) return
      const imageHeightRatio = imageSize
        ? drag.startPlacement.scale *
          (imageSize.height / imageSize.width) *
          (boardRect.width / boardRect.height)
        : drag.startPlacement.scale
      const anchor = rotatedImageCorner(
        drag.startPlacement,
        imageHeightRatio,
        'nw', cols / rows,
      )
      const startHandle = rotatedImageCorner(
        drag.startPlacement,
        imageHeightRatio,
        'se', cols / rows,
      )
      const anchorPx = {
        x: boardRect.left + anchor.x * boardRect.width,
        y: boardRect.top + anchor.y * boardRect.height,
      }
      const startHandlePx = {
        x: boardRect.left + startHandle.x * boardRect.width,
        y: boardRect.top + startHandle.y * boardRect.height,
      }
      const baseVector = {
        x: startHandlePx.x - anchorPx.x,
        y: startHandlePx.y - anchorPx.y,
      }
      const pointerVector = {
        x: event.clientX - anchorPx.x,
        y: event.clientY - anchorPx.y,
      }
      const baseLengthSq =
        baseVector.x * baseVector.x + baseVector.y * baseVector.y
      const ratio =
        baseLengthSq > 0
          ? (pointerVector.x * baseVector.x + pointerVector.y * baseVector.y) /
            baseLengthSq
          : 1
      const nextScale = Math.max(
        0.05,
        Math.min(6, drag.startPlacement.scale * ratio),
      )
      const nextPlacement = {
        ...drag.startPlacement,
        scale: nextScale,
      }
      const nextImageHeightRatio = imageSize
        ? nextScale *
          (imageSize.height / imageSize.width) *
          (boardRect.width / boardRect.height)
        : nextScale
      const nextAnchor = rotatedImageCorner(
        nextPlacement,
        nextImageHeightRatio,
        'nw', cols / rows,
      )
      onPlacementChange({
        ...nextPlacement,
        x: nextPlacement.x + anchor.x - nextAnchor.x,
        y: nextPlacement.y + anchor.y - nextAnchor.y,
      })
      return
    }
    if (drag.mode === 'rotate') {
      const boardRect = stageRef.current
        ?.querySelector('[data-placement-board="true"]')
        ?.getBoundingClientRect()
      if (!boardRect) return
      const center = imageCenterInBoardRect(
        drag.startPlacement,
        imageSize,
        boardRect,
      )
      const angle = Math.atan2(
        event.clientY - center.y,
        event.clientX - center.x,
      )
      const delta = ((angle - drag.startAngle) * 180) / Math.PI
      const rotation = event.shiftKey
        ? snapDegrees(drag.startPlacement.rotation + delta, 15)
        : drag.startPlacement.rotation + delta
      onPlacementChange({
        ...drag.startPlacement,
        rotation: normalizeDegrees(rotation),
      })
      return
    }
    const boardRect = event.currentTarget.getBoundingClientRect()
    onPlacementChange({ ...drag.startPlacement,
      x: drag.startPlacement.x + (event.clientX - drag.startX) / boardRect.width,
      y: drag.startPlacement.y + (event.clientY - drag.startY) / boardRect.height,
    })
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    dragRef.current = null
    setActiveDragMode(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function recenterImage() {
    const imageHeightRatio = getImageBoardHeightRatio(
      placement,
      imageSize,
      cols,
      rows,
    )
    onPlacementChange({
      ...placement,
      x: (1 - placement.scale) / 2,
      y: (1 - imageHeightRatio) / 2,
    })
  }

  function nudgeImage(event: KeyboardEvent<HTMLDivElement>) {
    const direction =
      event.key === 'ArrowLeft'
        ? { x: -1, y: 0 }
        : event.key === 'ArrowRight'
          ? { x: 1, y: 0 }
          : event.key === 'ArrowUp'
            ? { x: 0, y: -1 }
            : event.key === 'ArrowDown'
              ? { x: 0, y: 1 }
              : null
    if (!direction) return
    event.preventDefault()
    const step = event.shiftKey ? 5 : 1
    onPlacementChange({ ...placement,
      x: placement.x + direction.x * step / cols,
      y: placement.y + direction.y * step / rows,
    })
  }

  const boardSize =
    stageSize.width > 0 && stageSize.height > 0
      ? fitWithin(cols, rows, stageSize.width - 20, stageSize.height - 20)
      : null
  const imageBoardHeight =
    imageSize && boardSize
      ? placement.scale *
        (imageSize.height / imageSize.width) *
        (boardSize.width / boardSize.height)
      : placement.scale
  const rotateHandle = rotatedImageCorner(placement, imageBoardHeight, 'ne', cols / rows)
  const scaleHandle = rotatedImageCorner(placement, imageBoardHeight, 'se', cols / rows)
  const mirrorHandle = rotatedImageCorner(placement, imageBoardHeight, 'sw', cols / rows)
  const rotationLabel = formatDegrees(placement.rotation)

  return (
    <div className="image-placement-frame relative grid gap-3 rounded-3xl bg-editor-elevated/55 p-3">
      <button type="button" aria-label="重置构图" title="重置构图" onClick={onReset} disabled={!imageSize} className="touch-hit-target absolute right-1 top-1 z-30 grid h-7 w-7 place-items-center rounded-lg bg-editor-surface/90 text-editor-text transition hover:bg-editor-accent-soft hover:text-editor-accent disabled:opacity-40"><ArrowCounterClockwise size={16}/></button>
      <div
        ref={stageRef}
        tabIndex={0}
        className="image-placement-stage relative grid h-[min(560px,58svh)] min-h-80 place-items-center overflow-visible rounded-2xl bg-editor-surface p-5 outline-none transition focus-visible:ring-2 focus-visible:ring-editor-accent/55"
        onKeyDown={nudgeImage}
      >
        {imageUrl && boardSize ? (
          <div
            className="relative"
            style={{
              width: `${boardSize.width}px`,
              height: `${boardSize.height}px`,
            }}
          >
            <div
              data-placement-board="true"
              className="absolute inset-0 overflow-hidden border-2 border-editor-accent bg-editor-strong/10"
            >
              <img
                alt=""
                className="absolute max-w-none select-none"
                draggable={false}
                src={imageUrl}
                style={{
                  left: `${placement.x * 100}%`,
                  top: `${placement.y * 100}%`,
                  width: `${placement.scale * 100}%`,
                  transform: `rotate(${placement.rotation}deg) scale(${placement.flipX ? -1 : 1}, ${
                    placement.flipY ? -1 : 1
                  })`,
                  transformOrigin: 'center',
                }}
                onLoad={(event) => {
                  const size = {
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  }
                  onImageLoad(size)
                }}
              />
              <div
                className="absolute inset-0 touch-none cursor-move"
                onDoubleClick={recenterImage}
                onPointerDown={(event) => beginDrag('move', event)}
                onPointerMove={updateDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-45 mix-blend-difference"
                  height="100%"
                  preserveAspectRatio="none"
                  viewBox={`0 0 ${cols} ${rows}`}
                  width="100%"
                >
                  {Array.from({ length: cols + 1 }).map((_, index) => (
                    <line
                      key={`v-${index}`}
                      x1={index}
                      x2={index}
                      y1={0}
                      y2={rows}
                      stroke="white"
                      strokeWidth={0.045}
                    />
                  ))}
                  {Array.from({ length: rows + 1 }).map((_, index) => (
                    <line
                      key={`h-${index}`}
                      x1={0}
                      x2={cols}
                      y1={index}
                      y2={index}
                      stroke="white"
                      strokeWidth={0.045}
                    />
                  ))}
                </svg>
                <div className="pointer-events-none absolute inset-0 border border-white/45" />
              </div>
            </div>
            <div
              className="pointer-events-none absolute z-10"
              style={{
                left: `${placement.x * 100}%`,
                top: `${placement.y * 100}%`,
                width: `${placement.scale * 100}%`,
                height: `${imageBoardHeight * 100}%`,
                backgroundImage:
                  'linear-gradient(to right, color-mix(in srgb, var(--color-editor-accent) 72%, transparent) 0 12px, transparent 12px 23px), linear-gradient(to right, color-mix(in srgb, var(--color-editor-accent) 72%, transparent) 0 12px, transparent 12px 23px), linear-gradient(to bottom, color-mix(in srgb, var(--color-editor-accent) 72%, transparent) 0 12px, transparent 12px 23px), linear-gradient(to bottom, color-mix(in srgb, var(--color-editor-accent) 72%, transparent) 0 12px, transparent 12px 23px)',
                backgroundPosition:
                  'left top, left bottom, left top, right top',
                backgroundRepeat: 'repeat-x, repeat-x, repeat-y, repeat-y',
                backgroundSize:
                  '23px 1.5px, 23px 1.5px, 1.5px 23px, 1.5px 23px',
                transform: `rotate(${placement.rotation}deg)`,
                transformOrigin: 'center',
              }}
            />
            <button
              className="touch-hit-target absolute z-20 grid h-7 w-7 touch-none place-items-center rounded-full border border-editor-strong/20 bg-white/80 text-[13px] font-black text-editor-strong shadow-[0_4px_14px_rgba(31,24,18,0.18)] backdrop-blur transition hover:bg-white active:scale-95"
              type="button"
              aria-label="缩放图片"
              title="拖拽缩放"
              style={{
                left: `calc(${scaleHandle.x * 100}% - 0.875rem)`,
                top: `calc(${scaleHandle.y * 100}% - 0.875rem)`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                beginDrag('scale', event)
              }}
              onPointerMove={updateDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              ⤢
            </button>
            <button
              className="touch-hit-target absolute z-20 grid h-7 w-7 touch-none place-items-center rounded-full border border-editor-strong/20 bg-white/80 text-[13px] font-black text-editor-strong shadow-[0_4px_14px_rgba(31,24,18,0.18)] backdrop-blur transition hover:bg-white active:scale-95"
              type="button"
              aria-label="旋转图片"
              title="拖拽旋转，按 Shift 吸附 15°"
              style={{
                left: `calc(${rotateHandle.x * 100}% - 0.875rem)`,
                top: `calc(${rotateHandle.y * 100}% - 0.875rem)`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                beginDrag('rotate', event)
              }}
              onPointerMove={updateDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              ⟳
            </button>
            {activeDragMode === 'rotate' ? (
              <span
                className="pointer-events-none absolute z-30 rounded-full border border-editor-strong/15 bg-editor-strong/85 px-2.5 py-1 font-mono text-[11px] font-black text-white shadow-[0_8px_22px_rgba(31,24,18,0.2)]"
                style={{
                  left: `calc(${rotateHandle.x * 100}% + 0.75rem)`,
                  top: `calc(${rotateHandle.y * 100}% - 2rem)`,
                }}
              >
                {rotationLabel}
              </span>
            ) : null}
            <button
              className={`touch-hit-target absolute z-20 grid h-7 w-7 place-items-center rounded-full border text-[13px] font-black shadow-[0_4px_14px_rgba(31,24,18,0.18)] backdrop-blur transition hover:bg-white active:scale-95 ${
                placement.flipX || placement.flipY
                  ? 'border-editor-accent bg-editor-accent text-white hover:bg-editor-accent'
                  : 'border-editor-strong/20 bg-white/80 text-editor-strong'
              }`}
              type="button"
              aria-label="镜像图片"
              title="点击镜像：左右 / 上下循环"
              style={{
                left: `calc(${mirrorHandle.x * 100}% - 0.875rem)`,
                top: `calc(${mirrorHandle.y * 100}% - 0.875rem)`,
              }}
              onClick={() =>
                onPlacementChange(
                  placement.flipX === placement.flipY
                    ? { ...placement, flipX: !placement.flipX }
                    : { ...placement, flipY: !placement.flipY },
                )
              }
            >
              ⇆
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-editor-elevated/55 px-4 py-5 text-center text-xs font-bold text-editor-text">
            先导入图片，再摆放到拼盘上
          </div>
        )}
      </div>
    </div>
  )
}

function ConversionSettings({
  draft,
  postprocessDisabled,
  onChange,
}: {
  draft: ConversionDraft
  postprocessDisabled: boolean
  onChange: Dispatch<SetStateAction<ConversionDraft>>
}) {
  return (
    <div className="conversion-settings grid gap-3">
      <Dropdown
        ariaLabel="配色算法"
        value={draft.algorithm}
        onChange={(value) =>
          onChange((previous) => ({
            ...previous,
            algorithm: value as ConversionAlgorithm,
          }))
        }
        options={conversionAlgorithmOptions.map((option) => ({
          value: option.value,
          label: option.label,
          hint: option.description,
        }))}
      />
      <Slider
        label="最多颜色数"
        value={draft.colorLimit}
        onChange={(colorLimit) =>
          onChange((previous) => ({ ...previous, colorLimit }))
        }
        min={1}
        max={colorLimitMax}
      />
      <div className="grid gap-3">
      <Slider
        label="合并阈值"
        value={draft.mergeThreshold}
        onChange={(mergeThreshold) =>
          onChange((previous) => ({ ...previous, mergeThreshold }))
        }
        min={0}
        max={80}
        disabled={postprocessDisabled}
      />
      <label
        className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-editor-elevated/40 px-3 py-2 transition-colors ${
          postprocessDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-editor-elevated/70'
        }`}
      >
        <span className="text-xs font-bold text-editor-text">识别背景留白</span>
        <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          role="switch"
          aria-label="识别背景留白"
          className="peer sr-only"
          disabled={postprocessDisabled}
          checked={draft.detectBackground}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              detectBackground: event.target.checked,
            }))
          }
        />
        <span className="h-6 w-11 rounded-full bg-editor-border transition-colors peer-checked:bg-editor-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-editor-accent" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none peer-checked:translate-x-5" />
        </span>
      </label></div>
    </div>
  )
}

type ColorStat = {
  color: string
  count: number
  code: string | null
}

function ColorExclusionPanel({
  stats,
  excludedColors,
  palette,
  onExclude,
  onRestore,
}: {
  stats: ColorStat[]
  excludedColors: string[]
  palette: BeadColor[]
  onExclude: (hex: string) => void
  onRestore: (hex: string) => void
}) {
  return (
    <div className="color-exclusion-panel grid gap-3">
      <div className="flex items-center justify-between text-xs text-editor-text"><span className="font-semibold">图纸用色 · {stats.length}</span><span className="text-[11px]">点击排除</span></div>
      {stats.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {stats.map((item) => (
            <button
              key={item.color}
              type="button"
              className="flex h-10 w-28 max-w-full items-center gap-2 rounded-full bg-editor-elevated/70 px-2.5 text-left text-xs text-editor-strong transition hover:bg-editor-accent-soft active:scale-[0.98]"
              title={`排除 ${item.code ?? item.color}`}
              aria-label={`排除 ${item.code ?? item.color}`}
              onClick={() => onExclude(item.color)}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="min-w-0">
                <span className="block truncate font-mono text-[11px] font-black">
                  {item.code ?? item.color}
                </span>
                <span className="block text-[10px] opacity-70">
                  {item.count} 颗
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-editor-elevated/55 px-3 py-3 text-xs font-bold text-editor-text">
          生成预览后会显示用色
        </div>
      )}
      <ExcludedColorTray
        colors={excludedColors}
        palette={palette}
        onRestore={onRestore}
      />
    </div>
  )
}

function ExcludedColorTray({
  colors,
  palette,
  onRestore,
}: {
  colors: string[]
  palette: BeadColor[]
  onRestore: (hex: string) => void
}) {
  const labels = new Map(palette.map(color => [color.hex.toLowerCase(), boxLabel(color)]))
  const colorLabel = (hex: string) => labels.get(hex.toLowerCase()) ?? hex

  if (colors.length === 0) return <div className="flex items-center justify-between text-xs text-editor-text"><span className="font-semibold">已排除颜色 · 0</span><span className="text-[11px] opacity-70">暂无</span></div>

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between text-xs text-editor-text"><h4 className="font-semibold">已排除颜色 · {colors.length}</h4><span className="text-[11px]">点击恢复</span></div>
      <div className="flex flex-wrap gap-2">
        {colors.map((hex) => (
          <button
            key={hex}
            className="flex h-8 w-24 max-w-full items-center gap-2 rounded-full bg-editor-surface px-2.5 text-left text-[11px] font-semibold text-editor-strong transition hover:bg-editor-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-editor-accent active:scale-95"
            type="button"
            onClick={() => onRestore(hex)}
            title={`恢复 ${colorLabel(hex)}`}
            aria-label={`恢复 ${colorLabel(hex)}`}
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: hex }}
            />
            <span className="min-w-0 flex-1 truncate">{colorLabel(hex)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function PreviewPane({
  pattern,
  draft,
  previewing,
  status,
  canvasSettings,
}: {
  pattern: PatternGrid | null
  draft: ConversionDraft
  previewing: boolean
  status: string
  canvasSettings: EditorStateController['canvasSettings']
}) {
  const previewCells = pattern ? Math.max(pattern.width, pattern.height) : 52
  const cellSize = Math.max(3, Math.min(10, Math.floor(520 / previewCells)))
  const width = (pattern?.width ?? draft.cols) * cellSize
  const height = (pattern?.height ?? draft.rows) * cellSize

  return (
    <aside className="image-preview-pane relative grid min-h-0 grid-rows-[minmax(0,1fr)] bg-editor-elevated/35">
      <div className="image-preview-viewport grid min-h-0 place-items-center overflow-auto p-5">
        <div className="image-preview-frame relative rounded-3xl bg-editor-surface p-4 shadow-sm">
          <canvas
            aria-label="转图预览"
            className="block max-h-[58svh] max-w-full rounded-xl border border-editor-border"
            width={width}
            height={height}
            style={{
              imageRendering: 'pixelated',
              backgroundColor: canvasSettings.paperColor,
            }}
            ref={(canvas) => {
              if (!canvas) return
              const context = canvas.getContext('2d')
              if (!context) return
              context.clearRect(0, 0, width, height)
              context.fillStyle = canvasSettings.paperColor
              context.fillRect(0, 0, width, height)
              if (!pattern) return
              pattern.cells.forEach((cell, index) => {
                if (cell.color === null || cell.isExternal) return
                const x = (index % pattern.width) * cellSize
                const y = Math.floor(index / pattern.width) * cellSize
                context.fillStyle = cell.color
                context.fillRect(x, y, cellSize, cellSize)
              })
            }}
          />
          {previewing ? (
            <span className="absolute right-6 top-6 rounded-full bg-editor-strong px-3 py-1.5 text-[11px] font-black text-white shadow-sm">
              正在更新
            </span>
          ) : null}
        </div>
      </div>
      {status.startsWith('预览失败') ? (
        <div role="alert" className="absolute bottom-2 left-2 right-2 rounded-lg bg-editor-surface p-2 text-xs text-editor-accent">
          {status}
        </div>
      ) : null}
    </aside>
  )
}

function StepCard({
  step,
  title,
  children,
}: {
  step?: string
  title?: string
  children: ReactNode
}) {
  return (
    <section className="grid min-h-0 gap-4">
      {title ? (
        <div className="flex items-center gap-2">
          {step ? (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-editor-accent text-[12px] font-black text-white">
              {step}
            </span>
          ) : null}
          <h3 className="text-lg font-black text-editor-strong">{title}</h3>
        </div>
      ) : null}
      <div className="grid min-h-0 gap-3">{children}</div>
    </section>
  )
}

function buildColorStats(
  pattern: PatternGrid | null,
  editor: EditorStateController,
): ColorStat[] {
  if (!pattern) return []
  const counts = new Map<string, number>()
  pattern.cells.forEach((cell) => {
    if (cell.isExternal || cell.color === null) return
    counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1)
  })
  const codeByHex = new Map<string, string | null>()
  editor.palette.forEach((color) => {
    codeByHex.set(
      color.hex.toLowerCase(),
      boxLabel(color),
    )
  })
  return [...counts.entries()]
    .map(([color, count]) => ({
      color,
      count,
      code: codeByHex.get(color.toLowerCase()) ?? null,
    }))
    .sort((left, right) => right.count - left.count)
}

function fitWithin(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
) {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight)
  return {
    width: Math.max(1, Math.floor(sourceWidth * scale)),
    height: Math.max(1, Math.floor(sourceHeight * scale)),
  }
}

function fitImageToBoard(
  imageSize: { width: number; height: number },
  boardCols: number,
  boardRows: number,
  mode: 'contain' | 'cover',
): ImagePlacement {
  const boardRatio = boardCols / boardRows
  const imageRatio = imageSize.width / imageSize.height
  const scale =
    mode === 'contain'
      ? imageRatio >= boardRatio
        ? 1
        : imageRatio / boardRatio
      : imageRatio >= boardRatio
        ? imageRatio / boardRatio
        : 1
  const drawnHeight = scale * (imageSize.height / imageSize.width) * boardRatio
  return {
    x: (1 - scale) / 2,
    y: (1 - drawnHeight) / 2,
    scale,
    rotation: 0,
    flipX: false,
    flipY: false,
  }
}

function imageCenterInBoardRect(
  placement: ImagePlacement,
  imageSize: { width: number; height: number } | null,
  boardRect: DOMRect,
) {
  const imageHeightRatio = imageSize
    ? placement.scale *
      (imageSize.height / imageSize.width) *
      (boardRect.width / boardRect.height)
    : placement.scale
  return {
    x: boardRect.left + (placement.x + placement.scale / 2) * boardRect.width,
    y: boardRect.top + (placement.y + imageHeightRatio / 2) * boardRect.height,
  }
}

function getImageBoardHeightRatio(
  placement: ImagePlacement,
  imageSize: { width: number; height: number } | null,
  boardCols: number,
  boardRows: number,
) {
  return imageSize
    ? placement.scale *
        (imageSize.height / imageSize.width) *
        (boardCols / boardRows)
    : placement.scale
}

function rotatedImageCorner(
  placement: ImagePlacement,
  imageHeightRatio: number,
  corner: 'nw' | 'ne' | 'se' | 'sw',
  boardAspect: number,
) {
  const center = {
    x: placement.x + placement.scale / 2,
    y: placement.y + imageHeightRatio / 2,
  }
  const point =
    corner === 'nw'
      ? { x: placement.x, y: placement.y }
      : corner === 'ne'
        ? { x: placement.x + placement.scale, y: placement.y }
        : corner === 'se'
          ? {
              x: placement.x + placement.scale,
              y: placement.y + imageHeightRatio,
            }
          : { x: placement.x, y: placement.y + imageHeightRatio }
  const radians = (placement.rotation * Math.PI) / 180
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * Math.cos(radians) - dy / boardAspect * Math.sin(radians),
    y: center.y + dx * boardAspect * Math.sin(radians) + dy * Math.cos(radians),
  }
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360
}


function snapDegrees(value: number, step: number) {
  return Math.round(value / step) * step
}

function formatDegrees(value: number) {
  const rounded = Math.round(normalizeDegrees(value))
  return `${rounded}°`
}
