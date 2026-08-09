import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Warning } from '@phosphor-icons/react'
import { MAJOR_GRID_OPTIONS } from '../../../core/canvas/settings'
import { MAX_PATTERN_SIDE, MIN_PATTERN_SIDE } from '../../../core/pattern/grid'
import { canvasPresets } from '../../../core/pattern/presets'
import { THEMES } from '../../../core/theme/themes'
import { ColorPickerPopover } from '../../../components/ColorPickerPopover'
import { appToast } from '../../../components/toastApi'
import { Dropdown } from '../../../components/Dropdown'
import { Slider } from '../../../components/Slider'
import type { EditorStateController } from '../useEditorState'

type CanvasPanelProps = {
  editor: EditorStateController
  wide?: boolean
  view?: 'all' | 'canvas' | 'theme'
}

export function CanvasPanel({ editor, view = 'all' }: CanvasPanelProps) {
  const [resizeConfirmation, setResizeConfirmation] = useState<{
    rows: number
    cols: number
    croppedBeads: number
  } | null>(null)
  const resizeCancelRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (resizeConfirmation) resizeCancelRef.current?.focus()
  }, [resizeConfirmation])
  const currentPresetValue =
    canvasPresets.find(
      (preset) =>
        preset.value !== 'custom' &&
        preset.rows === editor.rows &&
        preset.cols === editor.cols,
    )?.value ?? 'custom'
  const { canvasSettings: s, updateCanvasSettings: update } = editor
  const sizeChanged =
    editor.rows !== editor.pattern.height ||
    editor.cols !== editor.pattern.width

  function applySizeWithPreflight() {
    const rows = Math.min(
      MAX_PATTERN_SIDE,
      Math.max(MIN_PATTERN_SIDE, Math.round(editor.rows)),
    )
    const cols = Math.min(
      MAX_PATTERN_SIDE,
      Math.max(MIN_PATTERN_SIDE, Math.round(editor.cols)),
    )
    let croppedBeads = 0
    if (cols < editor.pattern.width || rows < editor.pattern.height) {
      for (let y = 0; y < editor.pattern.height; y += 1) {
        const croppedRow = y >= rows
        const startX = croppedRow ? 0 : cols
        for (let x = startX; x < editor.pattern.width; x += 1) {
          const cell = editor.pattern.cells[y * editor.pattern.width + x]
          if (cell.color !== null && !cell.isExternal) croppedBeads += 1
        }
      }
    }

    if (croppedBeads > 0) {
      setResizeConfirmation({ rows, cols, croppedBeads })
      return
    }
    editor.applyCanvasSize(rows, cols)
    editor.requestViewportFit()
    appToast.success('画布尺寸已更新', `${cols} × ${rows} 颗`)
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8">
      {view !== 'theme' ? (
        <>
          <SettingsSection
            title="尺寸"
            description={`当前画布为 ${editor.pattern.width} × ${editor.pattern.height} 颗`}
          >
            <div className="grid gap-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <DimensionInput
                  label="宽"
                  value={editor.cols}
                  onChange={editor.setCols}
                />
                <span className="text-xs font-bold text-editor-text">×</span>
                <DimensionInput
                  label="高"
                  value={editor.rows}
                  onChange={editor.setRows}
                />
                <button
                  className="ml-auto h-10 rounded-xl bg-editor-accent px-5 text-xs font-bold text-white transition hover:brightness-105 disabled:cursor-default disabled:opacity-35"
                  type="button"
                  disabled={!sizeChanged}
                  onClick={applySizeWithPreflight}
                >
                  应用尺寸
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-bold text-editor-text">
                  预设
                </span>
                {canvasPresets
                  .filter((preset) => preset.value !== 'custom')
                  .map((preset) => {
                    const active = currentPresetValue === preset.value
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        className={`h-8 rounded-lg px-3 text-[11px] font-bold transition ${
                          active
                            ? 'bg-editor-surface-soft text-editor-accent outline outline-1 outline-editor-accent/35'
                            : 'text-editor-text hover:bg-editor-surface-soft hover:text-editor-strong'
                        }`}
                        onClick={() => {
                          editor.setRows(preset.rows)
                          editor.setCols(preset.cols)
                        }}
                      >
                        {preset.cols} × {preset.rows}
                      </button>
                    )
                  })}
                {currentPresetValue === 'custom' ? (
                  <span className="rounded-lg bg-editor-surface-soft px-3 py-2 text-[11px] font-bold text-editor-text">
                    自定义
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-editor-border pt-3 text-[11px] text-editor-text">
                <span>尺寸范围 4–512 颗</span>
                {sizeChanged ? (
                  <span className="font-bold text-editor-accent">
                    放大补充空格，缩小可能裁切内容
                  </span>
                ) : null}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="画布外观"
            description="调整工作区与纸面的显示方式"
          >
            <SettingRow label="外框背景" description="画布周围的工作区颜色">
              <ColorPickerPopover
                ariaLabel="外框背景色"
                color={s.bgColor}
                onCommit={(value) => update({ bgColor: value })}
                size="sm"
              />
            </SettingRow>
            <SettingRow label="纸面与留白" description="未放置拼豆区域的颜色">
              <ColorPickerPopover
                ariaLabel="纸面色"
                color={s.paperColor}
                onCommit={(value) => update({ paperColor: value })}
                size="sm"
              />
            </SettingRow>
            <SettingRow label="纸面透明度">
              <div className="w-full sm:w-64">
                <Slider
                  label="纸面透明度"
                  value={s.paperAlpha}
                  onChange={(value) => update({ paperAlpha: value })}
                  min={0}
                  max={1}
                  step={0.05}
                  formatValue={(value) => value.toFixed(2)}
                />
              </div>
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="网格" description="控制辅助线与大网格的显示">
            <SettingRow label="显示网格">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={s.showGrid}
                  onChange={(event) =>
                    update({ showGrid: event.target.checked })
                  }
                />
                <span className="h-6 w-11 rounded-full bg-editor-elevated transition peer-checked:bg-editor-accent" />
                <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
              </label>
            </SettingRow>
            <SettingRow label="网格线色">
              <ColorPickerPopover
                ariaLabel="网格线颜色"
                color={s.gridColor}
                onCommit={(value) => update({ gridColor: value })}
                size="sm"
              />
            </SettingRow>
            <SettingRow label="网格线粗细">
              <div className="w-full sm:w-64">
                <Slider
                  label="网格线粗细"
                  value={s.gridWidth}
                  onChange={(value) => update({ gridWidth: value })}
                  min={0.5}
                  max={3}
                  step={0.1}
                  formatValue={(value) => value.toFixed(1)}
                />
              </div>
            </SettingRow>
            <SettingRow label="大网格间隔">
              <div className="w-full sm:w-52">
                <Dropdown
                  ariaLabel="大网格间隔"
                  value={String(s.majorGridEvery)}
                  onChange={(value) =>
                    update({ majorGridEvery: Number(value) })
                  }
                  options={MAJOR_GRID_OPTIONS.map((value) => ({
                    value: String(value),
                    label: value === 0 ? '关闭' : `每 ${value} 格加粗`,
                  }))}
                />
              </div>
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="标尺与定位" description="显示行列坐标、指针位置和选区统计">
            <SettingToggle
              label="显示行列标尺"
              checked={s.showRulers !== false}
              onChange={(checked) => update({ showRulers: checked })}
            />
            <SettingToggle
              label="指针行列高亮"
              checked={s.showPointerGuides !== false}
              onChange={(checked) => update({ showPointerGuides: checked })}
            />
            <SettingToggle
              label="显示指针行列坐标"
              checked={s.showPointerCoordinates !== false}
              onChange={(checked) => update({ showPointerCoordinates: checked })}
            />
            <SettingToggle
              label="显示选区统计"
              checked={s.showSelectionStats !== false}
              onChange={(checked) => update({ showSelectionStats: checked })}
            />
          </SettingsSection>

          <SettingsSection title="豆子标注" description="在色块上显示当前品牌对应的豆子型号">
            <SettingToggle
              label="显示豆子型号"
              checked={s.showBeadCodes !== false}
              onChange={(checked) => update({ showBeadCodes: checked })}
            />
          </SettingsSection>
        </>
      ) : null}

      {view !== 'canvas' ? (
        <SettingsSection
          title="界面主题"
          description="选择适合当前环境的编辑器外观"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {THEMES.map((theme) => {
              const active = theme.id === editor.currentTheme
              const cardBg = theme.vars['--color-editor-surface']
              const cardText = theme.vars['--color-editor-strong']
              const accent = theme.vars['--color-editor-accent']
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => editor.setCurrentTheme(theme.id)}
                  title={theme.description}
                  className="relative grid min-h-28 overflow-hidden rounded-[14px] p-3 text-left transition hover:scale-[1.015]"
                  style={{
                    background: cardBg,
                    color: cardText,
                    outline: `${active ? 2 : 1}px solid ${
                      active ? accent : 'rgba(128,128,128,0.22)'
                    }`,
                  }}
                >
                  <span className="grid grid-cols-[1fr_1.6fr] gap-2">
                    <span
                      className="rounded-lg"
                      style={{ background: theme.vars['--color-editor-bg'] }}
                    />
                    <span className="grid gap-1.5">
                      <span
                        className="rounded-md"
                        style={{
                          background: theme.vars['--color-editor-surface-soft'],
                        }}
                      />
                      <span className="flex gap-1.5">
                        <span
                          className="flex-1 rounded-md"
                          style={{ background: accent }}
                        />
                        <span
                          className="flex-1 rounded-md"
                          style={{
                            background: theme.vars['--color-editor-elevated'],
                          }}
                        />
                      </span>
                    </span>
                  </span>
                  <span className="mt-3 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold">
                      {theme.label}
                    </span>
                    {active ? (
                      <span
                        className="grid h-5 w-5 place-items-center rounded-full text-white"
                        style={{ background: accent }}
                      >
                        <Check size={12} weight="bold" />
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex justify-end pt-2">
            <button
              className="h-10 rounded-xl border border-editor-border px-4 text-xs font-bold text-editor-text transition hover:bg-editor-surface-soft hover:text-editor-strong"
              type="button"
              onClick={editor.resetCanvasSettings}
            >
              恢复默认外观
            </button>
          </div>
        </SettingsSection>
      ) : null}

      {resizeConfirmation ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setResizeConfirmation(null)
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="resize-warning-title"
            aria-describedby="resize-warning-description"
            className="w-full max-w-sm rounded-[18px] border border-editor-border bg-editor-surface p-5 shadow-[0_24px_70px_rgba(0,0,0,0.38)]"
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              setResizeConfirmation(null)
            }}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-editor-accent/12 text-editor-accent">
              <Warning size={20} weight="bold" />
            </span>
            <h3
              id="resize-warning-title"
              className="mt-4 text-base font-black text-editor-strong"
            >
              缩小画布会裁切内容
            </h3>
            <p
              id="resize-warning-description"
              className="mt-2 text-xs leading-5 text-editor-text"
            >
              调整为 {resizeConfirmation.cols} × {resizeConfirmation.rows}{' '}
              后，将裁掉右侧或底部的 {resizeConfirmation.croppedBeads}{' '}
              颗拼豆。此操作可以撤销。
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                ref={resizeCancelRef}
                type="button"
                className="h-10 rounded-xl border border-editor-border text-xs font-bold text-editor-strong transition hover:bg-editor-surface-soft"
                onClick={() => setResizeConfirmation(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="h-10 rounded-xl bg-editor-accent text-xs font-bold text-white transition hover:brightness-105"
                onClick={() => {
                  editor.applyCanvasSize(
                    resizeConfirmation.rows,
                    resizeConfirmation.cols,
                  )
                  editor.requestViewportFit()
                  appToast.success(
                    '画布尺寸已更新',
                    `${resizeConfirmation.cols} × ${resizeConfirmation.rows} 颗`,
                  )
                  setResizeConfirmation(null)
                }}
              >
                继续裁切
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4">
      <header>
        <h3 className="text-sm font-black text-editor-strong">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs text-editor-text">{description}</p>
        ) : null}
      </header>
      <div className="divide-y divide-editor-border border-y border-editor-border">
        {children}
      </div>
    </section>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-16 gap-3 py-3 sm:grid-cols-[minmax(180px,1fr)_minmax(260px,auto)] sm:items-center sm:gap-6">
      <div>
        <p className="text-xs font-bold text-editor-strong">{label}</p>
        {description ? (
          <p className="mt-1 text-[11px] text-editor-text">{description}</p>
        ) : null}
      </div>
      <div className="flex justify-start sm:justify-end">{children}</div>
    </div>
  )
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <SettingRow label={label}>
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-editor-elevated transition peer-checked:bg-editor-accent" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </label>
    </SettingRow>
  )
}

function DimensionInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  function commitDraft() {
    const currentDraft = draft ?? String(value)
    if (currentDraft.trim() === '') {
      setDraft(null)
      return
    }
    const parsed = Number(currentDraft)
    if (!Number.isFinite(parsed)) {
      setDraft(null)
      return
    }
    const normalized = Math.min(
      MAX_PATTERN_SIDE,
      Math.max(MIN_PATTERN_SIDE, Math.round(parsed)),
    )
    setDraft(null)
    onChange(normalized)
  }

  return (
    <label className="flex h-10 items-center gap-2 rounded-xl border border-editor-border bg-editor-elevated/70 px-3">
      <span className="text-[11px] font-bold text-editor-text">{label}</span>
      <input
        className="w-14 bg-transparent text-right text-sm font-bold text-editor-strong outline-none"
        min={MIN_PATTERN_SIDE}
        max={MAX_PATTERN_SIDE}
        type="text"
        inputMode="numeric"
        maxLength={3}
        value={draft ?? String(value)}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '').slice(0, 3)
          setDraft(next)
          if (next !== '') onChange(Number(next))
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </label>
  )
}
