import type { EditorStateController } from '../useEditorState'

type ExportPanelProps = {
  editor: EditorStateController
}

export function ExportPanel({ editor }: ExportPanelProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <button
          className="h-11 rounded-2xl bg-editor-accent px-4 text-sm font-bold text-white disabled:opacity-40"
          type="button"
          disabled={editor.colorStats.length === 0}
          onClick={editor.exportPatternImage}
        >
          带色号图纸 PNG
        </button>
        <button
          className="h-11 rounded-2xl bg-editor-accent px-4 text-sm font-bold text-white disabled:opacity-40"
          type="button"
          disabled={editor.colorStats.length === 0}
          onClick={editor.exportShoppingListImage}
        >
          采购清单 PNG
        </button>
        <button
          className="h-11 rounded-2xl border border-editor-border bg-editor-elevated/70 px-4 text-sm font-bold text-editor-strong"
          type="button"
          onClick={editor.exportPng}
        >
          色块图纸 PNG（无色号）
        </button>
        <button
          className="h-11 rounded-2xl border border-editor-border bg-editor-elevated/70 px-4 text-sm font-bold text-editor-strong disabled:opacity-40"
          type="button"
          disabled={editor.colorStats.length === 0}
          onClick={editor.exportColorList}
        >
          配色清单 CSV
        </button>
        <button
          className="h-11 rounded-2xl border border-editor-border bg-editor-elevated/70 px-4 text-sm font-bold text-editor-strong"
          type="button"
          onClick={editor.saveLocal}
        >
          保存到此浏览器
        </button>
        <button
          className="h-11 rounded-2xl border border-editor-border bg-editor-elevated/70 px-4 text-sm font-bold text-editor-strong"
          type="button"
          onClick={editor.restoreLocal}
        >
          读取上次保存
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="rounded-2xl border border-editor-border bg-editor-elevated/70 px-3 py-2 text-sm font-bold text-editor-strong"
          type="button"
          onClick={editor.exportJson}
        >
          导出工程文件
        </button>
        <label className="relative grid cursor-pointer place-items-center rounded-2xl border border-editor-border bg-editor-elevated/70 px-3 py-2 text-sm font-bold text-editor-strong">
          导入工程文件
          <input
            accept="application/json"
            className="absolute inset-0 cursor-pointer opacity-0"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void editor.importJson(file)
              event.target.value = ''
            }}
          />
        </label>
      </div>
    </div>
  )
}
