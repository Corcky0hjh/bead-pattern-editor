/** 画布展示用的米色底,纯视觉常量,**不参与任何判等**。空 cell 由 color===null 表达。 */
export const CANVAS_BG_COLOR = '#fffdf8'
export const MIN_PATTERN_SIDE = 16
export const MAX_PATTERN_SIDE = 2048

export type PatternCell = {
  /** 该格的颜色 hex(小写带 #);null = 空格,表示该位置没有珠子。 */
  color: string | null
  /**
   * 是否为"外部背景"(图像处理时由边界 floodfill 识别得到的、与边界连通的背景色块)。
   * 标了 true 的格不计入用色统计、导出图纸时留白。用户手动编辑该格会清除此标记。
   */
  isExternal?: boolean
}

export type PatternGrid = {
  width: number
  height: number
  cells: PatternCell[]
}

type CreatePatternGridOptions = {
  width: number
  height: number
  palette: string[]
}

export function createPatternGrid({
  width,
  height,
  palette,
}: CreatePatternGridOptions): PatternGrid {
  const cells = Array.from({ length: width * height }, (_, index) => ({
    color: palette[index % palette.length],
  }))

  return { width, height, cells }
}

/** 创建一张纯色或全空(color=null)的图纸。 */
export function createSolidPatternGrid({
  width,
  height,
  color = null,
}: {
  width: number
  height: number
  color?: string | null
}): PatternGrid {
  return {
    width,
    height,
    cells: Array.from({ length: width * height }, () => ({ color })),
  }
}

/**
 * 旧版工程文件(emptyColor 时代)迁移:cells 里 `color === '#fffdf8'` 全部转 null。
 * 严格 hex 相等,避免误伤用户真的画的接近色。
 */
export function migrateLegacyCells(cells: PatternCell[]): PatternCell[] {
  let mutated = false
  const next = cells.map((cell) => {
    if (cell.color === '#fffdf8') {
      mutated = true
      return { ...cell, color: null }
    }
    return cell
  })
  return mutated ? next : cells
}

export function parsePatternGrid(value: unknown): PatternGrid | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<PatternGrid>
  if (
    !Number.isInteger(candidate.width) ||
    !Number.isInteger(candidate.height) ||
    candidate.width! < MIN_PATTERN_SIDE ||
    candidate.width! > MAX_PATTERN_SIDE ||
    candidate.height! < MIN_PATTERN_SIDE ||
    candidate.height! > MAX_PATTERN_SIDE ||
    !Array.isArray(candidate.cells) ||
    candidate.cells.length !== candidate.width! * candidate.height!
  ) {
    return null
  }

  const cells: PatternCell[] = []
  for (const rawCell of candidate.cells) {
    if (!rawCell || typeof rawCell !== 'object') return null
    const cell = rawCell as Partial<PatternCell>
    const color = cell.color
    if (
      color !== null &&
      (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))
    ) {
      return null
    }
    if (cell.isExternal !== undefined && typeof cell.isExternal !== 'boolean') {
      return null
    }
    cells.push({
      color: color === null ? null : color.toLowerCase(),
      ...(cell.isExternal ? { isExternal: true } : {}),
    })
  }

  return {
    width: candidate.width!,
    height: candidate.height!,
    cells: migrateLegacyCells(cells),
  }
}
