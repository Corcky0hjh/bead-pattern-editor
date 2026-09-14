import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=ts.transpile(fs.readFileSync('src/core/image/placementBounds.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022})
const {constrainImagePlacement}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
for(const [cols,rows] of [[52,52],[104,52],[29,58]]) for(const [width,height] of [[200,200],[100,900],[800,120]]) for(let rotation=0;rotation<360;rotation+=15) for(const scale of [.02,.5,6]) for(const x of [-3,.2,3]) {
 const image={width,height},p=constrainImagePlacement({x,y:-x,scale,rotation,flipX:true,flipY:false},image,cols,rows)
 const w=p.scale*cols,h=w*height/width,cx=(p.x+p.scale/2)*cols,cy=p.y*rows+h/2,r=rotation*Math.PI/180
 for(const dx of [-w/2,w/2])for(const dy of [-h/2,h/2]){const px=cx+dx*Math.cos(r)-dy*Math.sin(r),py=cy+dx*Math.sin(r)+dy*Math.cos(r);assert.ok(px>=-1e-8&&px<=cols+1e-8&&py>=-1e-8&&py<=rows+1e-8)}
 assert.ok(Math.abs(w/h-width/height)<1e-8)
 const repeated=constrainImagePlacement(p,image,cols,rows);assert.ok(Math.abs(repeated.x-p.x)<1e-8&&Math.abs(repeated.y-p.y)<1e-8)
}
console.log('Rotated image remains inside square/landscape/portrait boards at all tested scales and offsets; aspect ratio preserved.')
