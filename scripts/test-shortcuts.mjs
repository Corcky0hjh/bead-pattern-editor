import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
let saved = null, fail = false
const storage = {getItem:()=>saved,setItem:(_,value)=>{if(fail)throw Error('full');saved=value}}
const code = ts.transpile(fs.readFileSync('src/features/editor/shortcuts.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022})
function load(){const ctx={exports:{},localStorage:storage,require:()=>({useSyncExternalStore:(_,get)=>get()})};vm.runInNewContext(code,ctx);return ctx.exports}
const event=(key,extra={})=>({key,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,...extra})
let api=load()
assert(api.matchesShortcut(event('b'),'brush'))
assert(!api.matchesShortcut(event('b',{ctrlKey:true}),'brush'))
assert.equal(api.setShortcut('brush','mod+shift+p'),null)
assert(!api.matchesShortcut(event('b'),'brush'))
assert(api.matchesShortcut(event('P',{ctrlKey:true,shiftKey:true}),'brush'))
assert(api.matchesShortcut(event('P',{metaKey:true,shiftKey:true}),'brush'))
assert.match(api.setShortcut('eraser','mod+shift+p'),/已用于/)
api=load()
assert(api.matchesShortcut(event('P',{metaKey:true,shiftKey:true}),'brush'))
assert(api.matchesShortcut(event('+',{ctrlKey:true,shiftKey:true}),'zoomIn'))
assert.equal(api.setShortcut('holdPan','shift+q'),null)
assert(api.matchesShortcut(event('Q',{shiftKey:true}),'holdPan'))
assert(api.shortcutReleased(event('Shift'),'holdPan'))
assert(api.shortcutReleased(event('q',{shiftKey:true}),'holdPan'))
assert(!api.shortcutReleased(event('x',{shiftKey:true}),'holdPan'))
fail=true
assert.match(api.resetShortcuts(),/保存失败/)
assert(api.matchesShortcut(event('P',{metaKey:true,shiftKey:true}),'brush'))
fail=false
assert.equal(api.resetShortcuts(),null)
assert(api.matchesShortcut(event('b'),'brush'))
assert(load().matchesShortcut(event('b'),'brush'))
console.log('Shortcut matching, persistence, conflicts, modifier release and reset passed.')
