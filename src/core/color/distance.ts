// 感知均匀色距(Oklab),用于"最近色匹配"和"颜色相似度判断"。
//
// 为什么不用 RGB 欧氏距离:RGB 空间不是感知均匀的——人眼对绿色敏感、对蓝色不
// 敏感,RGB 上等距的两组颜色看起来差别可能差好几倍。Oklab(Björn Ottosson,
// 2020) 是一个感知均匀色彩空间,sqrt(dL²+dA²+dB²) 在视觉上比 RGB 欧氏距离
// 更接近"两个色看起来差多少"。
//
// 实现参考:perler-beads/src/utils/pixelation.ts 的 colorDistance,代码自写。
// 缓存:同一 RGB 反复转 Oklab 浪费,用 Map 缓存(整数 key)。

export type OklabColor = readonly [number, number, number]

const cache = new Map<number, OklabColor>()

/** RGB(0-255) → Oklab。结果缓存。 */
export function rgbToOklab(r: number, g: number, b: number): OklabColor {
  const key = (r << 16) | (g << 8) | b
  const cached = cache.get(key)
  if (cached) return cached

  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)

  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl

  const lr = Math.cbrt(l)
  const mr = Math.cbrt(m)
  const sr = Math.cbrt(s)

  const oklab: OklabColor = [
    0.2104542553 * lr + 0.793617785 * mr - 0.0040720468 * sr,
    1.9779984951 * lr - 2.428592205 * mr + 0.4505937099 * sr,
    0.0259040371 * lr + 0.7827717662 * mr - 0.808675766 * sr,
  ]
  cache.set(key, oklab)
  return oklab
}

function srgbToLinear(channel: number): number {
  const n = channel / 255
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
}

/**
 * 两个 Oklab 色之间的距离(欧氏),已 ×100 缩放到接近 0-100 区间,
 * 方便阈值滑块跟原 RGB 欧氏距离(0-441)有相近手感(原阈值 30 对应这里约 5)。
 */
export function oklabDistance(a: OklabColor, b: OklabColor): number {
  const dl = a[0] - b[0]
  const da = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dl * dl + da * da + db * db) * 100
}

/** 便捷:直接两个 RGB 算距离。 */
export function colorDistanceRgb(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return oklabDistance(rgbToOklab(r1, g1, b1), rgbToOklab(r2, g2, b2))
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const n = hex.replace('#', '')
  return [
    Number.parseInt(n.slice(0, 2), 16),
    Number.parseInt(n.slice(2, 4), 16),
    Number.parseInt(n.slice(4, 6), 16),
  ]
}
