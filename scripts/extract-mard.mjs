// scripts/extract-mard.mjs
// 从 ../perler-beads/src/app/colorSystemMapping.json 提取 MARD 色号 + hex,
// 输出到 src/core/color/data/mard.json。
//
// 法律说明:仅复用 hex 数值与 MARD 自有色号字符串(MARD 是国内贴牌品牌,
// 色号是商品 SKU 标记,本身不含创作性表达);不复制 perler-beads 的
// 跨店家映射数据库结构(那才是 sui generis 风险点)。
//
// 用法:node scripts/extract-mard.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(here, '../../perler-beads/src/app/colorSystemMapping.json')
const OUT = resolve(here, '../src/core/color/data/mard.json')

const raw = JSON.parse(readFileSync(SRC, 'utf8'))

/** @type {{hex:string, codes:{mard:string}}[]} */
const colors = []
for (const [hex, codes] of Object.entries(raw)) {
  if (!codes.MARD) continue
  colors.push({
    hex: hex.toLowerCase(),
    codes: { mard: codes.MARD },
  })
}

// 按 MARD 色号字母前缀 + 数字排序
colors.sort((a, b) => {
  const ka = a.codes.mard
  const kb = b.codes.mard
  const pa = ka.match(/^[A-Z]+/)?.[0] ?? ''
  const pb = kb.match(/^[A-Z]+/)?.[0] ?? ''
  if (pa !== pb) return pa.localeCompare(pb)
  const na = parseInt(ka.replace(/^[A-Z]+/, ''), 10) || 0
  const nb = parseInt(kb.replace(/^[A-Z]+/, ''), 10) || 0
  return na - nb
})

writeFileSync(OUT, JSON.stringify(colors, null, 2) + '\n', 'utf8')
console.log(`wrote ${colors.length} colors to ${OUT}`)
