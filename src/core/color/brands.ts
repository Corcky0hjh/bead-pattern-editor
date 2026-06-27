// 品牌注册表
//
// 录入新品牌时:
// 1. 把 id 加入 BrandId 联合(types.ts)
// 2. 在 src/core/color/data/<id>.json 落数据
// 3. 在此处追加一项,available 切 true
import type { Brand, BrandId } from './types'

export const brands: Brand[] = [
  {
    id: 'mard',
    label: 'MARD 融达 5mm',
    shortLabel: 'MARD',
    available: true,
    groupBy: 'letterPrefix',
  },
  {
    id: 'artkal-c',
    label: 'Artkal C 5mm',
    shortLabel: 'Artkal C',
    available: false,
    groupBy: 'letterPrefix',
  },
  {
    id: 'hama-midi',
    label: 'Hama Midi 5mm',
    shortLabel: 'Hama Midi',
    available: false,
    groupBy: 'numericRange',
  },
  {
    id: 'perler',
    label: 'Perler 5mm',
    shortLabel: 'Perler',
    available: false,
    groupBy: 'letterPrefix',
  },
]

export const defaultBrandId: BrandId = 'mard'

export function getBrand(id: BrandId): Brand {
  const found = brands.find((b) => b.id === id)
  if (!found) throw new Error(`unknown brand: ${id}`)
  return found
}

export function isBrandId(value: unknown): value is BrandId {
  return (
    typeof value === 'string' && brands.some((b) => b.id === value)
  )
}
