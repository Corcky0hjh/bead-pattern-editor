// 自定义取色器弹层,替代 <input type="color">。
//
// 结构(与主流 picker 一致):
//   ┌─────────────────┐
//   │   SV 方块       │   ← 拖动选 (Saturation, Value),背景是当前 Hue
//   └─────────────────┘
//   ━━━━━━━━━━━━━━━━━━   ← Hue 色相条,拖动选 H(0~360°)
//   [HEX: ff7a59]
//   ┌─色板里相近的色号─┐
//   │ ⚪ A12  ⚪ A13 ...│   ← 点击直接吸附到品牌色号
//   └──────────────────┘
//
// API 设计要点:
// - 拖动过程中频率极高(60Hz+),如果直接调 onChange 会让父组件 recent 列表爆炸
// - 所以拆 onPreview(高频,父可以用来实时刷画布显示但不要记 recent)
//   + onCommit(低频,pointerup / hex 输入 / 点 suggestion 才触发,父此时记 recent)
// - 内部用 draft state 维护"当前正在拖动的颜色",popover 内的 UI 全部用 draft
//   渲染,跟外部 color prop 解耦
import { useEffect, useRef, useState } from 'react'
import type { NearestBeadColor } from '../core/color'

type ColorPickerPopoverProps = {
  /** 当前颜色,小写 hex 带 #(打开 popover 时作为 draft 初值) */
  color: string
  /** 用户确认一个新颜色(拖动结束 / hex 输入 / 点 suggestion)。父此时可以记 recent */
  onCommit: (hex: string) => void
  /** 拖动过程的实时预览,高频。可选;父若实现要保证不记 recent / 不打入历史 */
  onPreview?: (hex: string) => void
  /** 底部相近色号建议(由父用 findNearestBeadColors 算出);点击 = commit 并展示色号 */
  suggestions?: NearestBeadColor[]
  /** 触发按钮的尺寸 */
  size?: 'sm' | 'md'
  ariaLabel?: string
}

export function ColorPickerPopover({
  color,
  onCommit,
  onPreview,
  suggestions,
  size = 'md',
  ariaLabel,
}: ColorPickerPopoverProps) {
  const [open, setOpen] = useState(false)
  // 拖动过程中的草稿色;打开时初始化为外部 color
  const [draft, setDraft] = useState(color)
  const [hexDraft, setHexDraft] = useState(color)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const hsv = hexToHsv(draft)

  function openPopover() {
    setDraft(color)
    setHexDraft(color)
    setOpen(true)
  }

  function preview(nextHex: string) {
    setDraft(nextHex)
    setHexDraft(nextHex)
    onPreview?.(nextHex)
  }

  function commit(nextHex: string) {
    setDraft(nextHex)
    setHexDraft(nextHex)
    onCommit(nextHex)
  }

  // 点外关闭(关闭时若 draft 与外部 color 不同,提交一次)
  useEffect(() => {
    if (!open) return
    function onDown(event: MouseEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (buttonRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const sizeClass = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11'

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel ?? '选择颜色'}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPopover())}
        className={`${sizeClass} shrink-0 cursor-pointer rounded-full border-2 border-white shadow-sm outline outline-1 outline-editor-border`}
        style={{ backgroundColor: color }}
        title={ariaLabel ?? color}
      />
      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={ariaLabel ?? '颜色选择器'}
          className="absolute left-0 top-[calc(100%+6px)] z-40 w-64 space-y-3 rounded-2xl border border-editor-border bg-editor-elevated p-3 shadow-xl"
        >
          <SvSquare
            hue={hsv.h}
            s={hsv.s}
            v={hsv.v}
            onPreview={(s, v) => preview(hsvToHex(hsv.h, s, v))}
            onCommit={(s, v) => commit(hsvToHex(hsv.h, s, v))}
          />
          <HueBar
            hue={hsv.h}
            onPreview={(h) => preview(hsvToHex(h, hsv.s, hsv.v))}
            onCommit={(h) => commit(hsvToHex(h, hsv.s, hsv.v))}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-editor-text">HEX</span>
            <input
              type="text"
              value={hexDraft}
              onChange={(event) => {
                const raw = event.target.value
                setHexDraft(raw)
                const normalized = normalizeHex(raw)
                if (normalized) {
                  setDraft(normalized)
                  onPreview?.(normalized)
                }
              }}
              onBlur={() => {
                const normalized = normalizeHex(hexDraft)
                if (normalized) commit(normalized)
                else setHexDraft(color) // 输入非法,回退到外部值
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  const normalized = normalizeHex(hexDraft)
                  if (normalized) commit(normalized)
                }
              }}
              className="h-7 flex-1 rounded-lg border border-editor-border bg-editor-elevated px-2 font-mono text-xs font-bold text-editor-strong outline-none"
              maxLength={7}
              spellCheck={false}
            />
          </div>
          {suggestions && suggestions.length > 0 ? (
            <Suggestions
              items={suggestions}
              currentHex={draft}
              onPick={(hex) => commit(hex)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// --- 相近色号建议 ---

function Suggestions({
  items,
  currentHex,
  onPick,
}: {
  items: NearestBeadColor[]
  currentHex: string
  onPick: (hex: string) => void
}) {
  return (
    <div className="grid gap-1.5 rounded-xl bg-editor-surface-soft p-2">
      <span className="text-[10px] font-bold text-editor-text">
        色板里最像的色号
      </span>
      <div className="grid grid-cols-6 gap-1">
        {items.map(({ color, distance }) => {
          const code =
            color.codes.mard ??
            color.codes['artkal-c'] ??
            color.codes['hama-midi'] ??
            color.codes.perler ??
            ''
          const selected = color.hex.toLowerCase() === currentHex.toLowerCase()
          return (
            <button
              key={color.hex}
              type="button"
              onClick={() => onPick(color.hex)}
              title={`${code || color.hex}  ·  Δ${distance.toFixed(1)}`}
              className={`grid justify-items-center gap-0.5 rounded-lg p-1 transition ${
                selected ? 'bg-editor-elevated shadow-sm' : 'hover:bg-editor-elevated/60'
              }`}
            >
              <span
                className="h-6 w-6 rounded-full border-2 border-white outline outline-1 outline-editor-border"
                style={{ backgroundColor: color.hex }}
              />
              {code ? (
                <span className="font-mono text-[9px] font-bold text-editor-text">
                  {code}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- SV 方块 ---

function SvSquare({
  hue,
  s,
  v,
  onPreview,
  onCommit,
}: {
  hue: number
  s: number
  v: number
  onPreview: (s: number, v: number) => void
  onCommit: (s: number, v: number) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const latestRef = useRef({ s, v })

  function calc(event: PointerEvent | React.PointerEvent) {
    const el = ref.current
    if (!el) return latestRef.current
    const rect = el.getBoundingClientRect()
    const nx = clamp01((event.clientX - rect.left) / rect.width)
    const ny = clamp01((event.clientY - rect.top) / rect.height)
    return { s: nx, v: 1 - ny }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const el = ref.current
    if (!el) return
    el.setPointerCapture(event.pointerId)
    const initial = calc(event)
    latestRef.current = initial
    onPreview(initial.s, initial.v)

    function onMove(e: PointerEvent) {
      const next = calc(e)
      latestRef.current = next
      onPreview(next.s, next.v)
    }
    function onUp(e: PointerEvent) {
      el?.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      onCommit(latestRef.current.s, latestRef.current.v)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className="relative h-32 w-full cursor-crosshair select-none touch-none overflow-hidden rounded-lg"
      style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))',
        }}
      />
      <div
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{
          left: `${s * 100}%`,
          top: `${(1 - v) * 100}%`,
          backgroundColor: hsvToHex(hue, s, v),
        }}
      />
    </div>
  )
}

// --- Hue 色相条 ---

function HueBar({
  hue,
  onPreview,
  onCommit,
}: {
  hue: number
  onPreview: (h: number) => void
  onCommit: (h: number) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const latestRef = useRef(hue)

  function calc(event: PointerEvent | React.PointerEvent) {
    const el = ref.current
    if (!el) return latestRef.current
    const rect = el.getBoundingClientRect()
    const nx = clamp01((event.clientX - rect.left) / rect.width)
    return nx * 360
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const el = ref.current
    if (!el) return
    el.setPointerCapture(event.pointerId)
    const initial = calc(event)
    latestRef.current = initial
    onPreview(initial)

    function onMove(e: PointerEvent) {
      const next = calc(e)
      latestRef.current = next
      onPreview(next)
    }
    function onUp(e: PointerEvent) {
      el?.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      onCommit(latestRef.current)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className="relative h-3 w-full cursor-crosshair select-none touch-none rounded-full"
      style={{
        background:
          'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{
          left: `${(hue / 360) * 100}%`,
          backgroundColor: `hsl(${hue}, 100%, 50%)`,
        }}
      />
    </div>
  )
}

// --- 色彩工具 ---

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** "#ff7a59" / "ff7a59" / "#f00" / "f00" → 标准 "#ff7a59",失败返回 null */
function normalizeHex(raw: string): string | null {
  let s = raw.trim().toLowerCase()
  if (s.startsWith('#')) s = s.slice(1)
  if (/^[0-9a-f]{3}$/.test(s)) {
    s = s
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`
  return null
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const normalized = normalizeHex(hex) ?? '#000000'
  const r = parseInt(normalized.slice(1, 3), 16) / 255
  const g = parseInt(normalized.slice(3, 5), 16) / 255
  const b = parseInt(normalized.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : delta / max
  return { h, s, v: max }
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0,
    g = 0,
    b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const toByte = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`
}
