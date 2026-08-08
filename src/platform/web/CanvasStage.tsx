import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsOutCardinal,
  BoundingBox,
  Broom,
  Circle,
  Copy,
  Crosshair,
  DotsSixVertical,
  Eyedropper,
  Eraser,
  GearSix,
  FlipHorizontal,
  FlipVertical,
  Hand,
  Minus,
  LineSegment,
  PaintBrush,
  PaintBucket,
  Plus,
  Rectangle,
  Shapes,
  Square,
  SquareHalf,
  Trash,
  Scribble,
  Selection,
  SelectionSlash,
  SquaresFour,
  type IconProps,
} from '@phosphor-icons/react'
import interact from 'interactjs'
import {
  clampToolbarPosition,
  getElementContentBounds,
  getToolbarDockEdge,
  measureToolbarNaturalExtent,
} from './toolbarDrag'
import {
  getAnchoredViewPosition,
  getCenteredViewPosition,
  getFitZoom,
  normalizeWheelDelta,
} from './viewportCamera'
import { ToolButton, type ToolButtonIcon } from '../../components/ToolButton'
import type {
  EditorStateController,
  EditorTool,
  EraserMode,
  FillMode,
  SelectionLayerCell,
  SelectionRect,
  ShapeKind,
  ShapeStyle,
  SymmetryMode,
} from '../../features/editor/useEditorState'
import { getShapeCellIndexes } from '../../features/editor/useEditorState'

type CanvasStageProps = {
  editor: EditorStateController
  onOpenSettings: () => void
}

type StageTool = { value: EditorTool; label: string; icon: ToolButtonIcon }
type SelectionMode = 'select' | 'move'
type ToolbarPlacement = 'top' | 'right' | 'bottom' | 'left' | 'floating'
type ToolbarDockPlacement = Exclude<ToolbarPlacement, 'floating'>
type ToolbarOrientation = 'horizontal' | 'vertical'
type ToolbarLayout = {
  placement: ToolbarPlacement
  orientation: ToolbarOrientation
  x: number
  y: number
}
type ToolbarDragSession = {
  id: number
  origin: ToolbarLayout
  offsetX: number
  offsetY: number
  pointerClientX: number
  pointerClientY: number
  width: number
  height: number
  x: number
  y: number
  candidate: ToolbarDockPlacement | null
  candidateEnteredAt: number | null
  dockTarget: ToolbarDockPlacement | null
  animatePlaceholder: boolean
  hasLeftOrigin: boolean
}
type FloatingSelection = {
  kind: 'move' | 'copy'
  source: SelectionRect
  cells: SelectionLayerCell[]
  pivotX2: number
  pivotY2: number
}

const toolbarLayoutStorageKey = 'bead-pattern-editor-toolbar-layout'

const eraserModeOptions: Array<{
  value: EraserMode
  label: string
  icon: ToolButtonIcon
}> = [
  { value: 'brush', label: '笔刷擦除', icon: Eraser },
  { value: 'region', label: '删除连续色块', icon: SquaresFour },
]

function getInitialToolbarLayout(): ToolbarLayout {
  try {
    const saved = localStorage.getItem(toolbarLayoutStorageKey)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<ToolbarLayout>
      if (
        parsed.placement === 'top' ||
        parsed.placement === 'right' ||
        parsed.placement === 'bottom' ||
        parsed.placement === 'left' ||
        parsed.placement === 'floating'
      ) {
        return {
          placement: parsed.placement,
          orientation:
            parsed.placement === 'left' || parsed.placement === 'right'
              ? 'vertical'
              : parsed.placement === 'top' || parsed.placement === 'bottom'
                ? 'horizontal'
                : parsed.orientation === 'vertical'
                  ? 'vertical'
                  : 'horizontal',
          x:
            typeof parsed.x === 'number' && Number.isFinite(parsed.x)
              ? parsed.x
              : 16,
          y:
            typeof parsed.y === 'number' && Number.isFinite(parsed.y)
              ? parsed.y
              : 16,
        }
      }
    }
  } catch {
    // Ignore invalid persisted toolbar layout.
  }
  return {
    placement: 'top',
    orientation: 'horizontal',
    x: 16,
    y: 16,
  }
}

const stageTools: StageTool[] = [
  { value: 'pan', label: '移动', icon: Hand },
  { value: 'select', label: '框选', icon: BoundingBox },
  { value: 'brush', label: '画笔', icon: PaintBrush },
  { value: 'eraser', label: '橡皮', icon: Eraser },
  { value: 'fill', label: '填充', icon: PaintBucket },
  { value: 'shape', label: '形状', icon: Shapes },
]

const sizeOptions = [1, 2, 3, 4, 5]
const toolsWithOptions = new Set<EditorTool>([
  'select',
  'brush',
  'eraser',
  'fill',
  'shape',
])
const toolbarButtonInteractionClass =
  'border border-transparent transition duration-150 hover:scale-[1.02] active:scale-95'
const toolbarSystemButtonInteractionClass =
  'border border-transparent transition duration-150 active:scale-95'
const toolbarButtonIdleClass =
  'bg-editor-surface-soft text-editor-strong hover:border-editor-accent/25 hover:bg-editor-elevated'
const symmetryOptions: Array<{
  value: SymmetryMode
  label: string
  icon: ToolButtonIcon
}> = [
  { value: 'off', label: '正常', icon: Scribble },
  { value: 'vertical', label: '左右对称', icon: FlipHorizontal },
  { value: 'horizontal', label: '上下对称', icon: FlipVertical },
  { value: 'both', label: '双轴对称', icon: SymmetryBothIcon },
  { value: 'center', label: '中心对称', icon: SymmetryCenterIcon },
]
const fillModeOptions: Array<{
  value: FillMode
  label: string
  icon: ToolButtonIcon
}> = [
  { value: 'region', label: '填充区域', icon: Selection },
  { value: 'global', label: '替换颜色', icon: SquaresFour },
]
const selectionModeOptions: Array<{
  value: SelectionMode
  label: string
  icon: ToolButtonIcon
}> = [
  { value: 'select', label: '选择', icon: Selection },
  { value: 'move', label: '移动内容', icon: ArrowsOutCardinal },
]
const shapeKindOptions: Array<{
  value: ShapeKind
  label: string
  icon: ToolButtonIcon
}> = [
  { value: 'line', label: '直线', icon: LineSegment },
  { value: 'rectangle', label: '矩形', icon: Rectangle },
  { value: 'ellipse', label: '圆形', icon: Circle },
]
const shapeStyleOptions: Array<{
  value: ShapeStyle
  label: string
  icon: ToolButtonIcon
}> = [
  { value: 'outline', label: '空心', icon: Square },
  { value: 'filled', label: '实心', icon: SquareHalf },
]

function getSymmetryIcon(mode: SymmetryMode | null): ToolButtonIcon | null {
  return symmetryOptions.find((option) => option.value === mode)?.icon ?? null
}

function getFillModeIcon(mode: FillMode): ToolButtonIcon {
  return fillModeOptions.find((option) => option.value === mode)!.icon
}

function getSelectionModeIcon(mode: SelectionMode): ToolButtonIcon {
  return selectionModeOptions.find((option) => option.value === mode)!.icon
}

function getShapeKindIcon(kind: ShapeKind): ToolButtonIcon {
  return (
    shapeKindOptions.find((option) => option.value === kind)?.icon ??
    LineSegment
  )
}

function getShapeStyleIcon(style: ShapeStyle): ToolButtonIcon {
  return (
    shapeStyleOptions.find((option) => option.value === style)?.icon ?? Square
  )
}
const semanticCellSize = 10
const maxCanvasBitmapSide = 2048
const minViewportZoom = 5
const maxViewportZoom = 500
const worldPaddingAt100 = 32
const toolbarDragPuckSize = 56
type PaintChunkCanvasCacheEntry = {
  token: object
  key: string
  canvas: HTMLCanvasElement
  bytes: number
}

const maxPaintChunkCanvasCacheBytes = 32 * 1024 * 1024
const paintChunkCanvasCache = new Map<
  object,
  Map<string, PaintChunkCanvasCacheEntry>
>()
const paintChunkCanvasLru = new Map<PaintChunkCanvasCacheEntry, true>()
let paintChunkCanvasCacheBytes = 0

function touchPaintChunkCanvas(entry: PaintChunkCanvasCacheEntry) {
  paintChunkCanvasLru.delete(entry)
  paintChunkCanvasLru.set(entry, true)
}

function cachePaintChunkCanvas(entry: PaintChunkCanvasCacheEntry) {
  const tokenCache =
    paintChunkCanvasCache.get(entry.token) ??
    new Map<string, PaintChunkCanvasCacheEntry>()
  tokenCache.set(entry.key, entry)
  paintChunkCanvasCache.set(entry.token, tokenCache)
  paintChunkCanvasCacheBytes += entry.bytes
  touchPaintChunkCanvas(entry)

  while (
    paintChunkCanvasCacheBytes > maxPaintChunkCanvasCacheBytes &&
    paintChunkCanvasLru.size > 1
  ) {
    const oldest = paintChunkCanvasLru.keys().next().value
    if (!oldest) break
    paintChunkCanvasLru.delete(oldest)
    paintChunkCanvasCacheBytes -= oldest.bytes
    const oldestTokenCache = paintChunkCanvasCache.get(oldest.token)
    oldestTokenCache?.delete(oldest.key)
    if (oldestTokenCache?.size === 0) {
      paintChunkCanvasCache.delete(oldest.token)
    }
  }
}

function getPaintChunkCanvas(
  chunk: EditorStateController['paintChunks'][number],
  cellSize: number,
) {
  const cacheKey = `${chunk.width}:${chunk.height}:${cellSize}`
  const tokenCache = paintChunkCanvasCache.get(chunk.token)
  const cached = tokenCache?.get(cacheKey)
  if (cached) {
    touchPaintChunkCanvas(cached)
    return cached.canvas
  }

  const canvas = document.createElement('canvas')
  canvas.width = chunk.width * cellSize
  canvas.height = chunk.height * cellSize
  const context = canvas.getContext('2d')
  if (context) {
    context.imageSmoothingEnabled = false
    if (chunk.isUniform) {
      if (chunk.solidColor !== null) {
        context.fillStyle = chunk.solidColor
        context.fillRect(0, 0, canvas.width, canvas.height)
      }
    } else {
      for (let y = 0; y < chunk.height; y += 1) {
        let runStart = -1
        let runColor: string | null = null
        for (let x = 0; x <= chunk.width; x += 1) {
          const cell = x < chunk.width ? chunk.get(x, y) : undefined
          const color = cell && !cell.isExternal ? cell.color : null
          if (color === runColor) continue
          if (runColor !== null) {
            context.fillStyle = runColor
            context.fillRect(
              runStart * cellSize,
              y * cellSize,
              (x - runStart) * cellSize,
              cellSize,
            )
          }
          runStart = color === null ? -1 : x
          runColor = color
        }
      }
    }
  }

  cachePaintChunkCanvas({
    token: chunk.token,
    key: cacheKey,
    canvas,
    bytes: canvas.width * canvas.height * 4,
  })
  return canvas
}
const toolbarDockDelay = 400

/** 把 hex 色 + alpha(0-1) 拼成 rgba() 字符串。失败时退回 paperColor 原值。 */
function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export function CanvasStage({ editor, onOpenSettings }: CanvasStageProps) {
  const [painting, setPainting] = useState(false)
  const [openToolOptions, setOpenToolOptions] = useState<EditorTool | null>(
    null,
  )
  const [renderedOptionsTool, setRenderedOptionsTool] =
    useState<EditorTool | null>(null)
  const [toolOptionsClosing, setToolOptionsClosing] = useState(false)
  const [renderedEraserMode, setRenderedEraserMode] =
    useState<EraserMode>(editor.eraserMode)
  const [toolOptionsAnchor, setToolOptionsAnchor] = useState({ x: 28, y: 28 })
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('select')
  const [pointerOutsideSelection, setPointerOutsideSelection] = useState(false)
  const [toolbarLayout, setToolbarLayout] = useState(getInitialToolbarLayout)
  const [toolbarDragSession, setToolbarDragSession] =
    useState<ToolbarDragSession | null>(null)
  const [toolbarRevealOrientation, setToolbarRevealOrientation] =
    useState<ToolbarOrientation | null>(null)
  const [viewPosition, setViewPosition] = useState({ x: 0, y: 0 })
  const [shapeDraft, setShapeDraft] = useState<{
    start: number
    end: number
  } | null>(null)
  const shapeDraftRef = useRef<{ start: number; end: number } | null>(null)
  const [floatingSelection, setFloatingSelection] =
    useState<FloatingSelection | null>(null)
  const floatingSelectionRef = useRef<FloatingSelection | null>(null)
  const selectionRef = useRef<SelectionRect | null>(null)
  const panningRef = useRef(false)
  const selectionDragRef = useRef<
    | {
        kind: 'create'
        anchorX: number
        anchorY: number
      }
    | {
        kind: 'reposition' | 'content'
        startX: number
        startY: number
        origin: SelectionRect
        dx: number
        dy: number
        pivotX2: number
        pivotY2: number
      }
    | null
  >(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const toolbarSurfaceRef = useRef<HTMLDivElement | null>(null)
  const toolOptionsPopoverRef = useRef<HTMLDivElement | null>(null)
  const toolbarContentRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLElement | null>(null)
  const [stageViewportOrigin, setStageViewportOrigin] = useState<{
    left: number
    top: number
  } | null>(null)
  const toolbarDragSessionRef = useRef<ToolbarDragSession | null>(null)
  const toolbarDockTimerRef = useRef<number | null>(null)
  const toolbarAnimationFramesRef = useRef<number[]>([])
  const toolbarResizeGuardTimerRef = useRef<number | null>(null)
  const toolbarResizeGuardRef = useRef(false)
  const toolbarDragIdRef = useRef(0)
  const toolbarRevealOrientationRef = useRef<ToolbarOrientation | null>(null)
  const viewPositionRef = useRef(viewPosition)
  const zoomRef = useRef(editor.zoom)
  const viewportSizeRef = useRef({ width: 0, height: 0 })
  const initialFitDoneRef = useRef(false)
  const zoomInputRef = useRef<HTMLInputElement | null>(null)
  const zoomHoldDelayRef = useRef<number | null>(null)
  const zoomHoldIntervalRef = useRef<number | null>(null)
  const toolOptionsCloseTimerRef = useRef<number | null>(null)
  const toolbarDragHandlersRef = useRef({
    start: startToolbarDrag,
    move: moveToolbar,
    finish: finishToolbarDrag,
  })
  toolbarDragHandlersRef.current = {
    start: startToolbarDrag,
    move: moveToolbar,
    finish: finishToolbarDrag,
  }
  const canvasActionsRef = useRef({
    cancelToolbarDrag,
    clearSelection,
    fitCanvasToViewport,
    zoomViewportAt,
  })
  canvasActionsRef.current = {
    cancelToolbarDrag,
    clearSelection,
    fitCanvasToViewport,
    zoomViewportAt,
  }
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const selectionPreviewRef = useRef<HTMLCanvasElement | null>(null)
  const shapePreviewRef = useRef<HTMLCanvasElement | null>(null)
  const editorRef = useRef(editor)
  const lastPaintedIndexRef = useRef<number | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const panStartRef = useRef({
    x: 0,
    y: 0,
    positionX: 0,
    positionY: 0,
  })
  const pattern = editor.pattern
  const cellSize = Math.max(
    1,
    Math.min(
      semanticCellSize,
      Math.floor(maxCanvasBitmapSide / Math.max(pattern.width, pattern.height)),
    ),
  )
  const cellSizeRef = useRef(cellSize)
  cellSizeRef.current = cellSize
  const zoomScale = (semanticCellSize * (editor.zoom / 100)) / cellSize
  const visualCellSize = cellSize * zoomScale
  const canvasWidth = pattern.width * cellSize
  const canvasHeight = pattern.height * cellSize
  const worldPadding = (worldPaddingAt100 * cellSize) / semanticCellSize
  const worldWidth = canvasWidth + worldPadding
  const worldHeight = canvasHeight + worldPadding
  const worldInset = worldPadding / 2
  const settings = editor.canvasSettings
  editorRef.current = editor
  zoomRef.current = editor.zoom
  floatingSelectionRef.current = floatingSelection
  selectionRef.current = selection
  const toolbarLayoutRef = useRef(toolbarLayout)
  toolbarLayoutRef.current = toolbarLayout
  toolbarDragSessionRef.current = toolbarDragSession

  useEffect(() => {
    if (
      document.activeElement !== zoomInputRef.current &&
      zoomInputRef.current
    ) {
      zoomInputRef.current.value = String(Math.round(editor.zoom))
    }
  }, [editor.zoom])

  useEffect(() => stopContinuousZoom, [])

  useLayoutEffect(() => {
    toolbarRef.current
      ?.querySelectorAll('button')
      .forEach((button) => (button.tabIndex = -1))
  })
  toolbarRevealOrientationRef.current = toolbarRevealOrientation
  viewPositionRef.current = viewPosition
  const displayedToolbarLayout = toolbarDragSession
    ? {
        placement: 'floating' as const,
        orientation: toolbarDragSession.origin.orientation,
        x: toolbarDragSession.x,
        y: toolbarDragSession.y,
      }
    : toolbarLayout
  const activeOptionsTool =
    !editor.eyedropperActive && openToolOptions === editor.currentTool
      ? openToolOptions
      : null
  const canRotateSelection = Boolean(
    selection &&
    selection.height <= pattern.width &&
    selection.width <= pattern.height,
  )
  const toolbarOptionsAbove =
    displayedToolbarLayout.placement === 'bottom' ||
    (displayedToolbarLayout.placement === 'floating' &&
      displayedToolbarLayout.y >
        (stageRef.current?.clientHeight ?? window.innerHeight) / 2)
  const toolbarOptionsSide = displayedToolbarLayout.orientation === 'vertical'
  const toolbarDragOriginSide =
    toolbarDragSession?.origin.orientation === 'vertical'
  const toolbarContentSide = toolbarDragSession
    ? toolbarDragOriginSide
    : toolbarOptionsSide
  const toolbarOptionsDirection = toolbarOptionsSide
    ? displayedToolbarLayout.placement === 'left'
      ? 'right'
      : 'left'
    : toolbarOptionsAbove
      ? 'up'
      : 'down'
  const toolbarOptionsPosition = toolbarOptionsSide
    ? displayedToolbarLayout.placement === 'left'
      ? 'left-[calc(100%-36px)] -translate-y-1/2 !rounded-l-none'
      : 'right-[calc(100%-36px)] -translate-y-1/2 !rounded-r-none'
    : toolbarOptionsAbove
      ? 'bottom-[calc(100%-36px)] -translate-x-1/2 !rounded-b-none'
      : 'top-[calc(100%-36px)] -translate-x-1/2 !rounded-t-none'
  const toolbarOptionsInset =
    toolbarOptionsDirection === 'right'
      ? 'pl-[44px]'
      : toolbarOptionsDirection === 'left'
        ? 'pr-[44px]'
        : toolbarOptionsDirection === 'down'
          ? 'pt-[44px]'
          : 'pb-[44px]'

  useEffect(() => {
    if (toolOptionsCloseTimerRef.current !== null) {
      window.clearTimeout(toolOptionsCloseTimerRef.current)
      toolOptionsCloseTimerRef.current = null
    }
    if (activeOptionsTool) {
      const frame = window.requestAnimationFrame(() => {
        setRenderedOptionsTool(activeOptionsTool)
        setToolOptionsClosing(false)
      })
      return () => window.cancelAnimationFrame(frame)
    }
    if (!renderedOptionsTool) return
    const frame = window.requestAnimationFrame(() => {
      setToolOptionsClosing(true)
      toolOptionsCloseTimerRef.current = window.setTimeout(() => {
        setRenderedOptionsTool(null)
        setToolOptionsClosing(false)
        toolOptionsCloseTimerRef.current = null
      }, 180)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      if (toolOptionsCloseTimerRef.current !== null) {
        window.clearTimeout(toolOptionsCloseTimerRef.current)
        toolOptionsCloseTimerRef.current = null
      }
    }
  }, [activeOptionsTool, renderedOptionsTool])

  useLayoutEffect(() => {
    const popover = toolOptionsPopoverRef.current
    const toolbar = toolbarRef.current
    const toolbarSurface = toolbarSurfaceRef.current
    const stage = stageRef.current
    if (
      !renderedOptionsTool ||
      !popover ||
      !toolbar ||
      !toolbarSurface ||
      !stage
    )
      return

    const toolbarRect = toolbar.getBoundingClientRect()
    const toolbarSurfaceRect = toolbarSurface.getBoundingClientRect()
    const stageRect = stage.getBoundingClientRect()
    const popoverWidth = popover.offsetWidth
    const popoverHeight = popover.offsetHeight
    popover.style.marginLeft = '0px'
    popover.style.marginTop = '0px'

    if (toolbarOptionsSide) {
      const minimum =
        Math.max(stageRect.top, toolbarSurfaceRect.top) -
        toolbarRect.top +
        popoverHeight / 2
      const maximum = stageRect.bottom - toolbarRect.top - popoverHeight / 2
      popover.style.top = `${Math.min(maximum, Math.max(minimum, toolOptionsAnchor.y))}px`
    } else {
      const minimum = stageRect.left - toolbarRect.left + popoverWidth / 2
      const maximum = stageRect.right - toolbarRect.left - popoverWidth / 2
      popover.style.left = `${Math.min(maximum, Math.max(minimum, toolOptionsAnchor.x))}px`
    }

    const positionedLeft =
      toolbarRect.left +
      popover.offsetLeft -
      (toolbarOptionsSide ? 0 : popoverWidth / 2)
    const positionedTop =
      toolbarRect.top +
      popover.offsetTop -
      (toolbarOptionsSide ? popoverHeight / 2 : 0)
    const positionedRight = positionedLeft + popoverWidth
    const positionedBottom = positionedTop + popoverHeight
    const minimumLeft = toolbarOptionsSide
      ? stageRect.left
      : Math.max(stageRect.left, toolbarSurfaceRect.left)
    const shiftX =
      positionedLeft < minimumLeft
        ? minimumLeft - positionedLeft
        : positionedRight > stageRect.right
          ? stageRect.right - positionedRight
          : 0
    const minimumTop = toolbarOptionsSide
      ? Math.max(stageRect.top, toolbarSurfaceRect.top)
      : stageRect.top
    const shiftY =
      positionedTop < minimumTop
        ? minimumTop - positionedTop
        : positionedBottom > stageRect.bottom
          ? stageRect.bottom - positionedBottom
          : 0
    popover.style.marginLeft = `${shiftX}px`
    popover.style.marginTop = `${shiftY}px`
  }, [
    renderedOptionsTool,
    displayedToolbarLayout.placement,
    toolOptionsAnchor,
    toolbarOptionsSide,
  ])
  const holdingToolbarOrigin = Boolean(
    toolbarDragSession &&
    toolbarDragSession.origin.placement !== 'floating' &&
    !toolbarDragSession.hasLeftOrigin &&
    (!toolbarDragSession.animatePlaceholder ||
      toolbarDragSession.candidate === toolbarDragSession.origin.placement),
  )
  const activeToolbarDock = toolbarDragSession
    ? holdingToolbarOrigin
      ? (toolbarDragSession.origin.placement as ToolbarDockPlacement)
      : toolbarDragSession.dockTarget
    : toolbarLayout.placement === 'floating'
      ? null
      : toolbarLayout.placement
  const sideDockPlacement =
    activeToolbarDock === 'left' || activeToolbarDock === 'right'
      ? activeToolbarDock
      : null
  const pendingToolbarDock =
    toolbarDragSession?.candidate &&
    toolbarDragSession.candidate !== toolbarDragSession.dockTarget
      ? toolbarDragSession.candidate
      : null
  const dockPlaceholderHeight = toolbarDragPuckSize
  const dockPlaceholderWidth = toolbarDragPuckSize
  const stageContentBounds = stageRef.current
    ? getElementContentBounds(stageRef.current)
    : null
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const updateOrigin = () => {
      const rect = stage.getBoundingClientRect()
      setStageViewportOrigin((current) =>
        current?.left === rect.left && current.top === rect.top
          ? current
          : { left: rect.left, top: rect.top },
      )
    }

    updateOrigin()
    const observer = new ResizeObserver(updateOrigin)
    observer.observe(stage)
    window.addEventListener('resize', updateOrigin)
    window.addEventListener('scroll', updateOrigin, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateOrigin)
      window.removeEventListener('scroll', updateOrigin, true)
    }
  }, [])

  useEffect(() => {
    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target as Node | null
      if (!target || toolbarRef.current?.contains(target)) return
      setOpenToolOptions(null)
      if (
        editorRef.current.currentTool === 'select' &&
        !viewportRef.current?.contains(target) &&
        !editorRef.current.protectedSelection
      ) {
        commitFloatingSelection()
        setSelection(null)
        setSelectionMode('select')
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const meta = event.ctrlKey || event.metaKey
      const lower = event.key.toLowerCase()
      const target = event.target as HTMLElement | null
      const editingText = target?.matches(
        'input, textarea, select, [contenteditable="true"]',
      )
      if (meta && !editingText && (event.key === '+' || event.key === '=')) {
        event.preventDefault()
        canvasActionsRef.current.zoomViewportAt(
          Math.min(maxViewportZoom, zoomRef.current + 10),
        )
        return
      }
      if (meta && !editingText && event.key === '-') {
        event.preventDefault()
        canvasActionsRef.current.zoomViewportAt(
          Math.max(minViewportZoom, zoomRef.current - 10),
        )
        return
      }
      if (meta && !editingText && event.key === '0') {
        event.preventDefault()
        canvasActionsRef.current.fitCanvasToViewport()
        return
      }
      const undoShortcut = meta && lower === 'z' && !event.shiftKey
      const redoShortcut =
        meta && (lower === 'y' || (lower === 'z' && event.shiftKey))
      if ((undoShortcut || redoShortcut) && floatingSelectionRef.current) {
        event.preventDefault()
        event.stopImmediatePropagation()
        cancelFloatingSelection()
        if (redoShortcut && editorRef.current.canRedo) editorRef.current.redo()
        return
      }
      if (event.key === 'Enter' && floatingSelectionRef.current) {
        event.preventDefault()
        commitFloatingSelection()
        return
      }
      if (event.key === 'Escape') {
        if (toolbarDragSessionRef.current) {
          event.preventDefault()
          canvasActionsRef.current.cancelToolbarDrag()
          interact.stop()
          return
        }
        setOpenToolOptions(null)
        selectionDragRef.current = null
        if (shapeDraftRef.current) {
          shapeDraftRef.current = null
          setShapeDraft(null)
          return
        }
        if (floatingSelectionRef.current) {
          cancelFloatingSelection()
        } else {
          canvasActionsRef.current.clearSelection()
        }
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const interactable = interact(toolbar).draggable({
      allowFrom: '[data-toolbar-drag-handle]',
      inertia: false,
      listeners: {
        start: (event) =>
          toolbarDragHandlersRef.current.start(event.clientX, event.clientY),
        move: (event) =>
          toolbarDragHandlersRef.current.move(
            event.clientX,
            event.clientY,
            event.ctrlKey || event.metaKey,
          ),
        end: (event) =>
          toolbarDragHandlersRef.current.finish(
            event.clientX,
            event.clientY,
            event.ctrlKey || event.metaKey,
          ),
      },
    })

    return () => {
      if (toolbarDockTimerRef.current !== null) {
        window.clearTimeout(toolbarDockTimerRef.current)
        toolbarDockTimerRef.current = null
      }
      toolbarAnimationFramesRef.current.forEach((frame) =>
        window.cancelAnimationFrame(frame),
      )
      toolbarAnimationFramesRef.current = []
      if (toolbarResizeGuardTimerRef.current !== null) {
        window.clearTimeout(toolbarResizeGuardTimerRef.current)
        toolbarResizeGuardTimerRef.current = null
      }
      interactable.unset()
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const toolbar = toolbarRef.current
    if (!stage || !toolbar) return

    const observer = new ResizeObserver(() =>
      reconcileFloatingToolbarPosition(),
    )
    observer.observe(stage)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || canvasWidth === 0 || canvasHeight === 0) return
    viewportSizeRef.current = {
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    }
    if (
      !initialFitDoneRef.current &&
      viewport.clientWidth > 0 &&
      viewport.clientHeight > 0
    ) {
      initialFitDoneRef.current = true
      canvasActionsRef.current.fitCanvasToViewport()
    }
  }, [canvasHeight, canvasWidth])

  useLayoutEffect(() => {
    if (editor.viewportFitRequest === 0) return
    const frame = window.requestAnimationFrame(() =>
      canvasActionsRef.current.fitCanvasToViewport(),
    )
    return () => window.cancelAnimationFrame(frame)
  }, [editor.viewportFitRequest, canvasHeight, canvasWidth])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const next = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }
      const previous = viewportSizeRef.current
      viewportSizeRef.current = next
      if (previous.width === 0 || previous.height === 0) return
      updateViewPosition({
        x: viewPositionRef.current.x + (next.width - previous.width) / 2,
        y: viewPositionRef.current.y + (next.height - previous.height) / 2,
      })
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!selection) return
    const protectedSelection = editor.protectedSelection
    if (
      !protectedSelection ||
      protectedSelection.x !== selection.x ||
      protectedSelection.y !== selection.y ||
      protectedSelection.width !== selection.width ||
      protectedSelection.height !== selection.height
    ) {
      editor.setProtectedSelection(selection)
    }
  }, [editor, editor.protectedSelection, selection])

  useEffect(() => {
    if (editor.currentTool !== 'select') {
      selectionDragRef.current = null
      commitFloatingSelection()
      const frame = window.requestAnimationFrame(() =>
        setSelection(editorRef.current.protectedSelection),
      )
      return () => window.cancelAnimationFrame(frame)
    }

    function handleSelectionKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (
        target?.matches('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selection) {
        event.preventDefault()
        const floating = floatingSelectionRef.current
        if (floating?.kind === 'move') {
          editorRef.current.deleteSelection(floating.source)
        } else if (!floating) {
          editor.deleteSelection(selection)
        }
        floatingSelectionRef.current = null
        setFloatingSelection(null)
        editorRef.current.setProtectedSelection(null)
        setSelection(null)
        setSelectionMode('select')
      }
    }

    document.addEventListener('keydown', handleSelectionKeyDown)
    return () => document.removeEventListener('keydown', handleSelectionKeyDown)
  }, [editor, editor.currentTool, selection])

  // 细网格:每一格的边界都画
  const { gridPath, majorGridPath } = useMemo(() => {
    const verticalGridLines = Array.from(
      { length: pattern.width + 1 },
      (_, index) => index * cellSize,
    )
    const horizontalGridLines = Array.from(
      { length: pattern.height + 1 },
      (_, index) => index * cellSize,
    )
    const nextGridPath = [
      ...verticalGridLines.map((x) => `M${x} 0V${canvasHeight}`),
      ...horizontalGridLines.map((y) => `M0 ${y}H${canvasWidth}`),
    ].join('')
    const majorEvery = settings.majorGridEvery
    const nextMajorGridPath =
      majorEvery > 0
        ? [
            ...verticalGridLines
              .filter((_, index) => index % majorEvery === 0)
              .map((x) => `M${x} 0V${canvasHeight}`),
            ...horizontalGridLines
              .filter((_, index) => index % majorEvery === 0)
              .map((y) => `M0 ${y}H${canvasWidth}`),
          ].join('')
        : ''
    return { gridPath: nextGridPath, majorGridPath: nextMajorGridPath }
  }, [
    canvasHeight,
    canvasWidth,
    cellSize,
    pattern.height,
    pattern.width,
    settings.majorGridEvery,
  ])
  const cursorClass = pointerOutsideSelection
    ? 'cursor-not-allowed'
    : editor.eyedropperActive
      ? 'cursor-copy'
      : editor.currentTool === 'pan'
        ? 'cursor-grab active:cursor-grabbing'
        : editor.currentTool === 'fill'
          ? 'cursor-cell'
          : 'cursor-crosshair'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const context = canvas.getContext('2d')
    if (!context) return

    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = withAlpha(settings.paperColor, settings.paperAlpha)
    context.fillRect(0, 0, canvas.width, canvas.height)

    editor.paintChunks.forEach((chunk) => {
      const chunkCanvas = getPaintChunkCanvas(chunk, cellSize)
      context.drawImage(chunkCanvas, chunk.x * cellSize, chunk.y * cellSize)
    })

    if (floatingSelection?.kind === 'move') {
      const source = floatingSelection.source
      context.fillStyle = withAlpha(settings.paperColor, settings.paperAlpha)
      context.fillRect(
        source.x * cellSize,
        source.y * cellSize,
        source.width * cellSize,
        source.height * cellSize,
      )
    }
  }, [
    canvasHeight,
    canvasWidth,
    cellSize,
    floatingSelection,
    editor.paintChunks,
    settings.paperColor,
    settings.paperAlpha,
  ])

  useEffect(() => {
    const controller = editorRef.current
    controller.setStrokePreviewListener((changes) => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) return
      changes.forEach(({ index, color }) => {
        const x = (index % pattern.width) * cellSize
        const y = Math.floor(index / pattern.width) * cellSize
        context.clearRect(x, y, cellSize, cellSize)
        context.fillStyle = withAlpha(settings.paperColor, settings.paperAlpha)
        context.fillRect(x, y, cellSize, cellSize)
        if (color !== null) {
          context.fillStyle = color
          context.fillRect(x, y, cellSize, cellSize)
        }
      })
    })
    return () => controller.setStrokePreviewListener(null)
  }, [cellSize, pattern.width, settings.paperAlpha, settings.paperColor])

  useEffect(() => {
    const preview = selectionPreviewRef.current
    if (!preview || !floatingSelection || !selection) return
    preview.width = selection.width * cellSize
    preview.height = selection.height * cellSize
    const context = preview.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, preview.width, preview.height)

    floatingSelection.cells.forEach((cell) => {
      context.fillStyle = cell.color
      context.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize)
    })
  }, [cellSize, floatingSelection, selection])

  useEffect(() => {
    const preview = shapePreviewRef.current
    if (!preview || !shapeDraft) return
    preview.width = canvasWidth
    preview.height = canvasHeight
    const context = preview.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, preview.width, preview.height)
    context.fillStyle = editor.currentColor

    const protectedSelection = editor.protectedSelection
    getShapeCellIndexes(
      shapeDraft.start,
      shapeDraft.end,
      pattern.width,
      pattern.height,
      editor.shapeKind,
      editor.shapeStyle,
      editor.brushSize,
    ).forEach((index) => {
      const x = index % pattern.width
      const y = Math.floor(index / pattern.width)
      if (
        protectedSelection &&
        (x < protectedSelection.x ||
          x >= protectedSelection.x + protectedSelection.width ||
          y < protectedSelection.y ||
          y >= protectedSelection.y + protectedSelection.height)
      ) {
        return
      }
      context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
    })
  }, [
    canvasHeight,
    canvasWidth,
    cellSize,
    editor.currentColor,
    editor.brushSize,
    editor.protectedSelection,
    editor.shapeKind,
    editor.shapeStyle,
    pattern.height,
    pattern.width,
    shapeDraft,
  ])

  // Ctrl/Cmd + wheel zooms around the pointer anchor.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    function handleWheel(event: WheelEvent) {
      const currentViewport = viewportRef.current
      if (!currentViewport) return
      event.preventDefault()
      const deltaX = normalizeWheelDelta(
        event.deltaX,
        event.deltaMode,
        currentViewport.clientWidth,
      )
      const deltaY = normalizeWheelDelta(
        event.deltaY,
        event.deltaMode,
        currentViewport.clientHeight,
      )
      if (!event.ctrlKey && !event.metaKey) {
        const current = viewPositionRef.current
        const horizontalDelta = event.shiftKey ? deltaY : deltaX
        const verticalDelta = event.shiftKey ? 0 : deltaY
        updateViewPosition({
          x: current.x - horizontalDelta,
          y: current.y - verticalDelta,
        })
        return
      }
      const current = zoomRef.current
      const factor = Math.exp(-deltaY * 0.001)
      const next = Math.min(
        maxViewportZoom,
        Math.max(minViewportZoom, Math.round(current * factor * 10) / 10),
      )
      canvasActionsRef.current.zoomViewportAt(
        next,
        event.clientX,
        event.clientY,
      )
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [])

  function paintFromPointer(
    event: PointerEvent<HTMLCanvasElement>,
    force = false,
  ) {
    const rect = event.currentTarget.getBoundingClientRect()
    // 用合并事件，回填浏览器在快速移动时丢弃的中间点
    const events =
      !force && typeof event.nativeEvent.getCoalescedEvents === 'function'
        ? event.nativeEvent.getCoalescedEvents()
        : []
    if (events.length === 0) {
      paintFromClientXY(rect, event.clientX, event.clientY, force)
      return
    }
    for (const e of events) {
      paintFromClientXY(rect, e.clientX, e.clientY, false)
    }
  }

  function getPointerCellIndex(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(
      ((event.clientX - rect.left) / rect.width) * pattern.width,
    )
    const y = Math.floor(
      ((event.clientY - rect.top) / rect.height) * pattern.height,
    )
    if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) {
      return null
    }
    return y * pattern.width + x
  }

  function getPointerCell(event: PointerEvent<HTMLCanvasElement>) {
    const index = getPointerCellIndex(event)
    if (index === null) return null
    return {
      x: index % pattern.width,
      y: Math.floor(index / pattern.width),
    }
  }

  function startShape(event: PointerEvent<HTMLCanvasElement>) {
    const index = getPointerCellIndex(event)
    if (index === null) return
    const nextDraft = { start: index, end: index }
    shapeDraftRef.current = nextDraft
    setShapeDraft(nextDraft)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function updateShape(event: PointerEvent<HTMLCanvasElement>) {
    const draft = shapeDraftRef.current
    if (!draft) return
    const index = getPointerCellIndex(event)
    if (index === null || index === draft.end) return
    const nextDraft = { ...draft, end: index }
    shapeDraftRef.current = nextDraft
    setShapeDraft(nextDraft)
  }

  function finishShape() {
    const draft = shapeDraftRef.current
    shapeDraftRef.current = null
    setShapeDraft(null)
    if (draft) editor.drawShape(draft.start, draft.end)
  }

  function cancelShape() {
    shapeDraftRef.current = null
    setShapeDraft(null)
  }

  function updatePointerRestriction(event: PointerEvent<HTMLCanvasElement>) {
    const protectedSelection = editor.protectedSelection
    const constrainedTool =
      editor.currentTool === 'brush' ||
      editor.currentTool === 'eraser' ||
      editor.currentTool === 'fill' ||
      editor.currentTool === 'shape'
    if (!protectedSelection || !constrainedTool) {
      setPointerOutsideSelection(false)
      return
    }
    const cell = getPointerCell(event)
    setPointerOutsideSelection(
      !cell ||
        cell.x < protectedSelection.x ||
        cell.x >= protectedSelection.x + protectedSelection.width ||
        cell.y < protectedSelection.y ||
        cell.y >= protectedSelection.y + protectedSelection.height,
    )
  }

  function getSelectionLayerCells(rect: SelectionRect): SelectionLayerCell[] {
    const cells: SelectionLayerCell[] = []
    for (let y = 0; y < rect.height; y += 1) {
      for (let x = 0; x < rect.width; x += 1) {
        const cell = pattern.cells[(rect.y + y) * pattern.width + rect.x + x]
        if (!cell?.color || cell.isExternal) continue
        cells.push({ x, y, color: cell.color })
      }
    }
    return cells
  }

  function commitFloatingSelection() {
    const floating = floatingSelectionRef.current
    const target = selectionRef.current
    if (floating && target) {
      editorRef.current.commitSelectionLayer(
        floating.source,
        target,
        floating.cells,
        floating.kind === 'move',
      )
    }
    floatingSelectionRef.current = null
    setFloatingSelection(null)
  }

  function cancelFloatingSelection() {
    const floating = floatingSelectionRef.current
    floatingSelectionRef.current = null
    setFloatingSelection(null)
    if (!floating) return
    selectionRef.current = floating.source
    setSelection(floating.source)
    editorRef.current.setProtectedSelection(floating.source)
  }

  function clearSelection() {
    commitFloatingSelection()
    selectionRef.current = null
    setSelection(null)
    setSelectionMode('select')
    setPointerOutsideSelection(false)
    editorRef.current.setProtectedSelection(null)
  }

  function startSelection(event: PointerEvent<HTMLCanvasElement>) {
    const cell = getPointerCell(event)
    if (!cell) return
    const insideSelection =
      selection &&
      cell.x >= selection.x &&
      cell.x < selection.x + selection.width &&
      cell.y >= selection.y &&
      cell.y < selection.y + selection.height

    if (insideSelection && selection) {
      const currentFloating = floatingSelectionRef.current
      selectionDragRef.current = {
        kind: selectionMode === 'move' ? 'content' : 'reposition',
        startX: cell.x,
        startY: cell.y,
        origin: selection,
        dx: 0,
        dy: 0,
        pivotX2: currentFloating?.pivotX2 ?? selection.x * 2 + selection.width,
        pivotY2: currentFloating?.pivotY2 ?? selection.y * 2 + selection.height,
      }
      if (selectionMode === 'move' && !floatingSelectionRef.current) {
        const nextFloating: FloatingSelection = {
          kind: 'move',
          source: selection,
          cells: getSelectionLayerCells(selection),
          pivotX2: selection.x * 2 + selection.width,
          pivotY2: selection.y * 2 + selection.height,
        }
        floatingSelectionRef.current = nextFloating
        setFloatingSelection(nextFloating)
      }
    } else {
      if (selectionMode === 'move') return
      commitFloatingSelection()
      const nextSelection = { x: cell.x, y: cell.y, width: 1, height: 1 }
      setSelection(nextSelection)
      selectionDragRef.current = {
        kind: 'create',
        anchorX: cell.x,
        anchorY: cell.y,
      }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function updateSelection(event: PointerEvent<HTMLCanvasElement>) {
    const drag = selectionDragRef.current
    const cell = getPointerCell(event)
    if (!drag || !cell) return

    if (drag.kind === 'create') {
      const x = Math.min(drag.anchorX, cell.x)
      const y = Math.min(drag.anchorY, cell.y)
      setSelection({
        x,
        y,
        width: Math.abs(cell.x - drag.anchorX) + 1,
        height: Math.abs(cell.y - drag.anchorY) + 1,
      })
      return
    }

    const minDx = -drag.origin.x
    const maxDx = pattern.width - drag.origin.x - drag.origin.width
    const minDy = -drag.origin.y
    const maxDy = pattern.height - drag.origin.y - drag.origin.height
    drag.dx = Math.min(maxDx, Math.max(minDx, cell.x - drag.startX))
    drag.dy = Math.min(maxDy, Math.max(minDy, cell.y - drag.startY))
    const nextSelection = {
      ...drag.origin,
      x: drag.origin.x + drag.dx,
      y: drag.origin.y + drag.dy,
    }
    setSelection(nextSelection)
    if (drag.kind === 'content' && floatingSelectionRef.current) {
      const nextFloating = {
        ...floatingSelectionRef.current,
        pivotX2: drag.pivotX2 + drag.dx * 2,
        pivotY2: drag.pivotY2 + drag.dy * 2,
      }
      floatingSelectionRef.current = nextFloating
      setFloatingSelection(nextFloating)
    }
  }

  function finishSelection() {
    selectionDragRef.current = null
  }

  function returnToBrush() {
    setOpenToolOptions(null)
    editor.setCurrentTool('brush')
  }

  function updateViewPosition(position: { x: number; y: number }) {
    viewPositionRef.current = position
    setViewPosition(position)
  }

  function centerCanvasInViewport(zoom: number) {
    const viewport = viewportRef.current
    if (!viewport) return
    const scale = (semanticCellSize * (zoom / 100)) / cellSize
    updateViewPosition(
      getCenteredViewPosition(
        { width: viewport.clientWidth, height: viewport.clientHeight },
        { width: worldWidth, height: worldHeight },
        scale,
      ),
    )
  }

  function zoomViewportAt(
    nextZoom: number,
    clientX?: number,
    clientY?: number,
  ) {
    const viewport = viewportRef.current
    if (!viewport) return
    const currentZoom = zoomRef.current
    const normalizedZoom = Math.min(
      maxViewportZoom,
      Math.max(minViewportZoom, nextZoom),
    )
    if (normalizedZoom === currentZoom) return

    const rect = viewport.getBoundingClientRect()
    const anchorX = clientX === undefined ? rect.width / 2 : clientX - rect.left
    const anchorY = clientY === undefined ? rect.height / 2 : clientY - rect.top
    const currentCellSize = cellSizeRef.current
    const currentScale =
      (semanticCellSize * (currentZoom / 100)) / currentCellSize
    const nextScale =
      (semanticCellSize * (normalizedZoom / 100)) / currentCellSize
    const currentPosition = viewPositionRef.current
    updateViewPosition(
      getAnchoredViewPosition({
        position: currentPosition,
        anchor: { x: anchorX, y: anchorY },
        currentScale,
        nextScale,
      }),
    )
    zoomRef.current = normalizedZoom
    editorRef.current.setZoom(normalizedZoom)
  }

  function stepZoom(direction: -1 | 1) {
    zoomViewportAt(zoomRef.current + direction * 10)
  }

  function stopContinuousZoom() {
    if (zoomHoldDelayRef.current !== null) {
      window.clearTimeout(zoomHoldDelayRef.current)
      zoomHoldDelayRef.current = null
    }
    if (zoomHoldIntervalRef.current !== null) {
      window.clearInterval(zoomHoldIntervalRef.current)
      zoomHoldIntervalRef.current = null
    }
  }

  function startContinuousZoom(direction: -1 | 1) {
    stopContinuousZoom()
    stepZoom(direction)
    zoomHoldDelayRef.current = window.setTimeout(() => {
      zoomHoldIntervalRef.current = window.setInterval(() => {
        const zoom = zoomRef.current
        if (
          (direction < 0 && zoom <= minViewportZoom) ||
          (direction > 0 && zoom >= maxViewportZoom)
        ) {
          stopContinuousZoom()
          return
        }
        stepZoom(direction)
      }, 80)
    }, 320)
  }

  function commitZoomInput() {
    const input = zoomInputRef.current
    if (!input) return
    const value = Number(input.value)
    if (Number.isFinite(value)) zoomViewportAt(value)
    input.value = String(Math.round(zoomRef.current))
  }

  function fitCanvasToViewport() {
    const viewport = viewportRef.current
    if (!viewport || canvasWidth === 0 || canvasHeight === 0) return
    const nextZoom = getFitZoom(
      { width: viewport.clientWidth, height: viewport.clientHeight },
      {
        width: pattern.width * semanticCellSize + worldPaddingAt100,
        height: pattern.height * semanticCellSize + worldPaddingAt100,
      },
      24,
      minViewportZoom,
      maxViewportZoom,
    )
    zoomRef.current = nextZoom
    editor.setZoom(nextZoom)
    centerCanvasInViewport(nextZoom)
  }

  function changeSelectionMode(mode: SelectionMode) {
    if (mode !== 'move') commitFloatingSelection()
    setSelectionMode(mode)
  }

  function flipSelectedContent(axis: 'horizontal' | 'vertical') {
    if (!selection) return
    const floating: FloatingSelection = floatingSelectionRef.current ?? {
      kind: 'move',
      source: selection,
      cells: getSelectionLayerCells(selection),
      pivotX2: selection.x * 2 + selection.width,
      pivotY2: selection.y * 2 + selection.height,
    }
    const nextFloating: FloatingSelection = {
      ...floating,
      cells: floating.cells.map((cell) => ({
        ...cell,
        x: axis === 'horizontal' ? selection.width - 1 - cell.x : cell.x,
        y: axis === 'vertical' ? selection.height - 1 - cell.y : cell.y,
      })),
    }
    floatingSelectionRef.current = nextFloating
    setFloatingSelection(nextFloating)
    setSelectionMode('move')
  }

  function rotateSelectedContent() {
    if (!selection) return
    if (selection.height > pattern.width || selection.width > pattern.height) {
      return
    }
    const currentFloating = floatingSelectionRef.current
    const floating: FloatingSelection = currentFloating ?? {
      kind: 'move',
      source: selection,
      cells: getSelectionLayerCells(selection),
      pivotX2: selection.x * 2 + selection.width,
      pivotY2: selection.y * 2 + selection.height,
    }
    const width = selection.height
    const height = selection.width
    const idealX = Math.floor((floating.pivotX2 - width) / 2)
    const idealY = Math.floor((floating.pivotY2 - height) / 2)
    const x = Math.min(pattern.width - width, Math.max(0, idealX))
    const y = Math.min(pattern.height - height, Math.max(0, idealY))
    const hitBoundary = x !== idealX || y !== idealY
    const nextSelection = { x, y, width, height }
    const nextFloating: FloatingSelection = {
      ...floating,
      cells: floating.cells.map((cell) => ({
        ...cell,
        x: selection.height - 1 - cell.y,
        y: cell.x,
      })),
      pivotX2: hitBoundary ? x * 2 + width : floating.pivotX2,
      pivotY2: hitBoundary ? y * 2 + height : floating.pivotY2,
    }
    selectionRef.current = nextSelection
    floatingSelectionRef.current = nextFloating
    setSelection(nextSelection)
    setFloatingSelection(nextFloating)
    editor.setProtectedSelection(nextSelection)
    setSelectionMode('move')
  }

  function copySelectedContent() {
    if (!selection) return
    const cells =
      floatingSelectionRef.current?.cells ?? getSelectionLayerCells(selection)
    commitFloatingSelection()
    const nextSelection = { ...selection, x: 0, y: 0 }
    const nextFloating: FloatingSelection = {
      kind: 'copy',
      source: selection,
      cells,
      pivotX2: nextSelection.x * 2 + nextSelection.width,
      pivotY2: nextSelection.y * 2 + nextSelection.height,
    }
    selectionRef.current = nextSelection
    floatingSelectionRef.current = nextFloating
    setSelection(nextSelection)
    setFloatingSelection(nextFloating)
    editor.setProtectedSelection(nextSelection)
    setSelectionMode('move')
  }

  function paintFromClientXY(
    rect: DOMRect,
    clientX: number,
    clientY: number,
    force: boolean,
  ) {
    const x = Math.floor(((clientX - rect.left) / rect.width) * pattern.width)
    const y = Math.floor(((clientY - rect.top) / rect.height) * pattern.height)
    if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) {
      lastPaintedIndexRef.current = null
      return
    }
    const index = y * pattern.width + x
    if (!force && lastPaintedIndexRef.current === index) return

    const previous = lastPaintedIndexRef.current
    if (previous !== null && previous !== index && !force) {
      const prevX = previous % pattern.width
      const prevY = Math.floor(previous / pattern.width)
      for (const [px, py] of bresenham(prevX, prevY, x, y)) {
        if (px === prevX && py === prevY) continue
        editor.paintCell(py * pattern.width + px)
      }
    } else {
      editor.paintCell(index)
    }

    lastPaintedIndexRef.current = index
  }

  function startPan(
    event: PointerEvent<HTMLDivElement>,
    viewport: HTMLDivElement,
  ) {
    event.preventDefault()
    viewport.setPointerCapture(event.pointerId)
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      positionX: viewPositionRef.current.x,
      positionY: viewPositionRef.current.y,
    }
    panningRef.current = true
    activePointerIdRef.current = event.pointerId
  }

  function endStroke() {
    if (painting) {
      editor.endStroke()
    }
    setPainting(false)
    lastPaintedIndexRef.current = null
  }

  function handleToolClick(tool: StageTool, button: HTMLButtonElement) {
    const isActive =
      !editor.eyedropperActive && editor.currentTool === tool.value

    if (isActive) {
      if (toolsWithOptions.has(tool.value)) {
        if (tool.value === 'eraser') {
          setRenderedEraserMode(editor.eraserMode)
        }
        const toolbarRect = toolbarRef.current?.getBoundingClientRect()
        const buttonRect = button.getBoundingClientRect()
        if (toolbarRect) {
          setToolOptionsAnchor({
            x: buttonRect.left - toolbarRect.left + buttonRect.width / 2,
            y: buttonRect.top - toolbarRect.top + buttonRect.height / 2,
          })
        }
        setOpenToolOptions((current) =>
          current === tool.value ? null : tool.value,
        )
      }
      return
    }

    if (editor.currentTool === 'select') commitFloatingSelection()
    cancelShape()
    setOpenToolOptions(null)
    editor.setCurrentTool(tool.value)
    editor.setEyedropperActive(false)
  }

  function clearToolbarDockTimer() {
    if (toolbarDockTimerRef.current === null) return
    window.clearTimeout(toolbarDockTimerRef.current)
    toolbarDockTimerRef.current = null
  }

  function clearToolbarAnimationFrames() {
    toolbarAnimationFramesRef.current.forEach((frame) =>
      window.cancelAnimationFrame(frame),
    )
    toolbarAnimationFramesRef.current = []
  }

  function scheduleToolbarFrame(callback: () => void) {
    const frame = window.requestAnimationFrame(() => {
      toolbarAnimationFramesRef.current =
        toolbarAnimationFramesRef.current.filter((current) => current !== frame)
      callback()
    })
    toolbarAnimationFramesRef.current.push(frame)
  }

  function updateToolbarDragSession(session: ToolbarDragSession | null) {
    toolbarDragSessionRef.current = session
    setToolbarDragSession(session)
  }

  function reconcileFloatingToolbarPosition(force = false) {
    const stage = stageRef.current
    const toolbar = toolbarRef.current
    const layout = toolbarLayoutRef.current
    if (
      !stage ||
      !toolbar ||
      layout.placement !== 'floating' ||
      toolbarDragSessionRef.current ||
      (!force &&
        (toolbarRevealOrientationRef.current || toolbarResizeGuardRef.current))
    )
      return

    const toolbarRect = toolbar.getBoundingClientRect()
    const position = clampToolbarPosition(
      getElementContentBounds(stage),
      { width: toolbarRect.width, height: toolbarRect.height },
      layout,
    )
    if (position.x === layout.x && position.y === layout.y) return

    const nextLayout: ToolbarLayout = { ...layout, ...position }
    toolbarLayoutRef.current = nextLayout
    setToolbarLayout(nextLayout)
    localStorage.setItem(toolbarLayoutStorageKey, JSON.stringify(nextLayout))
  }

  function getToolbarDockTarget(
    clientX: number,
    clientY: number,
    preventDock: boolean,
    currentTarget: ToolbarDockPlacement | null,
  ): ToolbarDockPlacement | null {
    const stage = stageRef.current
    if (!stage || preventDock) return null
    const stageRect = stage.getBoundingClientRect()
    const bounds = getElementContentBounds(stage)
    const pointerX = clientX - stageRect.left
    const pointerY = clientY - stageRect.top
    return getToolbarDockEdge({
      pointerX,
      pointerY,
      bounds,
      currentEdge: currentTarget,
    })
  }

  function startToolbarDrag(clientX: number, clientY: number) {
    const toolbar = toolbarRef.current
    const stage = stageRef.current
    if (!toolbar || !stage) return
    setOpenToolOptions(null)
    const rect = toolbar.getBoundingClientRect()
    const stageRect = stage.getBoundingClientRect()
    const contentBounds = getElementContentBounds(stage)
    const origin = toolbarLayoutRef.current
    const naturalExtent = toolbarContentRef.current
      ? measureToolbarNaturalExtent(
          toolbarContentRef.current,
          origin.orientation,
          origin.orientation === 'horizontal'
            ? contentBounds.width
            : contentBounds.height,
        )
      : toolbarDragPuckSize
    const floatingWidth =
      origin.orientation === 'horizontal' ? naturalExtent : toolbarDragPuckSize
    const floatingHeight =
      origin.orientation === 'vertical' ? naturalExtent : toolbarDragPuckSize
    const initialDock =
      origin.placement !== 'floating' ? origin.placement : null
    const originIsSide =
      origin.placement === 'left' || origin.placement === 'right'
    const puckInsetX = originIsSide
      ? Math.max(0, (rect.width - toolbarDragPuckSize) / 2)
      : 0
    const id = ++toolbarDragIdRef.current
    const initialPosition = clampToolbarPosition(
      contentBounds,
      { width: toolbarDragPuckSize, height: toolbarDragPuckSize },
      {
        x: clientX - stageRect.left - toolbarDragPuckSize / 2 - puckInsetX,
        y: clientY - stageRect.top - toolbarDragPuckSize / 2,
      },
    )
    const session: ToolbarDragSession = {
      id,
      origin,
      offsetX: toolbarDragPuckSize / 2 + puckInsetX,
      offsetY: toolbarDragPuckSize / 2,
      pointerClientX: clientX,
      pointerClientY: clientY,
      width: floatingWidth,
      height: floatingHeight,
      ...initialPosition,
      candidate: initialDock,
      candidateEnteredAt: initialDock ? performance.now() : null,
      dockTarget: initialDock,
      animatePlaceholder: false,
      hasLeftOrigin: false,
    }
    clearToolbarAnimationFrames()
    if (toolbarResizeGuardTimerRef.current !== null) {
      window.clearTimeout(toolbarResizeGuardTimerRef.current)
      toolbarResizeGuardTimerRef.current = null
    }
    toolbarResizeGuardRef.current = false
    toolbarRevealOrientationRef.current = null
    setToolbarRevealOrientation(null)
    updateToolbarDragSession(session)
    scheduleToolbarFrame(() => {
      const current = toolbarDragSessionRef.current
      if (current?.id === id) {
        scheduleToolbarFrame(() => {
          const latest = toolbarDragSessionRef.current
          if (latest?.id === id) {
            updateToolbarDragSession({
              ...latest,
              animatePlaceholder: true,
            })
          }
        })
      }
    })
  }

  function moveToolbar(clientX: number, clientY: number, preventDock: boolean) {
    const drag = toolbarDragSessionRef.current
    const stage = stageRef.current
    if (!drag || !stage) return
    const stageRect = stage.getBoundingClientRect()
    const contentBounds = getElementContentBounds(stage)
    const position = clampToolbarPosition(
      contentBounds,
      { width: toolbarDragPuckSize, height: toolbarDragPuckSize },
      {
        x: clientX - stageRect.left - drag.offsetX,
        y: clientY - stageRect.top - drag.offsetY,
      },
    )
    const candidate = getToolbarDockTarget(
      clientX,
      clientY,
      preventDock,
      drag.candidate,
    )
    let next = {
      ...drag,
      ...position,
      candidate,
      candidateEnteredAt:
        candidate === drag.candidate
          ? drag.candidateEnteredAt
          : candidate
            ? performance.now()
            : null,
      hasLeftOrigin: drag.hasLeftOrigin || candidate !== drag.origin.placement,
      pointerClientX: clientX,
      pointerClientY: clientY,
    }
    if (candidate !== drag.candidate) {
      clearToolbarDockTimer()
      next = { ...next, dockTarget: null }
      if (candidate) {
        const dragId = drag.id
        toolbarDockTimerRef.current = window.setTimeout(() => {
          toolbarDockTimerRef.current = null
          const current = toolbarDragSessionRef.current
          if (current?.id === dragId && current.candidate === candidate) {
            updateToolbarDragSession({ ...current, dockTarget: candidate })
          }
        }, toolbarDockDelay)
      }
    }
    updateToolbarDragSession(next)
  }

  function finishToolbarDrag(
    clientX: number,
    clientY: number,
    preventDock: boolean,
  ) {
    const drag = toolbarDragSessionRef.current
    const stage = stageRef.current
    if (!drag || !stage) return
    const contentBounds = getElementContentBounds(stage)
    const releaseCandidate = getToolbarDockTarget(
      clientX,
      clientY,
      preventDock,
      drag.candidate,
    )
    const candidateEnteredAt =
      releaseCandidate === drag.candidate
        ? drag.candidateEnteredAt
        : releaseCandidate
          ? performance.now()
          : null
    const dwellCompleted = Boolean(
      releaseCandidate &&
      candidateEnteredAt !== null &&
      performance.now() - candidateEnteredAt >= toolbarDockDelay,
    )
    const confirmedDockTarget =
      drag.dockTarget === releaseCandidate ? drag.dockTarget : null
    const dockTarget = preventDock
      ? null
      : (confirmedDockTarget ?? (dwellCompleted ? releaseCandidate : null))
    const placement: ToolbarPlacement = dockTarget ?? 'floating'
    const orientation: ToolbarOrientation =
      dockTarget === 'left' || dockTarget === 'right'
        ? 'vertical'
        : dockTarget === 'top' || dockTarget === 'bottom'
          ? 'horizontal'
          : drag.origin.orientation
    const floatingWidth =
      orientation === 'horizontal'
        ? Math.min(drag.width, contentBounds.width)
        : toolbarDragPuckSize
    const floatingHeight =
      orientation === 'vertical'
        ? Math.min(drag.height, contentBounds.height)
        : toolbarDragPuckSize
    const position = clampToolbarPosition(
      contentBounds,
      { width: floatingWidth, height: floatingHeight },
      drag,
    )
    const nextLayout: ToolbarLayout = { placement, orientation, ...position }
    clearToolbarDockTimer()
    clearToolbarAnimationFrames()
    if (toolbarResizeGuardTimerRef.current !== null) {
      window.clearTimeout(toolbarResizeGuardTimerRef.current)
    }
    toolbarResizeGuardRef.current = true
    setToolbarRevealOrientation(orientation)
    toolbarRevealOrientationRef.current = orientation
    updateToolbarDragSession(null)
    toolbarLayoutRef.current = nextLayout
    setToolbarLayout(nextLayout)
    localStorage.setItem(toolbarLayoutStorageKey, JSON.stringify(nextLayout))
    scheduleToolbarFrame(() => {
      scheduleToolbarFrame(() => {
        toolbarRevealOrientationRef.current = null
        setToolbarRevealOrientation(null)
        toolbarResizeGuardTimerRef.current = window.setTimeout(() => {
          toolbarResizeGuardTimerRef.current = null
          toolbarResizeGuardRef.current = false
          reconcileFloatingToolbarPosition(true)
        }, 220)
      })
    })
  }

  function cancelToolbarDrag() {
    const drag = toolbarDragSessionRef.current
    if (!drag) return
    clearToolbarDockTimer()
    clearToolbarAnimationFrames()
    toolbarResizeGuardRef.current = false
    if (toolbarResizeGuardTimerRef.current !== null) {
      window.clearTimeout(toolbarResizeGuardTimerRef.current)
      toolbarResizeGuardTimerRef.current = null
    }
    updateToolbarDragSession(null)
  }

  return (
    <section
      ref={stageRef}
      className="relative grid max-h-[calc(100svh-2rem)] min-h-[calc(100svh-2rem)] grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto] rounded-[32px] border border-editor-border bg-editor-surface p-4 md:p-5 2xl:h-full 2xl:min-h-0 2xl:max-h-full"
      aria-label="拼豆图纸编辑区"
    >
      {pendingToolbarDock ? (
        <div
          aria-hidden="true"
          className={`toolbar-dock-hint pointer-events-none absolute z-30 border-editor-accent ${
            {
              top: 'left-1/2 top-3 w-[95%] -translate-x-1/2 border-t-[1.5px] border-dashed',
              bottom:
                'bottom-3 left-1/2 w-[95%] -translate-x-1/2 border-t-[1.5px] border-dashed',
              left: 'left-3 top-1/2 h-[95%] -translate-y-1/2 border-l-[1.5px] border-dashed',
              right:
                'right-3 top-1/2 h-[95%] -translate-y-1/2 border-l-[1.5px] border-dashed',
            }[pendingToolbarDock]
          }`}
        />
      ) : null}
      <div
        aria-hidden="true"
        className={`pointer-events-none col-[1/4] row-start-1 w-full overflow-hidden ${
          toolbarDragSession?.animatePlaceholder
            ? 'transition-[height,margin,opacity] duration-200 ease-out'
            : 'transition-none'
        }`}
        style={{
          height: activeToolbarDock === 'top' ? dockPlaceholderHeight : 0,
          marginBottom: activeToolbarDock === 'top' ? 16 : 0,
          opacity:
            toolbarDragSession &&
            !holdingToolbarOrigin &&
            activeToolbarDock === 'top'
              ? 1
              : 0,
        }}
      >
        <div className="h-full w-full rounded-[18px] border border-dashed border-editor-accent/65 bg-editor-accent-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]" />
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none col-start-1 row-start-2 h-full overflow-hidden rounded-[18px] border border-dashed border-editor-accent/65 bg-editor-accent-soft ${
          toolbarDragSession?.animatePlaceholder
            ? 'transition-[width,margin,opacity] duration-200 ease-out'
            : 'transition-none'
        }`}
        style={{
          width: sideDockPlacement === 'left' ? dockPlaceholderWidth : 0,
          marginRight: sideDockPlacement === 'left' ? 16 : 0,
          opacity:
            toolbarDragSession &&
            !holdingToolbarOrigin &&
            sideDockPlacement === 'left'
              ? 1
              : 0,
        }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none col-start-3 row-start-2 h-full overflow-hidden rounded-[18px] border border-dashed border-editor-accent/65 bg-editor-accent-soft ${
          toolbarDragSession?.animatePlaceholder
            ? 'transition-[width,margin,opacity] duration-200 ease-out'
            : 'transition-none'
        }`}
        style={{
          width: sideDockPlacement === 'right' ? dockPlaceholderWidth : 0,
          marginLeft: sideDockPlacement === 'right' ? 16 : 0,
          opacity:
            toolbarDragSession &&
            !holdingToolbarOrigin &&
            sideDockPlacement === 'right'
              ? 1
              : 0,
        }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none col-[1/4] row-start-3 w-full overflow-hidden ${
          toolbarDragSession?.animatePlaceholder
            ? 'transition-[height,margin,opacity] duration-200 ease-out'
            : 'transition-none'
        }`}
        style={{
          height: activeToolbarDock === 'bottom' ? dockPlaceholderHeight : 0,
          marginTop: activeToolbarDock === 'bottom' ? 16 : 0,
          opacity:
            toolbarDragSession &&
            !holdingToolbarOrigin &&
            activeToolbarDock === 'bottom'
              ? 1
              : 0,
        }}
      >
        <div className="h-full w-full rounded-[18px] border border-dashed border-editor-accent/65 bg-editor-accent-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]" />
      </div>
      <div
        ref={toolbarRef}
        onMouseDownCapture={(event) => {
          if ((event.target as HTMLElement).closest('button'))
            event.preventDefault()
        }}
        className={`max-w-full ${
          displayedToolbarLayout.placement === 'floating' &&
          !stageViewportOrigin
            ? 'invisible '
            : ''
        }${
          toolbarDragSession
            ? `fixed z-50 max-w-[calc(100%_-_2rem)] ${
                toolbarDragOriginSide ? 'flex justify-center' : ''
              }`
            : displayedToolbarLayout.placement === 'floating'
              ? 'fixed z-50 max-w-[calc(100%_-_2rem)]'
              : displayedToolbarLayout.placement === 'bottom'
                ? 'relative z-40 col-[1/4] row-start-3 mt-4 w-full self-center'
                : displayedToolbarLayout.placement === 'top'
                  ? 'relative z-40 col-[1/4] row-start-1 mb-4 w-full self-center'
                  : displayedToolbarLayout.placement === 'left'
                    ? 'relative z-40 col-start-1 row-start-2 mr-4 h-full w-14 self-stretch'
                    : 'relative z-40 col-start-3 row-start-2 ml-4 h-full w-14 self-stretch'
        }`}
        style={
          toolbarDragSession
            ? {
                left: (stageViewportOrigin?.left ?? 0) + toolbarDragSession.x,
                top: (stageViewportOrigin?.top ?? 0) + toolbarDragSession.y,
              }
            : displayedToolbarLayout.placement === 'floating'
              ? {
                  left:
                    (stageViewportOrigin?.left ?? 0) +
                    Math.min(
                      Math.max(
                        stageContentBounds?.left ?? 16,
                        displayedToolbarLayout.x,
                      ),
                      Math.max(
                        stageContentBounds?.left ?? 16,
                        (stageContentBounds?.right ?? window.innerWidth) -
                          (toolbarRef.current?.offsetWidth ??
                            toolbarDragPuckSize) -
                          0,
                      ),
                    ),
                  top:
                    (stageViewportOrigin?.top ?? 0) +
                    Math.min(
                      Math.max(
                        stageContentBounds?.top ?? 16,
                        displayedToolbarLayout.y,
                      ),
                      Math.max(
                        stageContentBounds?.top ?? 16,
                        (stageContentBounds?.bottom ?? window.innerHeight) -
                          (toolbarRef.current?.offsetHeight ??
                            toolbarDragPuckSize),
                      ),
                    ),
                  maxWidth: Math.max(
                    toolbarDragPuckSize,
                    stageContentBounds?.width ?? window.innerWidth - 32,
                  ),
                  maxHeight:
                    displayedToolbarLayout.orientation === 'vertical'
                      ? stageContentBounds?.height
                      : undefined,
                }
              : undefined
        }
      >
        {renderedOptionsTool && !toolbarDragSession ? (
          <div
            ref={toolOptionsPopoverRef}
            className={`tool-options-popover absolute z-0 max-w-[calc(100vw-1.5rem)] overflow-visible rounded-[18px] border border-editor-border bg-editor-elevated/95 p-2 shadow-[0_14px_42px_rgba(31,24,18,0.16)] backdrop-blur-md ${toolbarOptionsPosition} ${toolbarOptionsInset}`}
            data-drawer-direction={toolbarOptionsDirection}
            data-closing={toolOptionsClosing ? 'true' : 'false'}
            style={
              toolbarOptionsSide
                ? { top: toolOptionsAnchor.y }
                : { left: toolOptionsAnchor.x }
            }
            role="group"
            aria-label={`${stageTools.find((tool) => tool.value === renderedOptionsTool)?.label ?? ''}设置`}
            onClick={() => setOpenToolOptions(null)}
          >
            <div
              className={`flex items-center gap-1 md:gap-2 ${
                toolbarOptionsSide
                  ? 'h-auto w-10 flex-col [&>div]:!h-auto [&>div]:!w-10 [&>div]:!flex-col [&>div]:!px-1 [&>div]:!py-1 [&_[data-toolbar-divider]]:!h-px [&_[data-toolbar-divider]]:!w-6'
                  : 'h-10 w-max'
              }`}
            >
              {renderedOptionsTool === 'eraser' ? (
                <EraserModePicker
                  value={renderedEraserMode}
                  onChange={editor.setEraserMode}
                />
              ) : null}

              {renderedOptionsTool === 'brush' ||
              (renderedOptionsTool === 'eraser' &&
                renderedEraserMode === 'brush') ? (
                <ToolSizePicker
                  value={
                    renderedOptionsTool === 'brush'
                      ? editor.brushSize
                      : editor.eraserSize
                  }
                  onChange={
                    renderedOptionsTool === 'brush'
                      ? editor.setBrushSize
                      : editor.setEraserSize
                  }
                />
              ) : null}

              {renderedOptionsTool === 'brush' ||
              renderedOptionsTool === 'eraser' ? (
                <>
                  <ToolbarDivider horizontal={toolbarOptionsSide} />
                  <SymmetryModePicker
                    value={
                      renderedOptionsTool === 'brush'
                        ? editor.brushSymmetryMode
                        : editor.eraserSymmetryMode
                    }
                    onChange={
                      renderedOptionsTool === 'brush'
                        ? editor.setBrushSymmetryMode
                        : editor.setEraserSymmetryMode
                    }
                  />
                </>
              ) : null}

              {renderedOptionsTool === 'eraser' ? (
                <>
                  <ToolbarDivider horizontal={toolbarOptionsSide} />
                  <div className="flex h-10 items-center gap-1 rounded-2xl bg-editor-surface-soft px-1">
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-xl text-editor-strong transition hover:bg-editor-elevated active:scale-95"
                      aria-label="清空图纸"
                      title="清空图纸"
                      onClick={editor.clearCanvas}
                    >
                      <Trash size={16} weight="regular" />
                    </button>
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-xl text-editor-strong transition hover:bg-editor-elevated active:scale-95"
                      aria-label="清理孤立珠"
                      title="清理孤立珠"
                      onClick={editor.removeIsolatedCells}
                    >
                      <Broom size={16} weight="regular" />
                    </button>
                  </div>
                </>
              ) : null}

              {renderedOptionsTool === 'fill' ? (
                <FillModePicker
                  value={editor.fillMode}
                  onChange={editor.setFillMode}
                />
              ) : null}

              {renderedOptionsTool === 'shape' ? (
                <ShapeToolOptions
                  kind={editor.shapeKind}
                  style={editor.shapeStyle}
                  onKindChange={editor.setShapeKind}
                  onStyleChange={editor.setShapeStyle}
                />
              ) : null}

              {renderedOptionsTool === 'select' ? (
                <SelectionToolOptions
                  mode={selectionMode}
                  selection={selection}
                  onModeChange={changeSelectionMode}
                  onFlipHorizontal={() => flipSelectedContent('horizontal')}
                  onFlipVertical={() => flipSelectedContent('vertical')}
                  onRotate={rotateSelectedContent}
                  onCopy={copySelectedContent}
                  onClearSelection={clearSelection}
                  canRotate={canRotateSelection}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          ref={toolbarSurfaceRef}
          data-toolbar-orientation={
            toolbarContentSide ? 'vertical' : 'horizontal'
          }
          className={
            toolbarDragSession
              ? 'toolbar-surface relative z-10 w-fit overflow-hidden rounded-[18px] border border-editor-border bg-editor-elevated p-0 text-editor-strong shadow-[0_12px_30px_rgba(31,24,18,0.24)]'
              : `toolbar-surface relative z-10 rounded-[18px] border border-editor-border p-[7px] transition-[box-shadow,background-color] duration-200 ease-out ${
                  toolbarContentSide
                    ? 'h-full overflow-hidden'
                    : 'overflow-hidden'
                } ${
                  displayedToolbarLayout.placement === 'floating'
                    ? 'w-max max-w-full bg-editor-elevated shadow-[0_18px_48px_rgba(31,24,18,0.22)]'
                    : 'bg-editor-elevated shadow-none'
                }`
          }
        >
          <div
            ref={toolbarContentRef}
            data-toolbar-content
            className={`${toolbarDragSession ? 'pointer-events-none gap-0' : 'gap-2'} ${
              toolbarContentSide
                ? 'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] justify-items-center'
                : `flex min-w-max items-center ${
                    displayedToolbarLayout.placement === 'top' ||
                    displayedToolbarLayout.placement === 'bottom'
                      ? 'w-full'
                      : ''
                  }`
            }`}
          >
            <button
              type="button"
              data-toolbar-drag-handle
              className={`grid shrink-0 touch-none cursor-grab place-items-center rounded-xl border text-editor-text transition-[background-color,border-color,color,box-shadow] hover:bg-editor-surface-soft hover:text-editor-strong active:cursor-grabbing ${
                toolbarDragSession
                  ? 'toolbar-drag-handle-active h-14 w-14 border-transparent'
                  : 'h-10 w-10 border-transparent'
              }`}
              aria-label="拖动工具栏"
              title="拖动工具栏"
            >
              <DotsSixVertical
                className={`toolbar-drag-grip-icon transition-transform duration-200 ${
                  toolbarContentSide ? 'rotate-90' : 'rotate-0'
                }`}
                size={16}
                weight="bold"
              />
            </button>
            <div
              data-toolbar-operations
              className={`toolbar-operation-group flex gap-2 ${
                toolbarDragSession
                  ? !toolbarDragSession.animatePlaceholder
                    ? `${toolbarDragOriginSide ? 'h-fit w-fit flex-col items-center' : 'h-fit w-fit'} overflow-hidden opacity-100 transition-none`
                    : toolbarDragOriginSide
                      ? 'h-0 w-fit flex-col items-center overflow-hidden opacity-0 transition-[height,opacity] duration-200 ease-out'
                      : 'h-fit w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-200 ease-out'
                  : toolbarRevealOrientation
                    ? toolbarRevealOrientation === 'vertical'
                      ? 'h-0 w-fit flex-col items-center overflow-hidden opacity-0 transition-none'
                      : 'h-fit w-0 overflow-hidden opacity-0 transition-none'
                    : toolbarContentSide
                      ? 'h-full min-h-0 w-fit flex-col items-center overflow-x-hidden overflow-y-auto opacity-100 [scrollbar-width:none] transition-[height,opacity] duration-200 ease-out [&::-webkit-scrollbar]:hidden'
                      : `h-fit max-w-full overflow-x-auto overflow-y-hidden opacity-100 [scrollbar-width:none] transition-[width,opacity] duration-200 ease-out [&::-webkit-scrollbar]:hidden ${
                          displayedToolbarLayout.placement === 'top' ||
                          displayedToolbarLayout.placement === 'bottom'
                            ? 'w-full'
                            : 'w-fit'
                        }`
              }`}
            >
              <div
                data-toolbar-row
                className={`flex gap-1 ${
                  toolbarContentSide ? 'h-auto flex-col items-center' : 'h-10'
                }`}
                aria-label="主要工具"
              >
                {stageTools.map((tool) => (
                  <ToolButton
                    key={tool.value}
                    icon={tool.icon}
                    label={tool.label}
                    active={
                      !editor.eyedropperActive &&
                      editor.currentTool === tool.value
                    }
                    statusActive={
                      tool.value === 'select' &&
                      Boolean(editor.protectedSelection) &&
                      editor.currentTool !== 'select'
                    }
                    hasOptions={toolsWithOptions.has(tool.value)}
                    optionsOpen={activeOptionsTool === tool.value}
                    presetValue={
                      tool.value === 'brush'
                        ? editor.brushSize
                        : tool.value === 'eraser'
                          ? editor.eraserMode === 'region'
                            ? <SquaresFour size={9} weight="regular" />
                            : editor.eraserSize
                          : tool.value === 'shape'
                            ? editor.shapeKind === 'line'
                              ? editor.brushSize
                              : (() => {
                                  const ShapeIcon = getShapeKindIcon(
                                    editor.shapeKind,
                                  )
                                  return <ShapeIcon size={9} weight="regular" />
                                })()
                            : null
                    }
                    presetIcon={
                      tool.value === 'select'
                        ? getSelectionModeIcon(selectionMode)
                        : tool.value === 'fill'
                          ? getFillModeIcon(editor.fillMode)
                          : tool.value === 'shape'
                            ? editor.shapeKind === 'line'
                              ? LineSegment
                              : getShapeStyleIcon(editor.shapeStyle)
                            : getSymmetryIcon(
                                tool.value === 'brush'
                                  ? editor.brushSymmetryMode
                                  : tool.value === 'eraser'
                                    ? editor.eraserSymmetryMode
                                    : null,
                              )
                    }
                    colorIndicator={
                      tool.value === 'brush' ||
                      tool.value === 'fill' ||
                      tool.value === 'shape'
                        ? editor.currentColor
                        : null
                    }
                    vertical={toolbarContentSide}
                    onClick={(event) =>
                      handleToolClick(tool, event.currentTarget)
                    }
                  />
                ))}
                <button
                  aria-pressed={editor.eyedropperActive}
                  aria-label="吸管"
                  title="吸管"
                  className={`grid h-10 w-10 place-items-center rounded-2xl text-sm font-bold ${toolbarButtonInteractionClass} ${
                    editor.eyedropperActive
                      ? 'bg-editor-accent text-white'
                      : toolbarButtonIdleClass
                  }`}
                  type="button"
                  onClick={() => {
                    setOpenToolOptions(null)
                    editor.setEyedropperActive((value) => !value)
                  }}
                >
                  <Eyedropper size={18} weight="regular" />
                </button>
              </div>

              <div
                data-toolbar-row
                className={`flex items-center gap-2 ${
                  toolbarContentSide ? 'mt-auto flex-col' : 'ml-auto'
                }`}
                onPointerDownCapture={() => setOpenToolOptions(null)}
              >
                <ToolbarDivider horizontal={toolbarContentSide} />
                <div
                  data-toolbar-row
                  className={`flex gap-1 ${
                    toolbarContentSide ? 'h-auto flex-col' : 'h-10'
                  }`}
                  aria-label="历史操作"
                >
                  <button
                    className={`grid h-10 w-10 place-items-center rounded-2xl ${toolbarSystemButtonInteractionClass} ${toolbarButtonIdleClass} disabled:scale-100 disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-editor-surface-soft`}
                    type="button"
                    disabled={!editor.canUndo && !floatingSelection}
                    aria-label="撤销"
                    onClick={() => {
                      if (floatingSelectionRef.current) {
                        cancelFloatingSelection()
                      } else {
                        editor.undo()
                      }
                    }}
                  >
                    <ArrowCounterClockwise size={18} weight="regular" />
                  </button>
                  <button
                    className={`grid h-10 w-10 place-items-center rounded-2xl ${toolbarSystemButtonInteractionClass} ${toolbarButtonIdleClass} disabled:scale-100 disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-editor-surface-soft`}
                    type="button"
                    disabled={!editor.canRedo && !floatingSelection}
                    aria-label="重做"
                    onClick={() => {
                      if (floatingSelectionRef.current)
                        cancelFloatingSelection()
                      if (editor.canRedo) editor.redo()
                    }}
                  >
                    <ArrowClockwise size={18} weight="regular" />
                  </button>
                </div>
                <ToolbarDivider horizontal={toolbarContentSide} />
                <div
                  data-toolbar-row
                  className={`flex items-center rounded-2xl bg-editor-surface-soft p-1 ${
                    toolbarContentSide ? 'flex-col' : 'h-10'
                  }`}
                  aria-label="画布缩放"
                >
                  <button
                    className="grid h-8 w-8 place-items-center rounded-xl text-editor-text transition hover:bg-editor-elevated disabled:opacity-35"
                    type="button"
                    aria-label="缩小"
                    disabled={editor.zoom <= minViewportZoom}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      startContinuousZoom(-1)
                    }}
                    onPointerUp={stopContinuousZoom}
                    onPointerCancel={stopContinuousZoom}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      stepZoom(-1)
                    }}
                  >
                    <Minus size={15} weight="bold" />
                  </button>
                  <input
                    ref={zoomInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    defaultValue={Math.round(editor.zoom)}
                    aria-label="缩放比例"
                    title={`缩放比例，${minViewportZoom} 至 ${maxViewportZoom}`}
                    className="h-8 w-8 appearance-none rounded-xl bg-transparent text-center text-[10px] font-bold tabular-nums text-editor-strong outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    onFocus={(event) => event.currentTarget.select()}
                    onInput={(event) => {
                      event.currentTarget.value = event.currentTarget.value
                        .replace(/\D/g, '')
                        .slice(0, 3)
                    }}
                    onBlur={commitZoomInput}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitZoomInput()
                        event.currentTarget.blur()
                      }
                      if (event.key === 'Escape') {
                        event.currentTarget.value = String(
                          Math.round(zoomRef.current),
                        )
                        event.currentTarget.blur()
                      }
                    }}
                  />
                  <button
                    className="grid h-8 w-8 place-items-center rounded-xl text-editor-text transition hover:bg-editor-elevated disabled:opacity-35"
                    type="button"
                    aria-label="放大"
                    disabled={editor.zoom >= maxViewportZoom}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      startContinuousZoom(1)
                    }}
                    onPointerUp={stopContinuousZoom}
                    onPointerCancel={stopContinuousZoom}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      stepZoom(1)
                    }}
                  >
                    <Plus size={15} weight="bold" />
                  </button>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-xl text-editor-text transition hover:bg-editor-elevated"
                    aria-label="定位画布"
                    title="适应并定位画布"
                    onClick={fitCanvasToViewport}
                  >
                    <Crosshair size={15} weight="bold" />
                  </button>
                </div>
                <ToolbarDivider horizontal={toolbarContentSide} />
                <button
                  type="button"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-editor-strong transition hover:bg-editor-elevated active:scale-95"
                  aria-label="设置"
                  title="画布与主题设置"
                  onClick={onOpenSettings}
                >
                  <GearSix size={18} weight="regular" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative col-start-2 row-start-2 min-h-0 min-w-0 overflow-hidden rounded-[18px] [clip-path:inset(0_round_18px)] [touch-action:none] [overscroll-behavior:contain] ${cursorClass}`}
        style={{ backgroundColor: settings.bgColor }}
        onPointerDown={(event) => {
          setOpenToolOptions(null)
          const viewport = viewportRef.current
          if (!viewport) return

          if (event.button === 1) {
            startPan(event, viewport)
            return
          }

          if (
            event.button === 0 &&
            editor.currentTool === 'eraser' &&
            !editor.eyedropperActive &&
            !canvasRef.current?.contains(event.target as Node)
          ) {
            returnToBrush()
            return
          }

          if (
            event.button === 0 &&
            editor.currentTool === 'select' &&
            !canvasRef.current?.contains(event.target as Node)
          ) {
            commitFloatingSelection()
            editor.setProtectedSelection(null)
            setSelection(null)
            setSelectionMode('select')
            return
          }

          if (editor.currentTool === 'pan' && !editor.eyedropperActive) {
            startPan(event, viewport)
          }
        }}
        onPointerMove={(event) => {
          if (!panningRef.current) return
          const viewport = viewportRef.current
          if (!viewport) return

          event.preventDefault()
          const deltaX = event.clientX - panStartRef.current.x
          const deltaY = event.clientY - panStartRef.current.y
          updateViewPosition({
            x: panStartRef.current.positionX + deltaX,
            y: panStartRef.current.positionY + deltaY,
          })
        }}
        onPointerLeave={() => {
          endStroke()
          setPointerOutsideSelection(false)
        }}
        onPointerUp={(event) => {
          endStroke()
          finishSelection()
          finishShape()
          if (panningRef.current) {
            viewportRef.current?.releasePointerCapture(event.pointerId)
          }
          panningRef.current = false
          activePointerIdRef.current = null
        }}
        onPointerCancel={() => {
          endStroke()
          cancelShape()
          const drag = selectionDragRef.current
          if (drag && drag.kind !== 'create') setSelection(drag.origin)
          selectionDragRef.current = null
          panningRef.current = false
          activePointerIdRef.current = null
        }}
      >
        <div
          className="absolute left-0 top-0 rounded-xl will-change-transform"
          style={{
            width: `${worldWidth}px`,
            height: `${worldHeight}px`,
            padding: `${worldInset}px`,
            transform: `translate3d(${viewPosition.x}px, ${viewPosition.y}px, 0) scale(${zoomScale})`,
            transformOrigin: '0 0',
          }}
        >
          <div
            className="relative overflow-visible"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
            }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
              }}
            >
              <canvas
                ref={canvasRef}
                aria-label="像素网格"
                width={canvasWidth}
                height={canvasHeight}
                className={`block select-none touch-none ${
                  editor.currentTool === 'pan' && !editor.eyedropperActive
                    ? 'pointer-events-none'
                    : ''
                }`}
                style={{
                  imageRendering: 'pixelated',
                }}
                onPointerDown={(event) => {
                  if (event.button === 1) return
                  event.preventDefault()
                  if (
                    editor.currentTool === 'select' &&
                    !editor.eyedropperActive
                  ) {
                    startSelection(event)
                    return
                  }
                  if (
                    editor.currentTool === 'shape' &&
                    !editor.eyedropperActive
                  ) {
                    startShape(event)
                    return
                  }
                  if (
                    editor.currentTool === 'eraser' &&
                    !editor.eyedropperActive
                  ) {
                    const index = getPointerCellIndex(event)
                    const protectedSelection = editor.protectedSelection
                    if (index !== null && protectedSelection) {
                      const x = index % pattern.width
                      const y = Math.floor(index / pattern.width)
                      if (
                        x < protectedSelection.x ||
                        x >= protectedSelection.x + protectedSelection.width ||
                        y < protectedSelection.y ||
                        y >= protectedSelection.y + protectedSelection.height
                      ) {
                        return
                      }
                    }
                    if (index === null || !pattern.cells[index]?.color) {
                      returnToBrush()
                      return
                    }
                  }
                  const isStrokeTool =
                    !editor.eyedropperActive &&
                    (editor.currentTool === 'brush' ||
                      (editor.currentTool === 'eraser' &&
                        editor.eraserMode === 'brush'))
                  if (isStrokeTool) {
                    editor.beginStroke()
                    setPainting(true)
                  }
                  paintFromPointer(event, true)
                }}
                onPointerMove={(event) => {
                  updatePointerRestriction(event)
                  if (selectionDragRef.current) {
                    updateSelection(event)
                    return
                  }
                  if (shapeDraftRef.current) {
                    updateShape(event)
                    return
                  }
                  if (painting && editor.currentTool !== 'fill') {
                    paintFromPointer(event)
                  }
                }}
              />
              {shapeDraft ? (
                <canvas
                  ref={shapePreviewRef}
                  aria-hidden="true"
                  width={canvasWidth}
                  height={canvasHeight}
                  className="pointer-events-none absolute inset-0 z-10"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : null}
              {(editor.currentTool === 'select' || editor.protectedSelection) &&
              selection ? (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute outline outline-2 outline-editor-accent shadow-[0_0_0_1px_rgba(255,255,255,0.7)] ${
                    floatingSelection
                      ? 'z-10 bg-transparent shadow-[0_8px_20px_rgba(31,24,18,0.22)]'
                      : 'z-0 bg-editor-accent/10'
                  }`}
                  style={{
                    left: selection.x * cellSize,
                    top: selection.y * cellSize,
                    width: selection.width * cellSize,
                    height: selection.height * cellSize,
                  }}
                >
                  {floatingSelection ? (
                    <>
                      <canvas
                        ref={selectionPreviewRef}
                        className="block h-full w-full"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <SelectionLayerCorner position="top-left" />
                      <SelectionLayerCorner position="top-right" />
                      <SelectionLayerCorner position="bottom-left" />
                      <SelectionLayerCorner position="bottom-right" />
                    </>
                  ) : null}
                </div>
              ) : null}
              {selection ? (
                <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
                  <div
                    aria-hidden="true"
                    className="absolute shadow-[0_0_0_9999px_rgba(31,24,18,0.07)]"
                    style={{
                      left: selection.x * cellSize,
                      top: selection.y * cellSize,
                      width: selection.width * cellSize,
                      height: selection.height * cellSize,
                    }}
                  />
                </div>
              ) : null}
              {settings.showGrid && visualCellSize >= 3 ? (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-20"
                  height={canvasHeight}
                  style={{
                    overflow: 'visible',
                  }}
                  viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                  width={canvasWidth}
                >
                  <path
                    d={gridPath}
                    fill="none"
                    opacity={0.3}
                    shapeRendering="crispEdges"
                    stroke={settings.gridColor}
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    strokeWidth={settings.gridWidth / zoomScale}
                  />
                  {majorGridPath ? (
                    <path
                      d={majorGridPath}
                      fill="none"
                      opacity={0.65}
                      shapeRendering="crispEdges"
                      stroke={settings.gridColor}
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      strokeWidth={(settings.gridWidth * 1.6) / zoomScale}
                    />
                  ) : null}
                </svg>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ToolSizePicker({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex h-10 items-center gap-0.5 rounded-2xl bg-editor-surface-soft px-1 md:gap-1">
      {sizeOptions.map((size) => (
        <button
          className={`grid h-8 w-7 place-items-center rounded-full text-xs font-black transition md:w-8 ${
            size === value
              ? 'bg-editor-accent text-white'
              : 'text-editor-strong hover:bg-editor-elevated'
          }`}
          key={size}
          type="button"
          onClick={() => onChange(size)}
        >
          {size}
        </button>
      ))}
    </div>
  )
}

function SymmetryModePicker({
  value,
  onChange,
}: {
  value: SymmetryMode
  onChange: (value: SymmetryMode) => void
}) {
  return (
    <div className="flex h-10 items-center gap-0.5 rounded-2xl bg-editor-surface-soft px-1 md:gap-1">
      {symmetryOptions.map((option) => (
        <SymmetryButton
          key={option.value}
          option={option}
          active={option.value === value}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}

function FillModePicker({
  value,
  onChange,
}: {
  value: FillMode
  onChange: (value: FillMode) => void
}) {
  return (
    <div
      className="flex h-10 items-center gap-1 rounded-2xl bg-editor-surface-soft px-1"
      role="group"
      aria-label="填色范围"
    >
      {fillModeOptions.map((option) => {
        const Icon = option.icon
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={`grid h-8 w-8 place-items-center rounded-xl transition active:scale-95 ${
              active
                ? 'bg-editor-accent text-white shadow-sm'
                : 'text-editor-strong hover:bg-editor-elevated'
            }`}
            aria-label={option.label}
            aria-pressed={active}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            <Icon size={15} weight="regular" />
          </button>
        )
      })}
    </div>
  )
}

function EraserModePicker({
  value,
  onChange,
}: {
  value: EraserMode
  onChange: (value: EraserMode) => void
}) {
  return (
    <div
      className="flex h-10 items-center gap-1 rounded-2xl bg-editor-surface-soft px-1"
      role="group"
      aria-label="橡皮模式"
    >
      {eraserModeOptions.map((option) => {
        const Icon = option.icon
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={`grid h-8 w-8 place-items-center rounded-xl transition active:scale-95 ${
              active
                ? 'bg-editor-accent text-white shadow-sm'
                : 'text-editor-strong hover:bg-editor-elevated'
            }`}
            aria-label={option.label}
            aria-pressed={active}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            <Icon size={15} weight="regular" />
          </button>
        )
      })}
    </div>
  )
}

function ShapeToolOptions({
  kind,
  style,
  onKindChange,
  onStyleChange,
}: {
  kind: ShapeKind
  style: ShapeStyle
  onKindChange: (value: ShapeKind) => void
  onStyleChange: (value: ShapeStyle) => void
}) {
  return (
    <div className="flex h-10 items-center gap-1 rounded-2xl bg-editor-surface-soft px-1">
      {shapeKindOptions.map((option) => {
        const Icon = option.icon
        const active = kind === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={`grid h-8 w-8 place-items-center rounded-xl transition active:scale-95 ${
              active
                ? 'bg-editor-accent text-white shadow-sm'
                : 'text-editor-strong hover:bg-editor-elevated'
            }`}
            aria-label={option.label}
            aria-pressed={active}
            title={option.label}
            onClick={() => onKindChange(option.value)}
          >
            <Icon size={16} weight="regular" />
          </button>
        )
      })}
      <ToolbarDivider />
      {shapeStyleOptions.map((option) => {
        const Icon = option.icon
        const active = style === option.value
        const disabled = kind === 'line'
        return (
          <button
            key={option.value}
            type="button"
            className={`grid h-8 w-8 place-items-center rounded-xl transition active:scale-95 disabled:opacity-30 disabled:active:scale-100 ${
              active && !disabled
                ? 'bg-editor-accent text-white shadow-sm'
                : 'text-editor-strong hover:bg-editor-elevated disabled:hover:bg-transparent'
            }`}
            aria-label={option.label}
            aria-pressed={active}
            title={kind === 'line' ? '直线不区分空心与实心' : option.label}
            disabled={disabled}
            onClick={() => onStyleChange(option.value)}
          >
            <Icon size={16} weight="regular" />
          </button>
        )
      })}
    </div>
  )
}

function SelectionToolOptions({
  mode,
  selection,
  onModeChange,
  onFlipHorizontal,
  onFlipVertical,
  onRotate,
  onCopy,
  onClearSelection,
  canRotate,
}: {
  mode: SelectionMode
  selection: SelectionRect | null
  onModeChange: (mode: SelectionMode) => void
  onFlipHorizontal: () => void
  onFlipVertical: () => void
  onRotate: () => void
  onCopy: () => void
  onClearSelection: () => void
  canRotate: boolean
}) {
  return (
    <div className="flex h-10 items-center gap-1 rounded-2xl bg-editor-surface-soft px-1">
      {selectionModeOptions.map((option) => {
        const Icon = option.icon
        const active = mode === option.value
        const disabled = option.value !== 'select' && !selection
        return (
          <button
            key={option.value}
            type="button"
            className={`grid h-8 w-8 place-items-center rounded-xl transition active:scale-95 disabled:opacity-35 disabled:active:scale-100 ${
              active
                ? 'bg-editor-accent text-white shadow-sm'
                : 'text-editor-strong hover:bg-editor-elevated'
            }`}
            aria-label={option.label}
            aria-pressed={active}
            title={option.label}
            disabled={disabled}
            onClick={() => onModeChange(option.value)}
          >
            <Icon size={16} weight="regular" />
          </button>
        )
      })}
      <SelectionActionButton
        icon={SelectionSlash}
        label="取消选择"
        disabled={!selection}
        onClick={onClearSelection}
      />
      <ToolbarDivider />
      <SelectionActionButton
        icon={FlipHorizontal}
        label="左右镜像"
        disabled={!selection}
        onClick={onFlipHorizontal}
      />
      <SelectionActionButton
        icon={FlipVertical}
        label="上下镜像"
        disabled={!selection}
        onClick={onFlipVertical}
      />
      <SelectionActionButton
        icon={ArrowClockwise}
        label="顺时针旋转 90°"
        disabled={!selection || !canRotate}
        onClick={onRotate}
      />
      <SelectionActionButton
        icon={Copy}
        label="复制到左上角"
        disabled={!selection}
        onClick={onCopy}
      />
    </div>
  )
}

function SelectionLayerCorner({
  position,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}) {
  return (
    <span
      className={`selection-layer-corner selection-layer-corner--${position}`}
    />
  )
}

function SelectionActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: ToolButtonIcon
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="grid h-8 w-8 place-items-center rounded-xl text-editor-strong transition hover:bg-editor-elevated active:scale-95 disabled:opacity-35 disabled:active:scale-100"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={16} weight="regular" />
    </button>
  )
}

function SymmetryButton({
  option,
  active,
  onClick,
}: {
  option: (typeof symmetryOptions)[number]
  active: boolean
  onClick: () => void
}) {
  const Icon = option.icon
  return (
    <button
      className={`grid h-8 w-7 place-items-center rounded-full text-xs font-black transition md:w-8 ${
        active
          ? 'bg-editor-accent text-white'
          : 'text-editor-strong hover:bg-editor-elevated'
      }`}
      type="button"
      aria-pressed={active}
      aria-label={option.label}
      title={option.label}
      onClick={onClick}
    >
      <Icon size={17} weight="regular" />
    </button>
  )
}

function SymmetryBothIcon({ size = 18 }: IconProps) {
  return (
    <SymmetryIconFrame size={size}>
      <RightTriangleOutline points="62 116 116 116 116 62" />
      <RightTriangleOutline points="140 116 140 62 194 116" />
      <RightTriangleOutline points="62 140 116 140 116 194" />
      <RightTriangleOutline points="140 140 194 140 140 194" />
    </SymmetryIconFrame>
  )
}

function SymmetryCenterIcon({ size = 18 }: IconProps) {
  return (
    <SymmetryIconFrame size={size}>
      <RightTriangleOutline points="62 116 116 116 116 62" />
      <RightTriangleOutline points="140 140 194 140 140 194" />
    </SymmetryIconFrame>
  )
}

function RightTriangleOutline({ points }: { points: string }) {
  return <polygon points={points} />
}

function SymmetryIconFrame({
  size,
  children,
}: {
  size: IconProps['size']
  children: ReactNode
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="15"
    >
      {children}
    </svg>
  )
}

function ToolbarDivider({ horizontal = false }: { horizontal?: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-toolbar-divider
      className={
        horizontal
          ? 'h-px w-6 shrink-0 bg-editor-border'
          : 'h-6 w-px shrink-0 bg-editor-border md:mx-0.5'
      }
    />
  )
}

function bresenham(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Array<[number, number]> {
  const points: Array<[number, number]> = []
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let x = x0
  let y = y0

  while (true) {
    points.push([x, y])
    if (x === x1 && y === y1) break
    const e2 = err * 2
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
  }
  return points
}
