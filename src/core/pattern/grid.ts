export type PatternCell = {
  color: string
}

export type PatternGrid = {
  width: number
  height: number
  cells: PatternCell[]
}

type CreatePatternGridOptions = {
  width: number
  height: number
  palette: string[]
}

export function createPatternGrid({
  width,
  height,
  palette,
}: CreatePatternGridOptions): PatternGrid {
  const cells = Array.from({ length: width * height }, (_, index) => ({
    color: palette[index % palette.length],
  }))

  return { width, height, cells }
}
