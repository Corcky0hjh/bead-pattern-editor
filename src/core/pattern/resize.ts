import { ensureChunkedPatternGrid, type PatternGrid } from './grid'
export type ResizeAnchor = { x: 0 | 0.5 | 1; y: 0 | 0.5 | 1 }
export function resizeWithAnchor(pattern: PatternGrid, width: number, height: number, anchor: ResizeAnchor) {
  const dx = Math.floor((width - pattern.width) * anchor.x)
  const dy = Math.floor((height - pattern.height) * anchor.y)
  const cells: PatternGrid['cells'] = Array.from({ length: width * height }, () => ({ color: null }))
  let croppedBeads = 0
  pattern.cells.forEach((cell, index) => {
    const x = index % pattern.width + dx
    const y = Math.floor(index / pattern.width) + dy
    if (x >= 0 && x < width && y >= 0 && y < height) cells[y * width + x] = cell
    else if (cell.color && !cell.isExternal) croppedBeads++
  })
  return { pattern: ensureChunkedPatternGrid({ width, height, cells }), croppedBeads }
}
