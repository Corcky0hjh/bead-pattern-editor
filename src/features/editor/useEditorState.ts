import { useEffect, useMemo, useRef, useState } from 'react'
import {
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
  migrateLegacyCells,
  CANVAS_BG_COLOR,
  type PatternGrid,
} from '../../core/pattern/grid'

export type EditorTool = 'pan' | 'brush' | 'eraser' | 'fill'
export type SymmetryMode = 'off' | 'vertical' | 'horizontal' | 'both' | 'center'

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
  })
  const [currentTool, setCurrentTool] = useState<EditorTool>('brush')
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('off')
  const [brushSize, setBrushSize] = useState(1)
  const [eraserSize, setEraserSize] = useState(1)
  const [currentColor, setCurrentColor] = useState(initialColor)
  const [replaceSourceColor, setReplaceSourceColor] = useState(initialColor)
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
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const brand = useMemo(() => getBrand(currentBrand), [currentBrand])
  const brandColors = useMemo(
    () => getBrandColors(currentBrand),
    [currentBrand],
  )
  const palette = useMemo<BeadColor[]>(
    () => [...brandColors, ...customPalette],
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
    if (palette.some((item) => item.hex.toLowerCase() === normalized)) return
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
    const normalized = hex.toLowerCase()
    setCustomPalette((previous) =>
      previous.filter((item) => item.hex.toLowerCase() !== normalized),
    )
    setDisabledPaletteHexes((previous) => withoutHex(previous, normalized))
    setExcludedColorHexes((previous) => withoutHex(previous, normalized))
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

  function commitPattern(next: PatternGrid) {
    setHistory((previous) => ({
      past: [...previous.past, previous.present].slice(-maxHistorySteps),
      present: next,
      future: [],
    }))
  }

  function undo() {
    setHistory((previous) => {
      const nextPresent = previous.past.at(-1)
      if (!nextPresent) return previous

      return {
        past: previous.past.slice(0, -1),
        present: nextPresent,
        future: [previous.present, ...previous.future].slice(
          0,
          maxHistorySteps,
        ),
      }
    })
  }

  function redo() {
    setHistory((previous) => {
      const nextPresent = previous.future[0]
      if (!nextPresent) return previous

      return {
        past: [...previous.past, previous.present].slice(-maxHistorySteps),
        present: nextPresent,
        future: previous.future.slice(1),
      }
    })
  }

  function applyCanvasSize(nextRows = rows, nextCols = cols) {
    const normalizedRows = clamp(Math.round(nextRows), 4, 120)
    const normalizedCols = clamp(Math.round(nextCols), 4, 120)
    setRows(normalizedRows)
    setCols(normalizedCols)
    commitPattern(
      createSolidPatternGrid({
        width: normalizedCols,
        height: normalizedRows,
      }),
    )
    setExcludedColorHexes(new Set())
  }

  function clearCanvas() {
    commitPattern(
      createSolidPatternGrid({
        width: pattern.width,
        height: pattern.height,
      }),
    )
    setExcludedColorHexes(new Set())
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
    }))
  }

  function paintCell(index: number) {
    if (eyedropperActive) {
      const sampledColor = pattern.cells[index]?.color
      if (sampledColor) {
        // 吸管:只有点到实色才更新当前色;点到空 cell 无意义,保持原色
        updateCurrentColor(sampledColor)
        setReplaceSourceColor(sampledColor)
      }
      setEyedropperActive(false)
      return
    }

    if (currentTool === 'pan') return
    if (currentTool === 'fill') {
      for (const targetIndex of getSymmetryIndexes(
        index,
        pattern.width,
        pattern.height,
        symmetryMode,
      )) {
        fillFrom(targetIndex)
      }
      return
    }

    const color = currentTool === 'eraser' ? null : currentColor
    const size = currentTool === 'eraser' ? eraserSize : brushSize
    for (const targetIndex of getSymmetryIndexes(
      index,
      pattern.width,
      pattern.height,
      symmetryMode,
    )) {
      paintArea(targetIndex, size, color)
    }
  }

  function paintArea(index: number, size: number, color: string | null) {
    const draftBase = strokeDraftRef.current ?? pattern
    const centerX = index % draftBase.width
    const centerY = Math.floor(index / draftBase.width)
    const radius = Math.floor(size / 2)
    const nextCells = draftBase.cells.slice()
    let changed = false

    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (x < 0 || y < 0 || x >= draftBase.width || y >= draftBase.height) {
          continue
        }
        const cellIndex = y * draftBase.width + x
        if (nextCells[cellIndex].color === color) continue
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
    const startCell = pattern.cells[index]
    if (!startCell) return
    const targetColor = startCell.color
    if (targetColor === currentColor) return

    const nextCells = pattern.cells.map((cell) => ({ ...cell }))
    const queue = [index]
    const visited = new Set<number>()

    while (queue.length > 0) {
      const currentIndex = queue.shift()
      if (currentIndex === undefined || visited.has(currentIndex)) continue
      if (nextCells[currentIndex]?.color !== targetColor) continue

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

  function replaceColor() {
    if (replaceSourceColor === currentColor) return
    commitPattern({
      ...pattern,
      cells: pattern.cells.map((cell) =>
        cell.color === replaceSourceColor ? { color: currentColor } : cell,
      ),
    })
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
      4,
      120,
    )
    const targetHeight = clamp(
      Math.round(options.height ?? pattern.height),
      4,
      120,
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
      commitPattern(nextPattern)
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
    setRows(nextPattern.height)
    setCols(nextPattern.width)
    setExcludedColorHexes(
      new Set([...(metadata.excludedColors ?? new Set())].map(normalizeHex)),
    )
    commitPattern(nextPattern)
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

    commitPattern(remapped.pattern)
    setExcludedColorHexes((previous) => withHex(previous, normalized))
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
        },
        new Set(),
      )
      const remapped = remapPatternColors(basePattern, normalizedExcluded)
      setRows(basePattern.height)
      setCols(basePattern.width)
      commitPattern(remapped.pattern)
      setExcludedColorHexes(remapped.applied)
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
    const cellSize = 12
    const canvas = document.createElement('canvas')
    canvas.width = pattern.width * cellSize
    canvas.height = pattern.height * cellSize
    const context = canvas.getContext('2d')
    if (!context) return

    context.fillStyle = CANVAS_BG_COLOR
    context.fillRect(0, 0, canvas.width, canvas.height)

    pattern.cells.forEach((cell, index) => {
      if (cell.color === null) return
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
    const payload = JSON.stringify({ rows, cols, pattern }, null, 2)
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
    const text = await file.text()
    const payload = JSON.parse(text) as {
      pattern?: PatternGrid
      rows?: number
      cols?: number
    }
    if (!payload.pattern) return
    setRows(payload.rows ?? payload.pattern.height)
    setCols(payload.cols ?? payload.pattern.width)
    commitPattern({
      ...payload.pattern,
      cells: migrateLegacyCells(payload.pattern.cells),
    })
  }

  function saveLocal() {
    localStorage.setItem(
      'bead-pattern-editor',
      JSON.stringify({ rows, cols, pattern }),
    )
    setImageStatus('已保存到当前浏览器')
  }

  function restoreLocal() {
    const saved = localStorage.getItem('bead-pattern-editor')
    if (!saved) {
      setImageStatus('当前浏览器没有保存过的图纸')
      return
    }

    const payload = JSON.parse(saved) as {
      rows?: number
      cols?: number
      pattern?: PatternGrid
    }
    if (!payload.pattern) return
    setRows(payload.rows ?? payload.pattern.height)
    setCols(payload.cols ?? payload.pattern.width)
    commitPattern({
      ...payload.pattern,
      cells: migrateLegacyCells(payload.pattern.cells),
    })
    setImageStatus('已恢复上次的图纸')
  }

  return {
    rows,
    setRows,
    cols,
    setCols,
    pattern,
    currentTool,
    setCurrentTool,
    symmetryMode,
    setSymmetryMode,
    brushSize,
    setBrushSize,
    eraserSize,
    setEraserSize,
    currentColor,
    updateCurrentColor,
    previewCurrentColor,
    replaceSourceColor,
    setReplaceSourceColor,
    eyedropperActive,
    setEyedropperActive,
    paletteExpanded,
    setPaletteExpanded,
    recentColors,
    customPalette,
    addCurrentColorToPalette,
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
    replaceColor,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getSymmetryIndexes(
  index: number,
  width: number,
  height: number,
  mode: SymmetryMode,
): number[] {
  const x = index % width
  const y = Math.floor(index / width)
  const points: Array<[number, number]> = [[x, y]]

  if (mode === 'vertical' || mode === 'both') {
    points.push([width - 1 - x, y])
  }
  if (mode === 'horizontal' || mode === 'both') {
    points.push([x, height - 1 - y])
  }
  if (mode === 'both' || mode === 'center') {
    points.push([width - 1 - x, height - 1 - y])
  }

  return [
    ...new Set(
      points
        .filter(([px, py]) => px >= 0 && py >= 0 && px < width && py < height)
        .map(([px, py]) => py * width + px),
    ),
  ]
}

function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase()
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
    return parsed.map((item) => {
      if ('codes' in item && item.codes) return item as BeadColor
      const legacy = item as { hex: string; name?: string }
      return {
        hex: legacy.hex,
        codes: {},
        nameZh: legacy.name,
      }
    })
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
