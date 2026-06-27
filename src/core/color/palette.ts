// 旧版"自定义色"轻量结构。仅用于 localStorage 向后兼容(旧版用户存的
// {hex, name})。新代码请用 BeadColor(./types.ts)。
//
// defaultPalette 已移除,色板默认数据现在按品牌取自 data/*.json,见 ./index.ts。
export type PaletteColor = {
  hex: string
  name: string
}
