import { describe, it, expect } from 'vitest'
import { seededRandom } from './rng.js'

describe('seededRandom', () => {
  it('is deterministic for a given seed', () => {
    const a = seededRandom(12345)
    const b = seededRandom(12345)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = seededRandom(1)
    const b = seededRandom(2)
    expect(a()).not.toBe(b())
  })

  it('stays within [0, 1)', () => {
    const r = seededRandom(0xdeadbeef)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
