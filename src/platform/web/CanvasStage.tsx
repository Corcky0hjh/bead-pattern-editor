import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ComponentType,
  type ReactNode,
} from 'react'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  Eyedropper,
  Eraser,
  FlipHorizontal,
  FlipVertical,
  Hand,
  Minus,
  PaintBrush,
  PaintBucket,
  type IconProps,
} from '@phosphor-icons/react'
import { Slider } from '../../components/Slider'
import type {
  EditorStateController,
  EditorTool,
  SymmetryMode,
} from '../../features/editor/useEditorState'

type CanvasStageProps = {
  editor: EditorStateController
}

type PhosphorIcon = ComponentType<IconProps>

type StageTool = { value: EditorTool; label: string; icon: PhosphorIcon }

const stageTools: StageTool[] = [
  { value: 'pan', label: '移动', icon: Hand },
  { value: 'brush', label: '画笔', icon: PaintBrush },
  { value: 'eraser', label: '橡皮', icon: Eraser },
  { value: 'fill', label: '填充', icon: PaintBucket },
]

const sizeOptions = [1, 2, 3, 5]
const symmetryOptions: Array<{
  value: SymmetryMode
  label: string
  icon: PhosphorIcon
}> = [
  { value: 'off', label: '关闭对称', icon: Minus },
  { value: 'vertical', label: '左右对称', icon: FlipHorizontal },
  { value: 'horizontal', label: '上下对称', icon: FlipVertical },
  { value: 'both', label: '双轴对称', icon: SymmetryBothIcon },
  { value: 'center', label: '中心对称', icon: SymmetryCenterIcon },
]
const baseCellSize = 12

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
  const panningRef = useRef(false)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
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
  const canvasWidth = pattern.width * baseCellSize
  const canvasHeight = pattern.height * baseCellSize
  const scaledCanvasWidth = Math.round(canvasWidth * zoomScale)
  const scaledCanvasHeight = Math.round(canvasHeight * zoomScale)
  const settings = editor.canvasSettings

  // 细网格:每一格的边界都画
  const verticalGridLines = Array.from(
    { length: pattern.width + 1 },
    (_, index) => index * baseCellSize,
  )
  const horizontalGridLines = Array.from(
    { length: pattern.height + 1 },
    (_, index) => index * baseCellSize,
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
  const cursorClass = editor.eyedropperActive
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
      const x = (index % pattern.width) * baseCellSize
      const y = Math.floor(index / pattern.width) * baseCellSize
      context.fillStyle = cell.color
      context.fillRect(x, y, baseCellSize, baseCellSize)
    })
  }, [
    canvasHeight,
    canvasWidth,
    pattern,
    settings.paperColor,
    settings.paperAlpha,
  ])

  // Ctrl/Cmd + 滚轮缩放（必须 native 监听，React onWheel 是 passive）
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const delta = event.deltaY > 0 ? -10 : 10
      editor.setZoom((current) => Math.min(220, Math.max(50, current + delta)))
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

  return (
    <section
      className="flex max-h-[calc(100svh-2rem)] min-h-[calc(100svh-2rem)] flex-col rounded-[32px] border border-editor-border bg-editor-surface p-4 md:p-5 2xl:h-full 2xl:min-h-0 2xl:max-h-full"
      aria-label="拼豆图纸编辑区"
    >
      <div className="fixed inset-x-3 bottom-4 z-50 grid gap-3 overflow-x-auto rounded-[24px] border border-editor-border bg-editor-elevated/92 p-2 shadow-[0_18px_60px_rgba(31,24,18,0.18)] backdrop-blur-md md:inset-x-6 2xl:static 2xl:z-auto 2xl:mb-4 2xl:overflow-visible 2xl:rounded-[26px] 2xl:bg-editor-elevated/70 2xl:p-3 2xl:shadow-none 2xl:backdrop-blur-none">
        <div className="flex w-max min-w-full items-end gap-3 2xl:w-auto 2xl:flex-wrap 2xl:justify-between 2xl:gap-x-4 2xl:gap-y-3">
          <ToolbarGroup label="工具">
            <div
              className="flex h-10 gap-1 2xl:flex-wrap"
              aria-label="主要工具"
            >
              {stageTools.map((tool) => (
                <ToolModeButton
                  key={tool.value}
                  tool={tool}
                  active={editor.currentTool === tool.value}
                  size={
                    tool.value === 'brush'
                      ? editor.brushSize
                      : tool.value === 'eraser'
                        ? editor.eraserSize
                        : null
                  }
                  onClick={() => {
                    editor.setCurrentTool(tool.value)
                    editor.setEyedropperActive(false)
                  }}
                />
              ))}
              <button
                aria-pressed={editor.eyedropperActive}
                aria-label="吸管"
                title="吸管"
                className={`grid h-10 w-10 place-items-center rounded-2xl text-sm font-bold transition ${
                  editor.eyedropperActive
                    ? 'bg-editor-accent text-white'
                    : 'bg-editor-surface-soft text-editor-strong hover:bg-editor-accent-soft'
                }`}
                type="button"
                onClick={() => editor.setEyedropperActive((value) => !value)}
              >
                <Eyedropper size={18} weight="regular" />
              </button>
            </div>
          </ToolbarGroup>

          {editor.currentTool === 'brush' || editor.currentTool === 'eraser' ? (
            <ToolbarGroup label="笔刷大小">
              <ToolSizePicker
                value={
                  editor.currentTool === 'brush'
                    ? editor.brushSize
                    : editor.eraserSize
                }
                onChange={
                  editor.currentTool === 'brush'
                    ? editor.setBrushSize
                    : editor.setEraserSize
                }
              />
            </ToolbarGroup>
          ) : null}

          <ToolbarGroup label="对称">
            <SymmetryModePicker
              value={editor.symmetryMode}
              onChange={editor.setSymmetryMode}
            />
          </ToolbarGroup>

          <ToolbarGroup label="撤销 / 重做">
            <div className="flex h-10 gap-1">
              <button
                className="grid h-10 w-10 place-items-center rounded-2xl bg-editor-surface-soft text-editor-text transition hover:bg-editor-accent-soft disabled:opacity-35"
                type="button"
                disabled={!editor.canUndo}
                aria-label="撤销"
                onClick={editor.undo}
              >
                <ArrowCounterClockwise size={18} weight="regular" />
              </button>
              <button
                className="grid h-10 w-10 place-items-center rounded-2xl bg-editor-surface-soft text-editor-text transition hover:bg-editor-accent-soft disabled:opacity-35"
                type="button"
                disabled={!editor.canRedo}
                aria-label="重做"
                onClick={editor.redo}
              >
                <ArrowClockwise size={18} weight="regular" />
              </button>
            </div>
          </ToolbarGroup>

          <ToolbarGroup label="缩放">
            <label className="flex h-10 min-w-48 items-center gap-3 rounded-2xl bg-editor-surface-soft px-3">
              <span className="min-w-0 flex-1">
                <Slider
                  bare
                  label="缩放"
                  size="sm"
                  value={editor.zoom}
                  onChange={editor.setZoom}
                  min={50}
                  max={220}
                />
              </span>
              <strong className="w-12 text-right text-xs text-editor-strong">
                {editor.zoom}%
              </strong>
            </label>
          </ToolbarGroup>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`grid min-h-0 flex-1 place-items-center overflow-auto rounded-[18px] p-10 [clip-path:inset(0_round_18px)] [touch-action:none] [overscroll-behavior:contain] ${cursorClass}`}
        style={{ backgroundColor: settings.bgColor }}
        onPointerDown={(event) => {
          const viewport = viewportRef.current
          if (!viewport) return

          if (event.button === 1) {
            startPan(event, viewport)
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
          panningRef.current = false
        }}
        onPointerUp={(event) => {
          endStroke()
          if (panningRef.current) {
            viewportRef.current?.releasePointerCapture(event.pointerId)
          }
          panningRef.current = false
          activePointerIdRef.current = null
        }}
        onPointerCancel={() => {
          endStroke()
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
                  if (painting && editor.currentTool !== 'fill') {
                    paintFromPointer(event)
                  }
                }}
              />
              {settings.showGrid ? (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
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
    <div className="flex h-10 items-center gap-1 rounded-2xl bg-editor-surface-soft px-1">
      {sizeOptions.map((size) => (
        <button
          className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black transition ${
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
    <div className="flex h-10 items-center gap-1 rounded-2xl bg-editor-surface-soft px-1">
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
      className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black transition ${
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

function ToolbarGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid shrink-0 gap-1.5">
      <span className="px-1 text-[11px] font-black tracking-[0.08em] text-editor-text uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

function ToolModeButton({
  tool,
  active,
  size,
  onClick,
}: {
  tool: StageTool
  active: boolean
  size: number | null
  onClick: () => void
}) {
  const Icon = tool.icon
  return (
    <button
      aria-pressed={active}
      aria-label={tool.label}
      title={tool.label}
      className={`relative grid h-10 w-10 place-items-center rounded-2xl text-sm font-bold transition ${
        active
          ? 'bg-editor-accent text-white'
          : 'bg-editor-surface-soft text-editor-strong hover:bg-editor-accent-soft'
      }`}
      type="button"
      onClick={onClick}
    >
      <Icon size={18} weight="regular" />
      {size ? (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-editor-elevated px-1 text-[10px] font-black tabular-nums text-editor-strong shadow-sm">
          {size}
        </span>
      ) : null}
    </button>
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
