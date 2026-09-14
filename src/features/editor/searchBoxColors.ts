import type { BoxColor } from './beadBox'
import { getBrand } from '../../core/color'

function normalizeCode(value: string) {
  return value.toLowerCase().replace(/([a-z]+)0+(?=\d)/g, '$1')
}
/** Prioritize explicit bead codes over incidental matches in RGB values. */
export function searchBoxColors(colors: BoxColor[], query: string): BoxColor[] {
  const term = query.trim().toLowerCase()
  if (!term) return []
  const normalized = normalizeCode(term)
  return colors.map((color, index) => {
    const codes = Object.values(color.codes).filter((code): code is string => Boolean(code)).map(code => code.toLowerCase())
    const names = [color.nameZh, color.nameEn].filter((name): name is string => Boolean(name)).map(name => name.toLowerCase())
    const hex = color.hex.toLowerCase()
    const brand = color.brand ? getBrand(color.brand).shortLabel.toLowerCase() : '自定义'
    let rank = Infinity
    if (codes.some(code => code === term)) rank = -1
    else if (codes.some(code => normalizeCode(code) === normalized)) rank = 0
    else if (hex === term || hex.slice(1) === term) rank = 1
    else if (codes.some(code => code.startsWith(term) || normalizeCode(code).startsWith(normalized))) rank = 2
    else if (names.some(name => name === term)) rank = 3
    else if (names.some(name => name.includes(term))) rank = 4
    else if (codes.some(code => code.includes(term))) rank = 5
    else if (brand.includes(term)) rank = 6
    else if (hex.includes(term)) rank = 7
    return {color, index, rank}
  }).filter(item => Number.isFinite(item.rank)).sort((a,b) => a.rank-b.rank || a.index-b.index).map(item => item.color)
}
