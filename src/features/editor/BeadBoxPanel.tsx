import { ModalHeader } from '../../components/ModalHeader'
import { searchBoxColors } from './searchBoxColors'
import { Dropdown } from '../../components/Dropdown'
import { ColorPickerPopover } from '../../components/ColorPickerPopover'
import { PaletteColorCell } from '../../components/PaletteColorCell'
import { memo, useCallback, useLayoutEffect, useRef, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Plus, Trash, MagnifyingGlass, CaretRight } from '@phosphor-icons/react'
import { brands, getBrand, findNearestBeadColors, type BrandId } from '../../core/color'
import { ModalDialog } from '../../components/ModalDialog'
import { boxLabel, type BoxColor } from './beadBox'
import type { EditorStateController } from './useEditorState'

export function BoxQuickColors({ editor, vertical = false }: { editor: EditorStateController; vertical?: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const update = () => {
      const max = Math.max(0, (vertical ? scroller.scrollHeight - scroller.clientHeight : scroller.scrollWidth - scroller.clientWidth))
      const x = Math.max(0, Math.min(max, vertical ? scroller.scrollTop : scroller.scrollLeft))
      const next = { left: x > 1, right: max - x > 1 }
      setEdges(previous => previous.left === next.left && previous.right === next.right ? previous : next)
    }
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    return () => { observer.disconnect(); scroller.removeEventListener('scroll', update) }
  }, [editor.beadBox.length, vertical])
  const direction = vertical ? 'to bottom' : 'to right'
  const mask = edges.left && edges.right
    ? `linear-gradient(${direction}, transparent, black 14px, black calc(100% - 14px), transparent)`
    : edges.left ? `linear-gradient(${direction}, transparent, black 14px)`
    : edges.right ? `linear-gradient(${direction}, black calc(100% - 14px), transparent)` : undefined
  return <div aria-label="豆盒快捷选色" className={`flex shrink-0 items-center gap-1 p-1 ${vertical ? 'w-10 flex-col' : 'h-10 flex-row'}`}>
    {/* Three 28px beads, three 4px gaps, and half a bead: 110px. */}
    <div ref={scrollerRef} style={{ maskImage: mask, WebkitMaskImage: mask }} className={`flex shrink-0 items-center gap-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${vertical ? 'h-[110px] w-7 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain [touch-action:pan-y]' : 'w-[110px] h-7 flex-row overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x]'}`}>
    {editor.beadBox.map(color => <button key={color.id} type="button" title={boxLabel(color)} aria-label={`选择豆色 ${boxLabel(color)}`} aria-pressed={editor.currentColor === color.hex} onClick={() => editor.selectDrawingColor(color.hex)} className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-editor-accent ${editor.currentColor === color.hex ? 'border-editor-accent' : 'border-transparent hover:border-editor-border'}`}><span className={`absolute rounded-full transition-[inset] ${editor.currentColor === color.hex ? 'inset-[2px]' : '-inset-px'}`} style={{ backgroundColor: color.hex }} /></button>)}
    </div>
    <button type="button" aria-label="从豆色卡添加" title="从豆色卡添加" onClick={() => editor.setBoxPickerOpen(true)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-editor-accent-soft text-editor-accent"><Plus size={16}/></button>
  </div>
}
function useBeadCounts(editor: EditorStateController) {
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const cell of editor.pattern.cells) if (cell.color && !cell.isExternal) counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1)
    return counts
  }, [editor.pattern])
}
export function BeadBoxPanel({ editor }: { editor: EditorStateController }) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [clearUnusedOpen, setClearUnusedOpen] = useState(false)
  const deleting = editor.beadBox.find(color => color.id === deleteId)
  const counts = useBeadCounts(editor)
  const colors = [...editor.beadBox.filter(c => counts.has(c.hex)), ...editor.beadBox.filter(c => !counts.has(c.hex))]
  const unusedIds = colors.filter(color => !counts.has(color.hex)).map(color => color.id)
  const removable = colors.find(color => color.hex === editor.currentColor)
  return <div className="bead-box-section" aria-label="作品豆盒">
    <div className="mb-2 grid grid-cols-2 gap-2">
      <button type="button" aria-label="添加豆色" onClick={() => editor.setBoxPickerOpen(true)} className="flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-editor-accent/15 bg-editor-accent-soft/60 px-2 text-xs font-medium text-editor-accent transition-colors hover:bg-editor-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-editor-accent"><Plus size={17}/>添加豆色</button>
      <button type="button" disabled={!unusedIds.length || editor.editorMode !== 'draw'} onClick={() => setClearUnusedOpen(true)} title="清空豆盒中 0 颗的颜色" className="flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-editor-border/60 bg-editor-elevated/40 px-2 text-xs font-medium text-editor-text transition-colors hover:bg-editor-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-editor-accent disabled:cursor-default disabled:opacity-40"><Trash size={15}/>清空未使用</button>
    </div>
    {clearUnusedOpen ? createPortal(<ModalDialog label="清空未使用豆色" onClose={() => setClearUnusedOpen(false)} panelClassName="w-full max-w-sm rounded-3xl bg-editor-surface p-5 shadow-xl">
      <ModalHeader title="清空未使用豆色"/>
      <p className="text-sm leading-6 text-editor-text">将从当前作品豆盒移除 {unusedIds.length} 种未使用豆色。画布上的豆子和豆色卡不会改变。</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" data-modal-close data-dialog-initial-focus className="rounded-xl px-4 py-2 text-sm text-editor-text transition hover:bg-editor-surface-soft">取消</button>
        <button type="button" disabled={!unusedIds.length || editor.editorMode !== 'draw'} onClick={() => { editor.removeBoxColors(unusedIds); setClearUnusedOpen(false) }} className="rounded-xl bg-editor-accent px-4 py-2 text-sm text-white transition hover:brightness-110 disabled:opacity-40">确认清空</button>
      </div>
    </ModalDialog>, document.body) : null}
    {removable ? <div className="mb-3 flex items-center gap-3 rounded-2xl border border-editor-border/60 bg-editor-elevated/60 px-3 py-2.5">
      <span className="h-8 w-8 shrink-0 rounded-full border border-black/5" style={{backgroundColor:removable.hex}} />
      <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-editor-strong">{boxLabel(removable)}</div><div className="mt-0.5 text-[10px] tabular-nums text-editor-text">{counts.get(removable.hex) ?? 0} 颗</div></div>
      <button type="button" aria-label={'删除豆色 ' + boxLabel(removable)} title="删除豆色" onClick={() => setDeleteId(removable.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-editor-text transition hover:bg-editor-accent-soft hover:text-editor-accent active:scale-95"><Trash size={17}/></button>
    </div> : null}
    {deleting ? createPortal(<ModalDialog label="删除豆色" onClose={() => setDeleteId(null)} panelClassName="w-full max-w-sm rounded-3xl bg-editor-surface p-5 shadow-xl">
      <div className="flex items-center gap-3"><span className="h-9 w-9 shrink-0 rounded-full border border-black/5" style={{backgroundColor:deleting.hex}} /><div className="min-w-0"><h2 className="font-semibold text-editor-strong">删除豆色？</h2><p className="truncate text-xs text-editor-text">{boxLabel(deleting)}</p></div></div>
      <p className="mt-4 text-sm leading-relaxed text-editor-text">{counts.get(deleting.hex) ? '画布上的 ' + counts.get(deleting.hex) + ' 颗对应豆子会一起清空为透明，可通过撤销恢复。' : '将从当前作品的豆盒中移除这个豆色。'}豆色卡中的原色仍会保留。</p>
      <div className="mt-5 flex justify-end gap-2"><button type="button" data-modal-close className="rounded-xl px-4 py-2 text-sm text-editor-text transition hover:bg-editor-surface-soft">取消</button><button type="button" onClick={() => { editor.removeBoxColor(deleting.id); setDeleteId(null) }} className="rounded-xl bg-editor-accent px-4 py-2 text-sm text-white transition hover:brightness-110 active:scale-95">删除</button></div>
    </ModalDialog>, document.body) : null}
    <div className="bead-box-grid grid gap-2">{colors.map(color => {
      const count = counts.get(color.hex) ?? 0
      return <div key={color.id} className="relative rounded-xl px-1 pb-1 pt-2 text-center">
        <PaletteColorCell color={color} brand={color.brand ?? editor.currentBrand} enabled selected={editor.currentColor === color.hex} actionLabel={`选择豆色 ${boxLabel(color)}`} onClick={() => editor.selectDrawingColor(color.hex)} />
        <span className="text-[10px] text-editor-text">{`${count} 颗`}</span>
      </div>
    })}
    </div>

  </div>
}
export function BeadCardBrowser({ editor }: { editor: EditorStateController }) {
  const counts = useBeadCounts(editor)
  const [brand, setBrand] = useState<BrandId | 'custom'>(editor.currentBrand)
  const [customOpen, setCustomOpen] = useState(false)
  const [removal, setRemoval] = useState<BoxColor[] | null>(null)
  const colors = useMemo(() => editor.boxCatalog.filter(c => (brand === 'custom' ? !c.brand : c.brand === brand) && (c.nameZh || c.nameEn || Object.values(c.codes).some(Boolean))), [editor.boxCatalog, brand])
  const addedByHex = new Map(editor.beadBox.map(c => [c.hex.toLowerCase(), c]))
  const addedHexes = new Set(editor.beadBox.map(c => c.hex.toLowerCase()))
  const unaddedColors = colors.filter(c => !addedHexes.has(c.hex.toLowerCase()))
  const groups = useMemo(() => groupCardColors(colors), [colors])
  const boxRef = useRef(editor.beadBox)
  const addColorRef = useRef(editor.addBoxColor)
  useLayoutEffect(() => { addColorRef.current = editor.addBoxColor; boxRef.current = editor.beadBox }, [editor.addBoxColor, editor.beadBox])
  const toggleColor = useCallback((color: BoxColor, added: boolean) => {
    if (added) { const existing = boxRef.current.find(item => item.hex.toLowerCase() === color.hex.toLowerCase()); if (existing) setRemoval([existing]) }
    else addColorRef.current(color)
  }, [])
  const allAdded = colors.length > 0 && !unaddedColors.length
  const removalHexes = new Set(removal?.map(c => c.hex))
  const removalCount = [...removalHexes].reduce((sum, hex) => sum + (counts.get(hex) ?? 0), 0)
  return createPortal(<ModalDialog label="豆色卡" onClose={() => editor.setBoxPickerOpen(false)} panelClassName="flex max-h-[85dvh] w-full max-w-2xl flex-col gap-3 rounded-3xl bg-editor-surface p-4 shadow-xl">
    <ModalHeader title="豆色卡" description="挑选豆色加入当前作品的豆盒"/>
    <div className="flex shrink-0 items-center gap-2">
      <div className="min-w-0 flex-1"><Dropdown ariaLabel="选择豆色卡品牌" value={brand} onChange={value=>setBrand(value as BrandId | 'custom')} options={[...brands.filter(b=>b.available).map(b=>({value:b.id,label:b.label})),{value:'custom',label:'我的豆色卡'}]}/></div>
      <button type="button" aria-label={allAdded ? '已全部加入' : '全部加入'} disabled={editor.editorMode !== 'draw' || !unaddedColors.length} onClick={() => editor.addBoxColors(unaddedColors)} className="flex h-11 shrink-0 items-center gap-2 rounded-xl px-2.5 text-editor-accent transition-colors hover:bg-editor-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-editor-accent disabled:cursor-default disabled:text-editor-text/45 disabled:hover:bg-transparent">
        {allAdded ? <Check size={17}/> : <Plus size={17}/>}
        <span className="grid gap-0.5 text-left"><span className="text-xs font-medium leading-4">{allAdded ? '已全部加入' : '全部加入'}</span><span className="text-[10px] leading-3 tabular-nums text-editor-text/60">{colors.length} 色</span></span>
      </button>
    </div>
    <div className="min-h-0 overflow-y-auto overscroll-contain px-1 [overflow-anchor:none]" aria-label="豆色分组">
      {[...groups].map(([label, items]) => {
        const groupAdded = [...new Map(items.flatMap(c => { const entry = addedByHex.get(c.hex.toLowerCase()); return entry ? [[entry.id, entry] as const] : [] })).values()]
        const panelId = 'bead-card-group-'+brand+'-'+encodeURIComponent(label)
        return <ColorCardGroup key={brand+label} label={label} count={items.length} panelId={panelId} actions={<>
            <button type="button" aria-label={'整组加入 '+label} title={'整组加入 '+label} disabled={editor.editorMode!=='draw'||items.every(c => addedHexes.has(c.hex.toLowerCase()))} onClick={()=>editor.addBoxColors(items)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-editor-accent transition hover:bg-editor-accent-soft disabled:opacity-30"><Plus size={17}/></button>
            <button type="button" aria-label={'整组移出 '+label} title={'整组移出 '+label} disabled={editor.editorMode!=='draw'||!groupAdded.length} onClick={()=>setRemoval(groupAdded)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-editor-text transition hover:bg-editor-accent-soft hover:text-editor-accent disabled:opacity-30"><Trash size={16}/></button>
          </>}>
            <div className="min-h-0 overflow-hidden"><div className="grid grid-cols-4 gap-x-2 gap-y-3 px-1 pb-1 pt-2 sm:grid-cols-7">{items.map(c => <CatalogColorItem key={c.id} color={c} brand={c.brand ?? editor.currentBrand} added={addedHexes.has(c.hex.toLowerCase())} count={counts.get(c.hex) ?? 0} onToggle={toggleColor}/>)}</div></div>
        </ColorCardGroup>
      })}
    </div>
    {!colors.length?<p className="text-sm text-editor-text">暂无匹配的豆色</p>:null}
    <button type="button" onClick={()=>setCustomOpen(true)} className="group flex shrink-0 items-center gap-3 rounded-2xl bg-editor-accent-soft/60 px-3 py-3 text-left transition hover:bg-editor-accent-soft">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-editor-surface text-editor-accent"><MagnifyingGlass size={21}/></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-editor-strong">找豆色</span><span className="block text-[11px] text-editor-text">检索相近色 · 创建自己的颜色</span></span><CaretRight size={17} className="text-editor-accent"/>
    </button>
    {customOpen ? <ColorDiscovery editor={editor} onClose={()=>setCustomOpen(false)} /> : null}
    {removal ? createPortal(<ModalDialog label="移出豆色" onClose={()=>setRemoval(null)} panelClassName="w-full max-w-sm rounded-3xl bg-editor-surface p-5 shadow-xl">
      <h2 className="font-semibold text-editor-strong">移出 {removal.length} 种豆色？</h2>
      <p className="mt-3 text-sm leading-relaxed text-editor-text">{removalCount ? '画布上对应的 '+removalCount+' 颗豆子也会清空为透明，可撤销恢复。' : '这些豆色将从当前作品的豆盒移出。'}原色卡会保留。</p>
      <div className="mt-5 flex justify-end gap-2"><button type="button" data-modal-close className="rounded-xl px-4 py-2 text-sm text-editor-text hover:bg-editor-surface-soft">取消</button><button type="button" onClick={()=>{editor.removeBoxColors(removal.map(c=>c.id));setRemoval(null)}} className="rounded-xl bg-editor-accent px-4 py-2 text-sm text-white">确认移出</button></div>
    </ModalDialog>,document.body) : null}
  </ModalDialog>,document.body)
}

const CatalogColorItem = memo(function CatalogColorItem({ color, brand, added, count, onToggle }: { color: BoxColor; brand: BrandId; added: boolean; count: number; onToggle: (color: BoxColor, added: boolean) => void }) {
  return <div className="relative px-1 pt-2">
    <PaletteColorCell color={color} brand={brand} enabled={added} actionLabel={(added ? '移出豆盒并清除对应豆子' : '加入豆盒') + ' ' + boxLabel(color)} onClick={() => onToggle(color, added)}/>
    <span className="block h-4 text-center text-[10px] leading-4 text-editor-text">{added ? count + ' 颗' : ''}</span>
  </div>
})

function groupCardColors(colors: BoxColor[]) {
  const prefixes = new Set(colors.map(c => (c.brand ? c.codes[c.brand] : '')?.match(/^[A-Za-z]+/)?.[0] ?? ''))
  const groups = new Map<string, BoxColor[]>()
  for (const color of colors) {
    const code = color.brand ? color.codes[color.brand] ?? '' : ''
    const prefix = code.match(/^[A-Za-z]+/)?.[0] ?? ''
    const number = Number(code.replace(/^[A-Za-z]+/, ''))
    const label = !color.brand ? '自定义' : prefixes.size > 1 && prefix ? prefix+' 组' : code && Number.isFinite(number) ? prefix+String(Math.floor(Math.max(0, number-1)/50)*50+1)+'–'+prefix+String((Math.floor(Math.max(0,number-1)/50)+1)*50) : '其他'
    const items = groups.get(label) ?? []
    items.push(color)
    groups.set(label,items)
  }
  return groups
}

function ColorDiscovery({editor,onClose}:{editor:EditorStateController;onClose:()=>void}) {
  const [mode,setMode]=useState<'nearest'|'custom'>('nearest')
  const [hex,setHex]=useState(editor.currentColor)
  const [name,setName]=useState('')
  const [query,setQuery]=useState('')
  const [busy,setBusy]=useState(false)
  const candidates=useMemo(()=>editor.boxCatalog.filter(c=>Boolean(c.brand)),[editor.boxCatalog])
  const recommendations=useMemo(()=>findNearestBeadColors(hex,candidates,8),[hex,candidates])
  const search=query.trim().toLowerCase()
  const searchResults=useMemo(()=>searchBoxColors(editor.boxCatalog,search),[editor.boxCatalog,search])
  const results=search ? searchResults : recommendations.map(item=>item.color as BoxColor)
  const added=new Set(editor.beadBox.map(c=>c.hex.toLowerCase()))
  return createPortal(<ModalDialog label="找豆色" onClose={onClose} panelClassName="flex max-h-[88dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-3xl bg-editor-surface p-4 shadow-xl">
    <ModalHeader title="找豆色"/>
    <div className="flex gap-1 rounded-xl bg-editor-surface-soft p-1">{([{id:'nearest',label:'相近色'},{id:'custom',label:'自定义'}] as const).map(item=><button key={item.id} type="button" aria-pressed={mode===item.id} onClick={()=>setMode(item.id)} className={'h-9 flex-1 rounded-lg text-xs font-medium transition '+(mode===item.id?'bg-editor-surface text-editor-accent shadow-sm':'text-editor-text hover:text-editor-strong')}>{item.label}</button>)}</div>
    {mode==='nearest' ? <input type="search" aria-label="查找豆色" placeholder="名称、色号或 Hex" value={query} onChange={event=>setQuery(event.target.value)} className="h-10 w-full shrink-0 rounded-xl border border-editor-border bg-editor-elevated px-3 text-sm text-editor-strong outline-none focus:border-editor-accent"/> : null}
    {!search || mode==='custom' ? <ColorPickerPopover inline color={hex} onPreview={setHex} onCommit={setHex} ariaLabel="选择检索颜色" /> : null}
    {mode==='nearest' ? <div>
      <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium text-editor-strong">{search?'搜索结果':'最相近的豆色'}</span><span className="text-editor-text">{search?results.length+' 个豆色':'全部品牌 · 按色差排序'}</span></div>
      <div className="grid grid-cols-2 gap-2">{results.map(c=>{const exists=added.has(c.hex.toLowerCase());return <button type="button" key={c.id} disabled={exists || editor.editorMode!=='draw'} onClick={()=>editor.addBoxColor(c)} title={boxLabel(c)+' · '+c.hex} className="flex min-w-0 items-center gap-2 rounded-xl border border-editor-border/60 p-2 text-left transition hover:border-editor-accent hover:bg-editor-accent-soft/40 disabled:cursor-default">
        <span className="h-8 w-8 shrink-0 rounded-full border border-black/10" style={{backgroundColor:c.hex}}/>
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-editor-strong">{c.brand ? c.codes[c.brand] : boxLabel(c)}</span><span className="block truncate text-[10px] text-editor-text">{c.brand ? getBrand(c.brand).shortLabel : ''} · {c.hex.toUpperCase()}</span></span>
        {exists?<Check size={15} className="shrink-0 text-editor-accent"/>:<Plus size={15} className="shrink-0 text-editor-text"/>}
      </button>})}</div>
      {!results.length ? <p className="py-6 text-center text-xs text-editor-text">没有匹配的豆色</p> : null}
    </div> : <form className="flex gap-2" onSubmit={async event=>{event.preventDefault();if(!name.trim()||busy)return;setBusy(true);try{await editor.createCustomBoxColor(hex,name.trim());onClose()}finally{setBusy(false)}}}>
      <input aria-label="自定义豆色名称" placeholder="给豆色起个名字" value={name} maxLength={32} onChange={event=>setName(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-editor-border bg-editor-elevated px-3 text-sm outline-none focus:border-editor-accent"/>
      <button type="submit" disabled={!name.trim()||busy||editor.editorMode!=='draw'} className="rounded-xl bg-editor-accent px-3 text-xs text-white disabled:opacity-40">{busy?'添加中':'加入豆盒'}</button>
    </form>}
  </ModalDialog>,document.body)
}

function ColorCardGroup({label,count,panelId,actions,children}:{label:string;count:number;panelId:string;actions:ReactNode;children:ReactNode}) {
  const [collapsed,setCollapsed]=useState(false)
  const contentRef=useRef<HTMLDivElement>(null)
  const [height,setHeight]=useState<number>()
  useLayoutEffect(()=>{
    const content=contentRef.current
    if(!content)return
    const measure=()=>setHeight(content.getBoundingClientRect().height)
    measure()
    const observer=new ResizeObserver(measure)
    observer.observe(content)
    return ()=>observer.disconnect()
  },[])
  return <section className="pb-3">
    <div className="flex items-center gap-1 py-1">
      <button type="button" aria-expanded={!collapsed} aria-controls={panelId} onClick={()=>setCollapsed(value=>!value)} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left transition hover:bg-editor-surface-soft">
        <CaretRight size={13} className={'shrink-0 text-editor-text transition-transform duration-200 '+(collapsed?'':'rotate-90')}/>
        <span className="text-xs font-semibold text-editor-strong">{label}</span><span className="text-[10px] tabular-nums text-editor-text/60">{count}</span>
      </button>{actions}
    </div>
    <div id={panelId} inert={collapsed} aria-hidden={collapsed} className="overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none" style={{height:collapsed?0:height}}>
      <div ref={contentRef} className="flow-root [contain:layout]">{children}</div>
    </div>
  </section>
}
