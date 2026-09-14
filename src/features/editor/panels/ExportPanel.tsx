import { useState } from 'react'
import { Image, Palette, FileCode, CheckCircle, Circle, DownloadSimple } from '@phosphor-icons/react'
import type { EditorStateController } from '../useEditorState'

type ExportKind = 'pattern' | 'palette' | 'project'
export function ExportPanel({ editor }: { editor: EditorStateController }) {
  const [kind, setKind] = useState<ExportKind>('pattern')
  const [options, setOptions] = useState({ showCodes: true, showGrid: true, showPalette: false, showInfo: true })
  const [paletteFormat, setPaletteFormat] = useState<'png' | 'csv'>('png')
  const tabs = [{ id: 'pattern' as const, label: '图纸', icon: Image }, { id: 'palette' as const, label: '配色', icon: Palette }, { id: 'project' as const, label: '工程', icon: FileCode }]
  const toggles = [{ key: 'showCodes' as const, label: '豆子色号' }, { key: 'showGrid' as const, label: '网格' }, { key: 'showPalette' as const, label: '附带配色清单' }, { key: 'showInfo' as const, label: '作品名称与尺寸' }]
  const empty = !editor.colorStats.length
  return <div className="grid gap-4">
    <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="导出类型">{tabs.map(({ id, label, icon: Icon }) => <button key={id} id={'export-tab-'+id} type="button" role="tab" aria-selected={kind===id} aria-controls={'export-content-'+id} onClick={()=>setKind(id)} className={'flex h-10 items-center justify-center gap-2 rounded-xl text-[13px] transition '+(kind===id?'bg-editor-accent-soft text-editor-accent':'text-editor-text hover:bg-editor-surface-soft')}><Icon size={18}/>{label}</button>)}</div>
    <div id={'export-content-'+kind} role="tabpanel" aria-labelledby={'export-tab-'+kind} className="min-h-44">
      {kind==='pattern' ? <div className="grid gap-1">{toggles.map(({key,label})=><label key={key} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-editor-strong transition hover:bg-editor-surface-soft"><input type="checkbox" checked={options[key]} onChange={e=>setOptions(previous=>({...previous,[key]:e.target.checked}))} className="peer sr-only"/><span className="flex-1">{label}</span><span className="rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-editor-accent">{options[key]?<CheckCircle size={19} className="text-editor-accent"/>:<Circle size={19} className="text-editor-text opacity-40"/>}</span></label>)}</div> : kind==='palette' ? <div className="grid gap-3 px-3 py-2"><p className="text-[13px] leading-6 text-editor-text">{editor.colorStats.length} 种豆色 · {editor.usedCount} 颗，包含色号、色值和数量。</p><div role="group" aria-label="配色文件格式" className="grid grid-cols-2 gap-2">{(['png','csv'] as const).map(format=><button type="button" key={format} aria-pressed={paletteFormat===format} onClick={()=>setPaletteFormat(format)} className={'rounded-xl px-3 py-3 text-[13px] transition '+(paletteFormat===format?'bg-editor-accent-soft text-editor-accent':'bg-editor-elevated text-editor-text hover:bg-editor-surface-soft')}>{format==='png'?'PNG 图片':'CSV 表格'}</button>)}</div></div> : <div className="px-3 py-2 text-[13px] leading-6 text-editor-text"><p>JSON 图纸文件，保留画板尺寸和每格的豆色，可重新导入继续绘制。</p><p className="mt-2">不包含拼豆进度。</p></div>}
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-editor-border/60 pt-3"><span className="text-xs text-editor-text">{kind==='project'?'JSON':kind==='palette'?paletteFormat.toUpperCase():'PNG'}{empty && kind!=='project'?' · 画布暂无豆子':''}</span><button type="button" disabled={empty && kind!=='project'} onClick={()=>{if(kind==='pattern')editor.exportPatternImage(options);else if(kind==='palette'){if(paletteFormat==='png')editor.exportShoppingListImage();else editor.exportColorList()}else editor.exportJson()}} className="flex h-10 items-center gap-2 rounded-xl bg-editor-accent px-4 text-[13px] text-white transition hover:brightness-110 active:scale-95 disabled:opacity-35"><DownloadSimple size={17}/>{kind==='pattern'?'导出图纸':kind==='palette'?'导出配色':'导出工程'}</button></div>
  </div>
}
