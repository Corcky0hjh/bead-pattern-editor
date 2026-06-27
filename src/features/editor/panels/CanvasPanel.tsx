import { canvasPresets } from '../../../core/pattern/presets'
import { MAJOR_GRID_OPTIONS } from '../../../core/canvas/settings'
import { THEMES } from '../../../core/theme/themes'
import { Dropdown } from '../../../components/Dropdown'
import { Slider } from '../../../components/Slider'
import { ColorPickerPopover } from '../../../components/ColorPickerPopover'
import type { EditorStateController } from '../useEditorState'

type CanvasPanelProps = {
  editor: EditorStateController
}

export function CanvasPanel({ editor }: CanvasPanelProps) {
  const currentPresetValue =
    editor.rows === 104 && editor.cols === 104 ? '104x104' : '52x52'
  const { canvasSettings: s, updateCanvasSettings: update } = editor
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <span className="text-xs font-bold text-editor-text">常用尺寸</span>
        <Dropdown
          ariaLabel="常用尺寸"
          value={currentPresetValue}
          onChange={(value) => {
            const preset = canvasPresets.find((item) => item.value === value)
            if (!preset) return
            editor.setRows(preset.rows)
            editor.setCols(preset.cols)
          }}
          options={canvasPresets.map((preset) => ({
            value: preset.value,
            label: preset.label,
            disabled: preset.value === 'custom',
          }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-2">
          <span className="text-xs font-bold text-editor-text">高（行数）</span>
          <input
            className="h-11 rounded-2xl border border-editor-border bg-editor-elevated/70 px-3 text-sm text-editor-strong outline-none"
            min={4}
            max={120}
            type="number"
            value={editor.rows}
            onChange={(event) => editor.setRows(Number(event.target.value))}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-bold text-editor-text">宽（列数）</span>
          <input
            className="h-11 rounded-2xl border border-editor-border bg-editor-elevated/70 px-3 text-sm text-editor-strong outline-none"
            min={4}
            max={120}
            type="number"
            value={editor.cols}
            onChange={(event) => editor.setCols(Number(event.target.value))}
          />
        </label>
      </div>

      <button
        className="h-11 rounded-2xl bg-editor-accent px-4 text-sm font-bold text-white"
        type="button"
        onClick={() => editor.applyCanvasSize()}
      >
        应用新尺寸
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="rounded-2xl border border-editor-border bg-editor-elevated/70 px-3 py-2 text-sm font-bold text-editor-strong"
          type="button"
          onClick={editor.clearCanvas}
        >
          清空图纸
        </button>
        <button
          className="col-span-2 rounded-2xl border border-editor-border bg-editor-elevated/70 px-3 py-2 text-sm font-bold text-editor-strong"
          type="button"
          onClick={editor.removeIsolatedCells}
        >
          清理孤立珠
        </button>
      </div>

      {/* —— 外观 —— */}
      <section className="grid gap-3 rounded-2xl bg-editor-surface-soft p-3">
        <span className="text-xs font-bold text-editor-text">外观</span>
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <ColorPickerPopover
            ariaLabel="外框背景色"
            color={s.bgColor}
            onCommit={(value) => update({ bgColor: value })}
            size="sm"
          />
          <span className="text-[11px] font-bold text-editor-text">
            外框背景
          </span>

          <ColorPickerPopover
            ariaLabel="纸面色"
            color={s.paperColor}
            onCommit={(value) =>
              update({ paperColor: value, externalColor: value })
            }
            size="sm"
          />
          <span className="text-[11px] font-bold text-editor-text">
            纸面 / 留白色
          </span>
        </div>
        <Slider
          label="纸面透明度"
          value={s.paperAlpha}
          onChange={(v) => update({ paperAlpha: v })}
          min={0}
          max={1}
          step={0.05}
          formatValue={(v) => v.toFixed(2)}
        />
      </section>

      {/* —— 网格 —— */}
      <section className="grid gap-3 rounded-2xl bg-editor-surface-soft p-3">
        <label className="flex items-center justify-between text-xs font-bold text-editor-text">
          <span>显示网格</span>
          <input
            type="checkbox"
            className="accent-editor-accent"
            checked={s.showGrid}
            onChange={(event) => update({ showGrid: event.target.checked })}
          />
        </label>
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3">
          <ColorPickerPopover
            ariaLabel="网格线颜色"
            color={s.gridColor}
            onCommit={(value) => update({ gridColor: value })}
            size="sm"
          />
          <span className="text-[11px] font-bold text-editor-text">线色</span>
        </div>
        <Slider
          label="网格线粗细"
          value={s.gridWidth}
          onChange={(v) => update({ gridWidth: v })}
          min={0.5}
          max={3}
          step={0.1}
          formatValue={(v) => v.toFixed(1)}
        />
        <div className="grid gap-1">
          <span className="text-[11px] font-bold text-editor-text">
            大网格间隔
          </span>
          <Dropdown
            ariaLabel="大网格间隔"
            value={String(s.majorGridEvery)}
            onChange={(value) => update({ majorGridEvery: Number(value) })}
            options={MAJOR_GRID_OPTIONS.map((n) => ({
              value: String(n),
              label: n === 0 ? '关闭' : `每 ${n} 格加粗`,
            }))}
          />
        </div>
      </section>

      {/* —— 主题 —— */}
      <section className="grid gap-3 rounded-2xl bg-editor-surface-soft p-3">
        <span className="text-xs font-bold text-editor-text">主题</span>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((theme) => {
            const active = theme.id === editor.currentTheme
            // 卡片本身用主题自身的色,而不是当前 UI 主题色;否则深色/浅色主题
            // 在同一背景下文字会糊。
            const cardBg = theme.vars['--color-editor-surface']
            const cardText = theme.vars['--color-editor-strong']
            const accent = theme.vars['--color-editor-accent']
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => editor.setCurrentTheme(theme.id)}
                title={theme.description}
                className="grid gap-1 rounded-xl p-2 text-left transition"
                style={{
                  background: cardBg,
                  color: cardText,
                  outline: `${active ? 2 : 1}px solid ${
                    active ? accent : 'rgba(0,0,0,0.12)'
                  }`,
                  boxShadow: active
                    ? '0 4px 14px rgba(0,0,0,0.16)'
                    : '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <span className="flex gap-1">
                  {[
                    theme.vars['--color-editor-bg'],
                    theme.vars['--color-editor-surface-soft'],
                    theme.vars['--color-editor-strong'],
                    theme.vars['--color-editor-accent'],
                  ].map((color, index) => (
                    <span
                      key={index}
                      className="h-4 flex-1 rounded-full"
                      style={{
                        background: color,
                        outline: '1px solid rgba(0,0,0,0.1)',
                      }}
                    />
                  ))}
                </span>
                <span
                  className="truncate text-[11px] font-bold"
                  style={{ color: cardText }}
                >
                  {theme.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <button
        className="h-9 rounded-2xl border border-editor-border bg-editor-elevated/70 px-4 text-xs font-bold text-editor-text"
        type="button"
        onClick={editor.resetCanvasSettings}
      >
        恢复默认外观
      </button>
    </div>
  )
}
