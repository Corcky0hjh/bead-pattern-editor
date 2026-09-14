import type { ImagePlacement } from './conversion'

/** Fit the rotated image rectangle inside the board, retaining its center where possible. */
export function constrainImagePlacement(p: ImagePlacement, image: { width: number; height: number }, cols: number, rows: number): ImagePlacement {
  const aspect = image.height / image.width
  const radians = p.rotation * Math.PI / 180
  const cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians))
  const maxScale = Math.min(1 / (cos + aspect * sin), rows / cols / (sin + aspect * cos))
  const scale = Math.min(maxScale, Math.max(.01, p.scale))
  const height = scale * aspect * cols / rows
  const halfX = scale * (cos + aspect * sin) / 2
  const halfY = scale * cols / rows * (sin + aspect * cos) / 2
  const centerX = Math.max(halfX, Math.min(1 - halfX, p.x + p.scale / 2))
  const centerY = Math.max(halfY, Math.min(1 - halfY, p.y + p.scale * aspect * cols / rows / 2))
  return { ...p, scale, x: centerX - scale / 2, y: centerY - height / 2 }
}
