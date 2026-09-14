import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function extract(path, name) {
  const source = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer.getText(source)
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(source)
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(found, name)
  return ts.transpile(`(${found})`, { target: ts.ScriptTarget.ES2022 })
}
class Target {
  constructor(panel) { this.panel = panel }
  closest() { return this.panel ? this : null }
}
const scroller = { scrollLeft: 0, clientWidth: 300 }
let cameraMoves = 0
let zooms = 0
const context = vm.createContext({
  scroller, Element: Target,
  normalizeWheelDelta: (delta) => delta,
  viewportRef: { current: { clientWidth: 800, clientHeight: 600, contains: target => !target.panel } },
  viewPositionRef: { current: { x: 0, y: 0 } },
  updateViewPosition: () => cameraMoves++,
  zoomRef: { current: 100 }, minViewportZoom: 1, maxViewportZoom: 1000,
  canvasActionsRef: { current: { zoomViewportAt: () => zooms++ } },
})
const panelWheel = vm.runInContext(extract('src/features/editor/BeadingStepBar.tsx', 'onWheel'), context)
const canvasWheel = vm.runInContext(extract('src/platform/web/CanvasStage.tsx', 'handleWheel'), context)
function event(panel, options = {}) {
  return { target: new Target(panel), deltaX: 0, deltaY: 40, deltaMode: 0, shiftKey: false, ctrlKey: false, metaKey: false, defaultPrevented: false, stopped: false,
    preventDefault() { this.defaultPrevented = true }, stopPropagation() { this.stopped = true }, ...options }
}
for (const deltas of [{ deltaY: 40 }, { deltaX: 40, deltaY: 0 }]) {
  const e = event(true, { shiftKey: true, ...deltas })
  panelWheel(e); canvasWheel(e)
  assert.ok(e.stopped); assert.equal(cameraMoves, 0)
}
assert.equal(scroller.scrollLeft, 80)
const bounded = event(true, { shiftKey: true })
// A full/non-overflowing list must still consume the gesture rather than pan the canvas.
scroller.scrollWidth = scroller.clientWidth
panelWheel(bounded); assert.ok(bounded.defaultPrevented && bounded.stopped)
canvasWheel(event(false, { shiftKey: true })); assert.equal(cameraMoves, 1)
for (const modifier of ['ctrlKey', 'metaKey']) {
  const e = event(true, { [modifier]: true })
  panelWheel(e); assert.equal(e.stopped, false); canvasWheel(e)
}
assert.equal(zooms, 2)
console.log('Panel Shift wheel routing, native horizontal deltas, boundary capture, canvas pan and Ctrl/Cmd zoom passed.')
