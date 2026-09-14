import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const transpile=s=>ts.transpile(s,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})
const load=async p=>import('data:text/javascript;base64,'+Buffer.from(transpile(fs.readFileSync(p,'utf8'))).toString('base64'))
const grid=await load('src/core/pattern/grid.ts'), box=await load('src/features/editor/beadBox.ts')
const source=ts.createSourceFile('state.ts',fs.readFileSync('src/features/editor/useEditorState.ts','utf8'),ts.ScriptTarget.Latest,true)
const functions=[]
function visit(n){if(ts.isFunctionDeclaration(n)&&['exportJson','createWorkFromJson','buildLabelByHex','exportBrand','exportColorList','addBoxColor','addBoxColors'].includes(n.name?.text))functions.push(n.getText(source));ts.forEachChild(n,visit)}visit(source)
const custom={id:'custom:red',hex:'#ff0000',nameZh:'我的"红色"',codes:{}}
const white={id:'coco:A01',hex:'#ffffff',brand:'coco',codes:{coco:'A01'}}
const reserve={id:'custom:blue',hex:'#0000ff',nameZh:'备用蓝',codes:{}}
const pattern=grid.createSolidPatternGrid({width:4,height:4,color:'#ff0000'})
let output
const ctx={pattern,beadBox:[custom,white,reserve],workBox:[custom,white,reserve],editorMode:'draw',Blob,URL:{createObjectURL:b=>{output=b;return 'test'}},downloadUrl(){},serializePatternGrid:grid.serializePatternGrid,parsePatternGrid:grid.parsePatternGrid,readBox:box.readBox,boxLabel:box.boxLabel,canLeaveDrawing:async()=>true,resetDrawingWorkspace(){},toast:{error(){}},palette:[],brands:[{id:'coco',shortLabel:'COCO'}],colorStats:[{color:'#ff0000',count:16}],usedCount:16}
for(const name of ['WorkBox','History','Rows','Cols','CurrentColor']){const key=name[0].toLowerCase()+name.slice(1);ctx['set'+name]=v=>ctx[key]=typeof v==='function'?v(ctx[key]):v}
vm.createContext(ctx);vm.runInContext(transpile(functions.join('\n')),ctx)
ctx.exportJson();const json=await output.text();ctx.workBox=[]
assert.equal(await ctx.createWorkFromJson({text:async()=>json}),true)
assert.deepEqual(ctx.workBox,[custom,white,reserve]);assert.deepEqual(grid.serializePatternGrid(ctx.history.present),grid.serializePatternGrid(pattern))
assert.equal(await ctx.createWorkFromJson({text:async()=>JSON.stringify({...JSON.parse(json),version:99})}),false)
ctx.exportColorList();const csv=await output.text();assert.ok(csv.includes('"我的""红色"""'));assert.ok(csv.includes('品牌,色号'))
ctx.addBoxColor({...white,id:'artkal-c:C01',brand:'artkal-c'});assert.equal(ctx.workBox.length,3);assert.equal(ctx.workBox[1].id,white.id)
ctx.addBoxColors([{...white,id:'other'}]);assert.equal(ctx.workBox.length,3)
assert.equal(box.readBox([white,{...white,id:'other'}]).length,1)
assert.equal(box.readBox([{...custom,nameZh:123}])[0].nameZh,undefined)
console.log('Work export/import preserves unused colors, custom names and brands; CSV quotes, version rejection and same-Hex identity passed.')
