import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const slots = [], effects = []
let cursor = 0, api, dirty = false, resize, now = 0, timer, flight
let reducedMotion = true
const geometry = {}
vm.runInNewContext(ts.transpile(fs.readFileSync('src/platform/web/toolbarDrag.ts','utf8'),{module:ts.ModuleKind.CommonJS}), { exports: geometry })
geometry.getElementContentBounds = () => ({left:8, top:8, right:width-8, bottom:height-8,width:width-16,height:height-16})
const react = {
 useState(initial) { const i=cursor++; if (!(i in slots)) slots[i]=initial; return [slots[i], next=>{const value=typeof next==='function'?next(slots[i]):next;if(value!==slots[i]){slots[i]=value;dirty=true}}] },
 useRef(initial) {const i=cursor++;return slots[i]??(slots[i]={current:initial})},
 useLayoutEffect(fn,deps) { const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])) {slots[i]=deps;effects.push(fn)} }
}
let width=900, height=600, panelWidth=520
const style={transform:'translate3d(0px, 0px, 0)'}
const bounds=()=>({left:20,top:50,width,height,right:20+width,bottom:50+height})
const panel={current:{style,animate(){flight={cancel(){this.cancelled=true}};return flight},querySelector(){return null},getBoundingClientRect(){const [x,y]=(style.transform.match(/-?[\d.]+(?=px)/g) ?? ['0','0']).map(Number);return {left:20+(width-panelWidth)/2+x,top:50+(api?.dock === 'top' ? 8 : height-108)+y,width:panelWidth,height:100}}}}
const viewport={current:{getBoundingClientRect:bounds}}
const exports={}
vm.runInNewContext(ts.transpile(fs.readFileSync('src/platform/web/useBeadingPanelDrag.ts','utf8'),{module:ts.ModuleKind.CommonJS}),{exports,require:name=>name==='react'?react:geometry, requestAnimationFrame:()=>1,cancelAnimationFrame(){},window:{matchMedia:()=>({matches:reducedMotion})},performance:{now:()=>now}, setTimeout:fn=>{timer=fn;return 1},clearTimeout:()=>{timer=null},ResizeObserver:class{constructor(fn){resize=fn}observe(){}disconnect(){}}})
function flush(){for(let n=0;n<20;n++){dirty=false;cursor=0;api=exports.useBeadingPanelDrag(true,panel,viewport,()=>{});panelWidth=api.dock?width-16:Math.min(520,width-16);effects.splice(0).forEach(fn=>fn());if(!dirty)return}throw Error('render loop')}
const target={setPointerCapture(){},hasPointerCapture(){return false}}
function event(type,x,y){return {type,clientX:x,clientY:y,pointerId:1,isPrimary:true,button:0,preventDefault(){},stopPropagation(){},currentTarget:target}}
function drag(dx,dy,wait=true){let r=panel.current.getBoundingClientRect();let x=r.left+16,y=r.top+16;api.handleProps.onPointerDown(event('pointerdown',x,y));api.handleProps.onPointerMove(event('pointermove',x+dx,y+dy));flush();if(wait){now+=400;timer?.();flush()}api.handleProps.onPointerUp(event('pointerup',x+dx,y+dy));flush()}
function click(){api.handleProps.onPointerDown(event('pointerdown',0,0));api.handleProps.onPointerUp(event('pointerup',0,0));flush()}
flush();drag(0,-1000,false);assert.equal(api.dock,null,'Quick release must not dock');drag(0,-10);assert.equal(api.dock,'top');assert.equal(panel.current.getBoundingClientRect().top,58);assert.equal(panelWidth,884)
drag(100,180);assert.equal(api.dock,null);assert.equal(panelWidth,520);assert.equal(panel.current.getBoundingClientRect().left,128,'Undock must preserve pointer delta after width shrinks')
drag(-1000,0);assert.equal(api.dock,null,'No side docking')
drag(0,1000);assert.equal(api.dock,'bottom');assert.equal(panel.current.getBoundingClientRect().top,542)
click();assert.equal(api.collapsed,true);assert.equal(api.dock,null,'Collapsing a docked panel must undock')
for (const delta of [-1000, 1000]) {
 drag(0,delta)
 assert.equal(api.dock,null,'A collapsed ball cannot dock')
 assert.equal(api.candidate,null,'A collapsed ball cannot show a docking hint')
 assert.equal(api.ready,null,'A collapsed ball cannot reserve dock space')
}
click();assert.equal(api.collapsed,false);assert.equal(api.dock,null,'Expanding the ball stays floating')
drag(0,1000);assert.equal(api.dock,'bottom','Expanded panel can dock again')
width=360;height=400;panelWidth=width-16;resize();flush();assert.equal(panelWidth,344);assert.equal(panel.current.getBoundingClientRect().left,28);assert.equal(panel.current.getBoundingClientRect().top,342)
click();drag(0,-150);assert.equal(api.dock,null);assert.equal(api.collapsed,true,'Dragging ball must not toggle it');click();assert.equal(api.collapsed,false)
console.log('Beading docking: top/bottom, no sides, undock anchor, collapse, dragging ball and resize passed.')

reducedMotion=false
drag(20,-50,false)
assert.equal(api.visualCollapsed,true,'Stay collapsed during flight')
assert.ok(flight)
flight.onfinish();flush()
assert.equal(api.visualCollapsed,false,'Expand once after flight finishes')
console.log('Release animation holds collapsed state until arrival.')

reducedMotion=true
for (const delta of [-1000, 1000]) {
 drag(0,delta)
 const before = panel.current.getBoundingClientRect()
 click()
 const after = panel.current.getBoundingClientRect()
 assert.equal(api.dock,null)
 assert.equal(api.collapsed,true)
 assert.equal(after.left,before.left,'Dock collapse preserves grip X')
 assert.equal(after.top,before.top,'Dock collapse preserves grip Y')
 click()
}
console.log('Top/bottom collapse preserves grip position and detaches from grid layout.')
