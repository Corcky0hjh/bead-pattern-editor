/** 画布展示用的米色底,纯视觉常量,**不参与任何判等**。空 cell 由 color===null 表达。 */
export const CANVAS_BG_COLOR = '#fffdf8'
export const MIN_PATTERN_SIDE = 4
export const MAX_PATTERN_SIDE = 512

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

/** 空格是不可变值，复用引用可避免大画布为每个空位分配独立对象。 */
export const EMPTY_PATTERN_CELL: PatternCell = Object.freeze({ color: null })

const CHUNK_SIDE = 32
const CHUNK_CELL_COUNT = CHUNK_SIDE * CHUNK_SIDE
const SPARSE_TO_DENSE_THRESHOLD = 32

type UniformChunk = { kind: 'uniform'; value: number }
type SparseChunk = {
  kind: 'sparse'
  base: number
  entries: Map<number, number>
}
type DenseChunk = { kind: 'dense'; values: Uint16Array }
type PatternChunk = UniformChunk | SparseChunk | DenseChunk

type CellPalette = {
  ids: Map<string, number>
  cells: PatternCell[]
}

type ChunkedCellStore = {
  width: number
  height: number
  chunkColumns: number
  chunks: PatternChunk[]
  ownedChunks: Set<number>
  palette: CellPalette
}

const cellStoreByArray = new WeakMap<PatternCell[], ChunkedCellStore>()

function getCellKey(cell: PatternCell) {
  return `${cell.color?.toLowerCase() ?? 'null'}:${cell.isExternal ? 1 : 0}`
}

function createCellPalette(
  cells: PatternCell[] = [EMPTY_PATTERN_CELL],
): CellPalette {
  const normalizedCells = cells.map((cell) =>
    Object.freeze({
      color: cell.color?.toLowerCase() ?? null,
      ...(cell.isExternal ? { isExternal: true } : {}),
    }),
  )
  const ids = new Map<string, number>()
  normalizedCells.forEach((cell, index) => ids.set(getCellKey(cell), index))
  return { ids, cells: normalizedCells }
}

function getCellId(palette: CellPalette, cell: PatternCell) {
  const key = getCellKey(cell)
  const existing = palette.ids.get(key)
  if (existing !== undefined) return existing
  if (palette.cells.length >= 0xffff) {
    throw new Error('画布颜色种类超过内部存储上限')
  }
  const normalized = Object.freeze({
    color: cell.color?.toLowerCase() ?? null,
    ...(cell.isExternal ? { isExternal: true } : {}),
  })
  const id = palette.cells.length
  palette.cells.push(normalized)
  palette.ids.set(key, id)
  return id
}

function getChunkLocation(store: ChunkedCellStore, index: number) {
  const x = index % store.width
  const y = Math.floor(index / store.width)
  return getChunkLocationAt(store, x, y)
}

function getChunkLocationAt(store: ChunkedCellStore, x: number, y: number) {
  const chunkX = Math.floor(x / CHUNK_SIDE)
  const chunkY = Math.floor(y / CHUNK_SIDE)
  return {
    chunkIndex: chunkY * store.chunkColumns + chunkX,
    localIndex: (y % CHUNK_SIDE) * CHUNK_SIDE + (x % CHUNK_SIDE),
  }
}

function readChunkValue(chunk: PatternChunk, localIndex: number) {
  if (chunk.kind === 'uniform') return chunk.value
  if (chunk.kind === 'sparse') {
    return chunk.entries.get(localIndex) ?? chunk.base
  }
  return chunk.values[localIndex]
}

function cloneChunk(chunk: PatternChunk): PatternChunk {
  if (chunk.kind === 'uniform') return chunk
  if (chunk.kind === 'sparse') {
    return { kind: 'sparse', base: chunk.base, entries: new Map(chunk.entries) }
  }
  return { kind: 'dense', values: chunk.values.slice() }
}

function writeStoreValueAtLocation(
  store: ChunkedCellStore,
  chunkIndex: number,
  localIndex: number,
  value: number,
) {
  let chunk = store.chunks[chunkIndex]
  if (readChunkValue(chunk, localIndex) === value) return

  if (!store.ownedChunks.has(chunkIndex)) {
    chunk = cloneChunk(chunk)
    store.chunks[chunkIndex] = chunk
    store.ownedChunks.add(chunkIndex)
  }

  if (chunk.kind === 'uniform') {
    store.chunks[chunkIndex] = {
      kind: 'sparse',
      base: chunk.value,
      entries: new Map([[localIndex, value]]),
    }
    return
  }

  if (chunk.kind === 'sparse') {
    if (value === chunk.base) chunk.entries.delete(localIndex)
    else chunk.entries.set(localIndex, value)
    if (chunk.entries.size === 0) {
      store.chunks[chunkIndex] = { kind: 'uniform', value: chunk.base }
    } else if (chunk.entries.size > SPARSE_TO_DENSE_THRESHOLD) {
      const values = new Uint16Array(CHUNK_CELL_COUNT)
      values.fill(chunk.base)
      chunk.entries.forEach((entry, entryIndex) => {
        values[entryIndex] = entry
      })
      store.chunks[chunkIndex] = { kind: 'dense', values }
    }
    return
  }

  chunk.values[localIndex] = value
}

function writeStoreValue(
  store: ChunkedCellStore,
  index: number,
  value: number,
) {
  const { chunkIndex, localIndex } = getChunkLocation(store, index)
  writeStoreValueAtLocation(store, chunkIndex, localIndex, value)
}

function readStoreValueAt(store: ChunkedCellStore, x: number, y: number) {
  const { chunkIndex, localIndex } = getChunkLocationAt(store, x, y)
  return readChunkValue(store.chunks[chunkIndex], localIndex)
}

function writeStoreValueAt(
  store: ChunkedCellStore,
  x: number,
  y: number,
  value: number,
) {
  const { chunkIndex, localIndex } = getChunkLocationAt(store, x, y)
  writeStoreValueAtLocation(store, chunkIndex, localIndex, value)
}

function readStoreCell(store: ChunkedCellStore, index: number) {
  const { chunkIndex, localIndex } = getChunkLocation(store, index)
  return store.palette.cells[
    readChunkValue(store.chunks[chunkIndex], localIndex)
  ]
}

function getChunkSize(store: ChunkedCellStore, chunkIndex: number) {
  const chunkX = chunkIndex % store.chunkColumns
  const chunkY = Math.floor(chunkIndex / store.chunkColumns)
  return {
    width: Math.min(CHUNK_SIDE, store.width - chunkX * CHUNK_SIDE),
    height: Math.min(CHUNK_SIDE, store.height - chunkY * CHUNK_SIDE),
  }
}

function compactChunk(
  chunk: PatternChunk,
  width: number,
  height: number,
): PatternChunk {
  const counts = new Map<number, number>()
  let base = 0
  let baseCount = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = readChunkValue(chunk, y * CHUNK_SIDE + x)
      const count = (counts.get(value) ?? 0) + 1
      counts.set(value, count)
      if (count > baseCount) {
        base = value
        baseCount = count
      }
    }
  }

  const validCount = width * height
  if (baseCount === validCount) return { kind: 'uniform', value: base }

  if (validCount - baseCount <= SPARSE_TO_DENSE_THRESHOLD) {
    const entries = new Map<number, number>()
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * CHUNK_SIDE + x
        const value = readChunkValue(chunk, index)
        if (value !== base) entries.set(index, value)
      }
    }
    return { kind: 'sparse', base, entries }
  }

  const values = new Uint16Array(CHUNK_CELL_COUNT)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * CHUNK_SIDE + x
      values[index] = readChunkValue(chunk, index)
    }
  }
  return { kind: 'dense', values }
}

function finalizeStore(store: ChunkedCellStore) {
  const sharedUniformChunks = new Map<number, UniformChunk>()
  store.chunks.forEach((chunk, chunkIndex) => {
    if (store.ownedChunks.has(chunkIndex) || chunk.kind !== 'uniform') return
    sharedUniformChunks.set(chunk.value, chunk)
  })

  for (const chunkIndex of store.ownedChunks) {
    const { width, height } = getChunkSize(store, chunkIndex)
    const compacted = compactChunk(store.chunks[chunkIndex], width, height)
    if (compacted.kind !== 'uniform') {
      store.chunks[chunkIndex] = compacted
      continue
    }
    const shared = sharedUniformChunks.get(compacted.value)
    if (shared) store.chunks[chunkIndex] = shared
    else {
      sharedUniformChunks.set(compacted.value, compacted)
      store.chunks[chunkIndex] = compacted
    }
  }
  store.ownedChunks.clear()
}

function normalizeSliceIndex(
  value: number | undefined,
  length: number,
  fallback: number,
) {
  if (value === undefined) return fallback
  const integer = Math.trunc(value)
  return integer < 0 ? Math.max(0, length + integer) : Math.min(length, integer)
}

function createChunkedCellProxy(store: ChunkedCellStore): PatternCell[] {
  const length = store.width * store.height
  const target: PatternCell[] = []
  const proxy: PatternCell[] = new Proxy(target, {
    get(arrayTarget, property, receiver) {
      if (property === 'length') return length
      if (property === 'slice') {
        return (start?: number, end?: number) => {
          const normalizedStart = normalizeSliceIndex(start, length, 0)
          const normalizedEnd = normalizeSliceIndex(end, length, length)
          if (normalizedStart === 0 && normalizedEnd === length) {
            return createChunkedCellProxy({
              ...store,
              chunks: store.chunks.slice(),
              ownedChunks: new Set(),
              palette: {
                ids: new Map(store.palette.ids),
                cells: store.palette.cells.slice(),
              },
            })
          }
          const result: PatternCell[] = []
          for (let index = normalizedStart; index < normalizedEnd; index += 1) {
            result.push(readStoreCell(store, index))
          }
          return result
        }
      }
      if (property === 'forEach') {
        return (
          callback: (
            cell: PatternCell,
            index: number,
            cells: PatternCell[],
          ) => void,
          thisArg?: unknown,
        ) => {
          for (let index = 0; index < length; index += 1) {
            callback.call(thisArg, readStoreCell(store, index), index, proxy)
          }
        }
      }
      if (property === 'reduce') {
        return <T>(
          callback: (
            accumulator: T,
            cell: PatternCell,
            index: number,
            cells: PatternCell[],
          ) => T,
          ...initial: [T] | []
        ) => {
          if (length === 0 && initial.length === 0) {
            throw new TypeError('Reduce of empty array with no initial value')
          }
          let index = initial.length === 0 ? 1 : 0
          let accumulator =
            initial.length === 0 ? (readStoreCell(store, 0) as T) : initial[0]
          for (; index < length; index += 1) {
            accumulator = callback(
              accumulator,
              readStoreCell(store, index),
              index,
              proxy,
            )
          }
          return accumulator
        }
      }
      if (typeof property === 'string') {
        const index = Number(property)
        if (
          Number.isInteger(index) &&
          index >= 0 &&
          index < length &&
          String(index) === property
        ) {
          return readStoreCell(store, index)
        }
      }
      return Reflect.get(arrayTarget, property, receiver)
    },
    set(arrayTarget, property, value, receiver) {
      if (property === 'length') {
        if (value !== length) {
          throw new TypeError('Pattern cell storage has a fixed length')
        }
        return true
      }
      if (typeof property === 'string') {
        const index = Number(property)
        if (
          Number.isInteger(index) &&
          index >= 0 &&
          index < length &&
          String(index) === property
        ) {
          writeStoreValue(
            store,
            index,
            getCellId(store.palette, value as PatternCell),
          )
          return true
        }
      }
      return Reflect.set(arrayTarget, property, value, receiver)
    },
    has(arrayTarget, property) {
      if (typeof property === 'string') {
        const index = Number(property)
        if (
          Number.isInteger(index) &&
          index >= 0 &&
          index < length &&
          String(index) === property
        ) {
          return true
        }
      }
      return Reflect.has(arrayTarget, property)
    },
  })
  cellStoreByArray.set(proxy, store)
  return proxy
}

export function createUniformPatternCells(
  width: number,
  height: number,
  cell: PatternCell,
): PatternCell[] {
  const chunkColumns = Math.ceil(width / CHUNK_SIDE)
  const chunkRows = Math.ceil(height / CHUNK_SIDE)
  const palette = createCellPalette()
  const uniformChunk: UniformChunk = {
    kind: 'uniform',
    value: getCellId(palette, cell),
  }
  return createChunkedCellProxy({
    width,
    height,
    chunkColumns,
    chunks: Array(chunkColumns * chunkRows).fill(uniformChunk),
    ownedChunks: new Set(),
    palette,
  })
}

export type PatternCellChunkView = {
  token: object
  x: number
  y: number
  width: number
  height: number
  uniformCell?: PatternCell
  get: (localX: number, localY: number) => PatternCell
}

export function getPatternCellChunks(cells: PatternCell[]) {
  const store = cellStoreByArray.get(cells)
  if (!store) return null
  return store.chunks.map<PatternCellChunkView>((chunk, chunkIndex) => {
    const chunkX = chunkIndex % store.chunkColumns
    const chunkY = Math.floor(chunkIndex / store.chunkColumns)
    const x = chunkX * CHUNK_SIDE
    const y = chunkY * CHUNK_SIDE
    return {
      token: chunk,
      x,
      y,
      width: Math.min(CHUNK_SIDE, store.width - x),
      height: Math.min(CHUNK_SIDE, store.height - y),
      ...(chunk.kind === 'uniform'
        ? { uniformCell: store.palette.cells[chunk.value] }
        : {}),
      get(localX, localY) {
        return store.palette.cells[
          readChunkValue(chunk, localY * CHUNK_SIDE + localX)
        ]
      },
    }
  })
}

export function toChunkedPatternCells(
  width: number,
  height: number,
  cells: PatternCell[],
) {
  if (cellStoreByArray.has(cells)) return cells
  const chunkColumns = Math.ceil(width / CHUNK_SIDE)
  const chunkRows = Math.ceil(height / CHUNK_SIDE)
  const chunks: PatternChunk[] = []
  const palette = createCellPalette()

  for (let chunkY = 0; chunkY < chunkRows; chunkY += 1) {
    for (let chunkX = 0; chunkX < chunkColumns; chunkX += 1) {
      const validWidth = Math.min(CHUNK_SIDE, width - chunkX * CHUNK_SIDE)
      const validHeight = Math.min(CHUNK_SIDE, height - chunkY * CHUNK_SIDE)
      const values = new Uint16Array(CHUNK_CELL_COUNT)
      const counts = new Map<number, number>()
      for (let localY = 0; localY < validHeight; localY += 1) {
        for (let localX = 0; localX < validWidth; localX += 1) {
          const x = chunkX * CHUNK_SIDE + localX
          const y = chunkY * CHUNK_SIDE + localY
          const value = getCellId(palette, cells[y * width + x])
          values[localY * CHUNK_SIDE + localX] = value
          counts.set(value, (counts.get(value) ?? 0) + 1)
        }
      }

      const validCount = validWidth * validHeight
      let base = 0
      let baseCount = -1
      counts.forEach((count, value) => {
        if (count > baseCount) {
          base = value
          baseCount = count
        }
      })
      if (baseCount === validCount) {
        chunks.push({ kind: 'uniform', value: base })
        continue
      }

      if (validCount - baseCount <= SPARSE_TO_DENSE_THRESHOLD) {
        const entries = new Map<number, number>()
        for (let localY = 0; localY < validHeight; localY += 1) {
          for (let localX = 0; localX < validWidth; localX += 1) {
            const localIndex = localY * CHUNK_SIDE + localX
            const value = values[localIndex]
            if (value !== base) entries.set(localIndex, value)
          }
        }
        chunks.push({ kind: 'sparse', base, entries })
        continue
      }

      chunks.push({ kind: 'dense', values })
    }
  }

  return createChunkedCellProxy({
    width,
    height,
    chunkColumns,
    chunks,
    ownedChunks: new Set(),
    palette,
  })
}

export function ensureChunkedPatternGrid(pattern: PatternGrid): PatternGrid {
  const store = cellStoreByArray.get(pattern.cells)
  if (store) {
    finalizeStore(store)
    return pattern
  }
  return {
    ...pattern,
    cells: toChunkedPatternCells(pattern.width, pattern.height, pattern.cells),
  }
}

export type PatternFillBounds = {
  x: number
  y: number
  width: number
  height: number
}

function normalizePatternBounds(
  width: number,
  height: number,
  bounds?: PatternFillBounds,
) {
  const rawX = Math.trunc(bounds?.x ?? 0)
  const rawY = Math.trunc(bounds?.y ?? 0)
  const rawWidth = Math.max(0, Math.trunc(bounds?.width ?? width))
  const rawHeight = Math.max(0, Math.trunc(bounds?.height ?? height))
  const minX = Math.max(0, rawX)
  const minY = Math.max(0, rawY)
  return {
    minX,
    minY,
    maxX: Math.min(width, Math.max(minX, rawX + rawWidth)),
    maxY: Math.min(height, Math.max(minY, rawY + rawHeight)),
  }
}

export function mapPatternCells(
  cells: PatternCell[],
  mapper: (cell: PatternCell, index: number) => PatternCell,
  bounds?: PatternFillBounds,
) {
  const store = cellStoreByArray.get(cells)
  if (!store) return cells.map(mapper)

  const nextCells = cells.slice()
  const nextStore = cellStoreByArray.get(nextCells)
  if (!nextStore) return cells
  const { minX, minY, maxX, maxY } = normalizePatternBounds(
    store.width,
    store.height,
    bounds,
  )
  let changed = false
  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const index = y * store.width + x
      const current = readStoreCell(store, index)
      const next = mapper(current, index)
      if (getCellKey(current) === getCellKey(next)) continue
      writeStoreValueAt(nextStore, x, y, getCellId(nextStore.palette, next))
      changed = true
    }
  }
  if (changed) finalizeStore(nextStore)
  return changed ? nextCells : cells
}

export function replacePatternColor(
  cells: PatternCell[],
  sourceColor: string,
  targetColor: string,
) {
  const store = cellStoreByArray.get(cells)
  if (!store) {
    const source = sourceColor.toLowerCase()
    const target = targetColor.toLowerCase()
    return cells.map((cell) =>
      !cell.isExternal && cell.color?.toLowerCase() === source
        ? { color: target }
        : cell,
    )
  }

  const sourceId = store.palette.ids.get(`${sourceColor.toLowerCase()}:0`)
  if (sourceId === undefined) return cells
  const nextCells = cells.slice()
  const nextStore = cellStoreByArray.get(nextCells)
  if (!nextStore) return cells
  const targetId = getCellId(nextStore.palette, {
    color: targetColor.toLowerCase(),
  })
  if (sourceId === targetId) return cells

  let changed = false
  nextStore.chunks.forEach((chunk, chunkIndex) => {
    if (chunk.kind === 'uniform') {
      if (chunk.value !== sourceId) return
      nextStore.chunks[chunkIndex] = { kind: 'uniform', value: targetId }
      nextStore.ownedChunks.add(chunkIndex)
      changed = true
      return
    }

    if (chunk.kind === 'sparse') {
      if (
        chunk.base !== sourceId &&
        ![...chunk.entries.values()].includes(sourceId)
      ) {
        return
      }
      const base = chunk.base === sourceId ? targetId : chunk.base
      const entries = new Map<number, number>()
      chunk.entries.forEach((value, index) => {
        const nextValue = value === sourceId ? targetId : value
        if (nextValue !== base) entries.set(index, nextValue)
      })
      nextStore.chunks[chunkIndex] = { kind: 'sparse', base, entries }
      nextStore.ownedChunks.add(chunkIndex)
      changed = true
      return
    }

    let nextValues: Uint16Array | null = null
    for (let index = 0; index < chunk.values.length; index += 1) {
      if (chunk.values[index] !== sourceId) continue
      nextValues ??= chunk.values.slice()
      nextValues[index] = targetId
    }
    if (!nextValues) return
    nextStore.chunks[chunkIndex] = { kind: 'dense', values: nextValues }
    nextStore.ownedChunks.add(chunkIndex)
    changed = true
  })

  return changed ? nextCells : cells
}

export function floodFillPatternGrid(
  pattern: PatternGrid,
  startIndex: number,
  replacement: PatternCell,
  bounds?: PatternFillBounds,
): PatternGrid {
  const normalized = ensureChunkedPatternGrid(pattern)
  const store = cellStoreByArray.get(normalized.cells)
  const length = normalized.width * normalized.height
  if (!store || startIndex < 0 || startIndex >= length) return normalized

  const { minX, minY, maxX, maxY } = normalizePatternBounds(
    normalized.width,
    normalized.height,
    bounds,
  )
  const startX = startIndex % normalized.width
  const startY = Math.floor(startIndex / normalized.width)
  if (startX < minX || startX >= maxX || startY < minY || startY >= maxY) {
    return normalized
  }

  const targetId = readStoreValueAt(store, startX, startY)
  if (getCellKey(store.palette.cells[targetId]) === getCellKey(replacement)) {
    return normalized
  }

  const nextCells = normalized.cells.slice()
  const nextStore = cellStoreByArray.get(nextCells)
  if (!nextStore) return normalized
  const replacementId = getCellId(nextStore.palette, replacement)
  const stack = [startY * normalized.width + startX]
  let changed = false

  const matches = (x: number, y: number) =>
    x >= minX &&
    x < maxX &&
    y >= minY &&
    y < maxY &&
    readStoreValueAt(nextStore, x, y) === targetId

  while (stack.length > 0) {
    const seed = stack.pop()
    if (seed === undefined) continue
    const y = Math.floor(seed / normalized.width)
    let left = seed % normalized.width
    if (!matches(left, y)) continue
    while (left > minX && matches(left - 1, y)) left -= 1

    let scanAbove = false
    let scanBelow = false
    for (let x = left; x < maxX && matches(x, y); x += 1) {
      writeStoreValueAt(nextStore, x, y, replacementId)
      changed = true

      if (y > minY) {
        const matchesAbove = matches(x, y - 1)
        if (matchesAbove && !scanAbove) {
          stack.push((y - 1) * normalized.width + x)
        }
        scanAbove = matchesAbove
      }
      if (y + 1 < maxY) {
        const matchesBelow = matches(x, y + 1)
        if (matchesBelow && !scanBelow) {
          stack.push((y + 1) * normalized.width + x)
        }
        scanBelow = matchesBelow
      }
    }
  }

  if (!changed) return normalized
  finalizeStore(nextStore)
  return { ...normalized, cells: nextCells }
}

export function resizePatternGrid(
  pattern: PatternGrid,
  width: number,
  height: number,
): PatternGrid {
  const normalized = ensureChunkedPatternGrid(pattern)
  const sourceStore = cellStoreByArray.get(normalized.cells)
  const next = createSolidPatternGrid({ width, height })
  const targetStore = cellStoreByArray.get(next.cells)
  const copyWidth = Math.min(width, pattern.width)
  const copyHeight = Math.min(height, pattern.height)

  if (sourceStore && targetStore) {
    targetStore.palette = {
      ids: new Map(sourceStore.palette.ids),
      cells: sourceStore.palette.cells.slice(),
    }
    const chunkColumns = Math.ceil(copyWidth / CHUNK_SIDE)
    const chunkRows = Math.ceil(copyHeight / CHUNK_SIDE)
    for (let chunkY = 0; chunkY < chunkRows; chunkY += 1) {
      for (let chunkX = 0; chunkX < chunkColumns; chunkX += 1) {
        const sourceChunkIndex = chunkY * sourceStore.chunkColumns + chunkX
        const targetChunkIndex = chunkY * targetStore.chunkColumns + chunkX
        const sourceSize = getChunkSize(sourceStore, sourceChunkIndex)
        const targetSize = getChunkSize(targetStore, targetChunkIndex)
        const copiedWidth = Math.min(
          CHUNK_SIDE,
          copyWidth - chunkX * CHUNK_SIDE,
        )
        const copiedHeight = Math.min(
          CHUNK_SIDE,
          copyHeight - chunkY * CHUNK_SIDE,
        )

        if (
          sourceSize.width === targetSize.width &&
          sourceSize.height === targetSize.height &&
          copiedWidth === sourceSize.width &&
          copiedHeight === sourceSize.height
        ) {
          targetStore.chunks[targetChunkIndex] =
            sourceStore.chunks[sourceChunkIndex]
          continue
        }

        for (let localY = 0; localY < copiedHeight; localY += 1) {
          for (let localX = 0; localX < copiedWidth; localX += 1) {
            const value = readChunkValue(
              sourceStore.chunks[sourceChunkIndex],
              localY * CHUNK_SIDE + localX,
            )
            if (value === 0) continue
            writeStoreValueAtLocation(
              targetStore,
              targetChunkIndex,
              localY * CHUNK_SIDE + localX,
              value,
            )
          }
        }
      }
    }
    finalizeStore(targetStore)
    return next
  }

  for (let y = 0; y < copyHeight; y += 1) {
    for (let x = 0; x < copyWidth; x += 1) {
      const cell = pattern.cells[y * pattern.width + x]
      if (cell.color === null && !cell.isExternal) continue
      next.cells[y * width + x] = cell
    }
  }
  return ensureChunkedPatternGrid(next)
}

export function getPatternStorageStats(cells: PatternCell[]) {
  const store = cellStoreByArray.get(cells)
  if (!store) return null
  let uniform = 0
  let sparse = 0
  let dense = 0
  for (const chunk of store.chunks) {
    if (chunk.kind === 'uniform') uniform += 1
    else if (chunk.kind === 'sparse') sparse += 1
    else dense += 1
  }
  return { chunks: store.chunks.length, uniform, sparse, dense }
}

export function getUniformPatternCell(cells: PatternCell[]) {
  const store = cellStoreByArray.get(cells)
  if (!store || store.chunks.length === 0) return undefined
  const first = store.chunks[0]
  if (first.kind !== 'uniform') return undefined
  for (let index = 1; index < store.chunks.length; index += 1) {
    const chunk = store.chunks[index]
    if (chunk.kind !== 'uniform' || chunk.value !== first.value)
      return undefined
  }
  return store.palette.cells[first.value]
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
    cells: createUniformPatternCells(
      width,
      height,
      color === null ? EMPTY_PATTERN_CELL : Object.freeze({ color }),
    ),
  }
}

type SerializedCell = [color: string | null, isExternal: 0 | 1]
type SerializedChunk =
  | { type: 'uniform'; value: number }
  | { type: 'sparse'; base: number; entries: number[] }
  | { type: 'dense'; data: string }

export type SerializedPatternGrid = {
  schemaVersion: 2
  width: number
  height: number
  palette: SerializedCell[]
  chunks: SerializedChunk[]
}

function encodeDenseValues(values: Uint16Array) {
  const bytes = new Uint8Array(values.length * 2)
  for (let index = 0; index < values.length; index += 1) {
    bytes[index * 2] = values[index] & 0xff
    bytes[index * 2 + 1] = values[index] >> 8
  }
  let binary = ''
  const batchSize = 0x4000
  for (let index = 0; index < bytes.length; index += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + batchSize))
  }
  return btoa(binary)
}

function decodeDenseValues(data: string) {
  let binary: string
  try {
    binary = atob(data)
  } catch {
    return null
  }
  if (binary.length !== CHUNK_CELL_COUNT * 2) return null
  const values = new Uint16Array(CHUNK_CELL_COUNT)
  for (let index = 0; index < values.length; index += 1) {
    values[index] =
      binary.charCodeAt(index * 2) | (binary.charCodeAt(index * 2 + 1) << 8)
  }
  return values
}

export function serializePatternGrid(
  pattern: PatternGrid,
): SerializedPatternGrid {
  const normalized = ensureChunkedPatternGrid(pattern)
  const store = cellStoreByArray.get(normalized.cells)
  if (!store) throw new Error('无法读取画布分块存储')

  return {
    schemaVersion: 2,
    width: normalized.width,
    height: normalized.height,
    palette: store.palette.cells.map((cell) => [
      cell.color,
      cell.isExternal ? 1 : 0,
    ]),
    chunks: store.chunks.map((chunk) => {
      if (chunk.kind === 'uniform') {
        return { type: 'uniform', value: chunk.value }
      }
      if (chunk.kind === 'sparse') {
        const entries = [...chunk.entries]
          .sort(([left], [right]) => left - right)
          .flatMap(([index, value]) => [index, value])
        return { type: 'sparse', base: chunk.base, entries }
      }
      return { type: 'dense', data: encodeDenseValues(chunk.values) }
    }),
  }
}

export function parsePatternGrid(value: unknown): PatternGrid | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<SerializedPatternGrid>
  if (
    candidate.schemaVersion !== 2 ||
    !Number.isInteger(candidate.width) ||
    !Number.isInteger(candidate.height) ||
    candidate.width! < MIN_PATTERN_SIDE ||
    candidate.width! > MAX_PATTERN_SIDE ||
    candidate.height! < MIN_PATTERN_SIDE ||
    candidate.height! > MAX_PATTERN_SIDE ||
    !Array.isArray(candidate.palette) ||
    candidate.palette.length === 0 ||
    candidate.palette.length >= 0xffff ||
    !Array.isArray(candidate.chunks)
  ) {
    return null
  }

  const paletteCells: PatternCell[] = []
  const paletteKeys = new Set<string>()
  for (const rawCell of candidate.palette) {
    if (!Array.isArray(rawCell) || rawCell.length !== 2) return null
    const [color, external] = rawCell
    if (
      color !== null &&
      (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))
    ) {
      return null
    }
    if (external !== 0 && external !== 1) return null
    const cell: PatternCell = {
      color: color === null ? null : color.toLowerCase(),
      ...(external ? { isExternal: true } : {}),
    }
    const key = getCellKey(cell)
    if (paletteKeys.has(key)) return null
    paletteKeys.add(key)
    paletteCells.push(cell)
  }
  if (getCellKey(paletteCells[0]) !== getCellKey(EMPTY_PATTERN_CELL))
    return null

  const width = candidate.width!
  const height = candidate.height!
  const chunkColumns = Math.ceil(width / CHUNK_SIDE)
  const chunkRows = Math.ceil(height / CHUNK_SIDE)
  if (candidate.chunks.length !== chunkColumns * chunkRows) return null

  const palette = createCellPalette(paletteCells)
  const isPaletteId = (id: unknown): id is number =>
    Number.isInteger(id) &&
    (id as number) >= 0 &&
    (id as number) < palette.cells.length
  const chunks: PatternChunk[] = []
  const sharedUniformChunks = new Map<number, UniformChunk>()
  for (
    let chunkIndex = 0;
    chunkIndex < candidate.chunks.length;
    chunkIndex += 1
  ) {
    const rawChunk = candidate.chunks[chunkIndex]
    if (!rawChunk || typeof rawChunk !== 'object') return null
    if (rawChunk.type === 'uniform') {
      if (!isPaletteId(rawChunk.value)) return null
      const shared = sharedUniformChunks.get(rawChunk.value)
      if (shared) chunks.push(shared)
      else {
        const chunk: UniformChunk = {
          kind: 'uniform',
          value: rawChunk.value,
        }
        sharedUniformChunks.set(rawChunk.value, chunk)
        chunks.push(chunk)
      }
      continue
    }
    if (rawChunk.type === 'sparse') {
      if (
        !isPaletteId(rawChunk.base) ||
        !Array.isArray(rawChunk.entries) ||
        rawChunk.entries.length % 2 !== 0
      ) {
        return null
      }
      const entries = new Map<number, number>()
      const chunkX = chunkIndex % chunkColumns
      const chunkY = Math.floor(chunkIndex / chunkColumns)
      const validWidth = Math.min(CHUNK_SIDE, width - chunkX * CHUNK_SIDE)
      const validHeight = Math.min(CHUNK_SIDE, height - chunkY * CHUNK_SIDE)
      for (let index = 0; index < rawChunk.entries.length; index += 2) {
        const localIndex = rawChunk.entries[index]
        const id = rawChunk.entries[index + 1]
        const localX = localIndex % CHUNK_SIDE
        const localY = Math.floor(localIndex / CHUNK_SIDE)
        if (
          !Number.isInteger(localIndex) ||
          localIndex < 0 ||
          localIndex >= CHUNK_CELL_COUNT ||
          localX >= validWidth ||
          localY >= validHeight ||
          !isPaletteId(id) ||
          entries.has(localIndex)
        ) {
          return null
        }
        entries.set(localIndex, id)
      }
      chunks.push({ kind: 'sparse', base: rawChunk.base, entries })
      continue
    }
    if (rawChunk.type === 'dense') {
      if (typeof rawChunk.data !== 'string') return null
      const values = decodeDenseValues(rawChunk.data)
      if (!values || values.some((id) => !isPaletteId(id))) return null
      chunks.push({ kind: 'dense', values })
      continue
    }
    return null
  }

  return {
    width,
    height,
    cells: createChunkedCellProxy({
      width,
      height,
      chunkColumns,
      chunks,
      ownedChunks: new Set(),
      palette,
    }),
  }
}
