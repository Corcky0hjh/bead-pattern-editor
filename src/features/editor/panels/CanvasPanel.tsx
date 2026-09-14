import { type ReactNode } from 'react'
import { Check, GridFour, PaintBrush, Palette, ArrowCounterClockwise } from '@phosphor-icons/react'
import { MAJOR_GRID_OPTIONS } from '../../../core/canvas/settings'
import { DEFAULT_THEME_ID, THEMES } from '../../../core/theme/themes'
import { ColorPickerPopover } from '../../../components/ColorPickerPopover'
import { Dropdown } from '../../../components/Dropdown'
import { Slider } from '../../../components/Slider'
import type { EditorStateController } from '../useEditorState'

type CanvasPanelProps = {
  editor: EditorStateController
  wide?: boolean
  view?: 'all' | 'canvas' | 'theme'
}

export function CanvasPanel({ editor, view = 'all' }: CanvasPanelProps) {
  const { canvasSettings: s, updateCanvasSettings: update } = editor

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">

      {view !== 'theme' ? (
        <>
          <CanvasAppearancePreview editor={editor} />
          <SettingsSection
            icon={<PaintBrush size={19}/>}
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
              <div className="w-full max-w-64">
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

          <SettingsSection icon={<GridFour size={19}/>} title="网格" description="精细线条与分区辅助">
            <SettingRow label="显示网格">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  aria-label="显示网格"
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
              <div className="w-full max-w-64">
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
              <div className="w-full max-w-52">
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
            <SettingRow label="分区对齐">
              <div className="w-full max-w-52"><Dropdown ariaLabel="分区对齐" value={s.majorGridAlignment} onChange={value => update({ majorGridAlignment: value })} options={[{value:'origin',label:'原点对齐'},{value:'center',label:'居中对齐'}]}/></div>
            </SettingRow>
          </SettingsSection>

        </>
      ) : null}

      {view !== 'canvas' ? (
        <SettingsSection
          divided={false}
          icon={<Palette size={19}/>}
          title="界面主题"
          description="预览工作区配色，点击即可应用"
        >
          <div className="grid grid-cols-2 gap-3 p-0.5 lg:grid-cols-3">
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
                  aria-pressed={active}
                  className="relative grid gap-3 overflow-hidden rounded-2xl p-3 text-left transition hover:-translate-y-0.5 focus-visible:outline-2"
                  style={{
                    background: cardBg,
                    color: cardText,
                    outline: `${active ? 2 : 1}px solid ${
                      active ? accent : 'rgba(128,128,128,0.22)'
                    }`,
                  }}
                >
                  <span aria-hidden="true" className="block overflow-hidden rounded-xl p-2" style={{background:theme.vars['--color-editor-bg']}}>
                    <span className="mb-2 flex items-center justify-between"><span className="h-2 w-8 rounded-full" style={{background:accent}}/><span className="flex gap-1">{[0,1,2].map(i=><span key={i} className="h-1.5 w-1.5 rounded-full opacity-50" style={{background:cardText}}/>)}</span></span>
                    <span className="flex h-16 gap-2"><span className="grid w-5 content-start gap-1 rounded-lg p-1" style={{background:cardBg}}>{[0,1,2].map(i=><span key={i} className="h-2 rounded" style={{background:i===0?accent:theme.vars['--color-editor-surface-soft']}}/>)}</span><span className="grid flex-1 grid-cols-6 gap-px rounded-lg p-1.5" style={{background:theme.vars['--color-editor-surface-soft']}}>{Array.from({length:24},(_,i)=><span key={i} className="rounded-[2px]" style={{background:[8,9,13,14,15,16,20,21].includes(i)?accent:cardBg}}/>)}</span></span>
                  </span>
                  <span className="flex min-h-5 items-center justify-between gap-2">
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

        </SettingsSection>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-transparent px-2 text-xs text-editor-text/70 transition hover:bg-editor-accent-soft/50 hover:text-editor-accent focus-visible:outline-2 focus-visible:outline-editor-accent"
          onClick={view === 'theme' ? () => editor.setCurrentTheme(DEFAULT_THEME_ID) : editor.resetCanvasSettings}
        >
          <ArrowCounterClockwise size={16} />
          {view === 'theme' ? '恢复默认主题' : '恢复默认设置'}
        </button>
      </div>

    </div>
  )
}

function SettingsSection({
  icon,
  divided = true,
  title,
  description,
  children,
}: {
  icon?: ReactNode
  divided?: boolean
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-3">
      <header className="flex items-center gap-3">
        {icon ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-editor-accent-soft text-editor-accent">{icon}</span> : null}
        <div>
        <h3 className="text-sm font-black text-editor-strong">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs text-editor-text">{description}</p>
        ) : null}
        </div>
      </header>
      <div className={divided ? "grid gap-1 rounded-2xl bg-editor-elevated/60 p-3 sm:p-4" : "grid gap-3"}>
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
    <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 rounded-xl px-1 py-2.5">
      <div>
        <p className="text-xs font-bold text-editor-strong">{label}</p>
        {description ? (
          <p className="mt-1 text-[11px] text-editor-text">{description}</p>
        ) : null}
      </div>
      <div className="flex min-w-0 justify-end">{children}</div>
    </div>
  )
}


function CanvasAppearancePreview({ editor }: { editor: EditorStateController }) {
  const s = editor.canvasSettings
  return <div aria-label="画布外观预览" className="relative flex h-36 items-center justify-center overflow-hidden rounded-2xl p-5" style={{background:s.bgColor}}>
    <span className="absolute left-3 top-3 rounded-full bg-editor-elevated/90 px-2 py-1 text-[10px] text-editor-text">实时预览</span>
    <div className="relative grid h-24 w-36 grid-cols-9 overflow-hidden rounded-lg shadow-sm">
      <div className="absolute inset-0" style={{background:s.paperColor,opacity:s.paperAlpha}}/>
      {Array.from({length:54},(_,i)=><span key={i} className="relative" style={{backgroundColor:[12,14,20,21,22,23,24,30,31,32,40].includes(i)?'var(--color-editor-accent)':'transparent',borderRight:s.showGrid?s.gridWidth+'px solid '+s.gridColor:undefined,borderBottom:s.showGrid?s.gridWidth+'px solid '+s.gridColor:undefined}}/>)}
    </div>
  </div>
}
