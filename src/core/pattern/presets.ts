export type CanvasPreset = {
  value: '52x52' | '104x104' | 'custom'
  label: string
  rows: number
  cols: number
}

export const canvasPresets: CanvasPreset[] = [
  { value: '52x52', label: '52 x 52 标准板', rows: 52, cols: 52 },
  { value: '104x104', label: '104 x 104 大图纸', rows: 104, cols: 104 },
  { value: 'custom', label: '自定义尺寸', rows: 52, cols: 52 },
]
