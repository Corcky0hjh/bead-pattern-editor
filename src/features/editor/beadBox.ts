import type { BeadColor, BrandId } from '../../core/color'
import type { PatternGrid } from '../../core/pattern/grid'

export type BoxColor = BeadColor & { id: string; brand?: BrandId }
export function boxLabel(color: BeadColor) {
  return color.nameZh?.trim() || color.nameEn?.trim() || Object.values(color.codes).find(Boolean) || color.hex
}
export function toBoxColor(color: BeadColor, brand?: BrandId): BoxColor {
  const code = brand ? color.codes[brand] : undefined
  return { ...color, hex: color.hex.toLowerCase(), brand, id: code ? `${brand}:${code}` : `custom:${color.hex.toLowerCase()}` }
}
export function readBox(value: unknown): BoxColor[] {
  if (!Array.isArray(value)) return []
  const result: BoxColor[] = []
  const hexes = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(entry.hex)) continue
    const hex = entry.hex.toLowerCase()
    if (hexes.has(hex)) continue
    hexes.add(hex)
    const codes = Object.fromEntries(Object.entries(entry.codes ?? {}).filter(([, code]) => typeof code === 'string'))
    result.push({ id: entry.id, hex, codes,
      ...(typeof entry.brand === 'string' ? { brand: entry.brand as BrandId } : {}),
      ...(typeof entry.nameZh === 'string' ? { nameZh: entry.nameZh } : {}),
      ...(typeof entry.nameEn === 'string' ? { nameEn: entry.nameEn } : {}),
    })
  }
  return result
}
export function includeUsedColors(box: BoxColor[], pattern: PatternGrid, catalog: BoxColor[]): BoxColor[] {
  const result = readBox(box)
  const included = new Set(result.map(c => c.hex))
  for (const cell of pattern.cells) {
    if (!cell.color || cell.isExternal || included.has(cell.color.toLowerCase())) continue
    const hex = cell.color.toLowerCase()
    result.push(catalog.find(c => c.hex === hex) ?? { id: `legacy:${hex}`, hex, codes: {} })
    included.add(hex)
  }
  return result
}
