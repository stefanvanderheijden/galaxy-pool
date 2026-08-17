import { describe, it, expect } from 'vitest'
import { createCamera } from './camera.js'

describe('camera', () => {
  it('round-trips world → screen → world', () => {
    const cam = createCamera({ zoom: 2.5, panX: 340, panY: 120, pxPerAU: 100 })
    const p = cam.worldToScreen(1.3, -0.7)
    const back = cam.screenToWorld(p.x, p.y)
    expect(back.x).toBeCloseTo(1.3, 10)
    expect(back.y).toBeCloseTo(-0.7, 10)
  })

  it('places the world origin at the pan offset', () => {
    const cam = createCamera({ zoom: 1, panX: 400, panY: 300 })
    expect(cam.worldToScreen(0, 0)).toEqual({ x: 400, y: 300 })
  })

  it('keeps the point under the cursor pinned while zooming', () => {
    const cam = createCamera({ zoom: 1, panX: 400, panY: 300, pxPerAU: 100 })
    const before = cam.screenToWorld(510, 260)
    cam.zoomAt(1.6, 510, 260)
    const after = cam.screenToWorld(510, 260)
    expect(after.x).toBeCloseTo(before.x, 10)
    expect(after.y).toBeCloseTo(before.y, 10)
    expect(cam.zoom).toBeCloseTo(1.6, 10)
  })

  it('clamps zoom to its bounds', () => {
    const cam = createCamera({ zoom: 1, minZoom: 0.5, maxZoom: 4 })
    cam.zoomAt(100, 0, 0)
    expect(cam.zoom).toBe(4)
    cam.zoomAt(0.001, 0, 0)
    expect(cam.zoom).toBe(0.5)
  })

  it('centerOn puts a world point at the viewport centre', () => {
    const cam = createCamera({ zoom: 3, pxPerAU: 100 })
    cam.centerOn(2, -1, 800, 600)
    const p = cam.worldToScreen(2, -1)
    expect(p.x).toBeCloseTo(400, 10)
    expect(p.y).toBeCloseTo(300, 10)
  })

  it('worldCenter is the inverse of centerOn', () => {
    const cam = createCamera({ zoom: 0.8, pxPerAU: 100 })
    cam.centerOn(-1.5, 2.25, 1024, 768)
    const c = cam.worldCenter(1024, 768)
    expect(c.x).toBeCloseTo(-1.5, 10)
    expect(c.y).toBeCloseTo(2.25, 10)
  })

  it('tickZoom eases toward the target without overshooting', () => {
    const cam = createCamera({ zoom: 1 })
    cam.targetZoom = 5
    const first = (cam.tickZoom(0.5), cam.zoom)
    expect(first).toBeCloseTo(3, 10)
    for (let i = 0; i < 60; i++) cam.tickZoom(0.5)
    expect(cam.zoom).toBeCloseTo(5, 6)
  })

  it('fitPoints frames every point inside the viewport', () => {
    const cam = createCamera({ zoom: 1, pxPerAU: 100 })
    const pts = [
      { x: -2, y: -1 },
      { x: 2, y: 1 },
      { x: 0.5, y: 0.25 },
    ]
    cam.fitPoints(pts, 800, 600, { padding: 0.2 })
    for (const p of pts) {
      const s = cam.worldToScreen(p.x, p.y)
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThanOrEqual(800)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThanOrEqual(600)
    }
  })

  it('fitPoints on an empty set leaves the camera alone', () => {
    const cam = createCamera({ zoom: 2, panX: 10, panY: 20 })
    cam.fitPoints([], 800, 600)
    expect(cam.zoom).toBe(2)
    expect(cam.panX).toBe(10)
  })
})
