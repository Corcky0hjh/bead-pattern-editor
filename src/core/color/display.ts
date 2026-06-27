// 色号显示与分组工具
//
// 思路对照 perler-beads/src/utils/colorSystemUtils.ts 与
// perler-beads/src/components/CustomPaletteEditor.tsx 的 groupColorsByPrefix,
// 代码自写。
import type { BeadColor, Brand, BrandId } from './types'

/**
 * 取颜色在指定品牌下的显示色号。
 * 没挂该品牌色号时返回 null(UI 自行 fallback,例如显示 hex 或 nameZh)。
 */
export function getDisplayCode(
  color: BeadColor,
  brand: BrandId,
): string | null {
  return color.codes[brand] ?? null
}

/**
 * 根据品牌的分组策略对颜色分桶。
 * - letterPrefix:按色号字母前缀分桶,组内按尾部数字升序
 * - numericRange:按色号数值分段(1-20/21-50/51-100/101-200/200+),组内按数值升序
 *
 * 没有该品牌色号的颜色被丢进 "其他" 桶。
 *
 * 返回 Map(保插入顺序),便于 UI 直接 for...of 渲染。
 */
export function groupColorsForBrand(
  colors: BeadColor[],
  brand: Brand,
): Map<string, BeadColor[]> {
  const groups = new Map<string, BeadColor[]>()
  const push = (key: string, color: BeadColor) => {
    let arr = groups.get(key)
    if (!arr) {
      arr = []
      groups.set(key, arr)
    }
    arr.push(color)
  }

  for (const color of colors) {
    const code = getDisplayCode(color, brand.id)
    if (code == null) {
      push('其他', color)
      continue
    }
    if (brand.groupBy === 'letterPrefix') {
      const prefix = code.match(/^[A-Z]+/)?.[0] ?? '其他'
      push(prefix, color)
    } else {
      const num = parseInt(code, 10)
      if (Number.isNaN(num)) {
        push('其他', color)
      } else if (num <= 20) push('1-20', color)
      else if (num <= 50) push('21-50', color)
      else if (num <= 100) push('51-100', color)
      else if (num <= 200) push('101-200', color)
      else push('200+', color)
    }
  }

  // 组内排序
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      const ca = getDisplayCode(a, brand.id) ?? ''
      const cb = getDisplayCode(b, brand.id) ?? ''
      const na = parseInt(ca.replace(/^[A-Z]+/, ''), 10) || 0
      const nb = parseInt(cb.replace(/^[A-Z]+/, ''), 10) || 0
      return na - nb
    })
  }

  return groups
}
