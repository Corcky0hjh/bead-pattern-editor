import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Record as BeadIcon, Stack } from '@phosphor-icons/react'
import { boxLabel } from './beadBox'
import { getDisplayCode } from '../../core/color'
import type { EditorStateController } from './useEditorState'
import { normalizeWheelDelta } from '../../platform/web/viewportCamera'

export function BeadingStepBar({ editor, tools, dragHandle, collapsed = false }: { editor: EditorStateController; tools: ReactNode; dragHandle: ReactNode; collapsed?: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const initialized = useRef(false)
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false })
  const steps = useMemo(() => editor.beadingLayers.map((layer) => {
    const color = [...editor.customPalette, ...editor.palette].find((item) => item.hex.toLowerCase() === layer.color)
    const boxed = editor.beadBox.find(item => item.hex.toLowerCase() === layer.color)
    const name = (boxed && boxLabel(boxed)) || color?.nameZh?.trim() || color?.nameEn?.trim()
      || (color && getDisplayCode(color, editor.currentBrand)) || layer.color
    const done = editor.completedBeadCountsByColor.get(layer.color) ?? 0
    return { color: layer.color, name, done, total: layer.indices.size }
  }), [editor.beadBox, editor.beadingLayers, editor.customPalette, editor.palette, editor.currentBrand, editor.completedBeadCountsByColor])
  const activeIndex = steps.findIndex((step) => step.color === editor.beadingColor)
  const current = steps[activeIndex]
  const hasCurrent = Boolean(current)

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const updateEdges = () => {
      const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
      const position = Math.max(0, Math.min(maxScroll, scroller.scrollLeft))
      // Allow for fractional CSS pixels at either boundary.
      const left = position > 1
      const right = maxScroll - position > 1
      setScrollEdges((previous) => previous.left === left && previous.right === right ? previous : { left, right })
    }
    updateEdges()
    scroller.addEventListener('scroll', updateEdges, { passive: true })
    const observer = new ResizeObserver(updateEdges)
    observer.observe(scroller)
    return () => {
      scroller.removeEventListener('scroll', updateEdges)
      observer.disconnect()
    }
  }, [steps.length, hasCurrent, editor.activeBeadingProjectId])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const panel = panelRef.current
    if (!panel) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      // Own wheel gestures across the whole panel, including at list boundaries.
      event.preventDefault()
      event.stopPropagation()
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      scroller.scrollLeft += normalizeWheelDelta(delta, event.deltaMode, scroller.clientWidth)
    }
    panel.addEventListener('wheel', onWheel, { passive: false })
    return () => panel.removeEventListener('wheel', onWheel)
  }, [hasCurrent])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const reveal = (smooth: boolean) => {
      const selected = scroller.querySelector<HTMLElement>('[aria-current="step"]')
      if (!selected) return
      const left = selected.getBoundingClientRect().left - scroller.getBoundingClientRect().left
        + scroller.scrollLeft - (scroller.clientWidth - selected.offsetWidth) / 2
      scroller.scrollTo({ left, behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' })
    }
    reveal(initialized.current)
    initialized.current = true
    let lastWidth = scroller.clientWidth
    const observer = new ResizeObserver(() => {
      if (scroller.clientWidth === lastWidth) return
      lastWidth = scroller.clientWidth
      reveal(false)
    })
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [activeIndex, editor.activeBeadingProjectId])

  if (!current) return null
  const summaryDone = editor.showingBeadingResult ? editor.completedBeadCount : current.done
  const summaryTotal = editor.showingBeadingResult ? editor.usedCount : current.total
  const edgeMask = scrollEdges.left || scrollEdges.right
    ? `linear-gradient(to right, ${scrollEdges.left ? 'transparent' : '#000'} 0, #000 24px, #000 calc(100% - 24px), ${scrollEdges.right ? 'transparent' : '#000'} 100%)`
    : undefined
  return (
    <section inert={collapsed} style={{ clipPath: collapsed ? 'inset(0 calc(100% - 44px) calc(100% - 44px) 0 round 22px)' : 'inset(0 0 0 0 round 22px)', pointerEvents: collapsed ? 'none' : 'auto' }} ref={panelRef} data-beading-step-bar aria-label="拼豆步骤进度" className="transition-[clip-path] duration-200 ease-out motion-reduce:transition-none pointer-events-auto relative z-10 select-none overflow-hidden rounded-[22px] border border-editor-border bg-editor-elevated/95 shadow-[0_6px_22px_rgba(31,24,18,0.12)] backdrop-blur-md">
      <div className={`transition-opacity duration-150 motion-reduce:transition-none ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex min-w-0 items-center justify-between gap-3 px-3 pt-1.5 pb-0.5">
        <div className="flex shrink-0 items-center gap-1">
          {dragHandle}
          {tools}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5" aria-label="当前拼豆进度">
          <div className="flex max-w-full flex-col items-end gap-0.5 text-[10px] tabular-nums text-editor-text">
            <span className="inline-flex items-center gap-1 whitespace-nowrap" title={`${editor.showingBeadingResult ? '全部' : '当前图层'}豆子进度`} aria-label={`${editor.showingBeadingResult ? '全部' : '当前图层'}已拼 ${summaryDone}，共 ${summaryTotal} 颗`}>
              <BeadIcon size={12} aria-hidden="true" /><span><span className="font-medium text-editor-strong">{summaryDone.toLocaleString()}</span><span className="opacity-60"> / {summaryTotal.toLocaleString()}</span></span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap" title="已完成图层" aria-label={`已完成 ${editor.completedBeadingLayerCount} / ${steps.length} 个图层`}>
              <Stack size={12} aria-hidden="true" /><span><span className="font-medium text-editor-strong">{editor.completedBeadingLayerCount}</span><span className="opacity-60"> / {steps.length}</span></span>
            </span>
          </div>
        </div>
      </div>
      <div className="px-1">
      <div ref={scrollerRef} style={{ maskImage: edgeMask, WebkitMaskImage: edgeMask }} className="relative flex gap-1 overflow-x-auto overscroll-x-contain px-2 pt-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [touch-action:pan-x]" role="group" aria-label="按颜色选择拼豆步骤">
        {steps.map((step, index) => {
          const selected = index === activeIndex
          const complete = step.total > 0 && step.done === step.total
          const progress = step.total ? step.done / step.total * 100 : 0
          const rgb = step.color.slice(1).match(/.{2}/g)?.map((channel) => parseInt(channel, 16)) ?? [255, 255, 255]
          const ink = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 155 ? '#292520' : '#ffffff'
          return <button key={step.color} type="button" aria-current={selected ? 'step' : undefined} aria-label={`第 ${index + 1} 步 ${step.name}，已拼 ${step.done} / ${step.total} 颗${complete ? '，已完成' : ''}`} title={`${step.name} · ${step.done} / ${step.total} 颗`} className={`group grid w-14 shrink-0 justify-items-center gap-0 rounded-xl px-1 py-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-editor-accent ${selected ? 'bg-editor-accent-soft' : 'hover:bg-editor-surface-soft'}`} onClick={() => {
            if (editor.showingBeadingResult) editor.continueBeadingAdjustment()
            editor.selectBeadingColorLayer(step.color)
          }}>
            <span className="relative grid h-10 w-10 place-items-center">
              <svg viewBox="0 0 48 48" className="absolute inset-0 h-10 w-10 -rotate-90 text-editor-accent" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2" opacity="0.14" />
                <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress} opacity={step.done ? 1 : 0} className="transition-[stroke-dashoffset] duration-200 motion-reduce:transition-none" />
              </svg>
              <span className="grid h-8 w-8 place-items-center rounded-full border border-black/5 text-xs font-bold transition-transform group-active:scale-95" style={{ backgroundColor: step.color, color: ink }}>{complete ? <Check size={17} weight="bold" aria-hidden="true" /> : index + 1}</span>
            </span>
            <span className="w-full truncate text-center text-[9px] font-medium text-editor-strong">{step.name}</span>
          </button>
        })}
      </div>
      </div>
      </div>
    </section>
  )
}
