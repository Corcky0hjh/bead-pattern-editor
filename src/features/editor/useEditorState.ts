import { useEffect, useMemo, useRef, useState } from 'react'
import {
  brands,
  type BeadColor,
  type BrandId,
  defaultBrandId,
  getBrand,
  getBrandColors,
  getDisplayCode,
  isBrandId,
} from '../../core/color'
import {
  hexToRgbTuple,
  oklabDistance,
  rgbToOklab,
} from '../../core/color/distance'
import {
  defaultConversionPreset,
  type ConversionAlgorithm,
  type ImageCropRect,
  type ImageFitMode,
  type ImagePlacement,
  quantizeImage,
} from '../../core/image/conversion'
import {
  bfsMergeRegions,
  limitColors,
  markExternalBackground,
} from '../../core/image/postprocess'
import { maxHistorySteps } from '../../core/history/stack'
import {
  DEFAULT_CANVAS_SETTINGS,
  parseCanvasSettings,
  type CanvasSettings,
} from '../../core/canvas/settings'
import {
  DEFAULT_THEME_ID,
  applyTheme,
  getTheme,
  isThemeId,
  type ThemeId,
} from '../../core/theme/themes'
import {
  downloadCanvas,
  renderPatternWithKeys,
  renderShoppingList,
  type LabelByHex,
} from '../../platform/web/imageExport'
import {
  createSolidPatternGrid,
  CANVAS_BG_COLOR,
  MAX_PATTERN_SIDE,
  MIN_PATTERN_SIDE,
  parsePatternGrid,
  type PatternGrid,
} from '../../core/pattern/grid'

export type EditorTool = 'pan' | 'select' | 'brush' | 'eraser' | 'fill' | 'shape'
export type SymmetryMode = 'off' | 'vertical' | 'horizontal' | 'both' | 'center'
export type FillMode = 'region' | 'global'
export type ShapeKind = 'line' | 'rectangle' | 'ellipse'
export type ShapeStyle = 'outline' | 'filled'
export type SelectionRect = {
  x: number
  y: number
  width: number
  height: number
}
export type SelectionFlipAxis = 'horizontal' | 'vertical'
export type SelectionLayerCell = { x: number; y: number; color: string }

export type EditorStateController = ReturnType<typeof useEditorState>

export type ImageConversionOptions = {
  width: number
  height: number
  algorithm: ConversionAlgorithm
  fit: ImageFitMode
  colorLimit: number
  mergeThreshold: number
  detectBackground: boolean
  crop?: ImageCropRect
  placement?: ImagePlacement
}

const initialColor = '#ff7a59'
const customPaletteStorageKey = 'bead-pattern-editor:custom-palette'
const currentBrandStorageKey = 'bead-pattern-editor:current-brand'
const canvasSettingsStorageKey = 'bead-pattern-editor:canvas-settings'
const themeStorageKey = 'bead-pattern-editor:theme'
const disabledPaletteStorageKey = 'bead-pattern-editor:disabled-palette-colors'

type HistoryState = {
  past: PatternGrid[]
  present: PatternGrid
  future: PatternGrid[]
  pastExcluded: Set<string>[]
  futureExcluded: Set<string>[]
}

const initialPattern = createSolidPatternGrid({
  width: defaultConversionPreset.size,
  height: defaultConversionPreset.size,
})

export function useEditorState() {
  const [rows, setRows] = useState<number>(defaultConversionPreset.size)
  const [cols, setCols] = useState<number>(defaultConversionPreset.size)
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: initialPattern,
    future: [],
    pastExcluded: [],
    futureExcluded: [],
  })
  const [currentTool, setCurrentTool] = useState<EditorTool>('brush')
  const [brushSymmetryMode, setBrushSymmetryMode] =
    useState<SymmetryMode>('off')
  const [eraserSymmetryMode, setEraserSymmetryMode] =
    useState<SymmetryMode>('off')
  const [brushSize, setBrushSize] = useState(1)
  const [eraserSize, setEraserSize] = useState(1)
  const [fillMode, setFillMode] = useState<FillMode>('region')
  const [shapeKind, setShapeKind] = useState<ShapeKind>('line')
  const [shapeStyle, setShapeStyle] = useState<ShapeStyle>('outline')
  const [protectedSelection, setProtectedSelection] =
    useState<SelectionRect | null>(null)
  const [currentColor, setCurrentColor] = useState(initialColor)
  const [eyedropperActive, setEyedropperActive] = useState(false)
  const [paletteExpanded, setPaletteExpanded] = useState(false)
  const [recentColors, setRecentColors] = useState<string[]>([initialColor])
  const [customPalette, setCustomPalette] = useState<BeadColor[]>(() =>
    loadCustomPalette(),
  )
  const [disabledPaletteHexes, setDisabledPaletteHexes] = useState<Set<string>>(
    () => loadHexSet(disabledPaletteStorageKey),
  )
  const [excludedColorHexes, setExcludedColorHexes] = useState<Set<string>>(
    () => new Set(),
  )
  const [currentBrand, setCurrentBrandState] = useState<BrandId>(() =>
    loadCurrentBrand(),
  )
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>(() =>
    loadCanvasSettings(),
  )
  const [currentTheme, setCurrentThemeState] = useState<ThemeId>(() =>
    loadTheme(),
  )
  const [zoom, setZoom] = useState(100)
  const [converter, setConverter] = useState<ConversionAlgorithm>(
    defaultConversionPreset.algorithm,
  )
  const [colorLimit, setColorLimit] = useState(32)
  const [mergeThreshold, setMergeThreshold] = useState(10)
  const [detectBackground, setDetectBackground] = useState(true)
  const [imageFitMode, setImageFitMode] = useState<ImageFitMode>('contain')
  const [imageCrop, setImageCrop] = useState<ImageCropRect | undefined>()
  const [imagePlacement, setImagePlacement] = useState<
    ImagePlacement | undefined
  >()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageStatus, setImageStatus] = useState('还没上传图片')

  const strokeBaselineRef = useRef<PatternGrid | null>(null)
  const strokeDraftRef = useRef<PatternGrid | null>(null)

  useEffect(() => {
    localStorage.setItem(customPaletteStorageKey, JSON.stringify(customPalette))
  }, [customPalette])

  useEffect(() => {
    localStorage.setItem(
      disabledPaletteStorageKey,
      JSON.stringify([...disabledPaletteHexes]),
    )
  }, [disabledPaletteHexes])

  useEffect(() => {
    localStorage.setItem(currentBrandStorageKey, currentBrand)
  }, [currentBrand])

  useEffect(() => {
    localStorage.setItem(
      canvasSettingsStorageKey,
      JSON.stringify(canvasSettings),
    )
  }, [canvasSettings])

  useEffect(() => {
    applyTheme(currentTheme)
    localStorage.setItem(themeStorageKey, currentTheme)
  }, [currentTheme])

  const pattern = history.present
  useEffect(() => {
    setRows(pattern.height)
    setCols(pattern.width)
  }, [pattern.height, pattern.width])
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const brand = useMemo(() => getBrand(currentBrand), [currentBrand])
  const brandColors = useMemo(
    () => getBrandColors(currentBrand),
    [currentBrand],
  )
  const palette = useMemo<BeadColor[]>(
    () => mergePaletteWithCustomPriority(brandColors, customPalette),
    [brandColors, customPalette],
  )
  const availablePalette = useMemo<BeadColor[]>(
    () =>
      palette.filter(
        (color) => !disabledPaletteHexes.has(normalizeHex(color.hex)),
      ),
    [palette, disabledPaletteHexes],
  )
  const conversionPalette = useMemo<BeadColor[]>(
    () =>
      availablePalette.filter(
        (color) => !excludedColorHexes.has(normalizeHex(color.hex)),
      ),
    [availablePalette, excludedColorHexes],
  )

  function setCurrentBrand(next: BrandId) {
    setCurrentBrandState(next)
  }

  function updateCanvasSettings(partial: Partial<CanvasSettings>) {
    setCanvasSettings((previous) => {
      const next = { ...previous, ...partial }
      if (partial.paperColor) {
        next.externalColor = partial.paperColor
      }
      return next
    })
  }

  function resetCanvasSettings() {
    // 恢复到当前主题的画布默认,而不是写死的初始默认
    const themeCanvas = getTheme(currentTheme).canvas
    setCanvasSettings({
      ...DEFAULT_CANVAS_SETTINGS,
      ...themeCanvas,
      externalColor: themeCanvas.paperColor,
    })
  }

  function toggleShowGrid() {
    setCanvasSettings((previous) => ({
      ...previous,
      showGrid: !previous.showGrid,
    }))
  }

  function setCurrentTheme(next: ThemeId) {
    setCurrentThemeState(next)
    // 切主题直接覆盖画布外观(5 项跟主题走);showGrid / gridWidth / majorGridEvery 用户偏好保留
    const themeCanvas = getTheme(next).canvas
    setCanvasSettings((previous) => ({
      ...previous,
      ...themeCanvas,
      externalColor: themeCanvas.paperColor,
    }))
  }

  const colorStats = useMemo(() => {
    const counts = new Map<string, number>()
    pattern.cells.forEach((cell) => {
      if (cell.isExternal) return
      if (cell.color === null) return
      counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1)
    })
    const codeByHex = new Map<string, string | null>()
    palette.forEach((color) => {
      codeByHex.set(
        color.hex.toLowerCase(),
        getDisplayCode(color, currentBrand),
      )
    })
    return [...counts.entries()]
      .map(([color, count]) => ({
        color,
        count,
        code: codeByHex.get(color.toLowerCase()) ?? null,
      }))
      .sort((left, right) => right.count - left.count)
  }, [pattern, palette, currentBrand])

  const usedCount = useMemo(
    () => colorStats.reduce((total, item) => total + item.count, 0),
    [colorStats],
  )

  function rememberColor(color: string) {
    const normalized = color.toLowerCase()
    setRecentColors((previous) =>
      [normalized, ...previous.filter((item) => item !== normalized)].slice(
        0,
        8,
      ),
    )
  }

  function updateCurrentColor(color: string) {
    const normalized = color.toLowerCase()
    setCurrentColor(normalized)
    rememberColor(normalized)
  }

  function selectDrawingColor(color: string) {
    updateCurrentColor(color)
    setEyedropperActive(false)
    if (currentTool !== 'fill' && currentTool !== 'shape') {
      setCurrentTool('brush')
    }
  }

  /**
   * 只更新当前颜色,不记最近用过。
   * 给取色器拖动预览这类高频场景用——拖动中色变了就要画笔跟着变,
   * 但不能每帧都往 recent 列表里塞一个色。
   */
  function previewCurrentColor(color: string) {
    setCurrentColor(color.toLowerCase())
  }

  function addCurrentColorToPalette() {
    const normalized = currentColor.toLowerCase()
    if (
      customPalette.some((item) => item.hex.toLowerCase() === normalized)
    ) {
      return
    }
    setCustomPalette((previous) => [
      ...previous,
      {
        hex: normalized,
        codes: {},
        nameZh: `自定义 ${previous.length + 1}`,
      },
    ])
  }

  function removeCustomColor(hex: string) {
    const normalized = normalizeHex(hex)
    const hasBrandFallback = brands.some((brandOption) =>
      getBrandColors(brandOption.id).some(
        (item) => normalizeHex(item.hex) === normalized,
      ),
    )
    setCustomPalette((previous) =>
      previous.filter((item) => item.hex.toLowerCase() !== normalized),
    )
    if (!hasBrandFallback) {
      setDisabledPaletteHexes((previous) => withoutHex(previous, normalized))
      setExcludedColorHexes((previous) => withoutHex(previous, normalized))
    }
  }

  function renameCustomColor(hex: string, name: string) {
    const normalized = hex.toLowerCase()
    const normalizedName = name.trim().slice(0, 32)
    if (!normalizedName) return
    setCustomPalette((previous) =>
      previous.map((item) =>
        item.hex.toLowerCase() === normalized
          ? { ...item, nameZh: normalizedName }
          : item,
      ),
    )
  }

  function setPaletteColorEnabled(hex: string, enabled: boolean) {
    const normalized = normalizeHex(hex)
    setDisabledPaletteHexes((previous) => {
      const next = new Set(previous)
      if (enabled) next.delete(normalized)
      else next.add(normalized)
      return next
    })
    if (!enabled) {
      setExcludedColorHexes((previous) => withoutHex(previous, normalized))
      if (normalizeHex(currentColor) === normalized) {
        const fallback = palette.find((color) => {
          const candidate = normalizeHex(color.hex)
          return candidate !== normalized && !disabledPaletteHexes.has(candidate)
        })
        if (fallback) updateCurrentColor(fallback.hex)
      }
    }
  }

  function setAllPaletteColorsEnabled(enabled: boolean) {
    if (enabled) {
      setDisabledPaletteHexes(new Set())
      return
    }
    setDisabledPaletteHexes(
      new Set(palette.map((color) => normalizeHex(color.hex))),
    )
    setExcludedColorHexes(new Set())
  }

  function resetPaletteSelection() {
    setDisabledPaletteHexes(new Set())
  }

  function commitPattern(
    next: PatternGrid,
    nextExcluded = excludedColorHexes,
  ) {
    setHistory((previous) => ({
      past: [...previous.past, previous.present].slice(-maxHistorySteps),
      present: next,
      future: [],
      pastExcluded: [
        ...previous.pastExcluded,
        new Set(excludedColorHexes),
      ].slice(-maxHistorySteps),
      futureExcluded: [],
    }))
    setExcludedColorHexes(new Set(nextExcluded))
  }

  function undo() {
    const nextPresent = history.past.at(-1)
    if (!nextPresent) return
    const nextExcluded = history.pastExcluded.at(-1)
    setExcludedColorHexes(new Set(nextExcluded ?? []))
    setHistory({
      past: history.past.slice(0, -1),
      present: nextPresent,
      future: [history.present, ...history.future].slice(0, maxHistorySteps),
      pastExcluded: history.pastExcluded.slice(0, -1),
      futureExcluded: [
        new Set(excludedColorHexes),
        ...history.futureExcluded,
      ].slice(0, maxHistorySteps),
    })
  }

  function redo() {
    const nextPresent = history.future[0]
    if (!nextPresent) return
    const nextExcluded = history.futureExcluded[0]
    setExcludedColorHexes(new Set(nextExcluded ?? []))
    setHistory({
      past: [...history.past, history.present].slice(-maxHistorySteps),
      present: nextPresent,
      future: history.future.slice(1),
      pastExcluded: [
        ...history.pastExcluded,
        new Set(excludedColorHexes),
      ].slice(-maxHistorySteps),
      futureExcluded: history.futureExcluded.slice(1),
    })
  }

  function applyCanvasSize(nextRows = rows, nextCols = cols) {
    const normalizedRows = clamp(
      Math.round(nextRows),
      MIN_PATTERN_SIDE,
      MAX_PATTERN_SIDE,
    )
    const normalizedCols = clamp(
      Math.round(nextCols),
      MIN_PATTERN_SIDE,
      MAX_PATTERN_SIDE,
    )
    setRows(normalizedRows)
    setCols(normalizedCols)
    commitPattern(
      createSolidPatternGrid({
        width: normalizedCols,
        height: normalizedRows,
      }),
      new Set(),
    )
  }

  function clearCanvas() {
    commitPattern(
      createSolidPatternGrid({
        width: pattern.width,
        height: pattern.height,
      }),
      new Set(),
    )
  }

  function beginStroke() {
    strokeBaselineRef.current = pattern
    strokeDraftRef.current = pattern
  }

  function endStroke() {
    const baseline = strokeBaselineRef.current
    const draft = strokeDraftRef.current
    strokeBaselineRef.current = null
    strokeDraftRef.current = null

    if (!baseline || !draft) return
    if (draft === baseline) return

    setHistory((previous) => ({
      past: [...previous.past, baseline].slice(-maxHistorySteps),
      present: draft,
      future: [],
      pastExcluded: [
        ...previous.pastExcluded,
        new Set(excludedColorHexes),
      ].slice(-maxHistorySteps),
      futureExcluded: [],
    }))
  }

  function paintCell(index: number) {
    if (eyedropperActive) {
      const sampledColor = pattern.cells[index]?.color
      if (sampledColor) {
        // 吸管:只有点到实色才更新当前色;点到空 cell 无意义,保持原色
        updateCurrentColor(sampledColor)
      }
      setEyedropperActive(false)
      return
    }

    if (currentTool === 'pan') return
    if (currentTool === 'fill') {
      if (fillMode === 'global') {
        fillAllMatching(index)
      } else {
        fillFrom(index)
      }
      return
    }

    const color = currentTool === 'eraser' ? null : currentColor
    const size = currentTool === 'eraser' ? eraserSize : brushSize
    const symmetryMode =
      currentTool === 'eraser' ? eraserSymmetryMode : brushSymmetryMode
    for (const targetIndex of getSymmetryIndexes(
      index,
      pattern.width,
      pattern.height,
      symmetryMode,
      protectedSelection,
    )) {
      paintArea(targetIndex, size, color)
    }
  }

  function paintArea(index: number, size: number, color: string | null) {
    const draftBase = strokeDraftRef.current ?? pattern
    const centerX = index % draftBase.width
    const centerY = Math.floor(index / draftBase.width)
    const startX = centerX - Math.floor(size / 2)
    const startY = centerY - Math.floor(size / 2)
    const nextCells = draftBase.cells.slice()
    let changed = false

    for (let y = startY; y < startY + size; y += 1) {
      for (let x = startX; x < startX + size; x += 1) {
        if (x < 0 || y < 0 || x >= draftBase.width || y >= draftBase.height) {
          continue
        }
        const cellIndex = y * draftBase.width + x
        if (!isIndexInsideSelection(cellIndex, draftBase.width, protectedSelection)) {
          continue
        }
        if (
          nextCells[cellIndex].color === color &&
          !nextCells[cellIndex].isExternal
        ) {
          continue
        }
        nextCells[cellIndex] = { color }
        changed = true
      }
    }

    if (!changed) return
    const nextPattern = { ...draftBase, cells: nextCells }

    if (strokeBaselineRef.current) {
      strokeDraftRef.current = nextPattern
      setHistory((previous) => ({ ...previous, present: nextPattern }))
    } else {
      commitPattern(nextPattern)
    }
  }

  function fillFrom(index: number) {
    if (!isIndexInsideSelection(index, pattern.width, protectedSelection)) return
    const startCell = pattern.cells[index]
    if (!startCell) return
    const targetColor = startCell.color
    const targetExternal = Boolean(startCell.isExternal)
    if (targetColor === currentColor && !targetExternal) return

    const nextCells = pattern.cells.map((cell) => ({ ...cell }))
    const queue = [index]
    const visited = new Set<number>()

    while (queue.length > 0) {
      const currentIndex = queue.shift()
      if (currentIndex === undefined || visited.has(currentIndex)) continue
      const currentCell = nextCells[currentIndex]
      if (!isIndexInsideSelection(currentIndex, pattern.width, protectedSelection)) {
        continue
      }
      if (
        currentCell?.color !== targetColor ||
        Boolean(currentCell.isExternal) !== targetExternal
      ) {
        continue
      }

      visited.add(currentIndex)
      nextCells[currentIndex] = { color: currentColor }

      const x = currentIndex % pattern.width
      const y = Math.floor(currentIndex / pattern.width)
      if (x > 0) queue.push(currentIndex - 1)
      if (x < pattern.width - 1) queue.push(currentIndex + 1)
      if (y > 0) queue.push(currentIndex - pattern.width)
      if (y < pattern.height - 1) queue.push(currentIndex + pattern.width)
    }

    commitPattern({ ...pattern, cells: nextCells })
  }

  function fillAllMatching(index: number) {
    if (!isIndexInsideSelection(index, pattern.width, protectedSelection)) return
    const sourceColor = pattern.cells[index]?.color
    if (!sourceColor) return
    const normalizedSource = normalizeHex(sourceColor)
    const normalizedCurrent = normalizeHex(currentColor)
    if (normalizedSource === normalizedCurrent) return
    commitPattern({
      ...pattern,
      cells: pattern.cells.map((cell, index) =>
        isIndexInsideSelection(
          index,
          pattern.width,
          protectedSelection,
        ) &&
        !cell.isExternal &&
        cell.color &&
        normalizeHex(cell.color) === normalizedSource
          ? { ...cell, color: normalizedCurrent }
          : cell,
      ),
    })
  }

  function drawShape(startIndex: number, endIndex: number) {
    const indexes = getShapeCellIndexes(
      startIndex,
      endIndex,
      pattern.width,
      pattern.height,
      shapeKind,
      shapeStyle,
      brushSize,
    ).filter((index) =>
      isIndexInsideSelection(index, pattern.width, protectedSelection),
    )
    if (indexes.length === 0) return
    const nextCells = pattern.cells.slice()
    let changed = false
    indexes.forEach((index) => {
      if (
        nextCells[index].color === currentColor &&
        !nextCells[index].isExternal
      ) {
        return
      }
      nextCells[index] = { color: currentColor }
      changed = true
    })
    if (changed) commitPattern({ ...pattern, cells: nextCells })
  }

  function deleteSelection(selection: SelectionRect) {
    let changed = false
    const nextCells = pattern.cells.map((cell, index) => {
      const x = index % pattern.width
      const y = Math.floor(index / pattern.width)
      const selected =
        x >= selection.x &&
        x < selection.x + selection.width &&
        y >= selection.y &&
        y < selection.y + selection.height
      if (!selected || cell.color === null || cell.isExternal) return cell
      changed = true
      return { color: null }
    })
    if (changed) commitPattern({ ...pattern, cells: nextCells })
  }

  function moveSelection(selection: SelectionRect, dx: number, dy: number) {
    if (dx === 0 && dy === 0) return
    const selectedCells: Array<{ x: number; y: number; color: string }> = []
    const nextCells = pattern.cells.slice()

    for (let y = selection.y; y < selection.y + selection.height; y += 1) {
      for (let x = selection.x; x < selection.x + selection.width; x += 1) {
        const index = y * pattern.width + x
        const cell = pattern.cells[index]
        const color = cell?.color
        if (!color || cell.isExternal) continue
        selectedCells.push({ x, y, color })
        nextCells[index] = { color: null }
      }
    }

    if (selectedCells.length === 0) return
    selectedCells.forEach(({ x, y, color }) => {
      const targetX = x + dx
      const targetY = y + dy
      if (
        targetX < 0 ||
        targetY < 0 ||
        targetX >= pattern.width ||
        targetY >= pattern.height
      ) {
        return
      }
      nextCells[targetY * pattern.width + targetX] = { color }
    })
    commitPattern({ ...pattern, cells: nextCells })
  }

  function flipSelection(selection: SelectionRect, axis: SelectionFlipAxis) {
    const selectedCells: Array<{ x: number; y: number; color: string }> = []
    const nextCells = pattern.cells.slice()

    for (let y = selection.y; y < selection.y + selection.height; y += 1) {
      for (let x = selection.x; x < selection.x + selection.width; x += 1) {
        const index = y * pattern.width + x
        const cell = pattern.cells[index]
        if (!cell?.color || cell.isExternal) continue
        selectedCells.push({ x, y, color: cell.color })
        nextCells[index] = { color: null }
      }
    }
    if (selectedCells.length === 0) return

    selectedCells.forEach(({ x, y, color }) => {
      const targetX =
        axis === 'horizontal'
          ? selection.x + selection.width - 1 - (x - selection.x)
          : x
      const targetY =
        axis === 'vertical'
          ? selection.y + selection.height - 1 - (y - selection.y)
          : y
      nextCells[targetY * pattern.width + targetX] = { color }
    })
    commitPattern({ ...pattern, cells: nextCells })
  }

  function copySelectionToOrigin(selection: SelectionRect) {
    const nextCells = pattern.cells.slice()
    let changed = false
    for (let y = 0; y < selection.height; y += 1) {
      for (let x = 0; x < selection.width; x += 1) {
        const source = pattern.cells[
          (selection.y + y) * pattern.width + selection.x + x
        ]
        if (!source?.color || source.isExternal) continue
        nextCells[y * pattern.width + x] = { color: source.color }
        changed = true
      }
    }
    if (changed) commitPattern({ ...pattern, cells: nextCells })
  }

  function commitSelectionLayer(
    source: SelectionRect,
    target: SelectionRect,
    cells: SelectionLayerCell[],
    clearSource: boolean,
  ) {
    const nextCells = pattern.cells.slice()
    let changed = false

    if (clearSource) {
      for (let y = source.y; y < source.y + source.height; y += 1) {
        for (let x = source.x; x < source.x + source.width; x += 1) {
          const index = y * pattern.width + x
          const cell = nextCells[index]
          if (!cell?.color || cell.isExternal) continue
          nextCells[index] = { color: null }
          changed = true
        }
      }
    }

    cells.forEach((cell) => {
      const x = target.x + cell.x
      const y = target.y + cell.y
      if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) return
      nextCells[y * pattern.width + x] = { color: cell.color }
      changed = true
    })

    if (changed) commitPattern({ ...pattern, cells: nextCells })
  }

  function removeIsolatedCells() {
    const nextCells = pattern.cells.map((cell, index) => {
      // 空格不参与"清理孤立";它本来就是空,不算杂色
      if (cell.color === null) return cell

      const neighbors = getNeighborColors(pattern, index)
      const matchingNeighbors = neighbors.filter(
        (color) => color === cell.color,
      )
      if (matchingNeighbors.length > 0) return cell

      // 优先吸附到相邻实色;没有就清空(回到 null)
      const dominantNeighbor = neighbors.find((color) => color !== null)
      return { color: dominantNeighbor ?? null }
    })

    commitPattern({ ...pattern, cells: nextCells })
  }

  async function convertImage(
    file = imageFile,
    options: {
      excludedColors?: Set<string>
      resetExcluded?: boolean
      width?: number
      height?: number
      algorithm?: ConversionAlgorithm
      fit?: ImageFitMode
      colorLimit?: number
      mergeThreshold?: number
      detectBackground?: boolean
      crop?: ImageCropRect
    } = {},
  ) {
    if (!file) {
      setImageStatus('请先选择一张图片')
      return
    }

    setImageFile(file)
    if (options.algorithm) setConverter(options.algorithm)
    if (options.fit) setImageFitMode(options.fit)
    if (options.colorLimit !== undefined) setColorLimit(options.colorLimit)
    if (options.mergeThreshold !== undefined) {
      setMergeThreshold(options.mergeThreshold)
    }
    if (options.detectBackground !== undefined) {
      setDetectBackground(options.detectBackground)
    }
    setImageCrop(options.crop)
    setImageStatus('正在转换...')

    const shouldResetExcluded = options.resetExcluded ?? file !== imageFile
    const targetWidth = clamp(
      Math.round(options.width ?? pattern.width),
      MIN_PATTERN_SIDE,
      MAX_PATTERN_SIDE,
    )
    const targetHeight = clamp(
      Math.round(options.height ?? pattern.height),
      MIN_PATTERN_SIDE,
      MAX_PATTERN_SIDE,
    )

    try {
      const nextExcluded =
        options.excludedColors ??
        (shouldResetExcluded ? new Set<string>() : excludedColorHexes)
      const normalizedExcluded = new Set([...nextExcluded].map(normalizeHex))
      if (shouldResetExcluded) {
        setExcludedColorHexes(new Set())
      } else if (options.excludedColors) {
        setExcludedColorHexes(normalizedExcluded)
      }
      const nextPattern = await buildConvertedPattern(
        file,
        {
          width: targetWidth,
          height: targetHeight,
          algorithm: options.algorithm ?? converter,
          fit: options.fit ?? imageFitMode,
          colorLimit: options.colorLimit ?? colorLimit,
          mergeThreshold: options.mergeThreshold ?? mergeThreshold,
          detectBackground: options.detectBackground ?? detectBackground,
          crop: options.crop,
        },
        normalizedExcluded,
      )
      setRows(targetHeight)
      setCols(targetWidth)
      commitPattern(nextPattern, normalizedExcluded)
      setImageStatus(
        `已把 ${file.name} 转成 ${targetWidth} × ${targetHeight} 颗`,
      )
    } catch (error) {
      console.error('[convertImage] failed:', error)
      const message = error instanceof Error ? error.message : String(error)
      setImageStatus(`转换失败：${message}`)
    }
  }

  async function buildConvertedPattern(
    file: File,
    options: ImageConversionOptions,
    paletteExcludedHexes: Set<string>,
  ): Promise<PatternGrid> {
    const image = await loadImage(file)
    const fullPalette = availablePalette
      .filter((color) => !paletteExcludedHexes.has(normalizeHex(color.hex)))
      .map((color) => color.hex)

    if (fullPalette.length === 0) {
      throw new Error('当前色卡是空的（切到 MARD 或先加自定义色再试）')
    }

    let cells = await quantizeImage({
      image,
      width: options.width,
      height: options.height,
      palette: fullPalette,
      algorithm: options.algorithm,
      fit: options.fit,
      crop: options.crop,
      placement: options.placement,
    })

    // 抖动模式不做后处理(否则丢失抖动颗粒感)
    if (options.algorithm !== 'atkinson') {
      if (options.mergeThreshold > 0) {
        cells = bfsMergeRegions(
          cells,
          options.width,
          options.height,
          options.mergeThreshold,
        )
      }
      if (options.detectBackground) {
        cells = markExternalBackground(cells, options.width, options.height)
      }
    }

    cells = limitColors(cells, options.colorLimit)
    return { width: options.width, height: options.height, cells }
  }

  async function generateImagePattern(
    file: File,
    options: ImageConversionOptions,
  ) {
    return buildConvertedPattern(file, options, new Set())
  }

  function applyImagePattern(
    nextPattern: PatternGrid,
    options: ImageConversionOptions,
    metadata: {
      file?: File | null
      excludedColors?: Set<string>
      status?: string
    } = {},
  ) {
    if (metadata.file) setImageFile(metadata.file)
    setConverter(options.algorithm)
    setImageFitMode(options.fit)
    setColorLimit(options.colorLimit)
    setMergeThreshold(options.mergeThreshold)
    setDetectBackground(options.detectBackground)
    setImageCrop(options.crop)
    setImagePlacement(options.placement)
    setRows(nextPattern.height)
    setCols(nextPattern.width)
    const nextExcluded = new Set(
      [...(metadata.excludedColors ?? new Set())].map(normalizeHex),
    )
    commitPattern(nextPattern, nextExcluded)
    setImageStatus(
      metadata.status ??
        `已应用 ${nextPattern.width} × ${nextPattern.height} 图纸`,
    )
  }

  function excludeColor(hex: string) {
    const normalized = normalizeHex(hex)
    if (excludedColorHexes.has(normalized)) return

    const remapped = remapPatternColor(pattern, normalized, excludedColorHexes)
    if (!remapped.replacement) {
      setImageStatus('无法排除该颜色：当前图纸没有其他已用颜色可供替代。')
      return
    }

    commitPattern(
      remapped.pattern,
      withHex(excludedColorHexes, normalized),
    )
    setImageStatus(`已排除 ${normalized}，并重映射到 ${remapped.replacement}`)
  }

  function restoreExcludedColor(hex: string) {
    const normalized = normalizeHex(hex)
    if (!excludedColorHexes.has(normalized)) return
    const nextExcluded = withoutHex(excludedColorHexes, normalized)
    void rebuildImageWithRemappedExclusions(nextExcluded)
  }

  function restoreAllExcludedColors() {
    void rebuildImageWithRemappedExclusions(new Set())
  }

  async function rebuildImageWithRemappedExclusions(nextExcluded: Set<string>) {
    const normalizedExcluded = new Set([...nextExcluded].map(normalizeHex))
    if (!imageFile) {
      setExcludedColorHexes(normalizedExcluded)
      return
    }

    setImageStatus('正在恢复排除颜色...')
    try {
      const basePattern = await buildConvertedPattern(
        imageFile,
        {
          width: pattern.width,
          height: pattern.height,
          algorithm: converter,
          fit: imageFitMode,
          colorLimit,
          mergeThreshold,
          detectBackground,
          crop: imageCrop,
          placement: imagePlacement,
        },
        new Set(),
      )
      const remapped = remapPatternColors(basePattern, normalizedExcluded)
      setRows(basePattern.height)
      setCols(basePattern.width)
      commitPattern(remapped.pattern, remapped.applied)
      setImageStatus(
        remapped.applied.size > 0
          ? `已恢复并保留 ${remapped.applied.size} 个排除颜色`
          : '已恢复所有排除颜色',
      )
    } catch (error) {
      console.error('[restoreExcludedColor] failed:', error)
      const message = error instanceof Error ? error.message : String(error)
      setImageStatus(`恢复失败：${message}`)
    }
  }

  function exportPng() {
    const cellSize = getBoundedCellSize(pattern, 12)
    const canvas = document.createElement('canvas')
    canvas.width = pattern.width * cellSize
    canvas.height = pattern.height * cellSize
    const context = canvas.getContext('2d')
    if (!context) return

    context.fillStyle = CANVAS_BG_COLOR
    context.fillRect(0, 0, canvas.width, canvas.height)

    pattern.cells.forEach((cell, index) => {
      if (cell.color === null || cell.isExternal) return
      const x = (index % pattern.width) * cellSize
      const y = Math.floor(index / pattern.width) * cellSize
      context.fillStyle = cell.color
      context.fillRect(x, y, cellSize, cellSize)
    })

    downloadUrl(canvas.toDataURL('image/png'), 'bead-pattern.png')
  }

  function buildLabelByHex(): LabelByHex {
    const map: LabelByHex = new Map()
    palette.forEach((color) => {
      const code = getDisplayCode(color, currentBrand)
      map.set(color.hex.toLowerCase(), code)
    })
    return map
  }

  function exportPatternImage() {
    const canvas = renderPatternWithKeys({
      pattern,
      labelByHex: buildLabelByHex(),
      title: `${brand.shortLabel} · ${pattern.width}×${pattern.height} · 共 ${usedCount} 颗 · ${colorStats.length} 色`,
      cellSize: getBoundedCellSize(pattern, 28, 3800),
    })
    downloadCanvas(canvas, 'bead-pattern-keys.png')
  }

  function exportShoppingListImage() {
    if (colorStats.length === 0) return
    const canvas = renderShoppingList({
      stats: colorStats,
      brandShortLabel: brand.shortLabel,
      totalCount: usedCount,
    })
    downloadCanvas(canvas, 'bead-shopping-list.png')
  }

  function exportJson() {
    const payload = JSON.stringify(
      {
        schemaVersion: 1,
        rows: pattern.height,
        cols: pattern.width,
        pattern,
      },
      null,
      2,
    )
    const blob = new Blob([payload], { type: 'application/json' })
    downloadUrl(URL.createObjectURL(blob), 'bead-pattern.json', true)
  }

  function exportColorList() {
    const labelByHex = new Map<string, string>()
    palette.forEach((color) => {
      const code = getDisplayCode(color, currentBrand)
      labelByHex.set(
        color.hex.toLowerCase(),
        code ?? color.nameZh ?? color.nameEn ?? '自定义色',
      )
    })
    const header = `色号(${brand.shortLabel}),hex,颗数\n`
    const rowsText = colorStats
      .map((item) => {
        const label = labelByHex.get(item.color.toLowerCase()) ?? '自定义色'
        return `${label},${item.color},${item.count}`
      })
      .join('\n')
    const total = `\n合计,,${usedCount}`
    const csv = `\uFEFF${header}${rowsText}${total}\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    downloadUrl(URL.createObjectURL(blob), 'bead-color-list.csv', true)
  }

  async function importJson(file: File) {
    try {
      const text = await file.text()
      const payload = JSON.parse(text) as { pattern?: unknown }
      const nextPattern = parsePatternGrid(payload.pattern)
      if (!nextPattern) throw new Error('图纸结构或尺寸无效')
      setRows(nextPattern.height)
      setCols(nextPattern.width)
      commitPattern(nextPattern, new Set())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setImageStatus(`导入失败：${message}`)
    }
  }

  function saveLocal() {
    localStorage.setItem(
      'bead-pattern-editor',
      JSON.stringify({
        schemaVersion: 1,
        rows: pattern.height,
        cols: pattern.width,
        pattern,
      }),
    )
    setImageStatus('已保存到当前浏览器')
  }

  function restoreLocal() {
    const saved = localStorage.getItem('bead-pattern-editor')
    if (!saved) {
      setImageStatus('当前浏览器没有保存过的图纸')
      return
    }

    try {
      const payload = JSON.parse(saved) as { pattern?: unknown }
      const nextPattern = parsePatternGrid(payload.pattern)
      if (!nextPattern) throw new Error('保存的图纸结构或尺寸无效')
      setRows(nextPattern.height)
      setCols(nextPattern.width)
      commitPattern(nextPattern, new Set())
      setImageStatus('已恢复上次的图纸')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setImageStatus(`恢复失败：${message}`)
    }
  }

  return {
    rows,
    setRows,
    cols,
    setCols,
    pattern,
    currentTool,
    setCurrentTool,
    brushSymmetryMode,
    setBrushSymmetryMode,
    eraserSymmetryMode,
    setEraserSymmetryMode,
    brushSize,
    setBrushSize,
    eraserSize,
    setEraserSize,
    fillMode,
    setFillMode,
    shapeKind,
    setShapeKind,
    shapeStyle,
    setShapeStyle,
    protectedSelection,
    setProtectedSelection,
    currentColor,
    updateCurrentColor,
    selectDrawingColor,
    previewCurrentColor,
    eyedropperActive,
    setEyedropperActive,
    paletteExpanded,
    setPaletteExpanded,
    recentColors,
    customPalette,
    addCurrentColorToPalette,
    renameCustomColor,
    removeCustomColor,
    disabledPaletteHexes,
    availablePalette,
    conversionPalette,
    setPaletteColorEnabled,
    setAllPaletteColorsEnabled,
    resetPaletteSelection,
    excludedColorHexes,
    excludeColor,
    restoreExcludedColor,
    restoreAllExcludedColors,
    canvasSettings,
    updateCanvasSettings,
    resetCanvasSettings,
    toggleShowGrid,
    currentTheme,
    setCurrentTheme,
    /** @deprecated 兼容旧用法,等同 canvasSettings.showGrid */
    showGrid: canvasSettings.showGrid,
    zoom,
    setZoom,
    converter,
    setConverter,
    colorLimit,
    setColorLimit,
    mergeThreshold,
    setMergeThreshold,
    detectBackground,
    setDetectBackground,
    imageFitMode,
    setImageFitMode,
    imageCrop,
    imageFile,
    imageStatus,
    palette,
    brand,
    currentBrand,
    setCurrentBrand,
    colorStats,
    usedCount,
    canUndo,
    canRedo,
    undo,
    redo,
    applyCanvasSize,
    clearCanvas,
    beginStroke,
    endStroke,
    paintCell,
    drawShape,
    deleteSelection,
    moveSelection,
    flipSelection,
    copySelectionToOrigin,
    commitSelectionLayer,
    removeIsolatedCells,
    convertImage,
    generateImagePattern,
    applyImagePattern,
    exportPng,
    exportPatternImage,
    exportShoppingListImage,
    exportJson,
    exportColorList,
    importJson,
    saveLocal,
    restoreLocal,
  }
}

function isIndexInsideSelection(
  index: number,
  width: number,
  selection: SelectionRect | null,
) {
  if (!selection) return true
  const x = index % width
  const y = Math.floor(index / width)
  return (
    x >= selection.x &&
    x < selection.x + selection.width &&
    y >= selection.y &&
    y < selection.y + selection.height
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getBoundedCellSize(
  pattern: PatternGrid,
  preferred: number,
  maxBitmapSide = 4096,
): number {
  return Math.max(
    1,
    Math.min(
      preferred,
      Math.floor(maxBitmapSide / Math.max(pattern.width, pattern.height)),
    ),
  )
}

function getSymmetryIndexes(
  index: number,
  width: number,
  height: number,
  mode: SymmetryMode,
  selection: SelectionRect | null,
): number[] {
  const x = index % width
  const y = Math.floor(index / width)
  const bounds = selection ?? { x: 0, y: 0, width, height }
  const mirroredX = bounds.x + bounds.width - 1 - (x - bounds.x)
  const mirroredY = bounds.y + bounds.height - 1 - (y - bounds.y)
  const points: Array<[number, number]> = [[x, y]]

  if (mode === 'vertical' || mode === 'both') {
    points.push([mirroredX, y])
  }
  if (mode === 'horizontal' || mode === 'both') {
    points.push([x, mirroredY])
  }
  if (mode === 'both' || mode === 'center') {
    points.push([mirroredX, mirroredY])
  }

  return [
    ...new Set(
      points
        .filter(
          ([px, py]) =>
            px >= bounds.x &&
            py >= bounds.y &&
            px < bounds.x + bounds.width &&
            py < bounds.y + bounds.height,
        )
        .map(([px, py]) => py * width + px),
    ),
  ]
}

export function getShapeCellIndexes(
  startIndex: number,
  endIndex: number,
  width: number,
  height: number,
  kind: ShapeKind,
  style: ShapeStyle,
  strokeSize = 1,
): number[] {
  const startX = startIndex % width
  const startY = Math.floor(startIndex / width)
  const endX = endIndex % width
  const endY = Math.floor(endIndex / width)
  const minX = Math.min(startX, endX)
  const maxX = Math.max(startX, endX)
  const minY = Math.min(startY, endY)
  const maxY = Math.max(startY, endY)
  const points = new Set<number>()
  const add = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < width && y < height) {
      points.add(y * width + x)
    }
  }
  const thicken = () => {
    if (strokeSize <= 1) return [...points]
    const source = [...points]
    const offset = Math.floor(strokeSize / 2)
    source.forEach((index) => {
      const centerX = index % width
      const centerY = Math.floor(index / width)
      for (let y = centerY - offset; y < centerY - offset + strokeSize; y += 1) {
        for (let x = centerX - offset; x < centerX - offset + strokeSize; x += 1) {
          add(x, y)
        }
      }
    })
    return [...points]
  }

  if (kind === 'line') {
    let x = startX
    let y = startY
    const dx = Math.abs(endX - startX)
    const dy = Math.abs(endY - startY)
    const sx = startX < endX ? 1 : -1
    const sy = startY < endY ? 1 : -1
    let error = dx - dy
    while (true) {
      add(x, y)
      if (x === endX && y === endY) break
      const doubled = error * 2
      if (doubled > -dy) {
        error -= dy
        x += sx
      }
      if (doubled < dx) {
        error += dx
        y += sy
      }
    }
    return thicken()
  }

  if (kind === 'rectangle') {
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (
          style === 'filled' ||
          x === minX ||
          x === maxX ||
          y === minY ||
          y === maxY
        ) {
          add(x, y)
        }
      }
    }
    return style === 'filled' ? [...points] : thicken()
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const radiusX = (maxX - minX) / 2
  const radiusY = (maxY - minY) / 2
  if (radiusX === 0 || radiusY === 0) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) add(x, y)
    }
    return style === 'filled' ? [...points] : thicken()
  }

  if (style === 'filled') {
    for (let y = minY; y <= maxY; y += 1) {
      const normalizedY = (y - centerY) / radiusY
      const span = radiusX * Math.sqrt(Math.max(0, 1 - normalizedY ** 2))
      const left = Math.ceil(centerX - span)
      const right = Math.floor(centerX + span)
      for (let x = left; x <= right; x += 1) add(x, y)
    }
  } else {
    const samples = Math.max(24, Math.max(maxX - minX, maxY - minY) * 12)
    for (let step = 0; step < samples; step += 1) {
      const angle = (step / samples) * Math.PI * 2
      add(
        Math.round(centerX + Math.cos(angle) * radiusX),
        Math.round(centerY + Math.sin(angle) * radiusY),
      )
    }
  }
  return style === 'filled' ? [...points] : thicken()
}

function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase()
}

function mergePaletteWithCustomPriority(
  brandColors: BeadColor[],
  customColors: BeadColor[],
): BeadColor[] {
  const colorsByHex = new Map<string, BeadColor>()
  brandColors.forEach((color) => colorsByHex.set(normalizeHex(color.hex), color))
  customColors.forEach((color) => {
    const normalized = normalizeHex(color.hex)
    const brandColor = colorsByHex.get(normalized)
    colorsByHex.set(normalized, {
      ...brandColor,
      ...color,
      hex: normalized,
      codes: {
        ...brandColor?.codes,
        ...color.codes,
      },
    })
  })
  return [...colorsByHex.values()]
}

function withHex(source: Set<string>, hex: string): Set<string> {
  const next = new Set(source)
  next.add(normalizeHex(hex))
  return next
}

function withoutHex(source: Set<string>, hex: string): Set<string> {
  const next = new Set(source)
  next.delete(normalizeHex(hex))
  return next
}

function findNearestHex(targetHex: string, candidateHexes: string[]): string {
  const uniqueCandidates = [...new Set(candidateHexes.map(normalizeHex))]
  const [r, g, b] = hexToRgbTuple(targetHex)
  const target = rgbToOklab(r, g, b)
  let best = uniqueCandidates[0]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of uniqueCandidates) {
    const [cr, cg, cb] = hexToRgbTuple(candidate)
    const distance = oklabDistance(target, rgbToOklab(cr, cg, cb))
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }

  return best
}

export function remapPatternColor(
  pattern: PatternGrid,
  targetHex: string,
  alreadyExcluded: Set<string>,
): { pattern: PatternGrid; replacement: string | null } {
  const normalizedTarget = normalizeHex(targetHex)
  const candidateHexes = [
    ...new Set(
      pattern.cells
        .filter((cell) => !cell.isExternal)
        .map((cell) => cell.color)
        .filter((color): color is string => Boolean(color))
        .map(normalizeHex)
        .filter(
          (color) => color !== normalizedTarget && !alreadyExcluded.has(color),
        ),
    ),
  ]

  if (candidateHexes.length === 0) {
    return { pattern, replacement: null }
  }

  const replacement = findNearestHex(normalizedTarget, candidateHexes)
  let changed = false
  const nextCells = pattern.cells.map((cell) => {
    if (cell.color === null || cell.isExternal) return cell
    if (normalizeHex(cell.color) !== normalizedTarget) return cell
    changed = true
    return { ...cell, color: replacement }
  })

  if (!changed) return { pattern, replacement: null }
  return { pattern: { ...pattern, cells: nextCells }, replacement }
}

export function remapPatternColors(
  sourcePattern: PatternGrid,
  excludedHexes: Set<string>,
): { pattern: PatternGrid; applied: Set<string> } {
  let nextPattern = sourcePattern
  const applied = new Set<string>()

  for (const hex of excludedHexes) {
    const normalized = normalizeHex(hex)
    const remapped = remapPatternColor(nextPattern, normalized, applied)
    if (!remapped.replacement) continue
    nextPattern = remapped.pattern
    applied.add(normalized)
  }

  return { pattern: nextPattern, applied }
}

function getNeighborColors(pattern: PatternGrid, index: number) {
  const x = index % pattern.width
  const y = Math.floor(index / pattern.width)
  const neighbors: Array<string | null> = []

  if (x > 0) neighbors.push(pattern.cells[index - 1].color)
  if (x < pattern.width - 1) neighbors.push(pattern.cells[index + 1].color)
  if (y > 0) neighbors.push(pattern.cells[index - pattern.width].color)
  if (y < pattern.height - 1)
    neighbors.push(pattern.cells[index + pattern.width].color)

  return neighbors
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    image.src = url
  })
}

/**
 * 读取自定义色板。兼容旧版 `{hex, name}` 格式,自动升级为 BeadColor。
 */
function loadCustomPalette(): BeadColor[] {
  try {
    const saved = localStorage.getItem(customPaletteStorageKey)
    if (!saved) return []
    const parsed = JSON.parse(saved) as Array<
      BeadColor | { hex: string; name?: string }
    >
    if (!Array.isArray(parsed)) return []
    const upgraded = parsed.map((item) => {
      if ('codes' in item && item.codes) return item as BeadColor
      const legacy = item as { hex: string; name?: string }
      return {
        hex: legacy.hex,
        codes: {},
        nameZh: legacy.name,
      }
    })
    return mergePaletteWithCustomPriority([], upgraded)
  } catch {
    return []
  }
}

function loadHexSet(storageKey: string): Set<string> {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return new Set()
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed
        .filter((item): item is string => typeof item === 'string')
        .map(normalizeHex),
    )
  } catch {
    return new Set()
  }
}

function loadCurrentBrand(): BrandId {
  try {
    const saved = localStorage.getItem(currentBrandStorageKey)
    if (saved && isBrandId(saved)) return saved
  } catch {
    /* ignore */
  }
  return defaultBrandId
}

function loadCanvasSettings(): CanvasSettings {
  try {
    const saved = localStorage.getItem(canvasSettingsStorageKey)
    if (!saved) return { ...DEFAULT_CANVAS_SETTINGS }
    return parseCanvasSettings(JSON.parse(saved))
  } catch {
    return { ...DEFAULT_CANVAS_SETTINGS }
  }
}

function loadTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(themeStorageKey)
    if (saved && isThemeId(saved)) return saved
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME_ID
}

function downloadUrl(url: string, filename: string, revoke = false) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  if (revoke) URL.revokeObjectURL(url)
}
