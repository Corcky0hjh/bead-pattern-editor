import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/core/pattern/beadingLayers.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } })
const { buildBeadingLayers, nextPendingLayer, connectedBeads } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

// The same color belongs to one layer even across empty/other-colored cells.
const layers = buildBeadingLayers({ cells: [
  { color: '#FF0000' }, { color: null }, { color: '#00ff00' },
  { color: '#ff0000' }, { color: '#0000ff', isExternal: true },
  { color: '#0000ff' }, { color: '#00ff00' },
] })
assert.deepEqual(layers.map(({ color, indices }) => [color, [...indices]]), [
  ['#ff0000', [0, 3]], ['#00ff00', [2, 6]], ['#0000ff', [5]],
])
assert.equal(nextPendingLayer(layers, 0, 1, new Set([0, 3, 2, 6])), layers[2])
assert.equal(nextPendingLayer(layers, 2, 1, new Set([5])), layers[0])
assert.equal(nextPendingLayer(layers, 0, -1, new Set()), layers[2])
assert.equal(nextPendingLayer(layers, 0, 1, new Set([0, 3, 2, 6, 5])), null)
assert.equal(nextPendingLayer(layers.slice(0, 1), 0, 1, new Set()), null)
console.log('Color grouping, exclusions, navigation, wraparound, and completion checks passed.')
const board = { width: 3, height: 3, cells: [
  {color:'#AA0000'}, {color:'#aa0000'}, {color:null},
  {color:null}, {color:'#aa0000'}, {color:'#00ff00'},
  {color:'#aa0000'}, {color:'#aa0000',isExternal:true}, {color:'#aa0000'},
] }
assert.deepEqual([...connectedBeads(board, 0)].sort(), [0,1,4])
assert.deepEqual([...connectedBeads(board, 6)], [6])
assert.deepEqual([...connectedBeads(board, 2)], [])
assert.deepEqual([...connectedBeads(board, 7)], [])
console.log('Connected fill excludes diagonals, other colors, empty cells, and external cells.')
