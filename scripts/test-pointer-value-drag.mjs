import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const listeners = new Map(), cleanups = [], previews = [], commits = []
const react = { useRef: value => ({current:value}), useCallback: fn => fn, useLayoutEffect: fn => fn(), useEffect: fn => { cleanups.push(fn()) } }
const context = { exports:{}, require: () => react, window:{addEventListener:(name,fn)=>listeners.set(name,fn), removeEventListener:name=>listeners.delete(name)} }
vm.createContext(context)
vm.runInContext(ts.transpile(fs.readFileSync('src/components/usePointerValueDrag.ts','utf8'), {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),context)
const h=context.exports.usePointerValueDrag(e=>e.clientX,v=>previews.push(v),v=>commits.push(v))
const capture=new Set(), element={setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)}
const e=(pointerId,clientX)=>({pointerId,clientX,button:0,currentTarget:element,preventDefault(){}})
h.onPointerDown(e(1,10));h.onPointerDown(e(2,90));h.onPointerMove(e(2,100));h.onPointerUp(e(2,100));assert.deepEqual(previews,[10]);assert.equal(commits.length,0)
h.onPointerMove(e(1,20));h.onPointerCancel(e(1,20));h.onPointerMove(e(1,30));assert.deepEqual(commits,[20]);assert.equal(capture.size,0)
h.onPointerDown(e(3,40));h.onPointerUp(e(3,50));h.onLostPointerCapture(e(3,50));assert.deepEqual(commits,[20,50])
h.onPointerDown(e(4,60));listeners.get('blur')();assert.deepEqual(commits,[20,50,60])
h.onPointerDown(e(5,70));cleanups.forEach(fn=>fn?.());h.onPointerMove(e(5,80));assert.deepEqual(previews,[10,20,40,60,70]);assert.equal(listeners.size,0)
console.log('Pointer drag: second finger isolation, cancellation, lost capture, blur and unmount passed.')
