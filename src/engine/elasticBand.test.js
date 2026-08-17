import { describe, it, expect } from 'vitest'
import { bandResponse, bandShape } from './elasticBand.js'

// A band along the x axis from (0,0) to (2,0), stretching 0.5 before letting go.
const BAND = { x1: 0, y1: 0, x2: 2, y2: 0, reach: 0.5, stiffness: 40 }

// Approaching from above (+y) means the remembered outside side is +1.
const FROM_ABOVE = 1

describe('bandResponse — which side, and whether it touches at all', () => {
  it('does nothing to a planet that has not reached the band yet', () => {
    // Inside the strip, but still on the side it came from.
    expect(bandResponse(BAND, 1, 0.2, FROM_ABOVE).engaged).toBe(false)
  })

  it('catches a planet that has crossed the rest line', () => {
    expect(bandResponse(BAND, 1, -0.2, FROM_ABOVE).engaged).toBe(true)
  })

  it('remembers the side while a planet is well clear of the band', () => {
    expect(bandResponse(BAND, 1, 0.9, 0).side).toBe(1)
    expect(bandResponse(BAND, 1, -0.9, 0).side).toBe(-1)
  })

  it('never catches a planet it has not seen outside first', () => {
    expect(bandResponse(BAND, 1, -0.2, 0).engaged).toBe(false)
  })

  it('lets go once a planet punches further than the band can stretch', () => {
    expect(bandResponse(BAND, 1, -0.6, FROM_ABOVE).engaged).toBe(false)
    // ...and it is now outside on the far side.
    expect(bandResponse(BAND, 1, -0.6, FROM_ABOVE).side).toBe(-1)
  })

  it('ignores a planet past either anchor, however close', () => {
    expect(bandResponse(BAND, -0.1, -0.01, FROM_ABOVE).engaged).toBe(false)
    expect(bandResponse(BAND, 2.1, -0.01, FROM_ABOVE).engaged).toBe(false)
  })

  it('reports where along the band the catch is', () => {
    expect(bandResponse(BAND, 0.5, -0.2, FROM_ABOVE).t).toBeCloseTo(0.25, 10)
    expect(bandResponse(BAND, 1.5, -0.2, FROM_ABOVE).t).toBeCloseTo(0.75, 10)
  })

  it('is inert for a zero-length band', () => {
    const degenerate = { x1: 1, y1: 1, x2: 1, y2: 1, reach: 0.5, stiffness: 40 }
    expect(bandResponse(degenerate, 1, 1, FROM_ABOVE).engaged).toBe(false)
  })

  it('works from the other side too', () => {
    expect(bandResponse(BAND, 1, 0.2, -1).engaged).toBe(true)
    expect(bandResponse(BAND, 1, 0.2, -1).ay).toBeLessThan(0)
  })
})

describe('bandResponse — the restoring pull', () => {
  it('pulls a caught planet back toward the rest line', () => {
    expect(bandResponse(BAND, 1, -0.2, FROM_ABOVE).ay).toBeGreaterThan(0)
  })

  it('pulls straight back when caught square in the middle', () => {
    expect(bandResponse(BAND, 1, -0.2, FROM_ABOVE).ax).toBeCloseTo(0, 10)
  })

  it('pulls mostly SIDEWAYS near an anchor, so glancing hits skid', () => {
    const middle = bandResponse(BAND, 1, -0.2, FROM_ABOVE)
    const nearEnd = bandResponse(BAND, 0.1, -0.2, FROM_ABOVE)
    expect(Math.abs(nearEnd.ax / nearEnd.ay)).toBeGreaterThan(Math.abs(middle.ax / middle.ay))
    expect(nearEnd.ax).toBeGreaterThan(0) // shoved along the band, away from A
  })

  it('grows with how deep the planet has been carried', () => {
    const shallow = bandResponse(BAND, 1, -0.05, FROM_ABOVE)
    const deep = bandResponse(BAND, 1, -0.4, FROM_ABOVE)
    expect(deep.stretch).toBeGreaterThan(shallow.stretch)
    expect(Math.hypot(deep.ax, deep.ay)).toBeGreaterThan(Math.hypot(shallow.ax, shallow.ay))
  })

  it('measures stretch as the extra length the band has been forced into', () => {
    // Dead centre at depth y: each half is hypot(1, y) against a rest length of 2.
    const y = 0.3
    const r = bandResponse(BAND, 1, -y, FROM_ABOVE)
    expect(r.stretch).toBeCloseTo(2 * Math.hypot(1, y) - 2, 10)
  })

  it('scales with stiffness', () => {
    const soft = bandResponse({ ...BAND, stiffness: 10 }, 1, -0.3, FROM_ABOVE)
    const stiff = bandResponse({ ...BAND, stiffness: 40 }, 1, -0.3, FROM_ABOVE)
    expect(Math.hypot(stiff.ax, stiff.ay)).toBeCloseTo(4 * Math.hypot(soft.ax, soft.ay), 10)
  })
})

describe('bandResponse — integrated bounce', () => {
  // Drop a planet straight down into the band and integrate until it comes back.
  function drop(speed, band) {
    let y = 0.4
    let vy = -speed
    let side = 0
    const dt = 2e-5
    for (let i = 0; i < 400000; i++) {
      const r = bandResponse(band, 1, y, side)
      side = r.side
      vy += r.ay * dt
      y += vy * dt
      if (y > 0.4) return { outcome: 'bounced', vy, y }
      if (y < -band.reach * 1.5) return { outcome: 'through', vy, y }
    }
    return { outcome: 'stuck', vy, y }
  }

  it('stops a planet and sends it back the way it came', () => {
    const r = drop(3, { ...BAND, stiffness: 4000 })
    expect(r.outcome).toBe('bounced')
    expect(r.vy).toBeGreaterThan(0)
  })

  it('returns nearly all the speed — it is elastic, not a sponge', () => {
    const r = drop(3, { ...BAND, stiffness: 4000 })
    expect(r.vy).toBeCloseTo(3, 1)
  })

  it('lets a hard enough hit punch through', () => {
    expect(drop(30, { ...BAND, stiffness: 4000 }).outcome).toBe('through')
  })

  it('holds a harder hit when it is stiffer', () => {
    expect(drop(30, { ...BAND, stiffness: 400000 }).outcome).toBe('bounced')
  })
})

describe('bandShape', () => {
  it('is a straight line at rest', () => {
    expect(bandShape(BAND, null)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ])
  })

  it('bends through the contact point when engaged', () => {
    const shape = bandShape(BAND, { x: 1, y: -0.2 })
    expect(shape).toHaveLength(3)
    expect(shape[1]).toEqual({ x: 1, y: -0.2 })
  })
})
