export type ConversionAlgorithm = 'rgb-quant' | 'atkinson'

export type ConversionPreset = {
  algorithm: ConversionAlgorithm
  size: 52 | 104
}

export const defaultConversionPreset: ConversionPreset = {
  algorithm: 'rgb-quant',
  size: 52,
}
