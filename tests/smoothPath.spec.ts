import { describe, expect, it } from 'vitest'
import { smoothPath } from '../app/utils/smoothPath'

/** The control points' y values, every one of them, from a path's C commands. */
const controlYs = (d: string): number[] =>
  [...d.matchAll(/C([^C]+)/g)].flatMap(m => m[1]!.trim().split(/\s+/).map(pair => Number(pair.split(',')[1])))

describe('smoothPath', () => {
  it('starts on the first point and ends on the last', () => {
    const d = smoothPath([{ x: 0, y: 10 }, { x: 10, y: 50 }, { x: 20, y: 30 }])
    expect(d.startsWith('M0,10')).toBe(true)
    expect(d.endsWith('20,30')).toBe(true)
  })

  it('never bends past the points it joins, so a curve of counts stays between them', () => {
    // A quiet day between two busy ones: no dip below the quiet day.
    const points = [{ x: 0, y: 20 }, { x: 10, y: 100 }, { x: 20, y: 100 }, { x: 30, y: 20 }]
    const ys = controlYs(smoothPath(points))
    expect(Math.max(...ys)).toBeLessThanOrEqual(100)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(20)
  })

  it('draws a flat line for flat data', () => {
    expect(controlYs(smoothPath([{ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 20, y: 5 }])).every(y => y === 5)).toBe(true)
  })

  it('handles no point or one', () => {
    expect(smoothPath([])).toBe('')
    expect(smoothPath([{ x: 3, y: 4 }])).toBe('M3,4')
  })
})
