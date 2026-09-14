import fs from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const ctx={exports:{},require:()=>({getBrand:()=>({shortLabel:'MARD'})})}
vm.runInNewContext(ts.transpile(fs.readFileSync('src/features/editor/searchBoxColors.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),ctx)
const color=(code,hex)=>({id:code,brand:'mard',codes:{mard:code},hex})
const colors=[color('B22','#0bb333'),color('B30','#112233'),color('B03','#abcdef'),color('B3','#ffffff')]
const search=ctx.exports.searchBoxColors
assert.equal(search(colors,'b3').map(c=>c.id).join(','),'B3,B03,B30,B22')
assert.equal(search(colors,' B03 ')[0].id,'B03')
assert.equal(search(colors,'#0bb333')[0].id,'B22')
assert.equal(search(colors,'abcdef')[0].id,'B03')
assert.equal(search(colors,'no match').length,0)
assert.equal(colors[0].id,'B22')
console.log('Exact normalized codes precede prefixes and incidental Hex matches; explicit Hex search remains supported.')
