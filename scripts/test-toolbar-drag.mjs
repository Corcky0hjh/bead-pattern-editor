import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/platform/web/toolbarDrag.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } })
const { measureToolbarNaturalExtent: measure, clampToolbarPosition: clamp, getToolbarDockEdge: edge, getToolbarGripAnchor: anchor } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const zero = { paddingLeft:'0', paddingRight:'0', paddingTop:'0', paddingBottom:'0', borderLeftWidth:'0', borderRightWidth:'0', borderTopWidth:'0', borderBottomWidth:'0' }
globalThis.window = { getComputedStyle: element => ({ ...zero, ...element.style }) }
const surface = { style: { paddingLeft:'16', paddingRight:'7', paddingTop:'7', paddingBottom:'7', borderLeftWidth:'1', borderRightWidth:'1', borderTopWidth:'1', borderBottomWidth:'1' } }
const row = { getBoundingClientRect: () => ({width:292,height:40}) }
const operations = { children:[row], style:{display:'flex',columnGap:'2',rowGap:'2'} }
const content = { parentElement:surface, style:{}, querySelector: () => operations }
assert.equal(measure(content,'horizontal',1000),317)
assert.equal(measure(content,'vertical',1000),56)
assert.equal(measure(content,'horizontal',263),263)
// Moving padding inside the animated shell must preserve expanded dimensions.
content.style = {paddingLeft:'16',paddingRight:'7',paddingTop:'7',paddingBottom:'7'}
Object.assign(surface.style,{paddingLeft:'0',paddingRight:'0',paddingTop:'0',paddingBottom:'0'})
assert.equal(measure(content,'horizontal',1000),317)
assert.equal(measure(content,'vertical',1000),56)
// A vertical dock measures the column rather than the full-height dock shell.
content.style = {paddingLeft:'7',paddingRight:'7',paddingTop:'16',paddingBottom:'7'}
row.getBoundingClientRect = () => ({width:40,height:384})
assert.equal(measure(content,'horizontal',1000),56)
assert.equal(measure(content,'vertical',1000),409)
const bounds = {left:20,top:20,right:980,bottom:680,width:960,height:660}
assert.deepEqual(clamp(bounds,{width:308,height:69},{x:600,y:300}),{x:600,y:300})
assert.deepEqual(clamp(bounds,{width:308,height:69},{x:970,y:670}),{x:672,y:611})
assert.deepEqual(clamp(bounds,{width:1200,height:900},{x:300,y:300}),{x:20,y:20})
for (const [x,y,expected] of [[500,25,'top'],[500,675,'bottom'],[25,350,'left'],[975,350,'right'],[500,350,null]]) {
  assert.equal(edge({pointerX:x,pointerY:y,bounds,currentEdge:null}),expected)
}
console.log('Toolbar natural sizes, animation padding, vertical columns, bounds and four dock edges passed.')

// Rotating the size by 90 degrees must rotate the anchor by the same amount.
for (const size of [{width:317,height:56},{width:410,height:56},{width:280,height:98}]) {
  const horizontal = anchor('horizontal',size)
  const vertical = anchor('vertical',{width:size.height,height:size.width})
  assert.deepEqual(horizontal,{x:vertical.y,y:vertical.x})
  for (const axis of ['horizontal','vertical']) {
    const a=anchor(axis,size)
    const puck={x:18-a.x,y:18-a.y}
    assert.equal(a.x+puck.x,18)
    assert.equal(a.y+puck.y,18)
  }
}
console.log('Rotated grip anchors and puck-center invariants passed.')
