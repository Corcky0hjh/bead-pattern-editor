import type { PatternCell } from '../pattern/grid'
import { rgbToOklab, type OklabColor } from '../color/distance'

export type ConversionAlgorithm = 'rgb-quant' | 'average' | 'atkinson'

export type ImageFitMode = 'stretch' | 'contain' | 'cover'

export type ImageCropRect = {
  x: number
  y: number
  width: number
  height: number
}

export type ImagePlacement = {
  x: number
  y: number
  scale: number
  rotation: number
  flipX: boolean
  flipY: boolean
}

export type ConversionAlgorithmOption = {
  value: ConversionAlgorithm
  label: string
  description: string
}

export type ImageFitOption = {
  value: ImageFitMode
  label: string
  description: string
}

export type ConversionPreset = {
  algorithm: ConversionAlgorithm
  size: 52 | 104
}

export const conversionAlgorithmOptions: ConversionAlgorithmOption[] = [
  {
    value: 'rgb-quant',
    label: '卡通（主导色，推荐）',
    description: '按格统计主导色后映射，色块整齐，适合插画/卡通/像素图。',
  },
  {
    value: 'average',
    label: '真实（平均色）',
    description: '按格取像素平均色,保留色彩过渡,适合渐变照片、风景。',
  },
  {
    value: 'atkinson',
    label: '抖动过渡',
    description: '用细密噪点模拟过渡色，更接近原图，但不做合并/去背景。',
  },
]

export const imageFitOptions: ImageFitOption[] = [
  {
    value: 'contain',
    label: '完整放入（留白）',
    description: '保留整张图，比例不变，多余位置留空。',
  },
  {
    value: 'cover',
    label: '铺满（裁掉边缘）',
    description: '铺满整张图纸，比例不变，超出的边会被裁掉。',
  },
  {
    value: 'stretch',
    label: '拉满（会变形）',
    description: '强行拉到图纸尺寸，画面比例会被压扁或拉长。',
  },
]

export const defaultConversionPreset: ConversionPreset = {
  algorithm: 'rgb-quant',
  size: 52,
}

type QuantizeOptions = {
  image: HTMLImageElement
  width: number
  height: number
  palette: string[]
  algorithm: ConversionAlgorithm
  fit: ImageFitMode
  crop?: ImageCropRect
  placement?: ImagePlacement
}

export async function quantizeImage({
  image,
  width,
  height,
  palette,
  algorithm,
  fit,
  crop,
  placement,
}: QuantizeOptions): Promise<PatternCell[]> {
  const paletteRgb = palette.map(hexToRgb)
  const paletteHex = palette.map((color) => color.toLowerCase())
  const paletteOklab = paletteRgb.map(([r, g, b]) => rgbToOklab(r, g, b))
  const nearestPaletteCache = new Int16Array(32 * 32 * 32)
  nearestPaletteCache.fill(-1)

  if (algorithm === 'atkinson') {
    // 抖动模式保持原路径:downscale + Atkinson 误差扩散
    const pixels = drawToTargetSize({
      image,
      width,
      height,
      fit,
      crop,
      placement,
      smoothing: true,
    })
    return atkinsonQuantize(
      pixels,
      width,
      height,
      paletteRgb,
      paletteOklab,
      paletteHex,
      nearestPaletteCache,
    )
  }

  // rgb-quant / average:都走 cell-pool 路径,只是 cell 代表色算法不同
  return cellPoolQuantize({
    image,
    width,
    height,
    fit,
    crop,
    placement,
    paletteOklab,
    paletteHex,
    nearestPaletteCache,
    mode: algorithm,
  })
}

/**
 * 把原图按 fit 模式画到 width×height 的离屏 canvas,返回像素数据。
 * smoothing=false 时浏览器走 nearest-neighbor,适合 dominant-pool 之前的小缩放;
 * smoothing=true 适合 Atkinson 抖动模式(保留过渡色更自然)。
 * 画布初始透明(clearRect),原图未覆盖的区域 alpha=0,采样时会被识别为空。
 */
function drawToTargetSize({
  image,
  width,
  height,
  fit,
  crop,
  placement,
  smoothing,
}: {
  image: HTMLImageElement
  width: number
  height: number
  fit: ImageFitMode
  crop?: ImageCropRect
  placement?: ImagePlacement
  smoothing: boolean
}): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas context unavailable')

  context.imageSmoothingEnabled = smoothing
  if (smoothing) context.imageSmoothingQuality = 'high'
  context.clearRect(0, 0, width, height)

  drawSourceImage(context, image, width, height, fit, crop, placement)
  return context.getImageData(0, 0, width, height).data
}

/**
 * 按格采样 + 最近色映射的通用路径。
 *
 * mode='rgb-quant':每格用 5-bit/通道直方图取出现频率最高的桶 → 主导色
 * mode='average':每格三通道求平均 → 平均色
 *
 * 两种代表色都用 Oklab 距离找最近调色板色(感知均匀,皮肤/天空场景比 RGB 欧氏更准)。
 */
function cellPoolQuantize({
  image,
  width,
  height,
  fit,
  crop,
  placement,
  paletteOklab,
  paletteHex,
  nearestPaletteCache,
  mode,
}: {
  image: HTMLImageElement
  width: number
  height: number
  fit: ImageFitMode
  crop?: ImageCropRect
  placement?: ImagePlacement
  paletteOklab: OklabColor[]
  paletteHex: string[]
  nearestPaletteCache: Int16Array
  mode: 'rgb-quant' | 'average'
}): PatternCell[] {
  // 限制源 canvas 尺寸,避免极大原图(如 6000×4000)耗内存。
  // 每格采样 ~12×12 像素就足以稳定取出主导色。
  const sampleScale = 12
  const maxSourceSide = 2400
  let sourceW = Math.min(width * sampleScale, maxSourceSide)
  let sourceH = Math.min(height * sampleScale, maxSourceSide)
  sourceW = Math.max(width, Math.floor(sourceW / width) * width)
  sourceH = Math.max(height, Math.floor(sourceH / height) * height)

  const canvas = document.createElement('canvas')
  canvas.width = sourceW
  canvas.height = sourceH
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas context unavailable')

  context.imageSmoothingEnabled = false
  // 透明初始化:fit=contain 时原图未覆盖区域 alpha=0,采样会被识别为空 cell
  context.clearRect(0, 0, sourceW, sourceH)

  drawSourceImage(context, image, sourceW, sourceH, fit, crop, placement)

  const pixels = context.getImageData(0, 0, sourceW, sourceH).data
  const cellW = sourceW / width
  const cellH = sourceH / height
  const result: PatternCell[] = new Array(width * height)

  // dominant 模式用直方图;average 用累加。两种模式分支独立,避免每格判断。
  if (mode === 'rgb-quant') {
    const bucketCount = 32 * 32 * 32
    const histogram = new Uint32Array(bucketCount)
    const touchedBuckets: number[] = []
    for (let cy = 0; cy < height; cy += 1) {
      for (let cx = 0; cx < width; cx += 1) {
        touchedBuckets.length = 0
        const x0 = Math.floor(cx * cellW)
        const y0 = Math.floor(cy * cellH)
        const x1 = Math.floor((cx + 1) * cellW)
        const y1 = Math.floor((cy + 1) * cellH)

        for (let y = y0; y < y1; y += 1) {
          const rowOffset = y * sourceW * 4
          for (let x = x0; x < x1; x += 1) {
            const offset = rowOffset + x * 4
            const alpha = pixels[offset + 3]
            if (alpha < 16) continue
            const r5 = pixels[offset] >> 3
            const g5 = pixels[offset + 1] >> 3
            const b5 = pixels[offset + 2] >> 3
            const bucket = (r5 << 10) | (g5 << 5) | b5
            if (histogram[bucket] === 0) touchedBuckets.push(bucket)
            histogram[bucket] += alpha
          }
        }

        let bestBucket = -1
        let bestCount = 0
        for (const bucket of touchedBuckets) {
          if (histogram[bucket] > bestCount) {
            bestCount = histogram[bucket]
            bestBucket = bucket
          }
          histogram[bucket] = 0
        }

        if (bestBucket < 0) {
          // 整格透明 → 空 cell
          result[cy * width + cx] = { color: null }
          continue
        }
        const r = ((bestBucket >> 10) & 0x1f) << 3
        const g = ((bestBucket >> 5) & 0x1f) << 3
        const b = (bestBucket & 0x1f) << 3
        const paletteIndex = findNearestPaletteIndexCached(
          r,
          g,
          b,
          paletteOklab,
          nearestPaletteCache,
        )
        result[cy * width + cx] = { color: paletteHex[paletteIndex] }
      }
    }
  } else {
    // average 模式
    for (let cy = 0; cy < height; cy += 1) {
      for (let cx = 0; cx < width; cx += 1) {
        const x0 = Math.floor(cx * cellW)
        const y0 = Math.floor(cy * cellH)
        const x1 = Math.floor((cx + 1) * cellW)
        const y1 = Math.floor((cy + 1) * cellH)

        let sumR = 0,
          sumG = 0,
          sumB = 0,
          alphaTotal = 0
        for (let y = y0; y < y1; y += 1) {
          const rowOffset = y * sourceW * 4
          for (let x = x0; x < x1; x += 1) {
            const offset = rowOffset + x * 4
            const alpha = pixels[offset + 3]
            if (alpha < 16) continue
            sumR += pixels[offset] * alpha
            sumG += pixels[offset + 1] * alpha
            sumB += pixels[offset + 2] * alpha
            alphaTotal += alpha
          }
        }

        const sampleCount = Math.max(1, (x1 - x0) * (y1 - y0))
        if (alphaTotal === 0 || alphaTotal / (sampleCount * 255) < 0.1) {
          result[cy * width + cx] = { color: null }
          continue
        }
        const r = Math.round(sumR / alphaTotal)
        const g = Math.round(sumG / alphaTotal)
        const b = Math.round(sumB / alphaTotal)
        const paletteIndex = findNearestPaletteIndexCached(
          r,
          g,
          b,
          paletteOklab,
          nearestPaletteCache,
        )
        result[cy * width + cx] = { color: paletteHex[paletteIndex] }
      }
    }
  }

  return result
}

function computeSourceCrop(
  imageWidth: number,
  imageHeight: number,
  crop?: ImageCropRect,
) {
  if (!crop) {
    return { x: 0, y: 0, width: imageWidth, height: imageHeight }
  }

  const x = clamp(crop.x, 0, 0.98)
  const y = clamp(crop.y, 0, 0.98)
  const width = clamp(crop.width, 0.02, 1 - x)
  const height = clamp(crop.height, 0.02, 1 - y)

  return {
    x: Math.round(x * imageWidth),
    y: Math.round(y * imageHeight),
    width: Math.max(1, Math.round(width * imageWidth)),
    height: Math.max(1, Math.round(height * imageHeight)),
  }
}

function drawSourceImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  fit: ImageFitMode,
  crop?: ImageCropRect,
  placement?: ImagePlacement,
) {
  if (placement) {
    const drawWidth = targetWidth * placement.scale
    const drawHeight = drawWidth * (image.height / image.width)
    const x = placement.x * targetWidth
    const y = placement.y * targetHeight
    context.save()
    context.translate(x + drawWidth / 2, y + drawHeight / 2)
    context.rotate((placement.rotation * Math.PI) / 180)
    context.scale(placement.flipX ? -1 : 1, placement.flipY ? -1 : 1)
    context.drawImage(
      image,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight,
    )
    context.restore()
    return
  }

  const source = computeSourceCrop(image.width, image.height, crop)
  const draw = computeDrawRect(
    source.width,
    source.height,
    targetWidth,
    targetHeight,
    fit,
  )
  context.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
    draw.x,
    draw.y,
    draw.width,
    draw.height,
  )
}

function computeDrawRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: ImageFitMode,
) {
  if (fit === 'stretch') {
    return { x: 0, y: 0, width: targetWidth, height: targetHeight }
  }

  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = targetWidth / targetHeight
  const useWidth =
    fit === 'contain' ? sourceRatio > targetRatio : sourceRatio < targetRatio

  if (useWidth) {
    const drawWidth = targetWidth
    const drawHeight = drawWidth / sourceRatio
    return {
      x: 0,
      y: (targetHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    }
  }

  const drawHeight = targetHeight
  const drawWidth = drawHeight * sourceRatio
  return {
    x: (targetWidth - drawWidth) / 2,
    y: 0,
    width: drawWidth,
    height: drawHeight,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function atkinsonQuantize(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  paletteRgb: Array<[number, number, number]>,
  paletteOklab: OklabColor[],
  paletteHex: string[],
  nearestPaletteCache: Int16Array,
): PatternCell[] {
  const buffer = new Float32Array(width * height * 3)
  // alphaMask[i]=1 表示该像素来自原图(可量化),=0 表示透明留白(将得到 null cell)
  const alphaMask = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4
    const target = i * 3
    buffer[target] = pixels[offset]
    buffer[target + 1] = pixels[offset + 1]
    buffer[target + 2] = pixels[offset + 2]
    if (pixels[offset + 3] >= 128) alphaMask[i] = 1
  }

  const result: PatternCell[] = new Array(width * height)
  const offsets: Array<[number, number]> = [
    [1, 0],
    [2, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [0, 2],
  ]

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (!alphaMask[index]) {
        result[index] = { color: null }
        continue
      }
      const target = index * 3
      const r = clampChannel(buffer[target])
      const g = clampChannel(buffer[target + 1])
      const b = clampChannel(buffer[target + 2])
      const paletteIndex = findNearestPaletteIndexCached(
        r,
        g,
        b,
        paletteOklab,
        nearestPaletteCache,
      )
      const chosen = paletteRgb[paletteIndex]
      result[index] = { color: paletteHex[paletteIndex] }

      const errR = (r - chosen[0]) / 8
      const errG = (g - chosen[1]) / 8
      const errB = (b - chosen[2]) / 8

      for (const [dx, dy] of offsets) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const neighbor = (ny * width + nx) * 3
        buffer[neighbor] += errR
        buffer[neighbor + 1] += errG
        buffer[neighbor + 2] += errB
      }
    }
  }

  return result
}

function clampChannel(value: number) {
  if (value < 0) return 0
  if (value > 255) return 255
  return value
}

function findNearestPaletteIndex(
  r: number,
  g: number,
  b: number,
  paletteOklab: OklabColor[],
) {
  const target = rgbToOklab(r, g, b)
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY
  for (let i = 0; i < paletteOklab.length; i += 1) {
    const c = paletteOklab[i]
    const dl = target[0] - c[0]
    const da = target[1] - c[1]
    const db = target[2] - c[2]
    const distance = dl * dl + da * da + db * db
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = i
    }
  }
  return nearestIndex
}

function findNearestPaletteIndexCached(
  r: number,
  g: number,
  b: number,
  paletteOklab: OklabColor[],
  cache: Int16Array,
): number {
  const r5 = Math.round(clampChannel(r)) >> 3
  const g5 = Math.round(clampChannel(g)) >> 3
  const b5 = Math.round(clampChannel(b)) >> 3
  const bucket = (r5 << 10) | (g5 << 5) | b5
  const cached = cache[bucket]
  if (cached >= 0) return cached

  const nearest = findNearestPaletteIndex(
    (r5 << 3) + 4,
    (g5 << 3) + 4,
    (b5 << 3) + 4,
    paletteOklab,
  )
  cache[bucket] = nearest
  return nearest
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}
