// 画布外观设置:外框、纸面/留白、网格线、大网格。
//
// 这些是用户偏好,跟图纸内容(pattern)解耦,localStorage 持久化。
// 不随工程文件导入导出。

export type CanvasSettings = {
  /** 外框背景色(画布容器底色) */
  bgColor: string
  /** 画布纸面色(底板,叠在外框上方) */
  paperColor: string
  /** 纸面 alpha,0-1。值越低越能透出外框色。 */
  paperAlpha: number
  /** 网格线颜色 */
  gridColor: string
  /** 网格线粗细(SVG strokeWidth) */
  gridWidth: number
  /** 每 N 格画一条加粗"大网格"线;0 = 关闭 */
  majorGridEvery: number
  /** 是否显示网格 */
  showGrid: boolean
  /** 是否显示顶部/左侧行列标尺 */
  showRulers: boolean
  /** 指针所在行列是否高亮 */
  showPointerGuides: boolean
  /** 是否显示右下角指针行列坐标 */
  showPointerCoordinates: boolean
  /** 是否在色块上显示当前品牌豆子色号 */
  showBeadCodes: boolean
}

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  bgColor: '#eadcc7',
  paperColor: '#ffffff',
  paperAlpha: 0.4,
  gridColor: '#9f9485',
  gridWidth: 1,
  majorGridEvery: 5,
  showGrid: true,
  showRulers: true,
  showPointerGuides: true,
  showPointerCoordinates: true,
  showBeadCodes: true,
}

/** 大网格间隔的可选值(0 = 关闭) */
export const MAJOR_GRID_OPTIONS = [0, 3, 5, 10] as const

/**
 * 把任意值安全解析成 CanvasSettings。缺失/类型错误的字段回退到默认。
 * 用于读取 localStorage 中的用户设置。
 */
export function parseCanvasSettings(raw: unknown): CanvasSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CANVAS_SETTINGS }
  const r = raw as Record<string, unknown>
  return {
    bgColor:
      typeof r.bgColor === 'string'
        ? r.bgColor
        : DEFAULT_CANVAS_SETTINGS.bgColor,
    paperColor:
      typeof r.paperColor === 'string'
        ? r.paperColor
        : DEFAULT_CANVAS_SETTINGS.paperColor,
    paperAlpha:
      typeof r.paperAlpha === 'number' && r.paperAlpha >= 0 && r.paperAlpha <= 1
        ? r.paperAlpha
        : DEFAULT_CANVAS_SETTINGS.paperAlpha,
    gridColor:
      typeof r.gridColor === 'string'
        ? r.gridColor
        : DEFAULT_CANVAS_SETTINGS.gridColor,
    gridWidth:
      typeof r.gridWidth === 'number' && r.gridWidth > 0
        ? r.gridWidth
        : DEFAULT_CANVAS_SETTINGS.gridWidth,
    majorGridEvery:
      typeof r.majorGridEvery === 'number' && r.majorGridEvery >= 0
        ? Math.floor(r.majorGridEvery)
        : DEFAULT_CANVAS_SETTINGS.majorGridEvery,
    showGrid:
      typeof r.showGrid === 'boolean'
        ? r.showGrid
        : DEFAULT_CANVAS_SETTINGS.showGrid,
    showRulers:
      typeof r.showRulers === 'boolean'
        ? r.showRulers
        : DEFAULT_CANVAS_SETTINGS.showRulers,
    showPointerGuides:
      typeof r.showPointerGuides === 'boolean'
        ? r.showPointerGuides
        : DEFAULT_CANVAS_SETTINGS.showPointerGuides,
    showPointerCoordinates:
      typeof r.showPointerCoordinates === 'boolean'
        ? r.showPointerCoordinates
        : DEFAULT_CANVAS_SETTINGS.showPointerCoordinates,
    showBeadCodes:
      typeof r.showBeadCodes === 'boolean'
        ? r.showBeadCodes
        : DEFAULT_CANVAS_SETTINGS.showBeadCodes,
  }
}
