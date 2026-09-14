import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import assert from 'node:assert/strict'
const sources=JSON.parse(fs.readFileSync('src/core/color/data/sources.json'))
const ids=new Set(['mard'])
for(const source of sources){
 const colors=JSON.parse(fs.readFileSync('src/core/color/data/'+source.id+'.json'))
 assert.equal(colors.length,source.count)
 assert(colors.length>0)
 assert.equal(new Set(colors.map(c=>c.codes[source.id])).size,colors.length)
 assert(colors.every(c=>/^#[0-9a-f]{6}$/.test(c.hex)&&Object.keys(c.codes).length===1))
 ids.add(source.id)
}
const ctx={exports:{},require:()=>({})}
vm.runInNewContext(ts.transpile(fs.readFileSync('src/features/editor/beadBox.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),ctx)
const {toBoxColor,includeUsedColors,readBox}=ctx.exports
const mard=JSON.parse(fs.readFileSync('src/core/color/data/mard.json'))
assert.equal(mard.length,291)
const a=toBoxColor({hex:'#ffffff',codes:{mard:'H02'}},'mard')
const b=toBoxColor({hex:'#ffffff',codes:{'artkal-c':'C01'}},'artkal-c')
assert.notEqual(a.id,b.id)
const box=includeUsedColors([a],{cells:[{color:'#ffffff'}]},[b,a])
assert.equal(box.length,1)
assert.equal(box[0].id,a.id,'Adding a new brand must not relabel a saved box')
assert.equal(readBox(JSON.parse(JSON.stringify([b])))[0].brand,'artkal-c')
for(const source of sources){for(const color of JSON.parse(fs.readFileSync('src/core/color/data/'+source.id+'.json'))) assert.equal(toBoxColor(color,source.id).id,source.id+':'+color.codes[source.id])}
console.log('Validated '+ids.size+' palettes, unique codes, persistent brand identity and legacy box preservation.')
