import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import assert from 'node:assert/strict'
const ast=ts.createSourceFile('state.ts',fs.readFileSync('src/features/editor/useEditorState.ts','utf8'),ts.ScriptTarget.Latest,true)
const nodes=[];function visit(n){if(ts.isFunctionDeclaration(n)&&['addBoxColors','removeBoxColors','removeBoxColor'].includes(n.name?.text))nodes.push(n.getText(ast));ts.forEachChild(n,visit)}visit(ast)
const a={id:'a',hex:'#111111'},b={id:'b',hex:'#222222'},c={id:'c',hex:'#333333'}
let box=[a,b,c],commits=[]
const ctx={editorMode:'draw',beadBox:box,currentColor:a.hex,history:{present:{cells:[{color:a.hex},{color:b.hex},{color:c.hex},{color:a.hex,isExternal:true}]}},setWorkBox:next=>box=typeof next==='function'?next(box):next,setCurrentColor:v=>ctx.currentColor=v,commitPattern:p=>commits.push(p),mapPatternCells:(cells,fn)=>cells.map(fn)}
vm.createContext(ctx);vm.runInContext(ts.transpile(nodes.join('\n'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}),ctx)
ctx.addBoxColors([a,b]);assert.equal(box.length,3)
ctx.removeBoxColors(['a','b']);assert.equal(commits.length,1);assert.equal(box.length,1);assert.equal(box[0].id,'c');assert.equal(ctx.currentColor,c.hex)
assert.equal(commits[0].cells[0].color,null);assert.equal(commits[0].cells[1].color,null);assert.equal(commits[0].cells[2].color,c.hex);assert.equal(commits[0].cells[3].color,a.hex)
ctx.editorMode='bead';ctx.removeBoxColors(['c']);assert.equal(commits.length,1)
console.log('Batch addition deduplicates; batch removal commits once, preserves other/external beads and respects read-only mode.')
