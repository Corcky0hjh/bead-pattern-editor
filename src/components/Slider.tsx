// 通用滑块组件。统一 5 处 input[type=range] 的视觉与交互。
//
// 设计要点:
// - 渐变 track:已选段用 accent 色,未选段用浅色
// - 大 thumb + shadow,hover 放大,active 收缩(物理感)
// - 数值变化时数字部分有 fade-in scale 微动画
// - disabled 灰显,不可拖
// - sm/md 两档尺寸
//
// 实现:用 <input type="range"> 不重新发明轮子,只给它加自定义 track/thumb 样式。
// linear-gradient 算 fillPercent → 渐变断点,实现"已选段着色"效果。
import { useEffect, useId, useRef, useState } from 'react'

type SliderProps = {
  /** 顶部主标签 */
  label: string
  /** 右上角小灰字提示(可选) */
  hint?: string
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  step?: number
  /** 自定义数值显示文本;默认 String(value) */
  formatValue?: (value: number) => string
  disabled?: boolean
  /** sm = 紧凑(画布工具栏),md = 标准(设置面板) */
  size?: 'sm' | 'md'
  /** 不渲染标签与数值,只渲染裸滑轨。用于已有自定义 label 行的场景 */
  bare?: boolean
}

export function Slider({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  formatValue,
  disabled = false,
  size = 'md',
  bare = false,
}: SliderProps) {
  const id = useId()
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0
  const ratio = percent / 100
  const display = formatValue ? formatValue(value) : String(value)

  // 楔形 track:整段一个完整圆角胶囊路径(两端真半圆),用 clipPath 切出 filled 段。
  //
  // 关键:必须用真实像素宽度作 viewBox,不能用 100×12 + preserveAspectRatio=none
  // —— 否则水平拉伸时半圆 arc 跟着拉成超扁椭圆,小半径下视觉就是直角。
  // ResizeObserver 监听容器宽度,实时更新 viewBox/path 像素坐标。
  const wrapperRef = useRef<HTMLSpanElement | null>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setTrackWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const wedgeMaxH = size === 'sm' ? 8 : 10
  const wedgeMinH = 2
  const W = Math.max(trackWidth, 1) // 像素宽
  const H = wedgeMaxH + 4 // 像素高,留 thumb 余量
  const cy = H / 2
  const rRight = wedgeMaxH / 2
  const rLeft = wedgeMinH / 2

  // 整段闭合 path,坐标都是真实像素 → arc 不会被拉变形。
  // 关键:半圆必须拆成两个四分之一弧,否则当起终点 x 相同时 SVG arc 退化成直线。
  const fullPath = [
    // 左端两段四分之一弧:从 (rLeft, cy-rLeft) → (0, cy) → (rLeft, cy+rLeft)
    `M ${rLeft} ${cy - rLeft}`,
    `A ${rLeft} ${rLeft} 0 0 0 0 ${cy}`,
    `A ${rLeft} ${rLeft} 0 0 0 ${rLeft} ${cy + rLeft}`,
    // 楔形下沿
    `L ${W - rRight} ${cy + rRight}`,
    // 右端两段四分之一弧:从 (W-rRight, cy+rRight) → (W, cy) → (W-rRight, cy-rRight)
    `A ${rRight} ${rRight} 0 0 0 ${W} ${cy}`,
    `A ${rRight} ${rRight} 0 0 0 ${W - rRight} ${cy - rRight}`,
    // 楔形上沿回到起点
    'Z',
  ].join(' ')

  const clipId = `bead-slider-clip-${id.replace(/:/g, '')}`
  // filled 跟原生 thumb 几何对齐:thumb 在 input 内左右各留 thumbHalf 像素
  // 基础 thumb 直径 14(sm 11),scale 后 thumbScale 倍
  const thumbBase = size === 'sm' ? 11 : 14
  const thumbScale = 0.85 + ratio * 0.25
  const thumbHalfPx = (thumbBase * thumbScale) / 2
  const fillRight = thumbHalfPx + ratio * Math.max(0, W - 2 * thumbHalfPx)

  const wedge = (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2"
      style={{ width: '100%', height: H }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={fillRight} height={H} />
        </clipPath>
      </defs>
      <path d={fullPath} fill="rgba(102, 95, 86, 0.22)" />
      <path
        d={fullPath}
        fill="var(--color-editor-accent)"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  )

  const input = (
    <span ref={wrapperRef} className="relative block h-5 w-full">
      {wedge}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`bead-slider bead-slider--wedge ${size === 'sm' ? 'bead-slider--sm' : ''} ${
          disabled ? 'opacity-40' : ''
        }`}
        style={{ ['--thumb-scale' as string]: thumbScale }}
      />
    </span>
  )

  if (bare) return input

  return (
    <label htmlFor={id} className={`grid gap-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <span className="flex items-center justify-between text-xs font-bold text-editor-text">
        <span>{label}</span>
        <span className="flex items-center gap-2">
          {hint ? (
            <span className="text-[10px] font-normal opacity-70">{hint}</span>
          ) : null}
          <span
            key={display}
            className="bead-slider-value font-mono text-[12px] font-black text-editor-strong"
          >
            {display}
          </span>
        </span>
      </span>
      {input}
    </label>
  )
}
