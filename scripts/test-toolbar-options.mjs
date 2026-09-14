import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the actual click handler, including its React state writes.
const source = readFileSync(new URL('../src/platform/web/CanvasStage.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('CanvasStage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let handler
function find(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'toggleToolbarOptions') handler = node.getText(ast)
  ts.forEachChild(node, find)
}
find(ast)
assert.ok(handler)
const code = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const rect = { left: 10, top: 20, width: 40, height: 40 }
const button = { getBoundingClientRect: () => rect }
let anchorWrites = 0
const state = {
  selectedOptionsTarget: null, openToolOptions: null, renderedOptionsTool: null,
  toolbarRef: { current: { getBoundingClientRect: () => rect } },
  setSelectedOptionsTarget(value) { state.selectedOptionsTarget = value },
  setOpenToolOptions(value) { state.openToolOptions = value },
  setToolOptionsAnchor() { anchorWrites++ },
}
vm.createContext(state)
vm.runInContext(code, state)
const click = (target, activate, active) => state.toggleToolbarOptions(target, button, activate, active)
click('layer-progress')
assert.equal(state.selectedOptionsTarget, 'layer-progress')
assert.equal(state.openToolOptions, null, 'first click selects only')
click('layer-progress')
assert.equal(state.openToolOptions, 'layer-progress', 'second click opens')
state.renderedOptionsTool = 'layer-progress'
click('beading-view')
assert.equal(state.openToolOptions, null, 'A2 -> B only closes A2')
assert.equal(state.selectedOptionsTarget, 'beading-view')
const before = anchorWrites
click('beading-view')
assert.equal(state.openToolOptions, null, 'click during exit never opens or queues')
assert.equal(anchorWrites, before, 'old exit anchor remains fixed')
state.renderedOptionsTool = null
assert.equal(state.openToolOptions, null, 'animation completion does not open B2')
click('beading-view')
assert.equal(state.openToolOptions, 'beading-view')
state.renderedOptionsTool = 'beading-view'
let activations = 0
click('beading-color', () => activations++, false)
assert.equal(activations, 1)
assert.equal(state.openToolOptions, null)
state.renderedOptionsTool = null
click('beading-color', () => activations++, true)
assert.equal(state.openToolOptions, 'beading-color')
assert.equal(activations, 1, 'opening details does not reactivate the tool')
assert.ok(!source.includes('pendingToolOptions'), 'no deferred opening path remains')
console.log('Toolbar select/open/close, A2 -> B, closing animation, and shared tool activation checks passed.')
