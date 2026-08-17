import { describe, it, expect } from 'vitest'
import { radiusFromMass, deltaVFromShot } from './planets.js'

describe('radiusFromMass', () => {
  it('maps the reference mass to the reference radius', () => {
    expect(radiusFromMass(3e-6, { refMass: 3e-6, refRadius: 0.02 })).toBeCloseTo(0.02, 10)
  })

  it('is constant-density by default: 8× the mass is 2× the radius', () => {
    const r1 = radiusFromMass(1e-6, { refMass: 1e-6, refRadius: 0.01 })
    const r8 = radiusFromMass(8e-6, { refMass: 1e-6, refRadius: 0.01 })
    expect(r8 / r1).toBeCloseTo(2, 10)
  })

  it('grows monotonically with mass', () => {
    const masses = [1e-7, 5e-7, 1e-6, 5e-6, 1e-5]
    const radii = masses.map((m) => radiusFromMass(m))
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThan(radii[i - 1])
  })

  it('exponent 0 makes every planet the same size', () => {
    const opts = { refRadius: 0.02, exponent: 0, minRadius: 0 }
    expect(radiusFromMass(1e-7, opts)).toBeCloseTo(0.02, 10)
    expect(radiusFromMass(1e-4, opts)).toBeCloseTo(0.02, 10)
  })

  it('never returns less than minRadius, including for junk input', () => {
    expect(radiusFromMass(1e-30, { minRadius: 0.004 })).toBe(0.004)
    expect(radiusFromMass(0, { minRadius: 0.004 })).toBe(0.004)
    expect(radiusFromMass(-1, { minRadius: 0.004 })).toBe(0.004)
  })
})

describe('deltaVFromShot', () => {
  it('gives a reference-mass planet exactly the requested power', () => {
    expect(deltaVFromShot(4, 3e-6, { refMass: 3e-6 })).toBeCloseTo(4, 10)
  })

  it('moves heavier planets less and lighter planets more', () => {
    const opts = { refMass: 1e-6, massExponent: 0.5 }
    const heavy = deltaVFromShot(1, 4e-6, opts)
    const light = deltaVFromShot(1, 2.5e-7, opts)
    expect(heavy).toBeCloseTo(0.5, 10) // sqrt(1/4)
    expect(light).toBeCloseTo(2, 10) // sqrt(4)
  })

  it('massExponent 1 is true impulse physics (Δv = J/m)', () => {
    const opts = { refMass: 1e-6, massExponent: 1 }
    expect(deltaVFromShot(1, 1e-5, opts)).toBeCloseTo(0.1, 10)
  })

  it('massExponent 0 ignores mass entirely (classic pool)', () => {
    const opts = { refMass: 1e-6, massExponent: 0 }
    expect(deltaVFromShot(3, 1e-9, opts)).toBeCloseTo(3, 10)
    expect(deltaVFromShot(3, 1e-3, opts)).toBeCloseTo(3, 10)
  })

  it('falls back to the raw power for a massless body', () => {
    expect(deltaVFromShot(2, 0)).toBe(2)
  })
})
