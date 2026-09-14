import { ModalHeader } from '../../../components/ModalHeader'
import { ModalDialog } from '../../../components/ModalDialog'
import type { EditorStateController } from '../useEditorState'
import { ExportPanel } from './ExportPanel'

export function ExportModal({ editor, onClose }: { editor: EditorStateController; onClose: () => void }) {
  return <ModalDialog label="导出作品" onClose={onClose} panelClassName="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-3xl bg-editor-surface p-4 shadow-xl sm:p-5">
    <ModalHeader title="导出作品" description={editor.currentWork?.name ?? '未命名作品'}/>
    <div className="min-h-0 overflow-y-auto overscroll-contain"><ExportPanel editor={editor}/></div>
  </ModalDialog>
}
