import { describe, expect, it } from 'vitest'
import { trimmedBounds } from '~/utils/trimImage'

/** A width × height RGBA picture, transparent or white, with one block drawn. */
function picture(width: number, height: number, block: { x: number, y: number, w: number, h: number }, transparent = true) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = transparent ? 0 : 255
  }
  for (let y = block.y; y < block.y + block.h; y++) {
    for (let x = block.x; x < block.x + block.w; x++) {
      const i = (y * width + x) * 4
      data[i] = 200; data[i + 1] = 20; data[i + 2] = 20; data[i + 3] = 255
    }
  }
  return data
}

describe('trimming a logo before upload', () => {
  it('crops a transparent margin down to the drawing, with a little air', () => {
    const box = trimmedBounds(picture(200, 200, { x: 70, y: 60, w: 50, h: 80 }), 200, 200)
    expect(box).toEqual({ x: 68, y: 58, w: 54, h: 84 })
  })

  it('treats white paper as the margin on a picture with no transparency', () => {
    const box = trimmedBounds(picture(100, 100, { x: 10, y: 20, w: 30, h: 40 }, false), 100, 100)
    expect(box).toEqual({ x: 9, y: 19, w: 32, h: 42 })
  })

  it('finds nothing to keep in a blank picture', () => {
    expect(trimmedBounds(picture(10, 10, { x: 0, y: 0, w: 0, h: 0 }), 10, 10)).toBeNull()
  })
})
