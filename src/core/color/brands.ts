// 品牌注册表
//
// 录入新品牌时:
// 1. 把 id 加入 BrandId 联合(types.ts)
// 2. 在 src/core/color/data/<id>.json 落数据
// 3. 在此处追加一项,available 切 true
import type { Brand, BrandId } from './types'

export const brands: Brand[] = [
  {
    "id": "mard",
    "label": "MARD",
    "shortLabel": "MARD",
    "available": true,
    "groupBy": "letterPrefix"
  },
  {
    "id": "artkal-s",
    "label": "Artkal S 5mm",
    "shortLabel": "Artkal S",
    "available": true,
    "groupBy": "letterPrefix"
  },
  {
    "id": "artkal-c",
    "label": "Artkal C 2.6mm",
    "shortLabel": "Artkal C",
    "available": true,
    "groupBy": "letterPrefix"
  },
  {
    "id": "hama-midi",
    "label": "Hama Midi 5mm",
    "shortLabel": "Hama Midi",
    "available": true,
    "groupBy": "numericRange"
  },
  {
    "id": "perler",
    "label": "Perler 5mm",
    "shortLabel": "Perler",
    "available": true,
    "groupBy": "numericRange"
  },
  {
    "id": "coco",
    "label": "COCO",
    "shortLabel": "COCO",
    "available": true,
    "groupBy": "letterPrefix"
  },
  {
    "id": "manman",
    "label": "漫漫",
    "shortLabel": "漫漫",
    "available": true,
    "groupBy": "letterPrefix"
  },
  {
    "id": "panpan",
    "label": "盼盼",
    "shortLabel": "盼盼",
    "available": true,
    "groupBy": "letterPrefix"
  },
  {
    "id": "mixiaowo",
    "label": "咪小窝",
    "shortLabel": "咪小窝",
    "available": true,
    "groupBy": "letterPrefix"
  }
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
