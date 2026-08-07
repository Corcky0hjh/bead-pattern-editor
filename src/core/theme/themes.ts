// 全站主题集中定义。所有需要展示主题列表 / 应用主题的代码都从这里 import。
//
// 加新主题只在这里加一行,预览页和设置面板自动同步。
//
// 设计:每套主题就是 8 个 CSS 变量值(对应 src/index.css @theme 中的 token)。
// 应用方式:在 <html> 元素上设置 inline style 的 CSS 变量,覆盖 @theme 默认。

export type ThemeVars = {
  '--color-editor-bg': string
  '--color-editor-surface': string
  '--color-editor-surface-soft': string
  '--color-editor-elevated': string
  '--color-editor-border': string
  '--color-editor-text': string
  '--color-editor-strong': string
  '--color-editor-accent': string
  '--color-editor-accent-soft': string
}

/** 主题附带的画布默认外观(切主题时直接覆盖到 CanvasSettings)。 */
export type ThemeCanvasDefaults = {
  bgColor: string
  paperColor: string
  paperAlpha: number
  gridColor: string
}

export type Theme = {
  id: string
  label: string
  description: string
  vars: ThemeVars
  canvas: ThemeCanvasDefaults
}

export const THEMES: Theme[] = [
  {
    id: 'warm-craft',
    label: '暖米褐(默认)',
    description: '温润手作感,做对照基准。',
    vars: {
      '--color-editor-bg': '#f8f2e8',
      '--color-editor-surface': '#fffaf2',
      '--color-editor-surface-soft': '#f1e5d3',
      '--color-editor-elevated': '#ffffff',
      '--color-editor-border': 'rgba(70, 50, 30, 0.14)',
      '--color-editor-text': '#665f56',
      '--color-editor-strong': '#1f1812',
      '--color-editor-accent': '#b64f2b',
      '--color-editor-accent-soft': 'rgba(182, 79, 43, 0.12)',
    },
    canvas: {
      bgColor: '#eadcc7',
      paperColor: '#ffffff',
      paperAlpha: 0.4,
      gridColor: '#9f9485',
    },
  },
  {
    id: 'cool-modern',
    label: '冷调现代',
    description: '浅灰白底 + 深蓝 accent,中性长时编辑友好。',
    vars: {
      '--color-editor-bg': '#fafafa',
      '--color-editor-surface': '#ffffff',
      '--color-editor-surface-soft': '#f1f5f9',
      '--color-editor-elevated': '#ffffff',
      '--color-editor-border': 'rgba(15, 23, 42, 0.12)',
      '--color-editor-text': '#475569',
      '--color-editor-strong': '#0f172a',
      '--color-editor-accent': '#2563eb',
      '--color-editor-accent-soft': 'rgba(37, 99, 235, 0.12)',
    },
    canvas: {
      bgColor: '#e2e8f0',
      paperColor: '#ffffff',
      paperAlpha: 0.6,
      gridColor: '#64748b',
    },
  },
  {
    id: 'dark-mode',
    label: '深色模式',
    description: '夜间体验,卡片深灰 + 亮橙 accent。',
    vars: {
      '--color-editor-bg': '#0f1115',
      '--color-editor-surface': '#1a1d24',
      '--color-editor-surface-soft': '#252932',
      '--color-editor-elevated': '#2f3441',
      '--color-editor-border': 'rgba(255, 255, 255, 0.08)',
      '--color-editor-text': '#94a3b8',
      '--color-editor-strong': '#e8e8ea',
      '--color-editor-accent': '#fb923c',
      '--color-editor-accent-soft': 'rgba(251, 146, 60, 0.18)',
    },
    canvas: {
      bgColor: '#1f2530',
      paperColor: '#0f1115',
      paperAlpha: 0.55,
      gridColor: '#5b6370',
    },
  },
  {
    id: 'mint-fresh',
    label: '薄荷绿调',
    description: '清新淡绿底 + 深绿 accent。',
    vars: {
      '--color-editor-bg': '#eef4f0',
      '--color-editor-surface': '#ffffff',
      '--color-editor-surface-soft': '#dcebe3',
      '--color-editor-elevated': '#ffffff',
      '--color-editor-border': 'rgba(20, 60, 40, 0.12)',
      '--color-editor-text': '#4b6e5c',
      '--color-editor-strong': '#1a3a2a',
      '--color-editor-accent': '#15803d',
      '--color-editor-accent-soft': 'rgba(21, 128, 61, 0.14)',
    },
    canvas: {
      bgColor: '#cce5d6',
      paperColor: '#f7fbf8',
      paperAlpha: 0.5,
      gridColor: '#5e8a72',
    },
  },
  {
    id: 'vintage-paper',
    label: '复古纸品',
    description: '低饱和米纸 + 棕褐 accent,文具风。',
    vars: {
      '--color-editor-bg': '#f4f1ec',
      '--color-editor-surface': '#fdf8ef',
      '--color-editor-surface-soft': '#e9e2d2',
      '--color-editor-elevated': '#fffaf0',
      '--color-editor-border': 'rgba(58, 46, 34, 0.16)',
      '--color-editor-text': '#6b5d4f',
      '--color-editor-strong': '#3a2e22',
      '--color-editor-accent': '#8b4513',
      '--color-editor-accent-soft': 'rgba(139, 69, 19, 0.12)',
    },
    canvas: {
      bgColor: '#dccdb4',
      paperColor: '#fdf6e7',
      paperAlpha: 0.45,
      gridColor: '#8b6f4e',
    },
  },
  {
    id: 'ocean-blue',
    label: '海洋蓝',
    description: '雾感蓝灰 + 海蓝 accent,稳重清爽。',
    vars: {
      '--color-editor-bg': '#eef2f5',
      '--color-editor-surface': '#ffffff',
      '--color-editor-surface-soft': '#dde4eb',
      '--color-editor-elevated': '#ffffff',
      '--color-editor-border': 'rgba(20, 40, 60, 0.12)',
      '--color-editor-text': '#506478',
      '--color-editor-strong': '#0b2440',
      '--color-editor-accent': '#0e7490',
      '--color-editor-accent-soft': 'rgba(14, 116, 144, 0.14)',
    },
    canvas: {
      bgColor: '#c8d4e0',
      paperColor: '#f4f8fb',
      paperAlpha: 0.5,
      gridColor: '#5b7390',
    },
  },
  {
    id: 'sakura-pink',
    label: '樱花粉调',
    description: '奶油粉 + 玫瑰红,甜美拼豆友好。',
    vars: {
      '--color-editor-bg': '#fef2f4',
      '--color-editor-surface': '#ffffff',
      '--color-editor-surface-soft': '#fbe2e7',
      '--color-editor-elevated': '#ffffff',
      '--color-editor-border': 'rgba(120, 30, 50, 0.12)',
      '--color-editor-text': '#7d525c',
      '--color-editor-strong': '#4a1f2c',
      '--color-editor-accent': '#e11d48',
      '--color-editor-accent-soft': 'rgba(225, 29, 72, 0.12)',
    },
    canvas: {
      bgColor: '#f6d2da',
      paperColor: '#fff7f8',
      paperAlpha: 0.5,
      gridColor: '#a8657a',
    },
  },
  {
    id: 'minimal-mono',
    label: '极简黑白',
    description: '全白底 + 纯黑 accent,沉依重色。',
    vars: {
      '--color-editor-bg': '#ffffff',
      '--color-editor-surface': '#fafafa',
      '--color-editor-surface-soft': '#ededed',
      '--color-editor-elevated': '#ffffff',
      '--color-editor-border': 'rgba(0, 0, 0, 0.16)',
      '--color-editor-text': '#525252',
      '--color-editor-strong': '#0a0a0a',
      '--color-editor-accent': '#111111',
      '--color-editor-accent-soft': 'rgba(0, 0, 0, 0.08)',
    },
    canvas: {
      bgColor: '#e5e5e5',
      paperColor: '#ffffff',
      paperAlpha: 0.6,
      gridColor: '#525252',
    },
  },
  {
    id: 'dark-walnut',
    label: '深棕(复古深色)',
    description: '插画棕底 + 亮黄 accent,作品不抢色。',
    vars: {
      '--color-editor-bg': '#1c1b22',
      '--color-editor-surface': '#272630',
      '--color-editor-surface-soft': '#33323e',
      '--color-editor-elevated': '#3d3c4a',
      '--color-editor-border': 'rgba(255, 230, 180, 0.1)',
      '--color-editor-text': '#a8a39a',
      '--color-editor-strong': '#f6efe3',
      '--color-editor-accent': '#facc15',
      '--color-editor-accent-soft': 'rgba(250, 204, 21, 0.16)',
    },
    canvas: {
      bgColor: '#2b2933',
      paperColor: '#1c1b22',
      paperAlpha: 0.55,
      gridColor: '#706a5a',
    },
  },
  {
    id: 'persimmon',
    label: '柿子橙',
    description: '暖黄底 + 柿子橙,能量感。',
    vars: {
      '--color-editor-bg': '#fff7ed',
      '--color-editor-surface': '#ffffff',
      '--color-editor-surface-soft': '#fce5c4',
      '--color-editor-elevated': '#ffffff',
      '--color-editor-border': 'rgba(120, 60, 0, 0.14)',
      '--color-editor-text': '#7a4f1f',
      '--color-editor-strong': '#3a230a',
      '--color-editor-accent': '#d97706',
      '--color-editor-accent-soft': 'rgba(217, 119, 6, 0.14)',
    },
    canvas: {
      bgColor: '#f8d8a8',
      paperColor: '#fff9ef',
      paperAlpha: 0.5,
      gridColor: '#9a6f3e',
    },
  },
]

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME_ID = 'warm-craft'

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((t) => t.id === value)
}

/**
 * 把主题应用到 <html> 元素。inline style 优先级高于 @theme block。
 * 切到默认主题时清掉 inline style,恢复 @theme 兜底。
 */
export function applyTheme(id: string): void {
  const theme = getTheme(id)
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value)
  }
}
