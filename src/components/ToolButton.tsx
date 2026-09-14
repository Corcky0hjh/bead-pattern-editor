import type { ComponentType, MouseEventHandler, ReactNode } from 'react'
import type { IconProps } from '@phosphor-icons/react'

export type ToolButtonIcon = ComponentType<IconProps>

type ToolButtonProps = {
  icon: ToolButtonIcon
  label: string
  active: boolean
  statusActive?: boolean
  hasOptions?: boolean
  optionsOpen?: boolean
  presetValue?: ReactNode
  presetIcon?: ToolButtonIcon | null
  colorIndicator?: string | null
  progress?: number
  vertical?: boolean
  onClick: MouseEventHandler<HTMLButtonElement>
}

export function ToolButton({
  icon: Icon,
  label,
  active,
  statusActive = false,
  hasOptions = false,
  optionsOpen = false,
  presetValue,
  presetIcon: PresetIcon,
  colorIndicator = null,
  progress,
  vertical = false,
  onClick,
}: ToolButtonProps) {
  const hasPresetValue = presetValue !== null && presetValue !== undefined
  const hasPresetMeta = Boolean(PresetIcon)
  const title = statusActive
    ? `${label}，选区生效中`
    : active && hasOptions
      ? `${label}，再次点击调整设置`
      : label

  return (
    <button
      data-tool-button
      data-has-preset={hasPresetMeta ? 'true' : 'false'}
      aria-pressed={active}
      aria-expanded={hasOptions ? optionsOpen : undefined}
      aria-label={label}
      title={title}
      className={`group relative shrink-0 focus-visible:outline-none ${
        hasPresetMeta
          ? vertical
            ? 'h-[56px] w-10'
            : 'h-10 w-[56px]'
          : 'h-10 w-10'
      }`}
      type="button"
      onClick={onClick}
    >
      {hasPresetMeta ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute z-0 grid border transition duration-150 ${
            vertical
              ? `bottom-0 left-px h-7 w-[38px] rounded-b-2xl rounded-t-[6px] px-1 pt-3 ${
                  hasPresetValue ? 'grid-cols-2' : 'place-items-center'
                }`
              : `right-0 top-px h-[38px] w-7 rounded-l-[6px] rounded-r-2xl pl-3 pr-0.5 ${
                  hasPresetValue ? 'grid-rows-2 py-1' : 'place-items-center'
                }`
          } ${
            optionsOpen
              ? 'border-editor-accent/45 bg-editor-accent-soft text-editor-accent'
              : active || statusActive
                ? 'border-editor-accent/35 bg-editor-accent-soft text-editor-strong'
                : 'border-editor-border bg-editor-elevated text-editor-text'
          }`}
        >
          {hasPresetValue ? (
            <span className="grid place-items-center text-[9px] font-black leading-none tabular-nums">
              {presetValue}
            </span>
          ) : null}
          <span
            className={`grid place-items-center ${
              hasPresetValue
                ? vertical
                  ? 'border-l border-editor-border/70 pl-0.5'
                  : 'border-t border-editor-border/70 pt-0.5'
                : ''
            }`}
          >
            {PresetIcon ? (
              <PresetIcon size={hasPresetValue ? 9 : 12} weight="regular" />
            ) : null}
          </span>
        </span>
      ) : null}

      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 z-10 grid h-10 w-10 place-items-center text-sm font-bold ${
          active || statusActive
            ? 'text-white'
            : 'text-editor-strong'
        }`}
      >
        <span
          className={`absolute inset-0 rounded-2xl border border-transparent transition-[transform,background-color,border-color] duration-150 group-hover:border-editor-accent/25 group-active:scale-95 ${
            active || statusActive
              ? 'bg-editor-accent'
              : 'bg-editor-surface-soft group-hover:bg-editor-elevated'
          }`}
        />

        <Icon className="relative z-10" size={18} weight="regular" />
        {progress !== undefined ? (
          <svg className={`pointer-events-none absolute inset-0 h-10 w-10 -rotate-90 ${active || statusActive ? 'text-white' : 'text-editor-accent'}`} viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2" opacity="0.16" />
            <circle cx="20" cy="20" r="16" pathLength="100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="100" strokeDashoffset={100 - Math.max(0, Math.min(100, progress))} opacity={progress > 0 ? 1 : 0} className="transition-[stroke-dashoffset] duration-200 motion-reduce:transition-none" />
          </svg>
        ) : null}

        {colorIndicator ? (
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 z-20 h-2.5 w-2.5 rounded-full border border-white/85"
            style={{ backgroundColor: colorIndicator }}
          />
        ) : null}
      </span>
    </button>
  )
}
