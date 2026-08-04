// 通用下拉选择器,替代原生 <select>。
//
// 设计:
// - button 按钮显示当前选中项,点击展开 popover 列表
// - 支持键盘:Enter/Space 展开;打开后 Up/Down 移焦点,Enter 选定,Esc 关闭
// - 支持 disabled 选项(灰显且不可选)
// - 点击外部关闭(mousedown 捕获)
// - 列表 max-h 限高 + 滚动,适配 16 项以内场景
// - 视觉与现有 Tailwind 主题对齐:rounded-2xl / editor-border / editor-surface
//
// 不打算覆盖的能力:多选、搜索过滤、虚拟滚动、portal 渲染。需要时再升级。
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

export type DropdownOption<V extends string = string> = {
  value: V
  label: string
  /** 可选的副标题/描述,在列表项里小字显示 */
  hint?: string
  disabled?: boolean
}

type DropdownProps<V extends string> = {
  value: V
  options: DropdownOption<V>[]
  onChange: (value: V) => void
  /** 当前未选中时的占位文案 */
  placeholder?: string
  /** 触发按钮额外类名(覆盖默认尺寸/形状时用) */
  className?: string
  ariaLabel?: string
}

export function Dropdown<V extends string>({
  value,
  options,
  onChange,
  placeholder = '请选择',
  className,
  ariaLabel,
}: DropdownProps<V>) {
  const [open, setOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState<number>(-1)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const listId = useId()

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  )

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    function onDown(event: MouseEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (buttonRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const commit = useCallback(
    (next: V) => {
      onChange(next)
      setOpen(false)
      buttonRef.current?.focus()
    },
    [onChange],
  )

  function openMenu() {
    const initial = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    )
    setFocusIndex(initial)
    setOpen(true)
  }

  function handleButtonKey(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault()
      openMenu()
    }
  }

  function handleListKey(event: React.KeyboardEvent<HTMLUListElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusIndex((i) => nextEnabled(options, i, 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusIndex((i) => nextEnabled(options, i, -1))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const item = options[focusIndex]
      if (item && !item.disabled) commit(item.value)
    }
  }

  // 打开时把焦点移到 listbox,使键盘可立即操作(Up/Down/Enter/Esc)
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleButtonKey}
        className={
          className ??
          'flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-editor-border bg-editor-elevated/70 px-3 text-sm font-bold text-editor-strong outline-none transition hover:bg-editor-elevated'
        }
      >
        <span className="truncate text-left">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown open={open} />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={
            focusIndex >= 0 ? `${listId}-option-${focusIndex}` : undefined
          }
          onKeyDown={handleListKey}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-auto rounded-2xl border border-editor-border bg-editor-elevated p-1 shadow-lg outline-none"
        >
          {options.map((option, index) => {
            const active = index === focusIndex
            const selectedItem = option.value === value
            return (
              <li
                key={option.value}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={selectedItem}
                aria-disabled={option.disabled}
                onMouseEnter={() => setFocusIndex(index)}
                onClick={() => {
                  if (option.disabled) return
                  commit(option.value)
                }}
                className={`grid cursor-pointer gap-0.5 rounded-xl px-3 py-2 text-sm transition ${
                  option.disabled
                    ? 'cursor-not-allowed text-editor-text/40'
                    : selectedItem
                      ? 'bg-editor-accent text-white'
                      : active
                        ? 'bg-editor-surface-soft text-editor-strong'
                        : 'text-editor-strong'
                }`}
              >
                <span className="font-bold">{option.label}</span>
                {option.hint ? (
                  <span
                    className={`text-[11px] leading-4 ${
                      selectedItem ? 'text-white/80' : 'text-editor-text/70'
                    }`}
                  >
                    {option.hint}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function nextEnabled<V extends string>(
  options: DropdownOption<V>[],
  current: number,
  delta: 1 | -1,
): number {
  const n = options.length
  if (n === 0) return -1
  let i = current
  for (let step = 0; step < n; step += 1) {
    i = (i + delta + n) % n
    if (!options[i].disabled) return i
  }
  return current
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      className={`shrink-0 text-editor-text transition-transform ${
        open ? 'rotate-180' : ''
      }`}
      aria-hidden
    >
      <path
        d="M3.5 6l4.5 4.5L12.5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
