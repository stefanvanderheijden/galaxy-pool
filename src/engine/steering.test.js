import { describe, it, expect } from 'vitest'
import { computeThrust, getThrustState, SPEED_FRAME_MIN } from './steering.js'

const NO_KEYS = { w: false, a: false, s: false, d: false, space: false }
const keys = (over) => ({ ...NO_KEYS, ...over })

// Baseline ship state helper.
function base(over = {}) {
  return {
    vx: 0,
    vy: 0,
    shipAngle: 0,
    keys: NO_KEYS,
    steering: 'drift',
    thrust: 100,
    dt_yr: 0.01,
    realDt_s: 0.016,
    turnSpeed: 3.5,
    ...over,
  }
}

describe('computeThrust — spacebar', () => {
  it('always requests a brake, in any mode', () => {
    for (const steering of ['tank', 'screen', 'drift']) {
      const r = computeThrust(base({ steering, keys: keys({ space: true }) }))
      expect(r.brake).toBe(true)
      expect(r.active).toBe(true)
    }
  })
})

describe('computeThrust — tank', () => {
  it('A/D rotate the heading without thrusting', () => {
    const left = computeThrust(base({ steering: 'tank', shipAngle: 0, keys: keys({ a: true }) }))
    expect(left.shipAngle).toBeCloseTo(-3.5 * 0.016)
    expect(left.dvx).toBe(0)
    expect(left.dvy).toBe(0)
    expect(left.active).toBe(false)

    const right = computeThrust(base({ steering: 'tank', shipAngle: 0, keys: keys({ d: true }) }))
    expect(right.shipAngle).toBeCloseTo(3.5 * 0.016)
  })

  it('W thrusts forward along the heading', () => {
    const r = computeThrust(base({ steering: 'tank', shipAngle: 0, keys: keys({ w: true }) }))
    // heading 0 → +x
    expect(r.dvx).toBeCloseTo(100 * 0.01)
    expect(r.dvy).toBeCloseTo(0)
    expect(r.particle).toEqual({ power: 1, angle: 0 })
  })

  it('S requests a brake', () => {
    const r = computeThrust(base({ steering: 'tank', vx: 5, keys: keys({ s: true }) }))
    expect(r.brake).toBe(true)
  })
})

describe('computeThrust — screen', () => {
  it('maps W/S/A/D to absolute screen directions (+y is down)', () => {
    const up = computeThrust(base({ steering: 'screen', keys: keys({ w: true }) }))
    expect(up.dvy).toBeLessThan(0) // up = -y
    expect(up.dvx).toBeCloseTo(0)

    const down = computeThrust(base({ steering: 'screen', keys: keys({ s: true }) }))
    expect(down.dvy).toBeGreaterThan(0)

    const left = computeThrust(base({ steering: 'screen', keys: keys({ a: true }) }))
    expect(left.dvx).toBeLessThan(0)

    const right = computeThrust(base({ steering: 'screen', keys: keys({ d: true }) }))
    expect(right.dvx).toBeGreaterThan(0)
  })

  it('normalizes diagonal thrust to single-axis magnitude', () => {
    const diag = computeThrust(base({ steering: 'screen', keys: keys({ w: true, d: true }) }))
    const mag = Math.hypot(diag.dvx, diag.dvy)
    expect(mag).toBeCloseTo(100 * 0.01) // same as one axis
  })

  it('coasts (no thrust) when no direction key is held', () => {
    const r = computeThrust(base({ steering: 'screen', vx: 3, vy: 4, keys: NO_KEYS }))
    expect(r.active).toBe(false)
    expect(r.particle).toBeNull()
    // nose points along travel
    expect(r.shipAngle).toBeCloseTo(Math.atan2(4, 3))
  })
})

describe('computeThrust — drift', () => {
  it('W accelerates along the direction of travel (prograde)', () => {
    const r = computeThrust(base({ steering: 'drift', vx: 10, vy: 0, keys: keys({ w: true }) }))
    expect(r.dvx).toBeGreaterThan(0) // travelling +x, prograde adds +x
    expect(r.dvy).toBeCloseTo(0)
  })

  it('S alone is a clamped retrograde brake', () => {
    const r = computeThrust(base({ steering: 'drift', vx: 10, vy: 0, keys: keys({ s: true }) }))
    expect(r.brake).toBe(true)
  })

  it('A thrusts to port (left of travel); D to starboard', () => {
    // Travelling +x. Port (left of an +x traveller, +y down) is -y (screen up).
    const port = computeThrust(base({ steering: 'drift', vx: 10, vy: 0, keys: keys({ a: true }) }))
    expect(port.dvy).toBeLessThan(0)
    expect(port.dvx).toBeCloseTo(0)

    const starboard = computeThrust(
      base({ steering: 'drift', vx: 10, vy: 0, keys: keys({ d: true }) }),
    )
    expect(starboard.dvy).toBeGreaterThan(0)
  })

  it('falls back to ship facing when nearly stationary', () => {
    const r = computeThrust(
      base({ steering: 'drift', vx: 0, vy: 0, shipAngle: Math.PI / 2, keys: keys({ w: true }) }),
    )
    // facing +y (down), prograde adds +y
    expect(r.dvy).toBeGreaterThan(0)
    expect(r.dvx).toBeCloseTo(0)
  })

  it('SPEED_FRAME_MIN is the stationary threshold', () => {
    expect(SPEED_FRAME_MIN).toBeGreaterThan(0)
    const justBelow = computeThrust(
      base({
        steering: 'drift',
        vx: SPEED_FRAME_MIN / 2,
        vy: 0,
        shipAngle: 0,
        keys: keys({ w: true }),
      }),
    )
    // below threshold → uses shipAngle (0 → +x); still thrusts +x here, but the
    // point is it doesn't read velocity direction.
    expect(justBelow.dvx).toBeGreaterThan(0)
  })

  it('normalizes prograde + lateral so a diagonal never exceeds single-axis thrust', () => {
    const r = computeThrust(
      base({ steering: 'drift', vx: 10, vy: 0, keys: keys({ w: true, a: true }) }),
    )
    const mag = Math.hypot(r.dvx, r.dvy)
    expect(mag).toBeCloseTo(100 * 0.01)
  })
})

describe('getThrustState (HUD classifier)', () => {
  it('space → brake in all modes', () => {
    for (const steering of ['tank', 'screen', 'drift']) {
      expect(getThrustState({ keys: keys({ space: true }), steering }).mode).toBe('brake')
    }
  })

  it('tank: S=brake, W=forward, idle=coast', () => {
    expect(getThrustState({ keys: keys({ s: true }), steering: 'tank' }).mode).toBe('brake')
    expect(getThrustState({ keys: keys({ w: true }), steering: 'tank' }).mode).toBe('forward')
    expect(getThrustState({ keys: NO_KEYS, steering: 'tank' }).mode).toBe('coast')
  })

  it('screen: any direction is forward (S is just down-thrust, not a brake)', () => {
    expect(getThrustState({ keys: keys({ s: true }), steering: 'screen' }).mode).toBe('forward')
    expect(getThrustState({ keys: keys({ a: true }), steering: 'screen' }).mode).toBe('forward')
  })

  it('drift: S alone is brake, but S+lateral is thrust', () => {
    expect(getThrustState({ keys: keys({ s: true }), steering: 'drift' }).mode).toBe('brake')
    expect(getThrustState({ keys: keys({ s: true, a: true }), steering: 'drift' }).mode).toBe(
      'forward',
    )
  })
})
