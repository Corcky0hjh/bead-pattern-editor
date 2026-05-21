export const maxHistorySteps = 10

export type HistoryStack<T> = {
  past: T[]
  present: T
  future: T[]
}

export function pushHistory<T>(
  stack: HistoryStack<T>,
  next: T,
): HistoryStack<T> {
  return {
    past: [...stack.past, stack.present].slice(-maxHistorySteps),
    present: next,
    future: [],
  }
}
