import { describe, it, expect } from 'vitest'
import { wrap, buildStarfieldData } from './starfield.js'

describe('wrap', () => {
  it('leaves in-range values untouched', () => {
    expect(wrap(30, 100)).toBe(30)
  })

  it('wraps past the top', () => {
    expect(wrap(130, 100)).toBe(30)
  })

  it('wraps negatives into range (not the JS % sign behaviour)', () => {
    expect(wrap(-30, 100)).toBe(70)
    expect(wrap(-230, 100)).toBe(70)
  })
})

describe('buildStarfieldData', () => {
  it('is deterministic for a seed, so the sky is stable across resizes', () => {
    const a = buildStarfieldData(800, 600)
    const b = buildStarfieldData(800, 600)
    expect(a.starLayers[0].stars[0]).toEqual(b.starLayers[0].stars[0])
    expect(a.nebulaClouds[3]).toEqual(b.nebulaClouds[3])
  })

  it('gives different seeds different skies', () => {
    const a = buildStarfieldData(800, 600, { starSeed: 1 })
    const b = buildStarfieldData(800, 600, { starSeed: 2 })
    expect(a.starLayers[0].stars[0]).not.toEqual(b.starLayers[0].stars[0])
  })

  it('tiles well beyond the viewport so wrap seams stay off-screen', () => {
    const { tw, th } = buildStarfieldData(1000, 800)
    expect(tw).toBeGreaterThanOrEqual(1000 * 3)
    expect(th).toBeGreaterThanOrEqual(800 * 3)
  })

  it('never tiles smaller than the floor, even for a tiny viewport', () => {
    const { tw, th } = buildStarfieldData(10, 10)
    expect(tw).toBe(2800)
    expect(th).toBe(2200)
  })

  it('keeps every star inside its tile', () => {
    const { starLayers, tw, th } = buildStarfieldData(800, 600)
    for (const layer of starLayers) {
      for (const star of layer.stars) {
        expect(star.x).toBeGreaterThanOrEqual(0)
        expect(star.x).toBeLessThan(tw)
        expect(star.y).toBeGreaterThanOrEqual(0)
        expect(star.y).toBeLessThan(th)
      }
    }
  })
})
