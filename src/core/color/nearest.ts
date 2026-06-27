// 给一个任意 hex,从 BeadColor[] 里挑出 N 个最接近的(Oklab 感知距离)。
//
// 用途:取色器里"自由色 → 当前品牌色卡里有哪几种最像",让用户一键吸附到
// 品牌色号,而不是拼一颗官方没有的色。
import { hexToRgbTuple, oklabDistance, rgbToOklab } from './distance'
import type { BeadColor } from './types'

export type NearestBeadColor = {
  color: BeadColor
  /** Oklab 距离(×100 已缩放),0=完全相同,3 以内人眼几乎分不出 */
  distance: number
}

export function findNearestBeadColors(
  targetHex: string,
  candidates: BeadColor[],
  limit = 6,
): NearestBeadColor[] {
  if (candidates.length === 0) return []
  const [r, g, b] = hexToRgbTuple(targetHex)
  const target = rgbToOklab(r, g, b)

  const scored: NearestBeadColor[] = candidates.map((color) => {
    const [cr, cg, cb] = hexToRgbTuple(color.hex)
    const co = rgbToOklab(cr, cg, cb)
    return { color, distance: oklabDistance(target, co) }
  })

  scored.sort((a, b) => a.distance - b.distance)
  return scored.slice(0, limit)
}
