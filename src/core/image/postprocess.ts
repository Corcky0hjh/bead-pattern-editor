// 像素图后处理:BFS 区域合并 + 边界 floodfill 背景识别。
//
// 思路对应 perler-beads/CLAUDE.md 的第 2、3 步;代码自写。
//
// null cell(空格)语义在所有后处理里都被尊重:
// - limitColors / bfsMergeRegions 不参与统计、不参与合并
// - markExternalBackground 把 null 当成天然背景候选(等同于"匹配了背景集")
import type { PatternCell } from '../pattern/grid'
import { hexToRgbTuple, oklabDistance, rgbToOklab, type OklabColor } from '../color/distance'

/** 可选的额外背景色集合;空 cell(color=null)天然算背景,无需在此列出。 */
export const BACKGROUND_FILL_HEXES = new Set<string>()

/**
 * 限制最终颜色数量。
 *
 * 语义:**整张图最多出现 maxColors 种颜色**(而非"从色板取前 N 色")。
 *
 * 做法:
 * 1. 统计 cells 各色出现频率(忽略 isExternal、忽略 null cell)
 * 2. 若实际色数 ≤ maxColors,原样返回
 * 3. 否则取频率前 maxColors 名作为"保留色",其余低频色按 Oklab 距离 remap
 *    到保留色集里最近的一个
 */
export function limitColors(
  cells: PatternCell[],
  maxColors: number,
): PatternCell[] {
  if (maxColors <= 0) return cells.map((c) => ({ ...c }))

  const counts = new Map<string, number>()
  for (const cell of cells) {
    if (cell.isExternal) continue
    if (cell.color === null) continue
    counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1)
  }
  if (counts.size <= maxColors) return cells.map((c) => ({ ...c }))

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const keep = sorted.slice(0, maxColors).map(([color]) => color)
  const keepOklab = keep.map((hex) => {
    const [r, g, b] = hexToRgbTuple(hex)
    return [hex, rgbToOklab(r, g, b)] as [string, OklabColor]
  })

  const remap = new Map<string, string>()
  for (const [color] of sorted.slice(maxColors)) {
    const [r, g, b] = hexToRgbTuple(color)
    const target = rgbToOklab(r, g, b)
    let best = keepOklab[0][0]
    let bestDist = Number.POSITIVE_INFINITY
    for (const [hex, ok] of keepOklab) {
      const dl = target[0] - ok[0]
      const da = target[1] - ok[1]
      const db = target[2] - ok[2]
      const d = dl * dl + da * da + db * db
      if (d < bestDist) {
        bestDist = d
        best = hex
      }
    }
    remap.set(color, best)
  }

  return cells.map((cell) => {
    if (cell.isExternal || cell.color === null) return { ...cell }
    return { ...cell, color: remap.get(cell.color) ?? cell.color }
  })
}

/**
 * BFS 区域合并:
 * 从未访问的实色 cell 出发,广度优先扩张到所有"颜色 Oklab 距离 < threshold"
 * 的邻居,形成一个连通区域。区域内统计每个色号出现次数,把整个区域
 * 改成出现次数最高的色号。
 *
 * **null cell 不参与合并**,被天然视为"区域边界"。
 *
 * 用 Oklab 感知距离而非 RGB 欧氏距离,效果对皮肤/天空/渐变更准。
 * threshold 是 Oklab 距离 ×100 后的值,约 0~30 区间;旧 RGB 阈值 30 对应这里约 5。
 *
 * threshold = 0 时直接返回原 cells 副本(关闭合并)。
 */
export function bfsMergeRegions(
  cells: PatternCell[],
  width: number,
  height: number,
  threshold: number,
): PatternCell[] {
  if (threshold <= 0) return cells.map((c) => ({ ...c }))

  const next = cells.map((c) => ({ ...c }))
  const total = width * height
  const visited = new Uint8Array(total)
  const thresholdSq = threshold * threshold

  // 预解析每个实色 cell 的 Oklab(null cell 标 visited 直接跳过)
  const oklabCache: Array<OklabColor | null> = new Array(total)
  for (let i = 0; i < total; i += 1) {
    const color = cells[i].color
    if (color === null) {
      oklabCache[i] = null
      visited[i] = 1
    } else {
      const [r, g, b] = hexToRgbTuple(color)
      oklabCache[i] = rgbToOklab(r, g, b)
    }
  }

  for (let start = 0; start < total; start += 1) {
    if (visited[start]) continue

    const region: number[] = [start]
    visited[start] = 1
    const seedOklab = oklabCache[start]!
    const counts = new Map<string, number>()

    let head = 0
    while (head < region.length) {
      const idx = region[head++]
      const color = next[idx].color
      if (color !== null) {
        counts.set(color, (counts.get(color) ?? 0) + 1)
      }

      const x = idx % width
      const y = (idx - x) / width
      const neighbors: number[] = []
      if (x > 0) neighbors.push(idx - 1)
      if (x < width - 1) neighbors.push(idx + 1)
      if (y > 0) neighbors.push(idx - width)
      if (y < height - 1) neighbors.push(idx + width)

      for (const n of neighbors) {
        if (visited[n]) continue
        const nOklab = oklabCache[n]
        if (nOklab === null) continue // null cell 永远是边界
        const d = oklabDistance(nOklab, seedOklab)
        if (d * d < thresholdSq) {
          visited[n] = 1
          region.push(n)
        }
      }
    }

    if (counts.size === 0) continue
    let majority = next[start].color as string
    let majorityCount = -1
    for (const [color, count] of counts) {
      if (count > majorityCount) {
        majority = color
        majorityCount = count
      }
    }

    for (const idx of region) {
      if (next[idx].color !== majority) {
        next[idx] = { ...next[idx], color: majority }
      }
    }
  }

  return next
}

/**
 * 从画布 4 条边的每个格开始 floodfill,把"颜色是 null 或属于 backgroundHexes"
 * 且与边界连通的格标 isExternal=true。
 *
 * 设计:背景就是"从边界进得来的、空的或颜色像背景的"格。中间的白色细节
 * (如眼白)不会被误标,因为它跟边界白连不上。
 */
export function markExternalBackground(
  cells: PatternCell[],
  width: number,
  height: number,
  backgroundHexes: Set<string> = BACKGROUND_FILL_HEXES,
): PatternCell[] {
  const next = cells.map((c) => ({ ...c, isExternal: false }))
  const total = width * height
  const visited = new Uint8Array(total)
  const queue: number[] = []

  function isBackground(idx: number): boolean {
    const color = next[idx].color
    if (color === null) return true
    return backgroundHexes.has(color.toLowerCase())
  }

  // 种子:4 条边上所有"算背景"的格
  for (let x = 0; x < width; x += 1) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width)
    seed(y * width + (width - 1))
  }

  function seed(idx: number) {
    if (visited[idx]) return
    if (!isBackground(idx)) return
    visited[idx] = 1
    queue.push(idx)
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    next[idx].isExternal = true

    const x = idx % width
    const y = (idx - x) / width
    if (x > 0) tryEnqueue(idx - 1)
    if (x < width - 1) tryEnqueue(idx + 1)
    if (y > 0) tryEnqueue(idx - width)
    if (y < height - 1) tryEnqueue(idx + width)
  }

  function tryEnqueue(idx: number) {
    if (visited[idx]) return
    if (!isBackground(idx)) return
    visited[idx] = 1
    queue.push(idx)
  }

  return next
}
