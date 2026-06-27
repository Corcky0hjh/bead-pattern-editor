import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { getDisplayCode } from '../../../core/color'
import {
  conversionAlgorithmOptions,
  type ConversionAlgorithm,
  type ImageFitMode,
  type ImagePlacement,
} from '../../../core/image/conversion'
import type { PatternGrid } from '../../../core/pattern/grid'
import { Dropdown } from '../../../components/Dropdown'
import { Slider } from '../../../components/Slider'
import {
  remapPatternColors,
  type EditorStateController,
  type ImageConversionOptions,
} from '../useEditorState'
import { BrandPicker, PaletteManagerModal } from './ColorPanel'

type ImagePanelProps = {
  editor: EditorStateController
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

const boardSizeMin = 16
const boardSizeMax = 2048
const colorLimitDefault = 32
const colorLimitMax = 128
const boardSizePresets = [
  { label: 'regular-1x1', cols: 29, rows: 29, name: '常规 1 板' },
  { label: 'regular-2x1', cols: 58, rows: 29, name: '常规 2 横' },
  { label: 'regular-1x2', cols: 29, rows: 58, name: '常规 2 竖' },
  { label: 'regular-2x2', cols: 58, rows: 58, name: '常规 2 × 2' },
  { label: 'mini-1x1', cols: 52, rows: 52, name: 'Mini 1 板' },
  { label: 'mini-2x1', cols: 104, rows: 52, name: 'Mini 2 横' },
  { label: 'mini-1x2', cols: 52, rows: 104, name: 'Mini 2 竖' },
  { label: 'mini-2x2', cols: 104, rows: 104, name: 'Mini 2 × 2' },
]

export function ImagePanel({ editor }: ImagePanelProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)

  return (
    <div className="grid gap-3">
      <label
        className="group grid min-h-24 cursor-pointer gap-2 rounded-3xl border border-editor-border bg-editor-elevated/70 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-editor-elevated hover:shadow-sm active:translate-y-0"
      >
        <input
          className="hidden"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null
            event.target.value = ''
            if (!nextFile) return
            setImportFile(nextFile)
            setImportOpen(true)
          }}
        />
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-black text-editor-strong">
            选择图片生成图纸
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-editor-accent text-lg font-black text-white transition group-hover:scale-105">
            +
          </span>
        </span>
        <span className="text-xs leading-5 text-editor-text">
          选图后直接进入构图和转色预览
        </span>
      </label>

      {importOpen ? (
        <ImageImportModal
          editor={editor}
          initialFile={importFile}
          onClose={() => {
            setImportOpen(false)
            setImportFile(null)
          }}
        />
      ) : null}
    </div>
  )
}

function ImageImportModal({
  editor,
  initialFile,
  onClose,
}: {
  editor: EditorStateController
  initialFile: File | null
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(initialFile)
  const [activeStep, setActiveStep] = useState<WorkbenchStepId>(1)
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<WorkbenchStepId>(1)
  const [paletteModalOpen, setPaletteModalOpen] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewStatus, setPreviewStatus] = useState('先导入图片')
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
  const canGenerate = Boolean(file) && editor.availablePalette.length > 0
  const postprocessDisabled = draft.algorithm === 'atkinson'
  const paletteCountText = `${editor.availablePalette.length} / ${editor.palette.length}`
  const previewStats = useMemo(
    () => buildColorStats(previewPattern, editor),
    [editor, previewPattern],
  )
  useEffect(() => {
    if (!file) {
      setImageUrl(null)
      setImageSize(null)
      setBasePattern(null)
      setPreviewPattern(null)
      setExcludedColors(new Set())
      setPlacement({
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        flipX: false,
        flipY: false,
      })
      setPreviewStatus('先导入图片')
      return
    }

    const nextUrl = URL.createObjectURL(file)
    setImageUrl(nextUrl)
    setImageSize(null)
    setBasePattern(null)
    setPreviewPattern(null)
    setExcludedColors(new Set())
    setPlacement({
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      flipX: false,
      flipY: false,
    })
    setPreviewStatus('准备生成预览')
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])

  useEffect(() => {
    if (!imageSize) return
    setPlacement(fitImageToBoard(imageSize, draft.cols, draft.rows, 'contain'))
  }, [draft.cols, draft.rows, imageSize])

  useEffect(() => {
    if (!file || !canGenerate || activeStep < 2) return
    const timer = window.setTimeout(() => {
      void generatePreview(file)
    }, 360)
    return () => window.clearTimeout(timer)
  }, [activeStep, canGenerate, conversionOptions, editor.currentBrand, file])

  async function generatePreview(sourceFile = file) {
    if (!sourceFile) return
    setPreviewing(true)
    setPreviewStatus('正在生成预览...')
    try {
      const nextBase = await editor.generateImagePattern(
        sourceFile,
        conversionOptions,
      )
      const remapped = remapPatternColors(nextBase, excludedColors)
      setBasePattern(nextBase)
      setExcludedColors(remapped.applied)
      setPreviewPattern(remapped.pattern)
      setPreviewStatus(
        `预览 ${nextBase.width} × ${nextBase.height}，${buildColorStats(remapped.pattern, editor).length} 色`,
      )
    } catch (error) {
      console.error('[ImageImportModal] preview failed:', error)
      const message = error instanceof Error ? error.message : String(error)
      setPreviewStatus(`预览失败：${message}`)
    } finally {
      setPreviewing(false)
    }
  }

  function applyExcluded(nextExcluded: Set<string>) {
    if (!basePattern) return
    const remapped = remapPatternColors(basePattern, nextExcluded)
    if (remapped.applied.size !== nextExcluded.size) {
      setPreviewStatus('部分颜色无法排除：没有其他已用颜色可替代')
    }
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
      void generatePreview(file)
      return
    }
    if (activeStep === 2 && previewPattern) {
      unlockStep(3)
      return
    }
  }

  function applyToEditor() {
    if (!previewPattern) return
    editor.applyImagePattern(previewPattern, conversionOptions, {
      file,
      excludedColors,
      status: `已应用 ${previewPattern.width} × ${previewPattern.height} 图纸`,
    })
    onClose()
  }

  const canContinue =
    activeStep === 1
      ? Boolean(file)
      : activeStep < 3
        ? Boolean(previewPattern)
        : false

  return (
    <div
      className="fixed inset-0 z-[65] grid place-items-center bg-editor-strong/30 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="源图转图纸"
    >
      <div className="grid max-h-[min(920px,94svh)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[28px] border border-editor-border bg-editor-surface shadow-[0_24px_80px_rgba(31,24,18,0.26)]">
        <header className="flex items-start justify-between gap-4 border-b border-editor-border px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-editor-strong">
              源图转图纸
            </h2>
            <p className="mt-1 text-xs leading-5 text-editor-text">
              构图阶段只看原图，确认后再生成拼豆预览
            </p>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-full bg-editor-surface-soft text-lg font-black text-editor-strong transition hover:bg-editor-elevated active:scale-95"
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        <div className="grid min-h-0 overflow-hidden lg:grid-cols-[minmax(360px,0.86fr)_minmax(0,1.14fr)]">
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] border-r border-editor-border">
            <Stepper
              activeStep={activeStep}
              maxUnlockedStep={maxUnlockedStep}
              onSelect={setActiveStep}
            />

            <div className="min-h-0 overflow-auto px-5 py-4">
              {activeStep === 1 ? (
                <StepCard>
                  <UploadDropzone file={file} compact onFileChange={setFile} />
                  <BoardSizeControls draft={draft} onChange={setDraft} />
                  <ImagePlacementControls
                    cols={draft.cols}
                    imageSize={imageSize}
                    imageUrl={imageUrl}
                    placement={placement}
                    rows={draft.rows}
                    onPlacementChange={setPlacement}
                  />
                </StepCard>
              ) : null}

              {activeStep === 2 ? (
                <StepCard>
                  <BrandPicker
                    currentBrand={editor.currentBrand}
                    onChange={editor.setCurrentBrand}
                  />
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-editor-elevated/60 px-3 py-2">
                    <span className="text-xs font-bold text-editor-text">
                      当前可用色
                    </span>
                    <span className="font-mono text-sm font-black text-editor-strong">
                      {paletteCountText}
                    </span>
                    <button
                      className="ml-auto rounded-full bg-editor-accent px-3 py-1.5 text-xs font-black text-white transition hover:brightness-105 active:scale-95"
                      type="button"
                      onClick={() => setPaletteModalOpen(true)}
                    >
                      管理
                    </button>
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
                    stats={previewStats}
                    onExclude={excludeColor}
                    onRestore={restoreColor}
                    onRestoreAll={() => applyExcluded(new Set())}
                  />
                </StepCard>
              ) : null}

            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-editor-border px-5 py-4">
              <button
                className="h-10 rounded-full bg-editor-elevated px-4 text-sm font-black text-editor-strong transition hover:bg-editor-surface-soft active:scale-95"
                type="button"
                onClick={onClose}
              >
                取消
              </button>
              <div className="ml-auto flex flex-wrap gap-2">
                {activeStep > 1 ? (
                  <button
                    className="h-10 rounded-full bg-editor-elevated px-4 text-sm font-black text-editor-strong transition hover:bg-editor-surface-soft active:scale-95"
                    type="button"
                    onClick={() =>
                      setActiveStep((activeStep - 1) as WorkbenchStepId)
                    }
                  >
                    上一步
                  </button>
                ) : null}
                {activeStep < 3 ? (
                  <button
                    className="h-10 rounded-full bg-editor-accent px-5 text-sm font-black text-white transition hover:brightness-105 active:scale-95 disabled:opacity-40"
                    type="button"
                    disabled={!canContinue}
                    onClick={continueStep}
                  >
                    继续
                  </button>
                ) : (
                  <button
                    className="h-10 rounded-full bg-editor-accent px-5 text-sm font-black text-white transition hover:brightness-105 active:scale-95 disabled:opacity-40"
                    type="button"
                    disabled={!previewPattern}
                    onClick={applyToEditor}
                  >
                    应用到编辑
                  </button>
                )}
              </div>
            </footer>
          </section>

          {activeStep === 1 ? (
            <aside className="min-h-0 bg-editor-elevated/35 p-5">
              <PlacementStage
                cols={draft.cols}
                imageSize={imageSize}
                imageUrl={imageUrl}
                placement={placement}
                rows={draft.rows}
                onImageLoad={setImageSize}
                onPlacementChange={setPlacement}
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

        {paletteModalOpen ? (
          <PaletteManagerModal
            editor={editor}
            onClose={() => setPaletteModalOpen(false)}
          />
        ) : null}
      </div>
    </div>
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
    <div className="grid gap-2 border-b border-editor-border px-5 py-4">
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step) => {
          const unlocked = step.id <= maxUnlockedStep
          const active = step.id === activeStep
          return (
            <button
              key={step.id}
              className={`grid min-h-14 gap-1 rounded-2xl px-2 py-2 text-left transition ${
                active
                  ? 'bg-editor-accent text-white shadow-sm'
                  : unlocked
                    ? 'bg-editor-elevated/70 text-editor-strong hover:bg-editor-elevated'
                    : 'bg-editor-surface-soft text-editor-text/35'
              }`}
              type="button"
              disabled={!unlocked}
              onClick={() => onSelect(step.id)}
            >
              <span className="font-mono text-[11px] font-black">
                {String(step.id).padStart(2, '0')}
              </span>
              <span className="truncate text-[11px] font-black">
                {step.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function UploadDropzone({
  file,
  onFileChange,
  compact = false,
}: {
  file: File | null
  onFileChange: (file: File | null) => void
  compact?: boolean
}) {
  return (
    <label
      className={`relative grid cursor-pointer place-items-center overflow-hidden rounded-3xl border border-dashed border-editor-border bg-editor-elevated/55 px-4 text-center transition hover:bg-editor-elevated ${
        compact ? 'min-h-16 py-3' : 'min-h-52 py-8'
      }`}
    >
      <input
        className="absolute inset-0 cursor-pointer opacity-0"
        type="file"
        accept="image/*"
        onChange={(event) => {
          onFileChange(event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
      />
      <span className="grid justify-items-center gap-1">
        <span className="text-sm font-black text-editor-strong">
          {file ? file.name : '选择图片'}
        </span>
        <span className="text-xs text-editor-text">
          {compact ? '重新选择图片' : 'PNG / JPG / WebP，支持透明图片'}
        </span>
      </span>
    </label>
  )
}

function BoardSizeControls({
  draft,
  onChange,
}: {
  draft: ConversionDraft
  onChange: Dispatch<SetStateAction<ConversionDraft>>
}) {
  return (
    <div className="grid gap-3 rounded-3xl bg-editor-elevated/55 p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-black text-editor-text">拼盘尺寸</h4>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="宽"
          value={draft.cols}
          onChange={(cols) => onChange((previous) => ({ ...previous, cols }))}
        />
        <NumberField
          label="高"
          value={draft.rows}
          onChange={(rows) => onChange((previous) => ({ ...previous, rows }))}
        />
      </div>
      <Dropdown
        ariaLabel="预设尺寸"
        value={getBoardPresetValue(draft.cols, draft.rows)}
        onChange={(value) => {
          const preset = boardSizePresets.find((item) => item.label === value)
          if (!preset) return
          onChange((previous) => ({
            ...previous,
            cols: preset.cols,
            rows: preset.rows,
          }))
        }}
        options={[
          { value: '', label: '自定义', hint: '使用上方宽高' },
          ...boardSizePresets.map((preset) => ({
            value: preset.label,
            label: `${preset.name} · ${preset.cols} × ${preset.rows}`,
          })),
        ]}
      />
    </div>
  )
}

function ImagePlacementControls({
  cols,
  imageUrl,
  imageSize,
  placement,
  rows,
  onPlacementChange,
}: {
  cols: number
  imageUrl: string | null
  imageSize: { width: number; height: number } | null
  placement: ImagePlacement
  rows: number
  onPlacementChange: (placement: ImagePlacement) => void
}) {
  function applyFit(mode: 'contain' | 'cover') {
    if (!imageSize) return
    onPlacementChange({
      ...fitImageToBoard(imageSize, cols, rows, mode),
      rotation: placement.rotation,
      flipX: placement.flipX,
      flipY: placement.flipY,
    })
  }

  return (
    <div className="grid gap-3 rounded-3xl bg-editor-elevated/55 p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-black text-editor-text">图片摆放</h4>
        {imageSize ? (
          <span className="rounded-full bg-editor-surface px-2.5 py-1 font-mono text-[11px] font-black text-editor-strong">
            {imageSize.width} × {imageSize.height}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="rounded-full bg-editor-surface px-3 py-1.5 text-xs font-black text-editor-strong transition hover:bg-editor-surface-soft active:scale-95 disabled:opacity-40"
          type="button"
          disabled={!imageUrl}
          onClick={() => applyFit('contain')}
        >
          完整放入
        </button>
        <button
          className="rounded-full bg-editor-surface px-3 py-1.5 text-xs font-black text-editor-strong transition hover:bg-editor-surface-soft active:scale-95 disabled:opacity-40"
          type="button"
          disabled={!imageUrl}
          onClick={() => applyFit('cover')}
        >
          铺满拼盘
        </button>
      </div>
    </div>
  )
}

function PlacementStage({
  cols,
  imageUrl,
  imageSize,
  placement,
  rows,
  onImageLoad,
  onPlacementChange,
}: {
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
        'nw',
      )
      const startHandle = rotatedImageCorner(
        drag.startPlacement,
        imageHeightRatio,
        'se',
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
      onPlacementChange({
        ...drag.startPlacement,
        scale: Math.max(0.05, Math.min(6, drag.startPlacement.scale * ratio)),
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
    const stageRect = stageRef.current?.getBoundingClientRect()
    const stageBounds = stageRect
      ? getBoundsInBoardRect(stageRect, boardRect)
      : { minX: 0, maxX: 1, minY: 0, maxY: 1 }
    const nextImageHeightRatio = getImageBoardHeightRatio(
      drag.startPlacement,
      imageSize,
      cols,
      rows,
    )
    onPlacementChange({
      ...drag.startPlacement,
      x: clampPlacementAxisToBounds(
        drag.startPlacement.x + (event.clientX - drag.startX) / boardRect.width,
        drag.startPlacement.scale,
        stageBounds.minX,
        stageBounds.maxX,
      ),
      y: clampPlacementAxisToBounds(
        drag.startPlacement.y + (event.clientY - drag.startY) / boardRect.height,
        nextImageHeightRatio,
        stageBounds.minY,
        stageBounds.maxY,
      ),
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
    const nextImageHeightRatio = getImageBoardHeightRatio(
      placement,
      imageSize,
      cols,
      rows,
    )
    const stageRect = stageRef.current?.getBoundingClientRect()
    const boardRect = stageRef.current
      ?.querySelector('[data-placement-board="true"]')
      ?.getBoundingClientRect()
    const stageBounds =
      stageRect && boardRect
        ? getBoundsInBoardRect(stageRect, boardRect)
        : { minX: 0, maxX: 1, minY: 0, maxY: 1 }
    onPlacementChange({
      ...placement,
      x: clampPlacementAxisToBounds(
        placement.x + (direction.x * step) / cols,
        placement.scale,
        stageBounds.minX,
        stageBounds.maxX,
      ),
      y: clampPlacementAxisToBounds(
        placement.y + (direction.y * step) / rows,
        nextImageHeightRatio,
        stageBounds.minY,
        stageBounds.maxY,
      ),
    })
  }

  const boardSize =
    stageSize.width > 0 && stageSize.height > 0
      ? fitWithin(cols, rows, stageSize.width - 24, stageSize.height - 24)
      : null
  const imageBoardHeight =
    imageSize && boardSize
      ? placement.scale *
        (imageSize.height / imageSize.width) *
        (boardSize.width / boardSize.height)
      : placement.scale
  const rotateHandle = rotatedImageCorner(placement, imageBoardHeight, 'ne')
  const scaleHandle = rotatedImageCorner(placement, imageBoardHeight, 'se')
  const mirrorHandle = rotatedImageCorner(placement, imageBoardHeight, 'sw')
  const rotationLabel = formatDegrees(placement.rotation)

  return (
    <div className="grid gap-3 rounded-3xl bg-editor-elevated/55 p-3">
      <div
        ref={stageRef}
        tabIndex={0}
        className="relative grid h-[min(560px,58svh)] min-h-80 place-items-center overflow-visible rounded-2xl bg-editor-surface p-5 outline-none transition focus-visible:ring-2 focus-visible:ring-editor-accent/55"
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
                className="absolute inset-0 cursor-move"
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
              className="absolute z-20 grid h-7 w-7 touch-none place-items-center rounded-full border border-editor-strong/20 bg-white/80 text-[13px] font-black text-editor-strong shadow-[0_4px_14px_rgba(31,24,18,0.18)] backdrop-blur transition hover:bg-white active:scale-95"
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
              className="absolute z-20 grid h-7 w-7 touch-none place-items-center rounded-full border border-editor-strong/20 bg-white/80 text-[13px] font-black text-editor-strong shadow-[0_4px_14px_rgba(31,24,18,0.18)] backdrop-blur transition hover:bg-white active:scale-95"
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
              className={`absolute z-20 grid h-7 w-7 place-items-center rounded-full border text-[13px] font-black shadow-[0_4px_14px_rgba(31,24,18,0.18)] backdrop-blur transition hover:bg-white active:scale-95 ${
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
    <div className="grid gap-3 rounded-3xl bg-editor-elevated/55 p-3">
      <h4 className="text-xs font-black text-editor-text">转换细节</h4>
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
        hint="超出会合并到最近色"
        value={draft.colorLimit}
        onChange={(colorLimit) =>
          onChange((previous) => ({ ...previous, colorLimit }))
        }
        min={1}
        max={colorLimitMax}
      />
      <Slider
        label="合并阈值"
        hint="0=关闭"
        value={draft.mergeThreshold}
        onChange={(mergeThreshold) =>
          onChange((previous) => ({ ...previous, mergeThreshold }))
        }
        min={0}
        max={80}
        disabled={postprocessDisabled}
      />
      <label
        className={`flex items-center gap-2 ${
          postprocessDisabled ? 'opacity-40' : ''
        }`}
      >
        <input
          type="checkbox"
          className="accent-editor-accent"
          disabled={postprocessDisabled}
          checked={draft.detectBackground}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              detectBackground: event.target.checked,
            }))
          }
        />
        <span className="text-xs font-bold text-editor-text">识别背景留白</span>
      </label>
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
  onExclude,
  onRestore,
  onRestoreAll,
}: {
  stats: ColorStat[]
  excludedColors: string[]
  onExclude: (hex: string) => void
  onRestore: (hex: string) => void
  onRestoreAll: () => void
}) {
  return (
    <div className="grid gap-3">
      {stats.length > 0 ? (
        <div className="grid max-h-[38svh] grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-2 overflow-auto pr-1">
          {stats.map((item) => (
            <button
              key={item.color}
              type="button"
              className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl bg-editor-elevated/70 px-2 py-2 text-left text-xs text-editor-strong transition hover:bg-editor-elevated active:scale-[0.98]"
              onClick={() => onExclude(item.color)}
            >
              <span
                className="h-7 w-7 rounded-full border-2 border-white shadow-sm"
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
              <span className="rounded-full bg-editor-surface px-2 py-1 text-[10px] font-black">
                排除
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
        onRestore={onRestore}
        onRestoreAll={onRestoreAll}
      />
    </div>
  )
}

function ExcludedColorTray({
  colors,
  onRestore,
  onRestoreAll,
}: {
  colors: string[]
  onRestore: (hex: string) => void
  onRestoreAll: () => void
}) {
  if (colors.length === 0) {
    return (
      <section className="grid gap-2 rounded-3xl bg-editor-elevated/40 p-3">
        <h4 className="text-xs font-black text-editor-text">已排除颜色</h4>
        <p className="rounded-2xl bg-editor-surface px-3 py-3 text-xs font-bold text-editor-text/70">
          还没有排除颜色
        </p>
      </section>
    )
  }

  return (
    <section className="grid gap-2 rounded-3xl bg-editor-elevated/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-black text-editor-text">已排除颜色</h4>
        <button
          className="rounded-full bg-editor-surface px-3 py-1.5 text-[11px] font-black text-editor-strong transition hover:bg-editor-surface-soft active:scale-95"
          type="button"
          onClick={onRestoreAll}
        >
          全部恢复
        </button>
      </div>
      <div className="flex max-h-28 flex-wrap gap-2 overflow-auto pr-1">
        {colors.map((hex) => (
          <button
            key={hex}
            className="flex items-center gap-1.5 rounded-full bg-editor-surface px-2 py-1.5 text-[11px] font-black text-editor-strong transition hover:bg-editor-surface-soft active:scale-95"
            type="button"
            onClick={() => onRestore(hex)}
            title="恢复这个颜色"
          >
            <span
              className="h-4 w-4 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: hex }}
            />
            <span className="font-mono">{hex}</span>
            <span className="text-editor-text/65">恢复</span>
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
    <aside className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-editor-elevated/35">
      <div className="grid min-h-0 place-items-center overflow-auto p-5">
        <div className="relative rounded-3xl bg-editor-surface p-4 shadow-sm">
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
      {status ? (
        <div className="border-t border-editor-border px-5 py-3 text-xs font-bold leading-5 text-editor-text">
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
      getDisplayCode(color, editor.currentBrand),
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
    x: center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: center.y + dx * Math.sin(radians) + dy * Math.cos(radians),
  }
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getBoundsInBoardRect(stageRect: DOMRect, boardRect: DOMRect) {
  return {
    minX: (stageRect.left - boardRect.left) / boardRect.width,
    maxX: (stageRect.right - boardRect.left) / boardRect.width,
    minY: (stageRect.top - boardRect.top) / boardRect.height,
    maxY: (stageRect.bottom - boardRect.top) / boardRect.height,
  }
}

function clampPlacementAxisToBounds(
  value: number,
  size: number,
  minBound: number,
  maxBound: number,
) {
  const lower = Math.min(minBound, maxBound - size)
  const upper = Math.max(minBound, maxBound - size)
  return clamp(value, lower, upper)
}

function getBoardPresetValue(cols: number, rows: number) {
  return (
    boardSizePresets.find((preset) => preset.cols === cols && preset.rows === rows)
      ?.label ?? ''
  )
}

function snapDegrees(value: number, step: number) {
  return Math.round(value / step) * step
}

function formatDegrees(value: number) {
  const rounded = Math.round(normalizeDegrees(value))
  return `${rounded}°`
}

function NumberField(props: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return <NumberInput {...props} min={boardSizeMin} max={boardSizeMax} />
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  function commit(next: number) {
    if (Number.isNaN(next)) return
    onChange(clamp(Math.round(next), min, max))
  }

  return (
    <label className="group flex h-11 min-w-0 items-center gap-2 rounded-2xl border border-editor-border bg-editor-elevated/70 px-3 outline-none transition-without-transform focus-within:border-editor-accent hover:bg-editor-elevated">
      <span className="shrink-0 text-xs font-black text-editor-text">
        {label}
      </span>
      <input
        className="number-input-clean min-w-0 flex-1 bg-transparent text-right font-mono text-sm font-black text-editor-strong outline-none"
        type="number"
        min={min}
        max={max}
        value={value}
        onBlur={(event) => commit(Number(event.target.value))}
        onChange={(event) => commit(Number(event.target.value))}
      />
    </label>
  )
}
