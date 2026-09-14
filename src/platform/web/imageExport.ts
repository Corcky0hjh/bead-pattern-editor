// 拼豆图纸 / 采购清单的 PNG 渲染器。
//
// 思路对照 perler-beads/src/utils/imageDownloader.ts(852 行);代码自写。
//
// 关键设计:
// - 跳过 isExternal / null cell 的格,导出图纸里完全留白(用户拼豆时这块不放珠)
// - 每格中央写色号 Key(如 A01),色号缺失时退化到 hex 末 3 位
// - 字色根据色块亮度自动选黑/白(luma 阈值)
// - 网格线只在 cellSize >= 16 时画,小图纸不画避免糊
import { CANVAS_BG_COLOR, type PatternGrid } from '../../core/pattern/grid'

const TITLE_FONT = `bold 18px "PingFang SC", "Microsoft YaHei", system-ui`
const LABEL_FONT_BASE = `bold {size}px "PingFang SC", "Microsoft YaHei", system-ui`

export type LabelByHex = Map<string, string | null>

type RenderPatternOpts = {
  pattern: PatternGrid
  labelByHex: LabelByHex
  cellSize?: number
  gridColor?: string
  title?: string
  showGrid?: boolean
  showCodes?: boolean
  paletteStats?: RenderShoppingOpts['stats']
  brandShortLabel?: string
}

/** 把图纸渲染成 PNG canvas,每格带色号 Key。 */
export function renderPatternWithKeys({
  pattern,
  labelByHex,
  cellSize = 28,
  gridColor = '#d4d4d4',
  title,
  showGrid = true,
  showCodes = true,
  paletteStats,
  brandShortLabel = '',
}: RenderPatternOpts): HTMLCanvasElement {
  const padding = 12
  const titleHeight = title ? 32 : 0
  const canvas = document.createElement('canvas')
  canvas.width = pattern.width * cellSize + padding * 2
  canvas.height = pattern.height * cellSize + padding * 2 + titleHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // 背景:外框白,网格区域米色(跟编辑画布观感一致)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 标题
  if (title) {
    ctx.fillStyle = '#1f2937'
    ctx.font = TITLE_FONT
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText(title, padding, padding + titleHeight / 2)
  }

  const gridX0 = padding
  const gridY0 = padding + titleHeight

  // 网格区域底色
  ctx.fillStyle = CANVAS_BG_COLOR
  ctx.fillRect(
    gridX0,
    gridY0,
    pattern.width * cellSize,
    pattern.height * cellSize,
  )

  // 色块 + 色号
  const labelFontSize = Math.max(8, Math.floor(cellSize * 0.4))
  const labelFont = LABEL_FONT_BASE.replace('{size}', String(labelFontSize))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < pattern.cells.length; i += 1) {
    const cell = pattern.cells[i]
    const x = gridX0 + (i % pattern.width) * cellSize
    const y = gridY0 + Math.floor(i / pattern.width) * cellSize

    if (cell.isExternal || cell.color === null) {
      // 留白,只画淡淡的网格线占位(底色已经是米色)
      if (showGrid) {
        ctx.strokeStyle = '#f3f4f6'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1)
      }
      continue
    }

    ctx.fillStyle = cell.color
    ctx.fillRect(x, y, cellSize, cellSize)

    // 网格线
    if (showGrid) {
      ctx.strokeStyle = gridColor
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1)
    }

    // 色号
    const label = labelByHex.get(cell.color.toLowerCase())
    const display = label ?? hexTail(cell.color)
    if (showCodes && display) {
      ctx.font = labelFont
      ctx.fillStyle = pickTextColor(cell.color)
      ctx.fillText(display, x + cellSize / 2, y + cellSize / 2, Math.max(1, cellSize - 2))
    }
  }

  if (paletteStats?.length) {
    const legend = renderShoppingList({ stats: paletteStats, brandShortLabel, totalCount: paletteStats.reduce((sum, item) => sum + item.count, 0), columns: Math.max(1, Math.floor(canvas.width / 260)) })
    const combined = document.createElement('canvas')
    combined.width = Math.max(canvas.width, legend.width)
    combined.height = canvas.height + legend.height
    const context = combined.getContext('2d')
    if (!context) return canvas
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, combined.width, combined.height)
    context.drawImage(canvas, (combined.width - canvas.width) / 2, 0)
    context.drawImage(legend, (combined.width - legend.width) / 2, canvas.height)
    return combined
  }
  return canvas
}

type RenderShoppingOpts = {
  stats: Array<{ color: string; count: number; code: string | null; brandLabel?: string }>
  brandShortLabel: string
  totalCount: number
  totalCells?: number
  swatchSize?: number
  columns?: number
}

/** 采购清单 PNG:每行一颗色,色块 + 色号 + hex + 数量,按数量降序。 */
export function renderShoppingList({
  stats,
  brandShortLabel,
  totalCount,
  swatchSize = 44,
  columns = 2,
}: RenderShoppingOpts): HTMLCanvasElement {
  const padding = 16
  const rowHeight = swatchSize + 8
  const headerHeight = 56
  const colWidth = 260

  const sorted = [...stats].sort((a, b) => b.count - a.count)
  const rows = Math.ceil(sorted.length / columns)

  const canvas = document.createElement('canvas')
  canvas.width = colWidth * columns + padding * 2
  canvas.height = headerHeight + rows * rowHeight + padding * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // header
  ctx.fillStyle = '#111827'
  ctx.font = `bold 20px "PingFang SC", "Microsoft YaHei", system-ui`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    `${brandShortLabel} 采购清单 · 共 ${totalCount} 颗 · ${sorted.length} 色`,
    padding,
    padding + 20,
  )

  // rows
  for (let i = 0; i < sorted.length; i += 1) {
    const item = sorted[i]
    const col = i % columns
    const row = Math.floor(i / columns)
    const x = padding + col * colWidth
    const y = headerHeight + padding + row * rowHeight

    // 色块
    ctx.fillStyle = item.color
    ctx.fillRect(x, y, swatchSize, swatchSize)
    ctx.strokeStyle = '#d4d4d4'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, swatchSize - 1, swatchSize - 1)

    // 文字
    const textX = x + swatchSize + 10
    ctx.fillStyle = '#111827'
    ctx.font = `bold 16px "PingFang SC", "Microsoft YaHei", system-ui`
    ctx.fillText(
      item.code ?? hexTail(item.color),
      textX,
      y + swatchSize / 2 - 8,
    )
    ctx.fillStyle = '#6b7280'
    ctx.font = `12px "PingFang SC", "Microsoft YaHei", system-ui`
    ctx.fillText([item.brandLabel, item.color].filter(Boolean).join(' · '), textX, y + swatchSize / 2 + 10, 150)

    // 数量
    ctx.fillStyle = '#111827'
    ctx.font = `bold 18px "PingFang SC", "Microsoft YaHei", system-ui`
    ctx.textAlign = 'right'
    ctx.fillText(`${item.count}`, x + colWidth - 16, y + swatchSize / 2)
    ctx.textAlign = 'left'
  }

  return canvas
}

function pickTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luma = 0.299 * r + 0.587 * g + 0.114 * b
  return luma < 140 ? '#ffffff' : '#1f2937'
}

function hexTail(hex: string): string {
  const clean = hex.replace('#', '')
  return clean.slice(-3).toUpperCase()
}

/** 把 canvas 转成 PNG 并触发下载。 */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL('image/png')
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
}
