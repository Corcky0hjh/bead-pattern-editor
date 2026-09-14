import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=ts.createSourceFile('stage.tsx',fs.readFileSync('src/platform/web/CanvasStage.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const node=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ModeCycleButton')
const ctx={exports:{},require:()=>({jsx:(type,props)=>({type,props})})}
vm.createContext(ctx)
vm.runInContext(ts.transpile(node.getText(source),{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}),ctx)
for(const count of [2,3,5]){
 const options=Array.from({length:count},(_,i)=>({value:String(i),label:String(i),icon:'icon'}))
 let value='0',stopped=0
 for(let i=0;i<count*2;i++){
  const button=ctx.ModeCycleButton({value,onChange:next=>value=next,label:'mode',options})
  button.props.onClick({stopPropagation(){stopped++}})
  assert.equal(value,String((i+1)%count))
 }
 assert.equal(stopped,count*2,'Clicks must not bubble and close the options panel')
}
console.log('Mode buttons cycle through 2/3/5 options, wrap around and keep their panel open.')

const sizeNode=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='SizeCycleButton')
const sizeCtx={exports:{},require:ctx.require,sizeOptions:[1,2,3,4,5]}
vm.createContext(sizeCtx)
vm.runInContext(ts.transpile(sizeNode.getText(source),{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}),sizeCtx)
for(const initial of [1,3,5]) {
 let value=initial, active=false, changes=0
 const render=()=>sizeCtx.SizeCycleButton({label:'size',value,active,onActivate:()=>{active=true},onChange:next=>{value=next;changes++}})
 render().props.onClick({stopPropagation(){}})
 assert.equal(active,true)
 assert.equal(value,initial,'Activation must preserve size')
 assert.equal(changes,0,'Activation must not invoke the size setter')
 render().props.onClick({stopPropagation(){}})
 assert.equal(value,initial===5?1:initial+1)
 assert.equal(changes,1)
}
console.log('Inactive size buttons activate first; only subsequent clicks increment, including 5 -> 1.')
