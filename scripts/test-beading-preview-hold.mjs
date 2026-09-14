import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source = fs.readFileSync('src/features/editor/BeadingControls.tsx', 'utf8')
const listeners = new Map()
const effects = []
const exports = {}
const calls = []
const editor = { beadingViewMode: 'reference', beadingFillMode: 'point', currentTool: 'brush', setBeadingPreview: value => calls.push(value) }
const react = { useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect: fn => effects.push(fn()) }
const jsx = (type, props) => ({ type, props })
const context = { exports, window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} }, require: name => name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : new Proxy({}, { get: (_, name) => name }) }
vm.runInNewContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }), context)
const tree = exports.BeadingControls({ editor })
const preview = tree.props.children[0].props.children.find(child => child.props.label === '按住预览已拼豆子，松开恢复')
const handlers = preview.props.pressProps
const pointer = { isPrimary: true, button: 0, pointerId: 1, preventDefault() {}, stopPropagation() {}, currentTarget: { setPointerCapture() {} } }
for (const ending of ['onPointerUp', 'onPointerCancel', 'onLostPointerCapture', 'onBlur']) {
  calls.length = 0
  handlers.onPointerDown(pointer)
  assert.deepEqual(calls, [true])
  handlers[ending]()
  handlers.onLostPointerCapture()
  assert.deepEqual(calls, [true, false])
}
calls.length = 0
handlers.onPointerDown(pointer); listeners.get('blur')()
assert.deepEqual(calls, [true, false])
calls.length = 0
const key = { key: ' ', repeat: false, stopped: false, preventDefault() {}, stopPropagation() { this.stopped = true } }
handlers.onKeyDown(key); handlers.onKeyDown({ ...key, repeat: true }); handlers.onKeyUp(key)
assert.deepEqual(calls, [true, false])
assert.equal(key.stopped, true, 'Preview key events must not reach global canvas shortcuts')
calls.length = 0
handlers.onPointerDown(pointer); effects.forEach(cleanup => cleanup?.())
assert.deepEqual(calls, [true, false])
assert.equal(preview.props.onClick, undefined)
console.log('Hold preview press/release, cancel, lost capture, blur, keyboard repeat and unmount cleanup passed.')
