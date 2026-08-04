import {
  useEffect,
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
  Eyedropper,
  Eraser,
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
import {
  ToolButton,
  type ToolButtonIcon,
} from '../../components/ToolButton'
import type {
  EditorStateController,
  EditorTool,
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
}

type StageTool = { value: EditorTool; label: string; icon: ToolButtonIcon }
type SelectionMode = 'select' | 'move'
type FloatingSelection = {
  kind: 'move' | 'copy'
  source: SelectionRect
  cells: SelectionLayerCell[]
  pivotX2: number
  pivotY2: number
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
  { value: 'region', label: '连续区域', icon: Selection },
  { value: 'global', label: '全画布同色', icon: SquaresFour },
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
  return shapeKindOptions.find((option) => option.value === kind)?.icon ?? LineSegment
}

function getShapeStyleIcon(style: ShapeStyle): ToolButtonIcon {
  return shapeStyleOptions.find((option) => option.value === style)?.icon ?? Square
}
const baseCellSize = 12
const maxCanvasBitmapSide = 4096

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

export function CanvasStage({ editor }: CanvasStageProps) {
  const [painting, setPainting] = useState(false)
  const [openToolOptions, setOpenToolOptions] = useState<EditorTool | null>(null)
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('select')
  const [pointerOutsideSelection, setPointerOutsideSelection] = useState(false)
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
    scrollLeft: 0,
    scrollTop: 0,
  })
  const pattern = editor.pattern
  const zoomScale = editor.zoom / 100
  const cellSize = Math.max(
    1,
    Math.min(
      baseCellSize,
      Math.floor(maxCanvasBitmapSide / Math.max(pattern.width, pattern.height)),
    ),
  )
  const canvasWidth = pattern.width * cellSize
  const canvasHeight = pattern.height * cellSize
  const scaledCanvasWidth = Math.round(canvasWidth * zoomScale)
  const scaledCanvasHeight = Math.round(canvasHeight * zoomScale)
  const settings = editor.canvasSettings
  editorRef.current = editor
  floatingSelectionRef.current = floatingSelection
  selectionRef.current = selection
  const activeOptionsTool =
    !editor.eyedropperActive && openToolOptions === editor.currentTool
      ? openToolOptions
      : null
  const canRotateSelection = Boolean(
    selection &&
      selection.height <= pattern.width &&
      selection.width <= pattern.height,
  )
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
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const meta = event.ctrlKey || event.metaKey
      const lower = event.key.toLowerCase()
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
          clearSelection()
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
    if (!selection) setSelectionMode('select')
  }, [selection])

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
      setSelection(editor.protectedSelection)
      return
    }

    function handleSelectionKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) {
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
      }
    }

    document.addEventListener('keydown', handleSelectionKeyDown)
    return () => document.removeEventListener('keydown', handleSelectionKeyDown)
  }, [editor, editor.currentTool, selection])

  // 细网格:每一格的边界都画
  const verticalGridLines = Array.from(
    { length: pattern.width + 1 },
    (_, index) => index * cellSize,
  )
  const horizontalGridLines = Array.from(
    { length: pattern.height + 1 },
    (_, index) => index * cellSize,
  )
  const gridPath = [
    ...verticalGridLines.map((x) => `M${x} 0V${canvasHeight}`),
    ...horizontalGridLines.map((y) => `M0 ${y}H${canvasWidth}`),
  ].join('')
  // 大网格:每 N 格加粗一条。0 = 关闭。第 0 条边界天然算"大网格"起点。
  const majorEvery = settings.majorGridEvery
  const majorGridPath =
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

    // 画布纸面:可配置色 + alpha,透出外框形成"纸"质感。cell 100% 实色不变。
    context.fillStyle = withAlpha(settings.paperColor, settings.paperAlpha)
    context.fillRect(0, 0, canvas.width, canvas.height)

    pattern.cells.forEach((cell, index) => {
      if (cell.color === null || cell.isExternal) return
      if (floatingSelection?.kind === 'move') {
        const source = floatingSelection.source
        const cellX = index % pattern.width
        const cellY = Math.floor(index / pattern.width)
        if (
          cellX >= source.x &&
          cellX < source.x + source.width &&
          cellY >= source.y &&
          cellY < source.y + source.height
        ) {
          return
        }
      }
      const x = (index % pattern.width) * cellSize
      const y = Math.floor(index / pattern.width) * cellSize
      context.fillStyle = cell.color
      context.fillRect(x, y, cellSize, cellSize)
    })
  }, [
    canvasHeight,
    canvasWidth,
    cellSize,
    floatingSelection,
    pattern,
    settings.paperColor,
    settings.paperAlpha,
  ])

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
      context.fillRect(
        cell.x * cellSize,
        cell.y * cellSize,
        cellSize,
        cellSize,
      )
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

  // Ctrl/Cmd + 滚轮缩放（必须 native 监听，React onWheel 是 passive）
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const delta = event.deltaY > 0 ? -10 : 10
      editor.setZoom((current) => Math.min(220, Math.max(1, current + delta)))
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [editor])

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
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * pattern.width)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * pattern.height)
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

  function fitCanvasToViewport() {
    const viewport = viewportRef.current
    if (!viewport || canvasWidth === 0 || canvasHeight === 0) return
    const availableWidth = Math.max(1, viewport.clientWidth - 112)
    const availableHeight = Math.max(1, viewport.clientHeight - 112)
    const fitZoom = Math.floor(
      Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight) *
        100,
    )
    editor.setZoom(Math.min(220, Math.max(1, fitZoom)))
  }

  function changeSelectionMode(mode: SelectionMode) {
    if (mode !== 'move') commitFloatingSelection()
    setSelectionMode(mode)
  }

  function flipSelectedContent(axis: 'horizontal' | 'vertical') {
    if (!selection) return
    const floating: FloatingSelection =
      floatingSelectionRef.current ?? {
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
    if (
      selection.height > pattern.width ||
      selection.width > pattern.height
    ) {
      return
    }
    const currentFloating = floatingSelectionRef.current
    const floating: FloatingSelection =
      currentFloating ?? {
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
    const cells = floatingSelectionRef.current?.cells ?? getSelectionLayerCells(selection)
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
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
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

  function handleToolClick(tool: StageTool) {
    const isActive =
      !editor.eyedropperActive && editor.currentTool === tool.value

    if (isActive) {
      if (toolsWithOptions.has(tool.value)) {
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

  return (
    <section
      className="flex max-h-[calc(100svh-2rem)] min-h-[calc(100svh-2rem)] flex-col rounded-[32px] border border-editor-border bg-editor-surface p-4 pb-24 md:p-5 md:pb-24 2xl:h-full 2xl:min-h-0 2xl:max-h-full 2xl:pb-5"
      aria-label="拼豆图纸编辑区"
    >
      <div
        ref={toolbarRef}
        className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 md:inset-x-6 2xl:relative 2xl:inset-auto 2xl:bottom-auto 2xl:z-auto 2xl:mb-4"
      >
        {activeOptionsTool ? (
          <div
            className="tool-options-popover absolute bottom-full left-0 z-10 mb-2 max-w-[calc(100vw-1.5rem)] overflow-visible rounded-[20px] border border-editor-border bg-editor-elevated/95 p-2 shadow-[0_14px_42px_rgba(31,24,18,0.16)] backdrop-blur-md 2xl:bottom-auto 2xl:top-full 2xl:mb-0 2xl:mt-2"
            role="group"
            aria-label={`${stageTools.find((tool) => tool.value === activeOptionsTool)?.label ?? ''}设置`}
            onClick={() => setOpenToolOptions(null)}
          >
            <div className="flex h-10 w-max items-center gap-1 md:gap-2">
              {activeOptionsTool === 'brush' || activeOptionsTool === 'eraser' ? (
                <ToolSizePicker
                  value={
                    activeOptionsTool === 'brush'
                      ? editor.brushSize
                      : editor.eraserSize
                  }
                  onChange={
                    activeOptionsTool === 'brush'
                      ? editor.setBrushSize
                      : editor.setEraserSize
                  }
                />
              ) : null}

              {activeOptionsTool === 'brush' || activeOptionsTool === 'eraser' ? (
                <>
                  <ToolbarDivider />
                  <SymmetryModePicker
                    value={
                      activeOptionsTool === 'brush'
                        ? editor.brushSymmetryMode
                        : editor.eraserSymmetryMode
                    }
                    onChange={
                      activeOptionsTool === 'brush'
                        ? editor.setBrushSymmetryMode
                        : editor.setEraserSymmetryMode
                    }
                  />
                </>
              ) : null}

              {activeOptionsTool === 'eraser' ? (
                <>
                  <ToolbarDivider />
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

              {activeOptionsTool === 'fill' ? (
                <FillModePicker
                  value={editor.fillMode}
                  onChange={editor.setFillMode}
                />
              ) : null}

              {activeOptionsTool === 'shape' ? (
                <ShapeToolOptions
                  kind={editor.shapeKind}
                  style={editor.shapeStyle}
                  onKindChange={editor.setShapeKind}
                  onStyleChange={editor.setShapeStyle}
                />
              ) : null}

              {activeOptionsTool === 'select' ? (
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

        <div className="overflow-x-auto rounded-[24px] border border-editor-border bg-editor-elevated/92 p-2 shadow-[0_18px_60px_rgba(31,24,18,0.18)] backdrop-blur-md 2xl:overflow-visible 2xl:rounded-[26px] 2xl:bg-editor-elevated/70 2xl:p-3 2xl:shadow-none 2xl:backdrop-blur-none">
          <div className="flex min-w-max items-center gap-2 2xl:min-w-full">
            <div className="flex h-10 gap-1" aria-label="主要工具">
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
                        ? editor.eraserSize
                        : tool.value === 'shape'
                          ? editor.shapeKind === 'line'
                            ? editor.brushSize
                            : (() => {
                                const ShapeIcon = getShapeKindIcon(editor.shapeKind)
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
                  onClick={() => handleToolClick(tool)}
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
              className="ml-auto flex items-center gap-2"
              onPointerDownCapture={() => setOpenToolOptions(null)}
            >
              <ToolbarDivider />
              <div className="flex h-10 gap-1" aria-label="历史操作">
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
                  if (floatingSelectionRef.current) cancelFloatingSelection()
                  if (editor.canRedo) editor.redo()
                }}
              >
                <ArrowClockwise size={18} weight="regular" />
              </button>
              </div>
              <ToolbarDivider />
              <div
                className="flex h-10 items-center rounded-2xl bg-editor-surface-soft p-1"
                aria-label="画布缩放"
              >
                <button
                  className="grid h-8 w-8 place-items-center rounded-xl text-editor-text transition hover:bg-editor-elevated disabled:opacity-35"
                  type="button"
                  aria-label="缩小"
                  disabled={editor.zoom <= 1}
                  onClick={() => editor.setZoom(Math.max(1, editor.zoom - 10))}
                >
                  <Minus size={15} weight="bold" />
                </button>
                <button
                  type="button"
                  className="h-8 w-12 rounded-xl text-center text-xs font-bold tabular-nums text-editor-strong transition hover:bg-editor-elevated"
                  aria-label="适应画布"
                  title="适应画布"
                  onClick={fitCanvasToViewport}
                >
                  {editor.zoom}%
                </button>
                <button
                  className="grid h-8 w-8 place-items-center rounded-xl text-editor-text transition hover:bg-editor-elevated disabled:opacity-35"
                  type="button"
                  aria-label="放大"
                  disabled={editor.zoom >= 220}
                  onClick={() => editor.setZoom(Math.min(220, editor.zoom + 10))}
                >
                  <Plus size={15} weight="bold" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`grid min-h-0 flex-1 place-items-center overflow-auto rounded-[18px] p-10 [clip-path:inset(0_round_18px)] [touch-action:none] [overscroll-behavior:contain] ${cursorClass}`}
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
          viewport.scrollLeft = panStartRef.current.scrollLeft - deltaX
          viewport.scrollTop = panStartRef.current.scrollTop - deltaY
        }}
        onPointerLeave={() => {
          endStroke()
          setPointerOutsideSelection(false)
          panningRef.current = false
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
          className="shrink-0 rounded-xl p-4"
          style={{
            width: `${scaledCanvasWidth + 32}px`,
            height: `${scaledCanvasHeight + 32}px`,
          }}
        >
          <div
            className="relative overflow-visible"
            style={{
              width: `${scaledCanvasWidth}px`,
              height: `${scaledCanvasHeight}px`,
            }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
                transform: `scale(${zoomScale})`,
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
                      editor.currentTool === 'eraser')
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
                      <SelectionLayerCorner
                        position="top-left"
                      />
                      <SelectionLayerCorner
                        position="top-right"
                      />
                      <SelectionLayerCorner
                        position="bottom-left"
                      />
                      <SelectionLayerCorner
                        position="bottom-right"
                      />
                    </>
                  ) : null}
                </div>
              ) : null}
              {floatingSelection ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-[5] bg-[rgba(31,24,18,0.07)]"
                />
              ) : null}
              {settings.showGrid ? (
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
                    strokeWidth={settings.gridWidth}
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
                      strokeWidth={settings.gridWidth * 1.6}
                    />
                  ) : null}
                </svg>
              ) : null}
              {editor.protectedSelection &&
              !editor.eyedropperActive &&
              (editor.currentTool === 'brush' ||
                editor.currentTool === 'eraser' ||
                editor.currentTool === 'fill' ||
                editor.currentTool === 'shape') ? (
                <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
                  <div
                    className="absolute shadow-[0_0_0_9999px_rgba(31,24,18,0.10)]"
                    style={{
                      left: editor.protectedSelection.x * cellSize,
                      top: editor.protectedSelection.y * cellSize,
                      width: editor.protectedSelection.width * cellSize,
                      height: editor.protectedSelection.height * cellSize,
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-editor-text">
        <span>
          {editor.cols} × {editor.rows} 颗
        </span>
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
            className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition active:scale-95 ${
              active
                ? 'bg-editor-accent text-white shadow-sm'
                : 'text-editor-strong hover:bg-editor-elevated'
            }`}
            aria-pressed={active}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            <Icon size={15} weight="regular" />
            <span>{option.label}</span>
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

function SymmetryBothIcon({ size = 18, weight: _weight }: IconProps) {
  return (
    <SymmetryIconFrame size={size}>
      <RightTriangleOutline points="62 116 116 116 116 62" />
      <RightTriangleOutline points="140 116 140 62 194 116" />
      <RightTriangleOutline points="62 140 116 140 116 194" />
      <RightTriangleOutline points="140 140 194 140 140 194" />
    </SymmetryIconFrame>
  )
}

function SymmetryCenterIcon({ size = 18, weight: _weight }: IconProps) {
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

function ToolbarDivider() {
  return (
    <span
      aria-hidden="true"
      className="h-6 w-px shrink-0 bg-editor-border md:mx-0.5"
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
