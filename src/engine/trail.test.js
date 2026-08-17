import { describe, it, expect } from 'vitest'
import { makeTrail, batchTrail } from './trail.js'

describe('makeTrail', () => {
  it('returns points in chronological order', () => {
    const t = makeTrail(4)
    t.push(0, 0)
    t.push(1, 1)
    t.push(2, 2)
    expect(t.points()).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ])
    expect(t.length).toBe(3)
  })

  it('overwrites the oldest point once full (ring behaviour)', () => {
    const t = makeTrail(3)
    for (let i = 0; i < 5; i++) t.push(i, i)
    // capacity 3, last three pushes are 2,3,4
    expect(t.points()).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ])
    expect(t.length).toBe(3)
  })

  it('clear() empties the buffer', () => {
    const t = makeTrail(3)
    t.push(1, 1)
    t.clear()
    expect(t.length).toBe(0)
    expect(t.points()).toEqual([])
  })

  it('a non-positive capacity yields an inert trail (no NaN)', () => {
    for (const cap of [0, -1, NaN, undefined]) {
      const t = makeTrail(cap)
      t.push(1, 1)
      t.push(2, 2)
      expect(t.length).toBe(0)
      expect(t.points()).toEqual([])
    }
  })
})

describe('batchTrail', () => {
  const line = (n) => Array.from({ length: n }, (_, i) => ({ x: i, y: 0 }))

  it('returns nothing for a trail too short to draw', () => {
    expect(batchTrail([])).toEqual([])
    expect(batchTrail([{ x: 0, y: 0 }])).toEqual([])
  })

  it('collapses many points into at most `bands` polylines', () => {
    const out = batchTrail(line(900), { bands: 10 })
    expect(out).toHaveLength(10)
  })

  it('never produces more bands than there are segments', () => {
    const out = batchTrail(line(4), { bands: 10 })
    expect(out.length).toBeLessThanOrEqual(3)
  })

  it('covers every segment exactly once, with shared seams', () => {
    const pts = line(21)
    const out = batchTrail(pts, { bands: 4 })
    // Bands join end-to-start...
    for (let i = 1; i < out.length; i++) {
      const prevEnd = out[i - 1].points[out[i - 1].points.length - 1]
      expect(out[i].points[0]).toEqual(prevEnd)
    }
    // ...and together they span the whole trail.
    expect(out[0].points[0]).toEqual(pts[0])
    expect(out[out.length - 1].points.at(-1)).toEqual(pts.at(-1))
    const drawn = out.reduce((sum, band) => sum + band.points.length - 1, 0)
    expect(drawn).toBe(pts.length - 1)
  })

  it('runs t from tail to head', () => {
    const out = batchTrail(line(100), { bands: 5 })
    for (let i = 1; i < out.length; i++) expect(out[i].t).toBeGreaterThan(out[i - 1].t)
    expect(out[0].t).toBeGreaterThan(0)
    expect(out.at(-1).t).toBeLessThan(1)
  })

  it('drops points closer together than minStep', () => {
    const dense = Array.from({ length: 100 }, (_, i) => ({ x: i * 0.01, y: 0 }))
    const kept = batchTrail(dense, { bands: 1, minStep: 0.1 })[0].points
    expect(kept.length).toBeLessThan(15)
    expect(kept.length).toBeGreaterThan(2)
  })

  it('always keeps the head point, so the trail stays attached', () => {
    const dense = Array.from({ length: 100 }, (_, i) => ({ x: i * 0.001, y: 0 }))
    const out = batchTrail(dense, { bands: 4, minStep: 10 })
    expect(out.at(-1).points.at(-1)).toEqual(dense.at(-1))
  })

  it('keeps the tail point too', () => {
    const dense = Array.from({ length: 100 }, (_, i) => ({ x: i * 0.001, y: 0 }))
    const out = batchTrail(dense, { bands: 4, minStep: 10 })
    expect(out[0].points[0]).toEqual(dense[0])
  })
})
