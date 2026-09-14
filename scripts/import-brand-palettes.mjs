import fs from 'node:fs'
const root='src/core/color/data/'
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(url+': '+r.status);return r.json()}
async function file(repo,ref,path){const j=await json('https://api.github.com/repos/'+repo+'/contents/'+path+'?ref='+ref);return Buffer.from(j.content,'base64').toString()}
const sources=[]
for(const [repo,entries] of [
 ['maxcleme/beadcolors', [['artkal-s','raw/artkal_s.csv'],['hama-midi','raw/hama.csv'],['perler','raw/perler.csv']]],
 ['HansBug/pindou-color-data', [['artkal-c','artkal-c-197-official/colors.json'],['coco','coco-291/colors.json'],['manman','manman-278/colors.json'],['panpan','panpan-289/colors.json'],['mixiaowo','mixiaowo-290/colors.json']]],
]) {
 const meta=await json('https://api.github.com/repos/'+repo)
 const commit=await json('https://api.github.com/repos/'+repo+'/commits/'+meta.default_branch)
 const ref=commit.sha
 const license=await file(repo,ref,'LICENSE')
 fs.writeFileSync(root+repo.split('/')[0]+'-LICENSE.txt',license)
 for(const [id,path] of entries){
  const raw=await file(repo,ref,path)
  let colors
  let upstreamSources
  if(path.endsWith('.json')){const data=JSON.parse(raw);upstreamSources=data.sources;colors=data.colors.filter(c=>id!=='artkal-c' || /^C[0-9]+$/.test(c.code)).map(c=>({hex:c.hex.toLowerCase(),codes:{[id]:c.code}}))}
  else colors=raw.trim().split(/\r?\n/).map(line=>{const [code,name,r,g,b]=line.split(',');const channels=[r,g,b].map(Number);if(channels.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Bad RGB '+line);return {hex:'#'+channels.map(v=>v.toString(16).padStart(2,'0')).join(''),codes:{[id]:code},...(name?{nameEn:name}:{})}})
  if(new Set(colors.map(c=>c.codes[id])).size!==colors.length)throw Error('Duplicate codes '+id)
  if(colors.some(c=>!/^#[0-9a-f]{6}$/.test(c.hex)))throw Error('Invalid hex '+id)
  fs.writeFileSync(root+id+'.json',JSON.stringify(colors,null,2)+'\n')
  sources.push({id,count:colors.length,repository:repo,commit:ref,path,license:'MIT',upstreamSources})
  console.log(id,colors.length)
 }
}
fs.writeFileSync(root+'sources.json',JSON.stringify(sources,null,2)+'\n')
