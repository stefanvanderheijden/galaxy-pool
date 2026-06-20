import { describe, it, expect } from 'vitest'
import { makeTrail } from './trail.js'

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
