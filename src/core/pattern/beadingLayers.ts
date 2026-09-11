import type { PatternGrid } from './grid'

export function connectedBeads(pattern: Pick<PatternGrid, 'cells' | 'width' | 'height'>, start: number) {
  const first = pattern.cells[start]
  const result = new Set<number>()
  if (!first?.color || first.isExternal) return result
  const color = first.color.toLowerCase()
  const queue = [start]
  result.add(start)
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor], x = index % pattern.width, y = Math.floor(index / pattern.width)
    for (const next of [x > 0 ? index - 1 : -1, x + 1 < pattern.width ? index + 1 : -1, y > 0 ? index - pattern.width : -1, y + 1 < pattern.height ? index + pattern.width : -1]) {
      if (next < 0 || result.has(next)) continue
      const cell = pattern.cells[next]
      if (!cell?.color || cell.isExternal || cell.color.toLowerCase() !== color) continue
      result.add(next)
      queue.push(next)
    }
  }
  return result
}

export function buildBeadingLayers(pattern: Pick<PatternGrid, 'cells'>) {
  const layers = new Map<string, Set<number>>()
  pattern.cells.forEach((cell, index) => {
    if (!cell.color || cell.isExternal) return
    const color = cell.color.toLowerCase()
    if (!layers.has(color)) layers.set(color, new Set())
    layers.get(color)!.add(index)
  })
  return [...layers.entries()].map(([color, indices]) => ({ color, indices }))
}

export function nextPendingLayer(
  layers: ReturnType<typeof buildBeadingLayers>,
  current: number,
  direction: -1 | 1,
  completed: Set<number>,
) {
  for (let offset = 1; offset < layers.length; offset += 1) {
    const layer = layers[(current + direction * offset + layers.length) % layers.length]
    if ([...layer.indices].some((index) => !completed.has(index))) return layer
  }
  return null
}
