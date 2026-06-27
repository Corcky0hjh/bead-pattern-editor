import { useMemo, useState, type CSSProperties } from 'react'
import {
  brands,
  findNearestBeadColors,
  getDisplayCode,
  groupColorsForBrand,
  type BeadColor,
  type BrandId,
} from '../../../core/color'
import { ColorPickerPopover } from '../../../components/ColorPickerPopover'
import type { EditorStateController } from '../useEditorState'

type ColorPanelProps = {
  editor: EditorStateController
}

export function ColorPanel({ editor }: ColorPanelProps) {
  const [paletteModalOpen, setPaletteModalOpen] = useState(false)
  const currentSuggestions = findNearestBeadColors(
    editor.currentColor,
    editor.availablePalette,
    6,
  )
  const sourceSuggestions = findNearestBeadColors(
    editor.replaceSourceColor,
    editor.availablePalette,
    6,
  )
  const currentInPalette = editor.palette.some(
    (item) => item.hex.toLowerCase() === editor.currentColor.toLowerCase(),
  )
  const stubBrand = !editor.brand.available

  return (
    <div className="grid gap-4">
      <BrandPicker
        currentBrand={editor.currentBrand}
        onChange={editor.setCurrentBrand}
      />

      {stubBrand ? (
        <p className="rounded-2xl bg-editor-surface-soft px-3 py-2 text-[11px] leading-5 text-editor-text">
          {editor.brand.shortLabel} 色卡数据待录入，先用 MARD 5mm 上手。
          自定义色仍可用。
        </p>
      ) : null}

      <section className="rounded-2xl bg-editor-surface-soft px-3 py-2">
        <div className="flex items-center gap-3">
          <ColorPickerPopover
            ariaLabel="当前颜色"
            color={editor.currentColor}
            onPreview={(value) => editor.previewCurrentColor(value)}
            onCommit={(value) => editor.updateCurrentColor(value)}
            suggestions={currentSuggestions}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-editor-text">当前颜色</p>
            <p className="font-mono text-sm font-black text-editor-strong">
              {editor.currentColor}
            </p>
          </div>
          <button
            className="shrink-0 rounded-full bg-editor-elevated px-3 py-1.5 text-[11px] font-bold text-editor-strong disabled:opacity-40"
            type="button"
            disabled={currentInPalette}
            onClick={editor.addCurrentColorToPalette}
          >
            {currentInPalette ? '已存' : '存入色板'}
          </button>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl bg-editor-surface-soft p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="block text-xs font-bold text-editor-text">
              可用色卡 · {editor.brand.shortLabel}
            </span>
            <span className="mt-1 block text-[11px] leading-4 text-editor-text/75">
              {editor.availablePalette.length} / {editor.palette.length}{' '}
              色可用于转图
              {editor.excludedColorHexes.size > 0
                ? ` · 已排除 ${editor.excludedColorHexes.size} 色`
                : ''}
            </span>
          </div>
          <button
            className="shrink-0 rounded-full bg-editor-accent px-3 py-1.5 text-xs font-black text-white"
            type="button"
            onClick={() => setPaletteModalOpen(true)}
          >
            管理
          </button>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-editor-text">选择豆色</span>
          <span className="rounded-full bg-editor-surface-soft px-2 py-1 text-[11px] font-bold text-editor-text">
            {editor.availablePalette.length} 色
          </span>
        </div>
        {editor.availablePalette.length > 0 ? (
          <div className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-2 overflow-auto rounded-3xl bg-editor-surface-soft p-2">
            {editor.availablePalette.map((color) => (
              <BeadColorPickCell
                key={color.hex}
                color={color}
                brand={editor.currentBrand}
                selected={
                  color.hex.toLowerCase() === editor.currentColor.toLowerCase()
                }
                onClick={() => editor.updateCurrentColor(color.hex)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-3xl bg-editor-surface-soft px-3 py-3 text-xs leading-5 text-editor-text">
            当前没有可选豆色
          </p>
        )}
      </section>

      <section className="grid gap-3">
        <span className="text-xs font-bold text-editor-text">最近用过</span>
        <div className="grid grid-cols-8 gap-2">
          {editor.recentColors.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              label={`选择 ${color}`}
              selected={editor.currentColor === color}
              small
              onClick={() => editor.updateCurrentColor(color)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-2">
        <span className="text-xs font-bold text-editor-text">批量换色</span>
        <div className="flex items-center gap-2 rounded-2xl bg-editor-surface-soft px-3 py-2">
          <ColorPickerPopover
            ariaLabel="源颜色"
            color={editor.replaceSourceColor}
            onCommit={(value) =>
              editor.setReplaceSourceColor(value.toLowerCase())
            }
            suggestions={sourceSuggestions}
            size="sm"
          />
          <span className="font-mono text-[11px] font-bold text-editor-strong">
            {editor.replaceSourceColor}
          </span>
          <span className="text-sm font-black text-editor-text">→</span>
          <span
            className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow-sm outline outline-1 outline-editor-border"
            style={{ backgroundColor: editor.currentColor }}
            aria-label="当前颜色"
          />
          <span className="font-mono text-[11px] font-bold text-editor-strong">
            {editor.currentColor}
          </span>
          <button
            className="ml-auto shrink-0 rounded-full bg-editor-accent px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-40"
            type="button"
            disabled={editor.replaceSourceColor === editor.currentColor}
            onClick={editor.replaceColor}
          >
            换色
          </button>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-editor-text">用色统计</span>
          <span className="rounded-full bg-editor-surface-soft px-2 py-1 text-[11px] font-bold text-editor-text">
            共 {editor.colorStats.length} 色
          </span>
        </div>
        {editor.colorStats.length > 0 ? (
          <div className="grid max-h-72 gap-2 overflow-auto rounded-3xl bg-editor-surface-soft p-2">
            {editor.colorStats.map((item) => (
              <UsedColorRow
                key={item.color}
                color={item.color}
                code={item.code}
                count={item.count}
                selected={editor.currentColor === item.color}
                sourceSelected={editor.replaceSourceColor === item.color}
                onPickCurrent={() => editor.updateCurrentColor(item.color)}
                onPickSource={() => editor.setReplaceSourceColor(item.color)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-3xl bg-editor-surface-soft px-3 py-3 text-xs leading-5 text-editor-text">
            还没用过颜色
          </p>
        )}
      </section>

      {paletteModalOpen ? (
        <PaletteManagerModal
          editor={editor}
          onClose={() => setPaletteModalOpen(false)}
        />
      ) : null}
    </div>
  )
}

export function BrandPicker({
  currentBrand,
  onChange,
}: {
  currentBrand: BrandId
  onChange: (brand: BrandId) => void
}) {
  return (
    <section className="grid gap-2">
      <span className="text-xs font-bold text-editor-text">色卡</span>
      <div className="flex flex-wrap gap-1.5">
        {brands.map((b) => {
          const active = b.id === currentBrand
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onChange(b.id)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                active
                  ? 'bg-editor-accent text-white'
                  : b.available
                    ? 'bg-editor-surface-soft text-editor-text hover:text-editor-strong'
                    : 'bg-editor-surface-soft text-editor-text/50'
              }`}
              title={b.available ? b.label : `${b.label}（数据待录入）`}
            >
              {b.shortLabel}
              {!b.available ? ' ·待录' : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function PaletteManagerModal({
  editor,
  onClose,
}: {
  editor: EditorStateController
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const filteredPalette = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return editor.palette
    return editor.palette.filter((color) => {
      const code = getDisplayCode(color, editor.currentBrand)
      return [code, color.hex, color.nameZh, color.nameEn]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q))
    })
  }, [editor.currentBrand, editor.palette, query])
  const grouped = useMemo(
    () => groupColorsForBrand(filteredPalette, editor.brand),
    [editor.brand, filteredPalette],
  )

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-editor-strong/28 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="色卡管理"
    >
      <div className="grid max-h-[min(760px,92svh)] w-full max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-[28px] border border-editor-border bg-editor-surface shadow-[0_24px_80px_rgba(31,24,18,0.26)]">
        <header className="flex items-start justify-between gap-4 border-b border-editor-border px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-editor-strong">色卡管理</h2>
            <p className="mt-1 text-xs leading-5 text-editor-text">
              已启用 {editor.availablePalette.length} / {editor.palette.length}{' '}
              色。 图片转换只会使用启用且未排除的颜色。
            </p>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-full bg-editor-surface-soft text-lg font-black text-editor-strong"
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        <div className="grid gap-3 border-b border-editor-border px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <input
            className="h-11 rounded-2xl border border-editor-border bg-editor-elevated/70 px-3 text-sm font-bold text-editor-strong outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索色号、hex 或名称"
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full bg-editor-accent px-3 py-2 text-xs font-black text-white"
              type="button"
              onClick={() => editor.setAllPaletteColorsEnabled(true)}
            >
              全选
            </button>
            <button
              className="rounded-full bg-editor-surface-soft px-3 py-2 text-xs font-black text-editor-strong"
              type="button"
              onClick={() => editor.setAllPaletteColorsEnabled(false)}
            >
              全不选
            </button>
            <button
              className="rounded-full bg-editor-surface-soft px-3 py-2 text-xs font-black text-editor-strong"
              type="button"
              onClick={editor.resetPaletteSelection}
            >
              恢复默认
            </button>
          </div>
        </div>

        <div className="overflow-auto px-5 py-4">
          {[...grouped.entries()].map(([group, colors]) => {
            const enabledCount = colors.filter(
              (color) =>
                !editor.disabledPaletteHexes.has(color.hex.toLowerCase()),
            ).length
            const allEnabled = enabledCount === colors.length

            return (
              <section key={group} className="mb-6 grid gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-black tracking-[0.08em] text-editor-text uppercase">
                      {group}
                    </h3>
                    <p className="mt-0.5 text-[11px] font-bold text-editor-text/70">
                      已启用 {enabledCount} / {colors.length}
                    </p>
                  </div>
                  <button
                    className="rounded-full bg-editor-surface-soft px-3 py-1.5 text-[11px] font-black text-editor-text transition hover:bg-editor-elevated hover:text-editor-strong active:scale-95"
                    type="button"
                    onClick={() => {
                      colors.forEach((color) =>
                        editor.setPaletteColorEnabled(color.hex, !allEnabled),
                      )
                    }}
                  >
                    {allEnabled ? '关闭本组' : '启用本组'}
                  </button>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(66px,1fr))] gap-x-2 gap-y-2.5">
                  {colors.map((color) => {
                    const enabled = !editor.disabledPaletteHexes.has(
                      color.hex.toLowerCase(),
                    )
                    return (
                      <PaletteColorCell
                        key={color.hex}
                        brand={editor.currentBrand}
                        color={color}
                        enabled={enabled}
                        onClick={() =>
                          editor.setPaletteColorEnabled(color.hex, !enabled)
                        }
                      />
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PaletteColorCell({
  brand,
  color,
  enabled,
  onClick,
}: {
  brand: BrandId
  color: BeadColor
  enabled: boolean
  onClick: () => void
}) {
  const code = getDisplayCode(color, brand) ?? '自定'
  const label = getColorLabel(color, brand)
  const textColor = getReadableTextColor(color.hex)

  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={`${enabled ? '停用' : '启用'} ${label}`}
      className={`palette-color-cell group relative grid min-h-[66px] w-full overflow-visible rounded-xl px-0.5 py-0 text-left transition duration-200 ease-out active:scale-[0.98] ${
        enabled ? 'text-editor-strong' : 'text-editor-text/55'
      }`}
      style={{ '--swatch': color.hex } as CSSProperties}
      title={label}
      onClick={onClick}
    >
      <span className="palette-color-cell__stack pointer-events-none relative h-11">
        <span
          className="palette-color-cell__back absolute left-1/2 top-1 h-8 w-11 rounded-xl border border-white/70 shadow-sm"
          style={{ backgroundColor: color.hex }}
        />
        <span
          className={`palette-color-cell__front absolute left-1/2 top-0 grid h-9 w-12 overflow-hidden rounded-xl border border-white/75 px-1.5 py-1 shadow-sm transition duration-200 ${
            enabled ? '' : 'grayscale'
          }`}
          style={{ backgroundColor: color.hex, color: textColor }}
        >
          <span className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
            <span className="absolute -inset-y-8 -left-10 w-8 rotate-12 bg-white/45 blur-md transition-transform duration-500 group-hover:translate-x-28" />
          </span>
          <span className="relative z-10 mt-auto truncate text-center font-mono text-[10px] font-black leading-none">
            {code}
          </span>
        </span>
      </span>
      <span className="pointer-events-none min-w-0 truncate text-center font-mono text-[8.5px] font-bold leading-3 opacity-70">
        {color.hex}
      </span>
      <span
        className="pointer-events-none mx-auto mt-0.5 h-0.5 w-9 rounded-full"
        style={{ backgroundColor: color.hex }}
      />
    </button>
  )
}

function BeadColorPickCell({
  brand,
  color,
  selected,
  onClick,
}: {
  brand: BrandId
  color: BeadColor
  selected: boolean
  onClick: () => void
}) {
  const label = getColorLabel(color, brand)
  const code = getDisplayCode(color, brand)

  return (
    <button
      type="button"
      aria-label={`选择 ${label}`}
      aria-pressed={selected}
      className={`group grid min-w-0 justify-items-center gap-1 rounded-2xl px-1 py-1 transition active:scale-95 ${
        selected
          ? 'bg-editor-elevated text-editor-strong shadow-sm'
          : 'text-editor-text hover:bg-editor-elevated/55'
      }`}
      title={label}
      onClick={onClick}
    >
      <span
        className={`relative h-7 w-7 rounded-full border-2 border-white shadow-sm outline transition ${
          selected
            ? 'outline-2 outline-editor-accent'
            : 'outline-1 outline-editor-border group-hover:outline-editor-accent/35'
        }`}
        style={{ backgroundColor: color.hex }}
      >
        <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white/45" />
      </span>
      <span className="w-full truncate text-center font-mono text-[8px] font-black leading-3">
        {code ?? color.hex.slice(1)}
      </span>
    </button>
  )
}

function ColorSwatch({
  color,
  label,
  selected,
  small = false,
  onClick,
}: {
  color: string
  label: string
  selected: boolean
  small?: boolean
  onClick: () => void
}) {
  return (
    <div className="grid justify-items-center gap-1">
      <button
        aria-label={label}
        className={`aspect-square w-full rounded-full border-2 border-white outline transition ${
          small ? 'max-w-8' : 'max-w-10'
        } ${
          selected
            ? 'outline-2 outline-editor-accent'
            : 'outline-1 outline-editor-border'
        }`}
        style={{ backgroundColor: color }}
        type="button"
        onClick={onClick}
        title={label}
      />
    </div>
  )
}

function UsedColorRow({
  color,
  code,
  count,
  selected,
  sourceSelected,
  onPickCurrent,
  onPickSource,
}: {
  color: string
  code: string | null
  count: number
  selected: boolean
  sourceSelected: boolean
  onPickCurrent: () => void
  onPickSource: () => void
}) {
  return (
    <div
      className={`grid gap-2 rounded-2xl px-2 py-2 text-xs transition ${
        selected
          ? 'bg-editor-elevated text-editor-strong shadow-sm'
          : 'text-editor-text hover:bg-editor-elevated/60'
      }`}
    >
      <button
        className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-2 text-left"
        type="button"
        onClick={onPickCurrent}
      >
        <span
          className="h-7 w-7 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: color }}
        />
        <span className="min-w-0">
          {code ? (
            <span className="block truncate font-mono text-[11px] font-black text-editor-strong">
              {code}
            </span>
          ) : null}
          <span className="block truncate font-mono text-[10px] font-bold opacity-70">
            {color}
          </span>
        </span>
        <strong className="rounded-full bg-editor-surface px-2 py-1 text-editor-strong">
          {count}
        </strong>
      </button>
      <div className="flex gap-2">
        <button
          className={`flex-1 rounded-full px-2 py-1 text-[11px] font-black ${
            sourceSelected
              ? 'bg-editor-accent text-white'
              : 'bg-editor-elevated/80 text-editor-strong'
          }`}
          type="button"
          onClick={onPickSource}
        >
          作为源色
        </button>
      </div>
    </div>
  )
}

function getColorLabel(color: BeadColor, brand: BrandId): string {
  return (
    getDisplayCode(color, brand) ?? color.nameZh ?? color.nameEn ?? color.hex
  )
}

function getReadableTextColor(hex: string): '#1f1812' | '#fffaf2' {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000

  return luminance > 150 ? '#1f1812' : '#fffaf2'
}

export type { BeadColor }
