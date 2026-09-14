import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const transpile = source => ts.transpile(source, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 })
const grid = await import(`data:text/javascript;base64,${Buffer.from(transpile(fs.readFileSync('src/core/pattern/grid.ts','utf8'))).toString('base64')}`)
const source = ts.createSourceFile('state.ts',fs.readFileSync('src/features/editor/useEditorState.ts','utf8'),ts.ScriptTarget.Latest,true)
const functions=[]
function visit(node){if(ts.isFunctionDeclaration(node)&&['removeBoxColor','removeBoxColors','commitPattern','undo','redo'].includes(node.name?.text))functions.push(node.getText(source));ts.forEachChild(node,visit)}visit(source)
const red={id:'red',hex:'#ff0000',codes:{}},blue={id:'blue',hex:'#0000ff',codes:{}}
const initial=grid.ensureChunkedPatternGrid({width:4,height:4,cells:Array.from({length:16},(_,i)=>i===0?{color:red.hex}:i===1?{color:blue.hex}:i===2?{color:red.hex,isExternal:true}:{color:null})})
const ctx={beadBox:[red,blue],workBox:[red,blue],currentColor:red.hex,editorMode:'draw',history:{past:[],present:initial,future:[],pastExcluded:[],futureExcluded:[]},excludedColorHexes:new Set(),maxHistorySteps:50,mapPatternCells:grid.mapPatternCells,ensureChunkedPatternGrid:grid.ensureChunkedPatternGrid}
for(const name of ['WorkBox','CurrentColor','History','ExcludedColorHexes','Rows','Cols']){const key=name[0].toLowerCase()+name.slice(1);ctx['set'+name]=value=>ctx[key]=typeof value==='function'?value(ctx[key]):value}
vm.createContext(ctx);vm.runInContext(transpile(functions.join('\n')),ctx)
ctx.removeBoxColor('red')
assert.equal(ctx.history.present.cells[0].color,null)
assert.equal(ctx.history.present.cells[1].color,blue.hex)
assert.equal(ctx.history.present.cells[2].isExternal,true)
assert.equal(ctx.history.present.cells[2].color,red.hex)
assert.equal(ctx.workBox.length,1)
assert.equal(ctx.currentColor,blue.hex)
ctx.beadBox=ctx.workBox;ctx.undo();assert.equal(ctx.history.present.cells[0].color,red.hex);assert.equal(ctx.workBox[0].id,'red');ctx.beadBox=ctx.workBox
ctx.redo();assert.equal(ctx.history.present.cells[0].color,null);assert.equal(ctx.workBox.length,1);assert.equal(ctx.workBox[0].id,'blue')
ctx.beadBox=[{id:'unused',hex:'#00ff00',codes:{}}];const steps=ctx.history.past.length
ctx.removeBoxColor('unused');assert.equal(ctx.workBox.length,0);assert.equal(ctx.history.past.length,steps)
console.log('Used color removal clears only its beads; undo/redo restores/clears beads; unused removal leaves canvas history untouched.')
