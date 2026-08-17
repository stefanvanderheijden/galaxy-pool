import { describe, it, expect } from 'vitest'
import { wrap, wrapCentered, buildStarfieldData, layerVisibility } from './starfield.js'

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

describe('wrapCentered', () => {
  it('centres the tile on zero', () => {
    expect(wrapCentered(0, 100)).toBe(0)
    expect(wrapCentered(10, 100)).toBe(10)
    expect(wrapCentered(-10, 100)).toBe(-10)
  })

  it('wraps past either edge back to the opposite one', () => {
    expect(wrapCentered(60, 100)).toBe(-40)
    expect(wrapCentered(-60, 100)).toBe(40)
  })

  it('always lands inside [-size/2, size/2)', () => {
    for (const v of [-999, -321, -50, 0, 49, 137, 5000]) {
      const r = wrapCentered(v, 100)
      expect(r).toBeGreaterThanOrEqual(-50)
      expect(r).toBeLessThan(50)
    }
  })
})

describe('buildStarfieldData', () => {
  it('is deterministic for a seed, so the sky is stable across reloads', () => {
    const a = buildStarfieldData()
    const b = buildStarfieldData()
    expect(a.layers[0].stars[0]).toEqual(b.layers[0].stars[0])
    expect(a.nebula[3]).toEqual(b.nebula[3])
  })

  it('gives different seeds different skies', () => {
    const a = buildStarfieldData({ seed: 1 })
    const b = buildStarfieldData({ seed: 2 })
    expect(a.layers[0].stars[0]).not.toEqual(b.layers[0].stars[0])
  })

  it('builds every layer at its declared count', () => {
    const { layers } = buildStarfieldData()
    expect(layers.length).toBeGreaterThan(3)
    for (const layer of layers) expect(layer.stars).toHaveLength(layer.count)
  })

  it('keeps every star inside its own layer tile', () => {
    const { layers } = buildStarfieldData()
    for (const layer of layers) {
      for (const star of layer.stars) {
        expect(star.wx).toBeGreaterThanOrEqual(0)
        expect(star.wx).toBeLessThan(layer.tileAU)
        expect(star.wy).toBeGreaterThanOrEqual(0)
        expect(star.wy).toBeLessThan(layer.tileAU)
      }
    }
  })

  it('has layers both behind and in front of the world', () => {
    const { layers } = buildStarfieldData()
    const behind = layers.filter((l) => !l.front)
    const front = layers.filter((l) => l.front)
    expect(behind.length).toBeGreaterThan(0)
    expect(front.length).toBeGreaterThan(0)
    // k is the whole model: below 1 is behind the world, above 1 is in front.
    for (const l of behind) expect(l.k).toBeLessThan(1)
    for (const l of front) expect(l.k).toBeGreaterThan(1)
  })

  it('spreads footprints across decades, so layers cover different zooms', () => {
    const { layers } = buildStarfieldData()
    const footprints = layers.map((l) => l.tileAU * l.k)
    // A ladder, not a cluster: if every layer had the same footprint they would
    // all populate and all empty at exactly the same zoom.
    expect(Math.max(...footprints) / Math.min(...footprints)).toBeGreaterThan(30)
  })

  it('orders the ladder widest footprint first', () => {
    const { layers } = buildStarfieldData()
    for (let i = 1; i < layers.length; i++) {
      const here = layers[i].tileAU * layers[i].k
      const before = layers[i - 1].tileAU * layers[i - 1].k
      expect(here).toBeLessThan(before)
    }
  })
})

describe('layerVisibility', () => {
  it('hides a layer whose tile would read as a repeating grid', () => {
    expect(layerVisibility(0.04, 140, 1400)).toBe(0)
  })

  it('only shows a layer once its tile OVERFLOWS the viewport', () => {
    // At or below 1 the square tile-edge fade is on screen — a box of stars.
    expect(layerVisibility(1, 140, 1400)).toBe(0)
    expect(layerVisibility(30, 140, 1400)).toBe(1)
  })

  it('fades in rather than popping', () => {
    const mid = layerVisibility(20, 140, 1400)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })

  it('rises monotonically with zoom', () => {
    let prev = -1
    for (const scale of [50, 100, 200, 400, 800, 1600, 3200]) {
      const v = layerVisibility(20, scale, 1400)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('hands over: at every zoom there are stars both behind and in front', () => {
    const { layers } = buildStarfieldData()
    for (const scale of [30, 70, 140, 400, 1200, 4000, 12000, 40000]) {
      const live = layers.filter((l) => layerVisibility(l.tileAU * l.k, scale, 1400) > 0.5)
      expect(
        live.some((l) => !l.front),
        `behind, scale ${scale}`,
      ).toBe(true)
      expect(
        live.some((l) => l.front),
        `front, scale ${scale}`,
      ).toBe(true)
    }
  })

  it('never shows a layer whose square tile edge would fall inside the view', () => {
    // This is the "field is just a box" bug: a tile smaller than the viewport
    // shows its own fade boundary as a square of stars in empty space.
    const { layers } = buildStarfieldData()
    const halfDiagonal = Math.hypot(1400, 900) / 2
    for (const scale of [30, 140, 1200, 12000]) {
      for (const layer of layers) {
        if (layerVisibility(layer.tileAU * layer.k, scale, 1400) <= 0) continue
        expect((layer.tileAU * layer.k * scale) / 2).toBeGreaterThan(halfDiagonal)
      }
    }
  })

  it('is inert for a zero-sized viewport', () => {
    expect(layerVisibility(10, 140, 0)).toBe(0)
  })
})
