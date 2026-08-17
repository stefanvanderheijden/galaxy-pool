import { describe, it, expect } from 'vitest'
import { warpAt, tForWarp, planSubsteps, createTimeWarp, formatWarp } from './timeWarp.js'

const RANGE = { min: 1, mid: 1e6, max: 2e7 }

describe('warpAt', () => {
  it('pins the cruising speed exactly at the centre', () => {
    expect(warpAt(0.5, RANGE)).toBeCloseTo(1e6, 3)
  })

  it('hits both ends', () => {
    expect(warpAt(0, RANGE)).toBeCloseTo(1, 6)
    expect(warpAt(1, RANGE)).toBeCloseTo(2e7, 0)
  })

  it('is monotonic across the whole travel', () => {
    let prev = -Infinity
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const w = warpAt(t, RANGE)
      expect(w).toBeGreaterThan(prev)
      prev = w
    }
  })

  it('is log-linear within each half, so the halves can span different decades', () => {
    // Quarter point of the left half is the geometric middle of min..mid.
    expect(warpAt(0.25, RANGE)).toBeCloseTo(Math.sqrt(1 * 1e6), 2)
    expect(warpAt(0.75, RANGE)).toBeCloseTo(Math.sqrt(1e6 * 2e7), 0)
  })

  it('clamps out-of-range positions', () => {
    expect(warpAt(-1, RANGE)).toBeCloseTo(warpAt(0, RANGE), 6)
    expect(warpAt(2, RANGE)).toBeCloseTo(warpAt(1, RANGE), 6)
  })
})

describe('tForWarp', () => {
  it('inverts warpAt', () => {
    for (const t of [0, 0.13, 0.5, 0.72, 1]) {
      expect(tForWarp(warpAt(t, RANGE), RANGE)).toBeCloseTo(t, 10)
    }
  })

  it('puts the cruising speed at the centre', () => {
    expect(tForWarp(1e6, RANGE)).toBeCloseTo(0.5, 10)
  })

  it('clamps warps outside the range', () => {
    expect(tForWarp(0.001, RANGE)).toBe(0)
    expect(tForWarp(1e12, RANGE)).toBe(1)
  })
})

describe('planSubsteps', () => {
  it('takes a single step when the frame is already fine enough', () => {
    expect(planSubsteps(5e-5, { maxStep: 1e-4 })).toEqual({ steps: 1, h: 5e-5 })
  })

  it('splits a coarse frame so no step exceeds the ceiling', () => {
    const { steps, h } = planSubsteps(1e-3, { maxStep: 1e-4 })
    expect(steps).toBe(10)
    expect(h).toBeLessThanOrEqual(1e-4 + 1e-12)
    expect(steps * h).toBeCloseTo(1e-3, 12)
  })

  it('degrades rather than freezing when the frame is enormous', () => {
    const { steps, h } = planSubsteps(10, { maxStep: 1e-4, maxSteps: 64 })
    expect(steps).toBe(64)
    expect(h).toBeGreaterThan(1e-4) // accuracy given up on purpose
    expect(steps * h).toBeCloseTo(10, 9)
  })

  it('always covers exactly the requested span', () => {
    for (const dt of [1e-6, 2.5e-4, 0.013, 1.7]) {
      const { steps, h } = planSubsteps(dt, { maxStep: 1e-4, maxSteps: 64 })
      expect(steps * h).toBeCloseTo(dt, 12)
    }
  })

  it('does nothing for a zero or negative frame', () => {
    expect(planSubsteps(0)).toEqual({ steps: 0, h: 0 })
    expect(planSubsteps(-1)).toEqual({ steps: 0, h: 0 })
  })
})

describe('createTimeWarp', () => {
  it('starts at the pinned centre', () => {
    const tw = createTimeWarp(RANGE)
    expect(tw.t).toBe(0.5)
    expect(tw.warp()).toBeCloseTo(1e6, 3)
  })

  it('slides while a key is held', () => {
    const tw = createTimeWarp({ ...RANGE, spring: false })
    tw.update(1, { faster: true })
    expect(tw.t).toBeCloseTo(0.95, 10)
    tw.update(1, { slower: true })
    expect(tw.t).toBeCloseTo(0.5, 10)
  })

  it('never slides past either end', () => {
    const tw = createTimeWarp({ ...RANGE, spring: false })
    for (let i = 0; i < 20; i++) tw.update(1, { faster: true })
    expect(tw.t).toBe(1)
    for (let i = 0; i < 20; i++) tw.update(1, { slower: true })
    expect(tw.t).toBe(0)
  })

  it('springs back to the centre once the keys are released', () => {
    const tw = createTimeWarp(RANGE)
    tw.update(1, { faster: true })
    expect(tw.t).toBeGreaterThan(0.5)
    // The return is exponential, so it is most of the way home in a second...
    for (let i = 0; i < 60; i++) tw.update(1 / 60)
    expect(Math.abs(tw.t - 0.5)).toBeLessThan(0.03)
    // ...and settled after three.
    for (let i = 0; i < 120; i++) tw.update(1 / 60)
    expect(tw.t).toBeCloseTo(0.5, 3)
  })

  it('stays put when the spring is switched off', () => {
    const tw = createTimeWarp({ ...RANGE, spring: false })
    tw.update(0.5, { faster: true })
    const parked = tw.t
    for (let i = 0; i < 60; i++) tw.update(1 / 60)
    expect(tw.t).toBe(parked)
  })

  it('eases the displayed bead toward the real position', () => {
    const tw = createTimeWarp({ ...RANGE, spring: false })
    tw.setWarp(2e7)
    expect(tw.t).toBe(1)
    expect(tw.shown).toBe(0.5) // has not caught up yet
    tw.update(1 / 60)
    expect(tw.shown).toBeGreaterThan(0.5)
    expect(tw.shown).toBeLessThan(1)
    for (let i = 0; i < 120; i++) tw.update(1 / 60)
    expect(tw.shown).toBeCloseTo(1, 3)
  })

  it('reports deflection from home', () => {
    const tw = createTimeWarp({ ...RANGE, spring: false })
    expect(tw.deflection()).toBe(0)
    tw.setWarp(2e7)
    expect(tw.deflection()).toBeCloseTo(1, 10)
    tw.setWarp(1)
    expect(tw.deflection()).toBeCloseTo(1, 10)
  })

  it('resets to the centre', () => {
    const tw = createTimeWarp({ ...RANGE, spring: false })
    tw.setWarp(2e7)
    tw.update(1)
    tw.reset()
    expect(tw.t).toBe(0.5)
    expect(tw.shown).toBe(0.5)
  })
})

describe('formatWarp', () => {
  it('labels each decade band readably', () => {
    expect(formatWarp(1)).toBe('1×')
    expect(formatWarp(250)).toBe('250×')
    expect(formatWarp(1e5)).toBe('100K')
    expect(formatWarp(5e6)).toBe('5.0M')
    expect(formatWarp(2e7)).toBe('20.0M')
  })
})
