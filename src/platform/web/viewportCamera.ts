export type ViewPoint = { x: number; y: number }
export type ViewSize = { width: number; height: number }

const wheelDeltaLine = 1
const wheelDeltaPage = 2

export function normalizeWheelDelta(
  delta: number,
  deltaMode: number,
  pageSize: number,
) {
  if (deltaMode === wheelDeltaLine) return delta * 16
  if (deltaMode === wheelDeltaPage) return delta * pageSize
  return delta
}

export function getCenteredViewPosition(
  viewport: ViewSize,
  world: ViewSize,
  scale: number,
): ViewPoint {
  return {
    x: (viewport.width - world.width * scale) / 2,
    y: (viewport.height - world.height * scale) / 2,
  }
}

export function getAnchoredViewPosition({
  position,
  anchor,
  currentScale,
  nextScale,
}: {
  position: ViewPoint
  anchor: ViewPoint
  currentScale: number
  nextScale: number
}): ViewPoint {
  const worldX = (anchor.x - position.x) / currentScale
  const worldY = (anchor.y - position.y) / currentScale
  return {
    x: anchor.x - worldX * nextScale,
    y: anchor.y - worldY * nextScale,
  }
}

export function getFitZoom(
  viewport: ViewSize,
  world: ViewSize,
  inset: number,
  minZoom: number,
  maxZoom: number,
) {
  const availableWidth = Math.max(1, viewport.width - inset * 2)
  const availableHeight = Math.max(1, viewport.height - inset * 2)
  const zoom = Math.floor(
    Math.min(availableWidth / world.width, availableHeight / world.height) * 100,
  )
  return Math.min(maxZoom, Math.max(minZoom, zoom))
}
