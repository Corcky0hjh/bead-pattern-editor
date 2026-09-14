import { createPortal } from 'react-dom'
import { Check } from '@phosphor-icons/react'
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
// 不打算覆盖的能力:搜索过滤、虚拟滚动。需要时再升级。
import {
  useCallback,
  useLayoutEffect,
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
  selectedValues?: V[]
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
  selectedValues,
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

  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const button = buttonRef.current, list = listRef.current
      if (!button || !list) return
      const r = button.getBoundingClientRect(), v = window.visualViewport
      const left = (v?.offsetLeft ?? 0) + 8, top = (v?.offsetTop ?? 0) + 8
      const right = left + (v?.width ?? innerWidth) - 16, bottom = top + (v?.height ?? innerHeight) - 16
      const below = bottom - r.bottom - 4, above = r.top - top - 4
      const up = below < Math.min(288, list.scrollHeight) && above > below
      list.style.width = Math.min(r.width, right-left) + 'px'
      list.style.maxHeight = Math.max(40, Math.min(288, up ? above : below)) + 'px'
      list.style.left = Math.max(left, Math.min(r.left, right-list.offsetWidth)) + 'px'
      list.style.top = (up ? r.top - list.offsetHeight - 4 : r.bottom + 4) + 'px'
    }
    position()
    const observer = new ResizeObserver(position)
    if (buttonRef.current) observer.observe(buttonRef.current)
    if (listRef.current) observer.observe(listRef.current)
    window.addEventListener('resize',position)
    window.addEventListener('scroll',position,true)
    window.visualViewport?.addEventListener('resize',position)
    return () => { observer.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);window.visualViewport?.removeEventListener('resize',position) }
  }, [open])

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  )
  const selectedOptions = selectedValues ? options.filter(option => selectedValues.includes(option.value)) : []

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
      if (!selectedValues) { setOpen(false); buttonRef.current?.focus() }
    },
    [onChange, selectedValues],
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
    if (event.key === 'Tab') { setOpen(false); buttonRef.current?.focus(); return }
    if (event.key === 'Escape') {
      event.stopPropagation()
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
        <span className="min-w-0 flex-1 truncate text-left" title={selectedValues ? selectedOptions.map(option => option.label).join('、') : undefined}>
          {selectedValues ? selectedOptions[0]?.label || placeholder : selected ? selected.label : placeholder}
        </span>
        {selectedValues && selectedOptions.length > 1 ? <span className="shrink-0 rounded-md bg-editor-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-editor-accent">+{selectedOptions.length - 1}</span> : null}
        <ChevronDown open={open} />
      </button>
      {open ? createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-multiselectable={selectedValues ? true : undefined}
          aria-label={ariaLabel}
          onMouseDown={event=>event.stopPropagation()}
          onPointerDown={event=>event.stopPropagation()}
          tabIndex={-1}
          aria-activedescendant={
            focusIndex >= 0 ? `${listId}-option-${focusIndex}` : undefined
          }
          onKeyDown={handleListKey}
          className="fixed z-[100] m-0 max-h-72 space-y-1 overflow-auto rounded-2xl border border-editor-border bg-editor-elevated p-1.5 shadow-lg outline-none"
        >
          {options.map((option, index) => {
            const active = index === focusIndex
            const selectedItem = selectedValues ? selectedValues.includes(option.value) : option.value === value
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
                className={`grid min-h-10 cursor-pointer content-center gap-0.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                  option.disabled
                    ? 'cursor-not-allowed text-editor-text/40'
                    : selectedItem
                      ? active ? 'bg-editor-accent-soft text-editor-accent' : 'text-editor-accent'
                      : active
                        ? 'bg-editor-surface-soft text-editor-strong'
                        : 'text-editor-strong'
                }`}
              >
                <span className="flex items-center justify-between gap-3 font-medium"><span className="min-w-0">{option.label}</span>{selectedValues ? <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selectedItem ? 'border-editor-accent bg-editor-accent text-white' : 'border-editor-border'}`}>{selectedItem ? <Check size={11} weight="bold"/> : null}</span> : selectedItem ? <Check size={15} className="shrink-0" aria-hidden="true"/> : null}</span>
                {option.hint ? (
                  <span
                    className={`text-[11px] leading-4 ${
                      selectedItem ? 'text-editor-accent/80' : 'text-editor-text/70'
                    }`}
                  >
                    {option.hint}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>, document.body
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
