import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const url=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(s,{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022})).toString('base64')
const grid=url(fs.readFileSync('src/core/pattern/grid.ts','utf8'))
const canvases=[]
globalThis.document={createElement:()=>{const calls=[];const context=new Proxy({}, {get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});const canvas={width:0,height:0,calls,getContext:()=>context};canvases.push(canvas);return canvas}}
const {renderPatternWithKeys}=await import(url(fs.readFileSync('src/platform/web/imageExport.ts','utf8').replace("'../../core/pattern/grid'",JSON.stringify(grid))))
const base={pattern:{width:2,height:2,cells:[{color:'#ff0000'},{color:null},{color:'#ff0000',isExternal:true},{color:'#0000ff'}]},labelByHex:new Map([['#ff0000','A01'],['#0000ff','B02']])}
for(const showGrid of [false,true])for(const showCodes of [false,true]){
 const c=renderPatternWithKeys({...base,showGrid,showCodes})
 assert.equal(c.calls.filter(x=>x[0]==='strokeRect').length,showGrid?4:0)
 assert.equal(c.calls.filter(x=>x[0]==='fillText').length,showCodes?2:0)
}
const plain=renderPatternWithKeys({...base,showCodes:false,showGrid:false})
const combined=renderPatternWithKeys({...base,showCodes:false,showGrid:false,paletteStats:[{color:'#ff0000',code:'A01',count:1}],brandShortLabel:'MARD'})
assert.ok(combined.height>plain.height)
assert.equal(combined.calls.filter(x=>x[0]==='drawImage').length,2)
const info=renderPatternWithKeys({...base,showCodes:false,showGrid:false,title:'Example'})
assert.equal(info.height,plain.height+32)
assert.ok(info.calls.some(x=>x[0]==='fillText'&&x[1]==='Example'))
console.log('Export grid/code switches, empty and external cells, title sizing and attached palette passed.')
