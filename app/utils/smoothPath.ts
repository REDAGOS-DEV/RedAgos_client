/**
 * An SVG path through the points that never overshoots them (monotone cubic,
 * Fritsch-Carlson): a smooth line that still reads true, never dipping below
 * zero between two quiet days or rising above a day's real count.
 *
 * Points in drawing order, left to right.
 */
export function smoothPath(points: ReadonlyArray<{ x: number, y: number }>): string {
  const n = points.length
  if (!n) return ''
  if (n === 1) return `M${points[0]!.x},${points[0]!.y}`

  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1]!.x - points[i]!.x
    slope[i] = (points[i + 1]!.y - points[i]!.y) / dx[i]!
  }

  // Tangents: zero at a peak or a trough, so the curve turns on the point.
  const t: number[] = [slope[0]!]
  for (let i = 1; i < n - 1; i++) {
    t[i] = slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2
  }
  t[n - 1] = slope[n - 2]!

  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i]! / slope[i]!
    const b = t[i + 1]! / slope[i]!
    const h = a * a + b * b
    if (h > 9) {
      const k = 3 / Math.sqrt(h)
      t[i] = k * a * slope[i]!
      t[i + 1] = k * b * slope[i]!
    }
  }

  let d = `M${points[0]!.x},${points[0]!.y}`
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i]! / 3
    const p = points[i]!
    const q = points[i + 1]!
    d += ` C${p.x + third},${p.y + t[i]! * third} ${q.x - third},${q.y - t[i + 1]! * third} ${q.x},${q.y}`
  }
  return d
}
