/**
 * Crops the empty margin off a logo before it is uploaded (2026-10-31), so two
 * logos printed in boxes of the same size look the same size: a drop drawn
 * small in the middle of a large transparent canvas otherwise prints smaller
 * than a seal that fills its own.
 *
 * Empty means transparent, or near-white on a picture with no transparency
 * (a JPG on a white page). The file is read in the browser, before it is
 * sent, so nothing is fetched cross-origin. Anything that fails returns the
 * file as it was.
 */

// Below this alpha a pixel counts as empty; above this level all three
// channels count as white paper.
const ALPHA_EMPTY = 12
const WHITE = 245
// A little air kept around the drawing, as a share of its longer side.
const PADDING = 0.02

export function trimmedBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number, y: number, w: number, h: number } | null {
  let hasAlpha = false
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 250) { hasAlpha = true; break }
  }

  let top = height
  let left = width
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const empty = hasAlpha
        ? data[i + 3]! < ALPHA_EMPTY
        : data[i]! > WHITE && data[i + 1]! > WHITE && data[i + 2]! > WHITE
      if (empty) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }

  if (right < 0) return null

  const pad = Math.round(Math.max(right - left, bottom - top) * PADDING)
  const x = Math.max(0, left - pad)
  const y = Math.max(0, top - pad)

  return { x, y, w: Math.min(width, right + pad + 1) - x, h: Math.min(height, bottom + pad + 1) - y }
}

export async function trimImageFile(file: File): Promise<File> {
  if (typeof document === 'undefined' || !['image/png', 'image/jpeg'].includes(file.type)) return file

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0)

    const box = trimmedBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
    // Nothing drawn, or hardly a margin to take: keep the file as it was.
    if (!box || (box.w >= canvas.width * 0.97 && box.h >= canvas.height * 0.97)) return file

    const out = document.createElement('canvas')
    out.width = box.w
    out.height = box.h
    out.getContext('2d')?.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)

    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, file.type, 0.95))
    if (!blob || blob.size > 2 * 1024 * 1024) return file

    return new File([blob], file.name, { type: file.type, lastModified: Date.now() })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}
