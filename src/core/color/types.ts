// 拼豆色卡核心类型
//
// 设计要点:hex 是颜色主键,各品牌色号是 hex 的别名(参考 perler-beads 的
// hex→多店家色号映射模型)。一个 BeadColor 可以同时挂多个 brand 的 code,
// UI 根据当前选定 brand 显示对应代号。
//
// 自定义色(用户在编辑器里临时取的色)用 codes={} 表示——属于"自由色",
// 不归属任何品牌。

/** 当前支持的品牌 id。新增品牌时追加到此联合 + brands 注册表。 */
export type BrandId = 'mard' | 'artkal-s' | 'artkal-c' | 'hama-midi' | 'perler' | 'coco' | 'manman' | 'panpan' | 'mixiaowo'

/** 单粒拼豆颜色 */
export type BeadColor = {
  /** hex 颜色值,小写带 #,例 "#faf4c8"。作为颜色主键。 */
  hex: string
  /** 各品牌色号别名,例 { mard: 'A01' }。自定义色为空对象。 */
  codes: Partial<Record<BrandId, string>>
  /** 中文俗称(玩家叫法,可选;留待下一轮抓拼豆吧) */
  nameZh?: string
  /** 英文官名(品牌官网原词,可选;留待下一轮抓官网) */
  nameEn?: string
}

/** 品牌元信息 */
export type Brand = {
  id: BrandId
  /** 完整标签,UI 列表展示用,例 "Artkal C 2.6mm" */
  label: string
  /** 短标签,色板顶部 picker 等紧凑场景用,例 "Artkal C" */
  shortLabel: string
  /** 是否已录入实数据。false=stub,UI 灰显并提示"数据待录入"。 */
  available: boolean
  /**
   * 色号分组策略:
   * - letterPrefix:有字母前缀的色号体系(MARD A/B/C..., Artkal C001-, Perler P001-),按前缀分组
   * - numericRange:纯数字色号(Hama 1-90+),按数值区间分段(1-20/21-50/...)
   */
  groupBy: 'letterPrefix' | 'numericRange'
}
