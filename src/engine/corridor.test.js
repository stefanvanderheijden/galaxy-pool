import { describe, it, expect } from 'vitest'
import { corridorBands } from './corridor.js'

// A straight run east, so the corridor edges are simply offset north and south.
const straight = (n = 21) => Array.from({ length: n }, (_, i) => ({ x: i * 0.1, y: 0 }))

describe('corridorBands', () => {
  it('returns nothing for a path too short to draw', () => {
    expect(corridorBands([])).toEqual([])
    expect(corridorBands([{ x: 0, y: 0 }])).toEqual([])
  })

  it('collapses a long path into at most `bands` polylines per edge', () => {
    const out = corridorBands(straight(900), { bands: 12, maxOffset: 0.02 })
    expect(out).toHaveLength(12)
  })

  it('starts tight and ends at the full half-width', () => {
    const out = corridorBands(straight(101), { bands: 10, maxOffset: 0.05 })
    const firstLeft = out[0].left[0]
    const lastLeft = out.at(-1).left.at(-1)
    expect(Math.abs(firstLeft.y)).toBeCloseTo(0, 10)
    expect(Math.abs(lastLeft.y)).toBeCloseTo(0.05, 10)
  })

  it('spreads monotonically along the path', () => {
    const out = corridorBands(straight(101), { bands: 10, maxOffset: 0.05 })
    let prev = -1
    for (const band of out) {
      for (const p of band.left) {
        expect(Math.abs(p.y)).toBeGreaterThanOrEqual(prev - 1e-12)
        prev = Math.abs(p.y)
      }
    }
  })

  it('puts the two edges on opposite sides of the path', () => {
    const out = corridorBands(straight(51), { bands: 5, maxOffset: 0.04 })
    const band = out.at(-1)
    expect(band.left.at(-1).y).toBeCloseTo(-band.right.at(-1).y, 12)
    expect(band.left.at(-1).y).not.toBeCloseTo(0, 6)
  })

  it('collapses to the bare path when maxOffset is 0', () => {
    const path = straight(21)
    const out = corridorBands(path, { bands: 4, maxOffset: 0 })
    for (const band of out) {
      for (const p of band.left) expect(p.y).toBeCloseTo(0, 12)
    }
  })

  it('joins bands seamlessly, on both edges', () => {
    const out = corridorBands(straight(41), { bands: 4, maxOffset: 0.03 })
    for (let i = 1; i < out.length; i++) {
      expect(out[i].left[0]).toEqual(out[i - 1].left.at(-1))
      expect(out[i].right[0]).toEqual(out[i - 1].right.at(-1))
    }
  })

  it('runs t from the start of the path to its end', () => {
    const out = corridorBands(straight(101), { bands: 8, maxOffset: 0.02 })
    for (let i = 1; i < out.length; i++) expect(out[i].t).toBeGreaterThan(out[i - 1].t)
  })

  it('honours a point’s own t, for paths not evenly spaced in time', () => {
    // Half the points cover the first tenth of the flight: the spread should
    // follow time, so those points stay tight.
    const pts = Array.from({ length: 21 }, (_, i) => ({
      x: i * 0.1,
      y: 0,
      t: i < 10 ? i * 0.01 : (i - 10) / 10,
    }))
    const out = corridorBands(pts, { bands: 20, maxOffset: 0.05, widenPow: 1 })
    expect(Math.abs(out[0].left[0].y)).toBeLessThan(0.005)
  })

  it('offsets perpendicular to a turning path, not to one segment', () => {
    // Quarter circle: every edge point must stay on a circle of its own radius.
    const pts = Array.from({ length: 41 }, (_, i) => {
      const a = (i / 40) * (Math.PI / 2)
      return { x: Math.cos(a), y: Math.sin(a) }
    })
    const out = corridorBands(pts, { bands: 8, maxOffset: 0.1 })
    const last = out.at(-1)
    const rLeft = Math.hypot(last.left.at(-1).x, last.left.at(-1).y)
    const rRight = Math.hypot(last.right.at(-1).x, last.right.at(-1).y)
    // One rail bows inward, the other outward, by the same amount.
    expect(Math.abs(rLeft - 1)).toBeCloseTo(0.1, 2)
    expect(Math.abs(rRight - 1)).toBeCloseTo(0.1, 2)
    expect((rLeft - 1) * (rRight - 1)).toBeLessThan(0)
  })
})
