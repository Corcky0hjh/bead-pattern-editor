export type ToolbarAxis = 'horizontal' | 'vertical'
export type ToolbarDockEdge = 'top' | 'right' | 'bottom' | 'left'

// A 16px grip strip rotates with the toolbar; both axes share one anchor rule.
export function getToolbarGripAnchor(axis: ToolbarAxis, size: { width: number; height: number }) {
  return axis === 'horizontal' ? { x: 8, y: size.height / 2 } : { x: size.width / 2, y: 8 }
}

export type ContentBounds = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export function getElementContentBounds(element: HTMLElement): ContentBounds {
  const style = window.getComputedStyle(element)
  const left = element.clientLeft + Number.parseFloat(style.paddingLeft)
  const top = element.clientTop + Number.parseFloat(style.paddingTop)
  const right =
    element.clientLeft +
    element.clientWidth -
    Number.parseFloat(style.paddingRight)
  const bottom =
    element.clientTop +
    element.clientHeight -
    Number.parseFloat(style.paddingBottom)

  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

export function clampToolbarPosition(
  bounds: ContentBounds,
  size: { width: number; height: number },
  position: { x: number; y: number },
) {
  const maxX = Math.max(bounds.left, bounds.right - size.width)
  const maxY = Math.max(bounds.top, bounds.bottom - size.height)
  return {
    x: Math.min(maxX, Math.max(bounds.left, position.x)),
    y: Math.min(maxY, Math.max(bounds.top, position.y)),
  }
}

export function getToolbarDockEdge({
  pointerX,
  pointerY,
  bounds,
  currentEdge,
  entryDistance = 64,
  retentionDistance = 80,
}: {
  pointerX: number
  pointerY: number
  bounds: ContentBounds
  currentEdge: ToolbarDockEdge | null
  entryDistance?: number
  retentionDistance?: number
}): ToolbarDockEdge | null {
  if (currentEdge === 'top' && pointerY <= bounds.top + retentionDistance) {
    return 'top'
  }
  if (
    currentEdge === 'bottom' &&
    pointerY >= bounds.bottom - retentionDistance
  ) {
    return 'bottom'
  }
  if (currentEdge === 'left' && pointerX <= bounds.left + retentionDistance) {
    return 'left'
  }
  if (
    currentEdge === 'right' &&
    pointerX >= bounds.right - retentionDistance
  ) {
    return 'right'
  }

  const edges: Array<{ edge: ToolbarDockEdge; distance: number }> = [
    { edge: 'top', distance: Math.max(0, pointerY - bounds.top) },
    { edge: 'right', distance: Math.max(0, bounds.right - pointerX) },
    { edge: 'bottom', distance: Math.max(0, bounds.bottom - pointerY) },
    { edge: 'left', distance: Math.max(0, pointerX - bounds.left) },
  ]
  const nearest = edges.reduce((best, edge) =>
    edge.distance < best.distance ? edge : best,
  )
  return nearest.distance <= entryDistance ? nearest.edge : null
}

export function measureToolbarNaturalExtent(
  content: HTMLElement,
  axis: ToolbarAxis,
  availableExtent: number,
) {
  const operations = content.querySelector<HTMLElement>(
    '[data-toolbar-operations]',
  )
  const dimension = axis === 'horizontal' ? 'width' : 'height'
  const gapProperty = axis === 'horizontal' ? 'columnGap' : 'rowGap'
  const operationChildren = operations
    ? (Array.from(operations.children) as HTMLElement[])
    : []
  const operationsStyle = operations
    ? window.getComputedStyle(operations)
    : null
  const operationsGap = operationsStyle
    ? Number.parseFloat(operationsStyle[gapProperty]) || 0
    : 0
  // Horizontal two-row toolbars stack their operation groups vertically.
  // Adding both row widths falsely consumes the entire stage and clamps every
  // drop to the left edge. Their horizontal extent is the widest row instead.
  const stackedRows = axis === 'horizontal' && operationsStyle?.display === 'grid'
  const operationsExtent = stackedRows
    ? Math.max(0, ...operationChildren.map((child) => child.getBoundingClientRect().width))
    : operationChildren.reduce(
      (total, child) => total + child.getBoundingClientRect()[dimension],
      0,
    ) + Math.max(0, operationChildren.length - 1) * operationsGap
  // The grip is absolutely positioned in the shell's top padding. It consumes
  // no row/column space; include shell padding exactly once below.
  const childrenExtent = operationsExtent
  const surface = content.parentElement
  const style = surface ? window.getComputedStyle(surface) : null
  // During the shell animation its padding moves to the content, so the
  // expanded size remains measurable even while the outer shell is 36px.
  const contentStyle = window.getComputedStyle(content)
  const chrome = style
    ? axis === 'horizontal'
      ? Number.parseFloat(contentStyle.paddingLeft) + Number.parseFloat(contentStyle.paddingRight) + Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.paddingRight) +
        Number.parseFloat(style.borderLeftWidth) +
        Number.parseFloat(style.borderRightWidth)
      : Number.parseFloat(contentStyle.paddingTop) + Number.parseFloat(contentStyle.paddingBottom) + Number.parseFloat(style.paddingTop) +
        Number.parseFloat(style.paddingBottom) +
        Number.parseFloat(style.borderTopWidth) +
        Number.parseFloat(style.borderBottomWidth)
    : 0

  return Math.min(
    availableExtent,
    Math.ceil(childrenExtent + chrome),
  )
}
