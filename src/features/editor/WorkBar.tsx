import { HeaderPopover, HeaderMenuButton } from '../../components/HeaderPopover'
import { createPortal } from 'react-dom'
import { HeaderIconButton } from '../../components/HeaderIconButton'
import { useEffect, useRef, useState } from 'react'
import { ArrowCounterClockwise, FloppyDisk, PencilSimple, GearSix, FilePlus, Ruler, Export } from '@phosphor-icons/react'
import type { EditorStateController } from './useEditorState'

export function WorkBar({ editor, onNewWork, onOpenSettings, onOpenExport, settingsHost }: { editor: EditorStateController; onNewWork: () => void; onOpenSettings: () => void; onOpenExport: () => void; settingsHost: HTMLDivElement | null }) {
  const [menu, setMenu] = useState(false)
  const menuRoot = useRef<HTMLDivElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const name = editor.currentWork?.name ?? '未命名作品'
  useEffect(() => {
    if (!menu) return
    const close = (event: PointerEvent) => { if (!menuRoot.current?.contains(event.target as Node)) setMenu(false) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenu(false); settingsButton.current?.focus() } }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key) }
  }, [menu])
  return settingsHost ? createPortal(<div ref={menuRoot} className="relative">
    <HeaderIconButton ref={settingsButton} type="button" aria-label="设置" title="设置" aria-haspopup="dialog" aria-expanded={menu} onClick={()=>setMenu(!menu)}><GearSix size={18}/>{editor.isWorkDirty?<span aria-label="未保存" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-editor-accent"/>:null}</HeaderIconButton>
    {menu ? <HeaderPopover label="作品与设置" triggerRef={settingsButton}>
      <div className="mb-1 flex h-10 items-center gap-2 pl-3"><span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-editor-strong" title={name}>{name}</span>{editor.currentWork?<HeaderIconButton aria-label="重命名作品" title="重命名" onClick={()=>{setMenu(false);void editor.requestRenameWork(editor.currentWork!.id)}}><PencilSimple size={17}/></HeaderIconButton>:null}</div>
      <HeaderMenuButton onClick={()=>{setMenu(false);editor.setCanvasSizeDialog('resize')}}><Ruler size={17}/><span>画板尺寸</span><span className="ml-auto text-editor-text tabular-nums">{editor.pattern.width} × {editor.pattern.height}</span></HeaderMenuButton>
      <HeaderMenuButton onClick={()=>{setMenu(false);void editor.saveWork()}}><FloppyDisk size={17}/><span>保存作品</span>{editor.isWorkDirty ? <span aria-label="未保存" className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-editor-accent"/> : null}</HeaderMenuButton>
      {editor.isWorkDirty?<HeaderMenuButton onClick={()=>{setMenu(false);void editor.discardWorkChanges()}}><ArrowCounterClockwise size={17}/><span>放弃未保存修改</span></HeaderMenuButton>:null}
      <HeaderMenuButton onClick={()=>{setMenu(false);onNewWork()}}><FilePlus size={17}/><span>新建作品</span></HeaderMenuButton>
      <HeaderMenuButton onClick={()=>{setMenu(false);onOpenExport()}}><Export size={17}/><span>导出作品</span></HeaderMenuButton>
      <HeaderMenuButton onClick={()=>{setMenu(false);onOpenSettings()}}><GearSix size={17}/><span>更多设置</span></HeaderMenuButton>
    </HeaderPopover>:null}
    </div>, settingsHost) : null
}
