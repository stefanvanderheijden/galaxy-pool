import { describe, it, expect } from 'vitest'
import { G_SIM, SOFTENING, AU_KM, PX_PER_AU, MAX_DT, SECONDS_PER_YEAR } from './units.js'

describe('units', () => {
  it('G_SIM equals 4π² (Kepler units)', () => {
    expect(G_SIM).toBeCloseTo(4 * Math.PI * Math.PI)
  })

  it('a circular orbit at r=1 AU has the expected velocity v = sqrt(G/r)', () => {
    // For M = 1 M☉ at r = 1 AU, v should be 2π AU/yr (Earth's orbital speed).
    const r = 1
    const v = Math.sqrt(G_SIM / r)
    expect(v).toBeCloseTo(2 * Math.PI)
  })

  it('constants are positive and finite', () => {
    for (const c of [G_SIM, SOFTENING, AU_KM, PX_PER_AU, MAX_DT, SECONDS_PER_YEAR]) {
      expect(Number.isFinite(c)).toBe(true)
      expect(c).toBeGreaterThan(0)
    }
  })

  it('SECONDS_PER_YEAR matches a Julian year', () => {
    expect(SECONDS_PER_YEAR).toBe(365.25 * 24 * 3600)
  })
})
