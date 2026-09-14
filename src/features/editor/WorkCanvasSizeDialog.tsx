import { ModalHeader } from '../../components/ModalHeader'
import { WorkCreationActions } from './WorkCreationActions'
import { useMemo, useState } from 'react'
import { BoardSizeFields } from './BoardSizeFields'
import { ModalDialog } from '../../components/ModalDialog'
import { resizeWithAnchor, type ResizeAnchor } from '../../core/pattern/resize'
import type { EditorStateController } from './useEditorState'

export function WorkCanvasSizeDialog({ editor, embedded = false, onCreated }: { editor: EditorStateController; embedded?: boolean; onCreated?: () => void }) {
  const creating = embedded || editor.canvasSizeDialog === 'new'
  const [width, setWidth] = useState(String(creating ? 52 : editor.pattern.width))
  const [height, setHeight] = useState(String(creating ? 52 : editor.pattern.height))
  const [anchor, setAnchor] = useState<ResizeAnchor>({ x: 0.5, y: 0.5 })
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const w = Number(width), h = Number(height)
  const valid = [w, h].every(n => Number.isInteger(n) && n >= 4 && n <= 512)
  const changed = w !== editor.pattern.width || h !== editor.pattern.height
  const cropped = useMemo(() => !creating && valid && changed ? resizeWithAnchor(editor.pattern, w, h, anchor).croppedBeads : 0, [creating, valid, changed, editor.pattern, w, h, anchor])
  const locked = !creating && editor.editorMode === 'bead'
  const close = () => { if (!busy) editor.setCanvasSizeDialog(null) }
  const labels = ['左上', '上中', '右上', '左中', '居中', '右中', '左下', '下中', '右下']
  const content = <>
    {!embedded ? <ModalHeader title="画板尺寸" disabled={busy}/> : null}
    {!creating ? <p className="mb-4 text-xs text-editor-text">{editor.currentWork?.name ?? '未命名作品'} · {editor.pattern.width} × {editor.pattern.height} 颗</p> : null}
    <form onSubmit={async event => { event.preventDefault(); if (!valid || busy || locked || (!creating && !changed)) return; if (cropped && !confirmed) { setConfirmed(true); return } setBusy(true); if (creating) { const created = await editor.newWork(w, h); setBusy(false); if (created) { editor.setCanvasSizeDialog(null); onCreated?.() } } else { editor.applyCanvasSize(h, w, anchor); editor.requestViewportFit(); editor.setCanvasSizeDialog(null) } }}>
      <fieldset disabled={busy || locked} className="grid gap-4" onChange={() => setConfirmed(false)}>
        <BoardSizeFields width={width} height={height} onChange={(w,h)=>{setWidth(w);setHeight(h);setConfirmed(false)}}/>
        {!creating ? <div className="flex items-center gap-4"><div className="grid shrink-0 grid-cols-3 gap-1" role="group" aria-label="图案锚点">{labels.map((label,i)=>{const x=(i%3)/2 as ResizeAnchor['x'],y=Math.floor(i/3)/2 as ResizeAnchor['y'];const selected=anchor.x===x&&anchor.y===y;return <button key={label} type="button" title={label} aria-label={label} aria-pressed={selected} onClick={()=>{setAnchor({x,y});setConfirmed(false)}} className={'grid h-8 w-8 place-items-center rounded-lg transition '+(selected?'bg-editor-accent text-white':'bg-editor-elevated text-editor-text hover:bg-editor-accent-soft')}><span className="h-1.5 w-1.5 rounded-full bg-current"/></button>})}</div><div className="text-xs leading-5 text-editor-text"><p className="font-medium text-editor-strong">固定图案的位置</p><p>新增区域留空，原图不拉伸。</p></div></div> : null}
      </fieldset>
      <p className="mt-3 text-xs leading-5 text-editor-text">{locked ? '拼豆中不能调整尺寸，请先返回绘制。' : !valid ? '宽、高均需为 4–512 的整数。' : creating ? '尺寸单位为豆子颗数。' : cropped ? '将裁掉 ' + cropped + ' 颗豆子，可撤销恢复。' : '不会裁掉豆子，可撤销恢复。'}</p>
      {confirmed ? <p role="alert" className="mt-2 rounded-xl bg-editor-accent-soft p-3 text-xs text-editor-accent">确认裁掉这 {cropped} 颗豆子并调整画板？</p> : null}
      <WorkCreationActions submit busy={busy} disabled={!valid || locked || (!creating && !changed)} label={creating ? '创建作品' : confirmed ? '确认裁切' : '应用尺寸'}/>
    </form>
  </>
  return embedded ? content : <ModalDialog dismissDisabled={busy} label={creating ? '新建空白作品' : '画板尺寸'} onClose={close} panelClassName="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-3xl bg-editor-surface p-5 shadow-xl">{content}</ModalDialog>
}
