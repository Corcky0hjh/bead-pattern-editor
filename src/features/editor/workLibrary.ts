import { readBox, type BoxColor } from './beadBox'
import { parsePatternGrid, serializePatternGrid, type SerializedPatternGrid, type PatternGrid } from '../../core/pattern/grid'

export const workStorageKey = 'bead-pattern-editor:works:v1'
export const draftStorageKey = 'bead-pattern-editor:work-draft:v1'
export type Work = {
  id: string; name: string; createdAt: number; updatedAt: number
  pattern: SerializedPatternGrid; revision: number; progressRevision: number
  beadBox?: BoxColor[]; completed: number[]; beadingMode: 'layer'
}
type StorageReader = Pick<Storage, 'getItem'>
const parsedPatterns = new WeakMap<SerializedPatternGrid, PatternGrid | null>()
function decoded(pattern: SerializedPatternGrid) {
  if (!parsedPatterns.has(pattern)) parsedPatterns.set(pattern, parsePatternGrid(pattern))
  return parsedPatterns.get(pattern)!
}
export function sameWorkPattern(a: SerializedPatternGrid, b: SerializedPatternGrid) {
  if (a === b) return true
  if (a.width !== b.width || a.height !== b.height) return false
  const left = decoded(a), right = decoded(b)
  if (!left || !right) return false
  // Compare actual beads: unused palette entries and chunk representation are not edits.
  for (let i = 0; i < left.cells.length; i++) {
    if (left.cells[i].color !== right.cells[i].color || Boolean(left.cells[i].isExternal) !== Boolean(right.cells[i].isExternal)) return false
  }
  return true
}
export function updateWorkPattern(work: Work, pattern: SerializedPatternGrid, now = Date.now()): Work {
  if (sameWorkPattern(work.pattern, pattern)) return work
  const revision = work.revision + 1
  return { ...work, pattern, revision, progressRevision: revision, completed: [], updatedAt: now }
}
export function loadWorkLibrary(storage: StorageReader): Work[] {
  const current = storage.getItem(workStorageKey)
  const raw = current ?? storage.getItem('bead-pattern-editor:beading-projects')
  const parsed: unknown = raw ? JSON.parse(raw) : []
  if (!Array.isArray(parsed)) throw new Error('作品数据格式无效')
  const works: Work[] = []
  for (const value of parsed) {
    if (!value || typeof value !== 'object') {
      if (current !== null) throw new Error('作品数据包含无效记录，已停止覆盖保存')
      continue
    }
    const row = value as Partial<Work>
    const pattern = parsePatternGrid(row.pattern)
    if (!pattern || typeof row.id !== 'string' || typeof row.name !== 'string') {
      if (current !== null) throw new Error('作品图纸损坏，已停止覆盖保存')
      continue
    }
    const revision = Number.isInteger(row.revision) && row.revision! > 0 ? row.revision! : 1
    const progressRevision = Number.isInteger(row.progressRevision) ? row.progressRevision! : revision
    const completed = progressRevision === revision && Array.isArray(row.completed)
      ? [...new Set(row.completed.filter(index => Number.isInteger(index) && index >= 0 && pattern.cells[index]?.color && !pattern.cells[index].isExternal))]
      : []
    works.push({ id: row.id, name: row.name, pattern: serializePatternGrid(pattern),
      createdAt: row.createdAt ?? Date.now(), updatedAt: row.updatedAt ?? Date.now(),
      revision, progressRevision: revision, completed, beadBox: readBox(row.beadBox), beadingMode: 'layer' })
  }
  // Migrate the separately saved drawing only once; never overwrite the legacy keys.
  if (current === null) {
    const saved = storage.getItem('bead-pattern-editor')
    if (saved) {
      const pattern = parsePatternGrid(JSON.parse(saved))
      if (pattern) works.push({ id: 'legacy-drawing', name: '原绘制草稿', pattern: serializePatternGrid(pattern),
        createdAt: Date.now(), updatedAt: Date.now(), revision: 1, progressRevision: 1, completed: [], beadingMode: 'layer' })
    }
  }
  return works
}
export function loadWorkDraft(storage: StorageReader) {
  try {
    const raw = storage.getItem(draftStorageKey)
    if (!raw) return null
    const data = JSON.parse(raw)
    const pattern = parsePatternGrid(data.pattern)
    if (!pattern) return null
    return { beadBox: readBox(data.beadBox), workId: typeof data.workId === 'string' ? data.workId : null, pattern }
  } catch { return null }
}
