import { describe, it, expect } from 'vitest'
import { applyRogueGravity, wakeRadius } from './gravity.js'

const body = (over = {}) => ({ x: 0, y: 0, vx: 0, vy: 0, mass: 3e-6, rogue: false, ...over })

// Strong field, short reach — the shape the sketch actually uses.
const FIELD = { influenceR: 0.35, boost: 12000, wakeAccel: 8 }

describe('applyRogueGravity — the two states', () => {
  it('leaves a rack of stable planets completely alone', () => {
    const bodies = [body({ x: 0 }), body({ x: 0.05 }), body({ x: 0.1 })]
    applyRogueGravity(bodies, 0.01, FIELD)
    for (const b of bodies) {
      expect(b.vx).toBe(0)
      expect(b.vy).toBe(0)
      expect(b.rogue).toBe(false)
    }
  })

  it('pulls a stable planet once one of the pair has gone rogue', () => {
    const a = body({ x: 0, rogue: true })
    const b = body({ x: 0.1 })
    applyRogueGravity([a, b], 0.01, FIELD)
    expect(a.vx).toBeGreaterThan(0) // pulled toward b
    expect(b.vx).toBeLessThan(0) // pulled toward a
  })

  it('conserves momentum across an interacting pair', () => {
    const a = body({ x: 0, mass: 8e-6, rogue: true })
    const b = body({ x: 0.12, mass: 8e-7 })
    applyRogueGravity([a, b], 0.01, FIELD)
    expect(a.mass * a.vx + b.mass * b.vx).toBeCloseTo(0, 18)
  })

  it('accelerates the lighter body of a pair harder', () => {
    const heavy = body({ x: 0, mass: 8e-6, rogue: true })
    const light = body({ x: 0.12, mass: 8e-7 })
    applyRogueGravity([heavy, light], 0.01, FIELD)
    expect(Math.abs(light.vx)).toBeGreaterThan(Math.abs(heavy.vx))
  })

  it('does nothing beyond the influence radius', () => {
    const a = body({ x: 0, rogue: true })
    const b = body({ x: 0.4 }) // outside 0.35
    applyRogueGravity([a, b], 0.01, FIELD)
    expect(b.vx).toBe(0)
    expect(b.rogue).toBe(false)
  })

  it('is inert when the mechanic is switched off', () => {
    const a = body({ x: 0, rogue: true })
    const b = body({ x: 0.1 })
    expect(applyRogueGravity([a, b], 0.01, { ...FIELD, boost: 0 })).toEqual([])
    expect(b.vx).toBe(0)
  })
})

describe('applyRogueGravity — waking', () => {
  it('wakes a stable planet that is pulled hard enough', () => {
    const a = body({ x: 0, rogue: true })
    const b = body({ x: 0.05 })
    const woken = applyRogueGravity([a, b], 0.01, FIELD)
    expect(woken).toEqual([b])
    expect(b.rogue).toBe(true)
  })

  it('does NOT wake on the weak pull near the rim — it only bends the orbit', () => {
    const a = body({ x: 0, rogue: true })
    const b = body({ x: 0.33 }) // inside the field, but barely pulled
    const woken = applyRogueGravity([a, b], 0.01, FIELD)
    expect(woken).toEqual([])
    expect(b.rogue).toBe(false)
    expect(b.vx).toBeLessThan(0) // still felt something
  })

  it('cancels opposing pulls instead of adding them up', () => {
    // Two rogues either side at equal distance: the net pull is zero, so the
    // planet between them must not wake even though each pull is strong.
    const left = body({ x: -0.05, rogue: true })
    const middle = body({ x: 0 })
    const right = body({ x: 0.05, rogue: true })
    const woken = applyRogueGravity([left, middle, right], 0.01, FIELD)
    expect(woken).toEqual([])
    expect(middle.rogue).toBe(false)
  })

  it('never wakes anything when wake is off (the shot preview)', () => {
    const a = body({ x: 0, rogue: true })
    const b = body({ x: 0.05 })
    const woken = applyRogueGravity([a, b], 0.01, { ...FIELD, wake: false })
    expect(woken).toEqual([])
    expect(b.rogue).toBe(false)
    expect(b.vx).not.toBe(0) // but the force still applies
  })

  it('gives the same result whatever order the bodies are listed in', () => {
    const build = () => [
      body({ x: 0, rogue: true }),
      body({ x: 0.05 }),
      body({ x: 0.26, mass: 8e-6 }),
    ]
    const forward = build()
    const reversed = build().reverse()
    applyRogueGravity(forward, 0.01, FIELD)
    applyRogueGravity(reversed, 0.01, FIELD)
    reversed.reverse()
    for (let i = 0; i < forward.length; i++) {
      expect(reversed[i].vx).toBeCloseTo(forward[i].vx, 12)
      expect(reversed[i].rogue).toBe(forward[i].rogue)
    }
  })

  it('cascades over successive steps, not within one', () => {
    // c is inside a's field but too far to be woken by it; it IS close enough to
    // b, which a wakes first. So the chain reaction takes two steps to reach it.
    const a = body({ x: 0, rogue: true })
    const b = body({ x: 0.05 })
    const c = body({ x: 0.26 })
    expect(applyRogueGravity([a, b, c], 0.01, FIELD)).toEqual([b])
    expect(c.rogue).toBe(false)
    expect(applyRogueGravity([a, b, c], 0.01, FIELD)).toEqual([c])
  })
})

describe('wakeRadius', () => {
  it('is inside the influence radius', () => {
    const r = wakeRadius(3e-6, FIELD)
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThan(FIELD.influenceR)
  })

  it('agrees with where waking actually happens', () => {
    const r = wakeRadius(3e-6, FIELD)
    const justInside = () => {
      const a = body({ x: 0, rogue: true })
      const b = body({ x: r * 0.97 })
      return applyRogueGravity([a, b], 0.01, FIELD).length
    }
    const justOutside = () => {
      const a = body({ x: 0, rogue: true })
      const b = body({ x: r * 1.03 })
      return applyRogueGravity([a, b], 0.01, FIELD).length
    }
    expect(justInside()).toBe(1)
    expect(justOutside()).toBe(0)
  })

  it('reaches further for a heavier planet', () => {
    expect(wakeRadius(8e-6, FIELD)).toBeGreaterThan(wakeRadius(8e-7, FIELD))
  })

  it('is 0 when a body is far too light to wake anything', () => {
    expect(wakeRadius(1e-12, FIELD)).toBe(0)
  })

  it('is 0 when the mechanic is off', () => {
    expect(wakeRadius(3e-6, { ...FIELD, boost: 0 })).toBe(0)
  })
})
