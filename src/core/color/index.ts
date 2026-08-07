// 色板模块统一出口
//
// 数据层和工具集中在此处导出,UI/state 只依赖本模块,不直接 import data/*.json
import type { BeadColor, BrandId } from './types'
import mardData from './data/mard.json'
import artkalCData from './data/artkal-c.json'
import hamaMidiData from './data/hama-midi.json'
import perlerData from './data/perler.json'

export type { BeadColor, BrandId, Brand } from './types'
export {
  brands,
  defaultBrandId,
  getBrand,
  isBrandId,
} from './brands'
export { getDisplayCode, groupColorsForBrand } from './display'
export { findNearestBeadColors, type NearestBeadColor } from './nearest'

const datasets: Record<BrandId, BeadColor[]> = {
  mard: mardData as BeadColor[],
  'artkal-c': artkalCData as BeadColor[],
  'hama-midi': hamaMidiData as BeadColor[],
  perler: perlerData as BeadColor[],
}

/** 取指定品牌的全部色卡数据(stub 品牌返回空数组) */
export function getBrandColors(brand: BrandId): BeadColor[] {
  return datasets[brand]
}
