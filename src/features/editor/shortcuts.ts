import { useSyncExternalStore } from 'react'

export const shortcutDefinitions = [
  ['brush', '画笔', '工具切换', 'b'], ['eraser', '橡皮', '工具切换', 'e'],
  ['fill', '填充', '工具切换', 'f'], ['shape', '形状', '工具切换', 'u'],
  ['pan', '移动画布', '工具切换', 'v'], ['eyedropper', '吸管', '工具切换', 'i'],
  ['holdPan', '按住移动画布', '临时操作', 'space'], ['holdPick', '按住临时吸管', '临时操作', 'alt'],
  ['smaller', '减小工具粗细', '临时操作', '['], ['larger', '增大工具粗细', '临时操作', ']'],
  ['grid', '显示 / 隐藏网格', '历史与视图', 'g'], ['save', '保存作品', '历史与视图', 'mod+s'],
  ['undo', '撤销', '历史与视图', 'mod+z'], ['redo', '重做', '历史与视图', 'mod+y'],
  ['redoAlt', '重做（备用）', '历史与视图', 'mod+shift+z'],
  ['zoomIn', '放大画布', '历史与视图', 'mod+='], ['zoomOut', '缩小画布', '历史与视图', 'mod+-'],
  ['fit', '画布适应视口', '历史与视图', 'mod+0'],
  ['confirm', '确认浮动选区', '选区操作', 'enter'], ['cancel', '取消当前操作 / 清除选区', '选区操作', 'escape'],
  ['delete', '删除选区', '选区操作', 'delete'], ['deleteAlt', '删除选区（备用）', '选区操作', 'backspace'],
] as const
export type ShortcutId = typeof shortcutDefinitions[number][0]
type Bindings = Record<ShortcutId, string>
const defaults = Object.fromEntries(shortcutDefinitions.map(([id,,,key]) => [id,key])) as Bindings
const storageKey = 'bead-editor:shortcuts:v1'
let bindings = { ...defaults }
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
  const candidate = { ...defaults }
  for (const [id] of shortcutDefinitions) if (typeof saved[id] === 'string' && saved[id]) candidate[id] = saved[id]
  if (new Set(Object.values(candidate)).size === shortcutDefinitions.length) bindings = candidate
} catch { /* Defaults remain available when storage cannot be read. */ }
const listeners = new Set<() => void>()
export function useShortcuts() { return useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback) } }, () => bindings) }
export function shortcutLabel(value: string): string {
  const labels: Record<string,string> = { mod:'Ctrl / Cmd', alt:'Alt', shift:'Shift', space:'Space', escape:'Esc', enter:'Enter', delete:'Delete', backspace:'Backspace' }
  return value.split('+').map(key => labels[key] || key.toUpperCase()).join(' + ')
}
export function shortcutFromEvent(event: Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>) {
  let key = event.key.toLowerCase()
  if (['control','meta','shift'].includes(key)) return null
  if (key === ' ') key = 'space'
  if (key === '+') key = '='
  return [...(event.ctrlKey || event.metaKey ? ['mod'] : []), ...(event.altKey && key !== 'alt' ? ['alt'] : []), ...(event.shiftKey && event.key !== '+' ? ['shift'] : []), key].join('+')
}
export function matchesShortcut(event: KeyboardEvent, id: ShortcutId) { return shortcutFromEvent(event) === bindings[id] }
export function shortcutReleased(event: KeyboardEvent, id: ShortcutId) {
  const binding = bindings[id]
  const key = event.key === ' ' ? 'space' : event.key === '+' ? '=' : event.key.toLowerCase()
  return key === binding.split('+').at(-1) || (binding.includes('mod+') && !event.ctrlKey && !event.metaKey) || (binding.includes('alt+') && !event.altKey) || (binding.includes('shift+') && !event.shiftKey)
}
export function setShortcut(id: ShortcutId, key: string) {
  const conflict = shortcutDefinitions.find(([other]) => other !== id && bindings[other] === key)
  if (conflict) return '已用于“' + conflict[1] + '”，请换一个按键'
  return persist({ ...bindings, [id]:key })
}
function persist(next: Bindings) {
  try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { return '保存失败，请检查浏览器存储空间' }
  bindings = next
  listeners.forEach(listener => listener())
  return null
}
export function resetShortcuts() { return persist({ ...defaults }) }
