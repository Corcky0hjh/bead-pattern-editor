import type { ComponentType, ReactNode } from 'react'
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
  vertical?: boolean
  onClick: () => void
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
      className={`group relative shrink-0 ${
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
              ? `inset-x-0 bottom-0 h-7 rounded-b-2xl px-1 pt-3 ${
                  hasPresetValue ? 'grid-cols-2' : 'place-items-center'
                }`
              : `inset-y-0 right-0 w-7 rounded-r-2xl pl-3 pr-0.5 ${
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
        className={`pointer-events-none absolute left-0 top-0 z-10 grid h-10 w-10 place-items-center rounded-2xl border border-transparent text-sm font-bold transition duration-150 group-hover:border-editor-accent/25 group-active:scale-95 ${
          active || statusActive
            ? 'bg-editor-accent text-white shadow-sm'
            : 'bg-editor-surface-soft text-editor-strong group-hover:bg-editor-elevated'
        }`}
      >
        <Icon size={18} weight="regular" />

        {colorIndicator ? (
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-full border border-white/85 shadow-[0_2px_6px_rgba(10,8,6,0.55),0_0_0_1px_rgba(31,24,18,0.18)]"
            style={{ backgroundColor: colorIndicator }}
          />
        ) : null}

      </span>
    </button>
  )
}
