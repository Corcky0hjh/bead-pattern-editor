import type { CSSProperties } from 'react'
import { getDisplayCode, type BrandId, type BeadColor } from '../core/color'

export function PaletteColorCell({
  brand,
  color,
  enabled,
  onClick,
  selected,
  actionLabel,
}: {
  brand: BrandId
  color: BeadColor
  enabled: boolean
  selected?: boolean
  actionLabel?: string
  onClick: () => void
}) {
  const code = color.nameZh || color.nameEn || getDisplayCode(color, brand) || '待命名'
  const label = color.nameZh || color.nameEn || getDisplayCode(color, brand) || color.hex
  const textColor = getReadableTextColor(color.hex)

  return (
    <button
      type="button"
      aria-pressed={selected ?? enabled}
      data-enabled={enabled}
      aria-label={actionLabel ?? `${enabled ? '停用' : '启用'} ${label}`}
      className={`palette-color-cell group relative grid min-h-[66px] w-full overflow-visible rounded-xl px-0.5 py-0 text-left transition duration-200 ease-out active:scale-[0.98] ${
        selected ? 'text-editor-accent' : enabled ? 'text-editor-strong' : 'text-editor-text/55'
      }`}
      style={{ '--swatch': color.hex } as CSSProperties}
      title={label}
      onClick={onClick}
    >
      {selected ? <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] rounded-xl bg-editor-accent-soft" /> : null}
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
      <span className="pointer-events-none relative min-w-0 truncate text-center font-mono text-[8.5px] font-bold leading-3 opacity-70">
        {color.hex}
      </span>
      <span
        className={`pointer-events-none relative mx-auto mt-0.5 h-0.5 w-9 rounded-full transition duration-200 ${selected ? 'scale-x-110 bg-editor-accent' : ''}`}
        style={{ backgroundColor: selected ? undefined : color.hex }}
      />
    </button>
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
