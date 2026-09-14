import fs from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const distance={exports:{}}
vm.runInNewContext(ts.transpile(fs.readFileSync('src/core/color/distance.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),distance)
const nearest={exports:{},require:()=>distance.exports}
vm.runInNewContext(ts.transpile(fs.readFileSync('src/core/color/nearest.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),nearest)
const sources=JSON.parse(fs.readFileSync('src/core/color/data/sources.json'))
const candidates=['mard',...sources.map(s=>s.id)].flatMap(id=>JSON.parse(fs.readFileSync('src/core/color/data/'+id+'.json')).map(c=>({...c,brand:id,id:id+':'+c.codes[id]})))
for(const id of ['coco','artkal-c','perler']) {
 const target=candidates.find(c=>c.brand===id)
 const results=nearest.exports.findNearestBeadColors(target.hex,candidates,8)
 assert.equal(results.length,8)
 assert.equal(results[0].distance,0)
 assert(results.every((r,i)=>!i||r.distance>=results[i-1].distance))
 assert(results.every(r=>r.color.id&&r.color.brand))
}
assert.equal(nearest.exports.findNearestBeadColors('#ffffff',[],8).length,0)
console.log('All-brand recommendations retain identities, rank by perceptual distance and return exact matches first.')
