import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const url = text => 'data:text/javascript;base64,' + Buffer.from(ts.transpile(text,{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022})).toString('base64')
const gridURL=url(fs.readFileSync('src/core/pattern/grid.ts','utf8'))
const grid=await import(gridURL)
const {resizeWithAnchor}=await import(url(fs.readFileSync('src/core/pattern/resize.ts','utf8').replace("'./grid'",JSON.stringify(gridURL))))
const original=grid.ensureChunkedPatternGrid({width:4,height:4,cells:Array.from({length:16},(_,i)=>({color:'#'+i.toString(16).padStart(6,'0')}))})
for(const x of [0,.5,1])for(const y of [0,.5,1]){
 const enlarged=resizeWithAnchor(original,8,6,{x,y})
 assert.equal(enlarged.croppedBeads,0)
 assert.equal(enlarged.pattern.cells.filter(c=>c.color!==null).length,16)
 assert.equal(enlarged.pattern.cells[y*2*8+x*4].color,'#000000')
 const restored=resizeWithAnchor(enlarged.pattern,4,4,{x,y})
 assert.deepEqual([...restored.pattern.cells],[...original.cells])
 const cropped=resizeWithAnchor(original,2,2,{x,y})
 assert.equal(cropped.croppedBeads,12)
 assert.equal(cropped.pattern.cells[0].color,original.cells[y*2*4+x*2].color)
}
const solid=grid.ensureChunkedPatternGrid({width:4,height:4,cells:Array.from({length:16},()=>({color:'#ff0000'}))})
const bigger=resizeWithAnchor(solid,6,6,{x:.5,y:.5})
assert.equal(bigger.pattern.cells.filter(c=>c.color).length,16,'A solid canvas must expand with empty cells, never more beads')
assert.equal(solid.cells.filter(c=>c.color).length,16,'Source must remain unchanged for undo')
const external={width:4,height:4,cells:Array.from({length:16},()=>({color:'#ff0000',isExternal:true}))}
assert.equal(resizeWithAnchor(external,2,2,{x:0,y:0}).croppedBeads,0)
console.log('All nine resize anchors, crop counts, empty expansion, external cells and source preservation passed.')
