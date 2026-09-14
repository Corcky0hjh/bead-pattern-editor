import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const transpile = source => ts.transpile(source, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 })
const url = source => `data:text/javascript;base64,${Buffer.from(transpile(source)).toString('base64')}`
const gridURL = url(fs.readFileSync('src/core/pattern/grid.ts', 'utf8'))
const grid = await import(gridURL)
const boxURL = url(fs.readFileSync('src/features/editor/beadBox.ts','utf8'))
const boxModule = await import(boxURL)
const library = await import(url(fs.readFileSync('src/features/editor/workLibrary.ts', 'utf8').replace("'../../core/pattern/grid'", JSON.stringify(gridURL)).replace("'./beadBox'",JSON.stringify(boxURL))))
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
const names = ['copyWork','createWorkFromJson','createWorkFromImage','persistWorks','saveWork','canLeaveDrawing','enterWork','openWork','startBeadingWork','leaveBeadingMode','resetDrawingWorkspace','newWork','discardWorkChanges','requestRenameWork','renameWork','deleteBeadingProject']
const functions=[]
function visit(node){if(ts.isFunctionDeclaration(node)&&names.includes(node.name?.text))functions.push(node.getText(source));ts.forEachChild(node,visit)}visit(source)
assert.equal(functions.length,names.length)
let allow = true
const context = { readBox:boxModule.readBox, beadBox:[], bootstrap:{error:''}, askWorkDialog:async(message,name)=>allow?(name===undefined?'confirm':'Copy'):null, beadingProjects:[a,b], activeWorkId:'a', editorMode:'draw', history:{past:[],present:parse(red),future:[]}, activeBeadingPattern:null, beadingHistory:{past:[],present:new Set(a.completed),future:[]}, localStorage:storage, workStorageKey:library.workStorageKey, initialPattern:parse(pattern(null)), crypto:{randomUUID:()=> 'copy'}, window:{confirm:()=>allow,prompt:()=> 'Copy'}, toast:{success(){},error(){}}, parsePatternGrid:parse,serializePatternGrid:serialize, sameWorkPattern:library.sameWorkPattern,updateWorkPattern:library.updateWorkPattern }
for(const name of ['WorkBox','BeadingProjects','ActiveWorkId','History','Rows','Cols','ExcludedColorHexes','ActiveBeadingProjectId','ActiveBeadingPattern','BeadingHistory','BeadingPreviewProjectId','BeadingAdjustment','ActiveBeadingLayerAnchor','BeadingColor','HighlightedColor','ProtectedSelection','EyedropperActive','CurrentTool','EditorMode','ViewportFitRequest']) {
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

const reserve=boxModule.toBoxColor({hex:'#00ff00',codes:{mard:'A01'}},'mard')
const otherBrand=boxModule.toBoxColor({hex:'#00ff00',codes:{perler:'P01'}},'perler')
assert.notEqual(reserve.id,otherBrand.id,'Different brand beads must retain distinct identities')
const inferred=boxModule.includeUsedColors([reserve],parse(red),[])
assert.equal(inferred.length,2)
assert.equal(inferred[1].hex,'#ff0000','Legacy unknown colors must survive migration')
context.activeWorkId='a';context.editorMode='draw';context.history={past:[],present:parse(context.currentWork.pattern),future:[]}
context.beadBox=[reserve]
const progressBefore=[...context.currentWork.completed], revisionBefore=context.currentWork.revision
allow=true;const withBox=await context.saveWork()
assert.deepEqual(withBox.completed,progressBefore,'Saving reserve colors must preserve beading progress')
assert.equal(withBox.revision,revisionBefore)
assert.equal(withBox.beadBox[0].id,reserve.id)
const roundtrip=library.loadWorkLibrary({getItem:key=>key===library.workStorageKey?JSON.stringify([withBox]):null})
assert.equal(roundtrip[0].beadBox[0].id,reserve.id,'Box must persist with its work')
const draft=library.loadWorkDraft({getItem:()=>JSON.stringify({workId:'a',pattern:red,beadBox:[reserve]})})
assert.equal(draft.beadBox[0].id,reserve.id)
console.log('Bead box identity, legacy colors, persistence and progress preservation passed.')
// Creating with chosen dimensions must start a fresh history and preserve existing works.
context.MIN_PATTERN_SIDE=4;context.MAX_PATTERN_SIDE=512;context.createUniformPatternCells=grid.createUniformPatternCells
context.canLeaveDrawing=async()=>false
const unchanged=context.history
assert.equal(await context.newWork(29,58),false)
assert.equal(context.history,unchanged,'Canceling the leave prompt must preserve the canvas')
context.canLeaveDrawing=async()=>true
const savedWorks=JSON.stringify(context.beadingProjects)
assert.equal(await context.newWork(29,58),true)
assert.equal(context.history.present.width,29);assert.equal(context.history.present.height,58)
assert.equal(context.history.present.cells.filter(c=>c.color).length,0)
assert.equal(context.history.past.length,0)
assert.equal(context.activeWorkId,null)
assert.equal(JSON.stringify(context.beadingProjects),savedWorks)
const blank=context.history
assert.equal(await context.newWork(NaN,52),false)
assert.equal(context.history,blank)
console.log('New canvas dimensions, cancellation, empty history and saved-work isolation passed.')

context.canLeaveDrawing=async()=>false
const beforeImport=context.history
assert.equal(await context.createWorkFromJson({text:async()=>JSON.stringify(red)}),false)
assert.equal(context.history,beforeImport)
context.canLeaveDrawing=async()=>true
assert.equal(await context.createWorkFromJson({text:async()=>'{invalid'}),false)
assert.equal(context.history,beforeImport)
assert.equal(await context.createWorkFromJson({text:async()=>JSON.stringify({hello:'world'})}),false)
assert.equal(context.history,beforeImport)
const preservedWorks=JSON.stringify(context.beadingProjects)
assert.equal(await context.createWorkFromJson({text:async()=>JSON.stringify(red)}),true)
assert.deepEqual(serialize(context.history.present),red)
assert.equal(context.activeWorkId,null)
assert.equal(context.editorMode,'draw')
assert.equal(context.history.past.length,0)
assert.equal(JSON.stringify(context.beadingProjects),preservedWorks)
console.log('Project import validates first, preserves canvas on cancel/error, and creates an isolated new draft.')

context.structuredClone=structuredClone
let copySequence=0
context.crypto={randomUUID:()=> 'record-copy-'+(++copySequence)}
context.beadingProjects=[a,b]
const draftBeforeCopy=context.history, activeBeforeCopy=context.activeWorkId
const copied=context.copyWork('b')
assert.deepEqual(copied.pattern,b.pattern)
assert.notEqual(copied.pattern,b.pattern)
assert.equal(copied.completed.length,0)
assert.equal(copied.name,'B 副本')
assert.equal(context.history,draftBeforeCopy)
assert.equal(context.activeWorkId,activeBeforeCopy)
assert.deepEqual(b.completed,[2])
assert.equal(context.copyWork('b').name,'B 副本 2')
const beforeFailedCopy=context.beadingProjects
storage.setItem=()=>{throw Error('QuotaExceeded')}
assert.equal(context.copyWork('b'),null)
assert.equal(context.beadingProjects,beforeFailedCopy)
console.log('Per-record copy preserves source/draft, resets only copy progress, names duplicates and handles storage failure.')
