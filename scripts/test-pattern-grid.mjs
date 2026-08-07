import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import {
  MAX_PATTERN_SIDE,
  createSolidPatternGrid,
  ensureChunkedPatternGrid,
  floodFillPatternGrid,
  getPatternCellChunks,
  getPatternStorageStats,
  getUniformPatternCell,
  mapPatternCells,
  parsePatternGrid,
  replacePatternColor,
  resizePatternGrid,
  serializePatternGrid,
} from '../src/core/pattern/grid.ts'

function finalize(pattern) {
  return ensureChunkedPatternGrid(pattern)
}

assert.equal(MAX_PATTERN_SIDE, 512)

const empty = createSolidPatternGrid({ width: 512, height: 512 })
assert.equal(empty.cells.length, 512 * 512)
assert.equal(getUniformPatternCell(empty.cells)?.color, null)

const editedCells = empty.cells.slice()
editedCells[0] = { color: '#ff0000' }
editedCells[33] = { color: '#00ff00', isExternal: true }
const edited = finalize({ ...empty, cells: editedCells })
assert.equal(
  empty.cells[0].color,
  null,
  'copy-on-write must preserve the source snapshot',
)
assert.equal(edited.cells[0].color, '#ff0000')

const encoded = serializePatternGrid(edited)
const decoded = parsePatternGrid(JSON.parse(JSON.stringify(encoded)))
assert.ok(decoded)
assert.deepEqual(decoded.cells[0], { color: '#ff0000' })
assert.deepEqual(decoded.cells[33], { color: '#00ff00', isExternal: true })
assert.ok(JSON.stringify(serializePatternGrid(empty)).length < 50_000)

const denseCells = empty.cells.slice()
for (let index = 0; index < 40; index += 1) {
  const cellIndex = Math.floor(index / 32) * empty.width + (index % 32)
  denseCells[cellIndex] = { color: '#ff0000' }
}
const dense = finalize({ ...empty, cells: denseCells })
assert.equal(getPatternStorageStats(dense.cells)?.dense, 1)

const clearedCells = dense.cells.slice()
for (let index = 0; index < 40; index += 1) {
  const cellIndex = Math.floor(index / 32) * empty.width + (index % 32)
  clearedCells[cellIndex] = { color: null }
}
const cleared = finalize({ ...dense, cells: clearedCells })
assert.equal(getPatternStorageStats(cleared.cells)?.dense, 0)
assert.equal(getUniformPatternCell(cleared.cells)?.color, null)

const replacedCells = replacePatternColor(edited.cells, '#ff0000', '#0000ff')
const replaced = finalize({ ...edited, cells: replacedCells })
assert.equal(replaced.cells[0].color, '#0000ff')
assert.equal(edited.cells[0].color, '#ff0000')

const mappedCells = mapPatternCells(replaced.cells, (cell, index) =>
  index === 1 ? { color: '#ffffff' } : cell,
)
const mapped = finalize({ ...replaced, cells: mappedCells })
assert.equal(mapped.cells[1].color, '#ffffff')

const resized = resizePatternGrid(mapped, 37, 35)
assert.equal(resized.width, 37)
assert.equal(resized.height, 35)
assert.equal(resized.cells[0].color, '#0000ff')
assert.equal(parsePatternGrid({ schemaVersion: 1 }), null)

const expanded = resizePatternGrid(resized, 65, 64)
assert.equal(expanded.cells[0].color, '#0000ff')
assert.equal(expanded.cells[37].color, null)

const fillBase = createSolidPatternGrid({ width: 512, height: 512 })
const fillBarrierCells = fillBase.cells.slice()
for (let y = 0; y < fillBase.height; y += 1) {
  fillBarrierCells[y * fillBase.width + 256] = { color: '#111111' }
}
const fillBarrier = finalize({ ...fillBase, cells: fillBarrierCells })
const fillStartedAt = performance.now()
const regionFilled = floodFillPatternGrid(fillBarrier, 0, {
  color: '#ff0000',
})
const fillElapsed = performance.now() - fillStartedAt
assert.equal(regionFilled.cells[255].color, '#ff0000')
assert.equal(regionFilled.cells[256].color, '#111111')
assert.equal(regionFilled.cells[257].color, null)
assert.ok(
  fillElapsed < 1_000,
  `512 region fill took ${fillElapsed.toFixed(1)}ms`,
)

const boundedFill = floodFillPatternGrid(
  fillBase,
  10 * fillBase.width + 10,
  { color: '#00ff00' },
  { x: 8, y: 8, width: 4, height: 4 },
)
assert.equal(boundedFill.cells[8 * fillBase.width + 8].color, '#00ff00')
assert.equal(boundedFill.cells[7 * fillBase.width + 8].color, null)

const checkerStartedAt = performance.now()
const checkerCells = mapPatternCells(fillBase.cells, (_cell, index) => {
  const x = index % fillBase.width
  const y = Math.floor(index / fillBase.width)
  return { color: (x + y) % 2 === 0 ? '#ff0000' : '#0000ff' }
})
const checker = finalize({ ...fillBase, cells: checkerCells })
const checkerPayload = JSON.stringify(serializePatternGrid(checker))
const checkerDecoded = parsePatternGrid(JSON.parse(checkerPayload))
const checkerElapsed = performance.now() - checkerStartedAt
assert.ok(checkerDecoded)
assert.equal(checkerDecoded.cells[0].color, '#ff0000')
assert.equal(checkerDecoded.cells[1].color, '#0000ff')
assert.equal(getPatternStorageStats(checkerDecoded.cells)?.dense, 256)
assert.ok(checkerPayload.length < 1_000_000)
assert.ok(
  checkerElapsed < 1_000,
  `512 dense codec took ${checkerElapsed.toFixed(1)}ms`,
)

const decodedEmpty = parsePatternGrid(
  JSON.parse(JSON.stringify(serializePatternGrid(fillBase))),
)
assert.ok(decodedEmpty)
const decodedEmptyChunks = getPatternCellChunks(decodedEmpty.cells)
assert.ok(decodedEmptyChunks)
assert.equal(new Set(decodedEmptyChunks.map((chunk) => chunk.token)).size, 1)

console.log(`512 region fill benchmark: ${fillElapsed.toFixed(1)}ms`)
console.log(
  `512 dense codec benchmark: ${checkerElapsed.toFixed(1)}ms, ${checkerPayload.length} bytes`,
)

console.log('pattern grid regression checks passed')
