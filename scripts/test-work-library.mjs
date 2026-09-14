import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const transpile = source => ts.transpile(source, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 })
const url = source => `data:text/javascript;base64,${Buffer.from(transpile(source)).toString('base64')}`
const gridURL = url(fs.readFileSync('src/core/pattern/grid.ts', 'utf8'))
const grid = await import(gridURL)
const library = await import(url(fs.readFileSync('src/features/editor/workLibrary.ts', 'utf8').replace("'../../core/pattern/grid'", JSON.stringify(gridURL))))
const { serializePatternGrid: serialize, parsePatternGrid: parse } = grid
const pattern = color => serialize({ width: 4, height: 4, cells: Array.from({length:16}, (_, i) => ({ color: i < 4 ? color : null })) })
const red = pattern('#ff0000'), blue = pattern('#0000ff')
const a = { id:'a', name:'A', createdAt:1, updatedAt:1, pattern:red, completed:[0,1], beadingMode:'layer', revision:1, progressRevision:1 }
const b = { ...a, id:'b', name:'B', pattern:blue, completed:[2] }
const data = new Map([['bead-pattern-editor:beading-projects', JSON.stringify([{...a,revision:undefined,progressRevision:undefined}])], ['bead-pattern-editor', JSON.stringify(blue)]])
const storage = { getItem:key=>data.get(key)??null, setItem:(key,value)=>data.set(key,value) }
let migrated = library.loadWorkLibrary(storage)
assert.equal(migrated.length,2); assert.deepEqual(migrated[0].completed,[0,1]); assert.equal(migrated[1].id,'legacy-drawing')
storage.setItem(library.workStorageKey,JSON.stringify(migrated))
assert.equal(library.loadWorkLibrary(storage).length,2, 'Migration must not duplicate old drafts')
assert.ok(data.has('bead-pattern-editor:beading-projects'))
assert.equal(library.updateWorkPattern(a,red),a,'Unchanged content must preserve progress and version')
const sameBeads = structuredClone(red)
sameBeads.palette.push(['#00ff00',0])
assert.equal(library.updateWorkPattern(a,sameBeads),a,'Unused palette entries must not invalidate progress')
const changed = library.updateWorkPattern(a,blue)
assert.equal(changed.revision,2);assert.equal(changed.progressRevision,2);assert.deepEqual(changed.completed,[])
storage.setItem(library.workStorageKey,JSON.stringify([{...a,progressRevision:0}]))
assert.deepEqual(library.loadWorkLibrary(storage)[0].completed,[])
storage.setItem(library.draftStorageKey,JSON.stringify({workId:'a',pattern:blue}))
assert.equal(library.loadWorkDraft(storage).workId,'a')
assert.deepEqual(serialize(library.loadWorkDraft(storage).pattern),blue)

const source = ts.createSourceFile('state.ts',fs.readFileSync('src/features/editor/useEditorState.ts','utf8'),ts.ScriptTarget.Latest,true)
const names = ['createWorkFromImage','persistWorks','saveWork','canLeaveDrawing','enterWork','openWork','startBeadingWork','leaveBeadingMode','resetDrawingWorkspace','newWork','discardWorkChanges','requestRenameWork','renameWork','deleteBeadingProject']
const functions=[]
function visit(node){if(ts.isFunctionDeclaration(node)&&names.includes(node.name?.text))functions.push(node.getText(source));ts.forEachChild(node,visit)}visit(source)
assert.equal(functions.length,names.length)
let allow = true
const context = { bootstrap:{error:''}, askWorkDialog:async(message,name)=>allow?(name===undefined?'confirm':'Copy'):null, beadingProjects:[a,b], activeWorkId:'a', editorMode:'draw', history:{past:[],present:parse(red),future:[]}, activeBeadingPattern:null, beadingHistory:{past:[],present:new Set(a.completed),future:[]}, localStorage:storage, workStorageKey:library.workStorageKey, initialPattern:parse(pattern(null)), crypto:{randomUUID:()=> 'copy'}, window:{confirm:()=>allow,prompt:()=> 'Copy'}, toast:{success(){},error(){}}, parsePatternGrid:parse,serializePatternGrid:serialize, sameWorkPattern:library.sameWorkPattern,updateWorkPattern:library.updateWorkPattern }
for(const name of ['BeadingProjects','ActiveWorkId','History','Rows','Cols','ExcludedColorHexes','ActiveBeadingProjectId','ActiveBeadingPattern','BeadingHistory','BeadingPreviewProjectId','BeadingAdjustment','ActiveBeadingLayerAnchor','BeadingColor','HighlightedColor','ProtectedSelection','EyedropperActive','CurrentTool','EditorMode','ViewportFitRequest']) {
 const key=name[0].toLowerCase()+name.slice(1)
 context['set'+name]=value=>{context[key]=typeof value==='function'?value(context[key]??0):value}
}
Object.defineProperties(context,{ currentWork:{get:()=>context.beadingProjects.find(w=>w.id===context.activeWorkId)??null}, serializedDraft:{get:()=>serialize(context.history.present)}, isWorkDirty:{get:()=>context.editorMode==='draw'&&(context.currentWork?!library.sameWorkPattern(context.currentWork.pattern,serialize(context.history.present)):context.history.past.length>0)} })
for (const key of ['beadingStrokeBaselineRef','beadingStrokeChangedRef','strokeBaselineRef','strokeDraftRef','strokeChangedRef']) context[key] = { current: null }
vm.createContext(context);vm.runInContext(transpile(functions.join('\n')),context)
assert.equal(await context.openWork('b','draw'),true);assert.deepEqual(serialize(context.history.present),blue)
assert.equal(await context.startBeadingWork(),true);assert.equal(context.activeBeadingProjectId,'b');assert.deepEqual([...context.beadingHistory.present],[2])
context.leaveBeadingMode();assert.equal(context.editorMode,'draw');assert.equal(context.activeWorkId,'b');assert.deepEqual(serialize(context.history.present),blue)
assert.deepEqual(context.currentWork.completed,[2],'Entering drawing must not clear progress')
context.history={past:[parse(blue)],present:parse(red),future:[]}
allow=false;assert.equal(await context.saveWork(),null);assert.deepEqual(context.currentWork.completed,[2]);assert.equal(context.isWorkDirty,true)
allow=true;await context.saveWork();assert.equal(context.currentWork.revision,2);assert.equal(context.currentWork.completed.length,0);assert.equal(context.beadingHistory.past.length,0)
await context.openWork('a','draw');await context.saveWork(true);assert.equal(context.activeWorkId,'copy');assert.deepEqual(context.beadingProjects.find(w=>w.id==='a').completed,[0,1]);assert.equal(context.currentWork.completed.length,0)
context.history={past:[parse(red)],present:parse(blue),future:[]};allow=false;assert.equal(await context.openWork('a','bead'),false);assert.equal(context.activeWorkId,'copy')
allow=true;await context.discardWorkChanges();assert.deepEqual(serialize(context.history.present),red)
context.renameWork('a','Renamed');assert.deepEqual(context.beadingProjects.find(w=>w.id==='a').completed,[0,1])
const before = context.currentWork
storage.setItem=()=>{throw Error('QuotaExceeded')}
context.history={past:[],present:parse(blue),future:[]};assert.equal(await context.saveWork(),null);assert.equal(context.currentWork,before,'Storage failure must not claim or commit a successful save')
console.log('Work migration, draft recovery, revision invalidation, mode identity, save cancellation, copy isolation, rename and storage failure passed.')

context.editorMode='bead';context.activeWorkId='a';context.activeBeadingProjectId='a'
const originalProgress=JSON.stringify(context.beadingProjects)
let applied
context.applyImagePattern=(grid,options,metadata)=>{applied={grid,metadata}}
assert.equal(await context.createWorkFromImage(parse(blue),{},{}),true)
assert.equal(context.activeWorkId,null)
assert.equal(context.editorMode,'draw')
assert.equal(applied.metadata.freshWork,true)
assert.equal(JSON.stringify(context.beadingProjects),originalProgress,'Image creation must preserve saved works and progress')
console.log('Image creation detaches current work without changing its saved progress.')

storage.setItem=()=>{}
context.activeWorkId='a';context.editorMode='draw'
const oldName=context.currentWork.name
allow=false;await context.requestRenameWork('a');assert.equal(context.currentWork.name,oldName)
allow=true;await context.requestRenameWork('a');assert.equal(context.currentWork.name,'Copy')
context.history={past:[],present:parse(blue),future:[]}
allow=false;await context.discardWorkChanges();assert.deepEqual(serialize(context.history.present),blue)
allow=true;await context.discardWorkChanges();assert.deepEqual(serialize(context.history.present),context.currentWork.pattern)
console.log('In-app rename and discard: cancel preserves data; confirm applies the requested change.')
