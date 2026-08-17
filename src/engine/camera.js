// A 2D world camera: world↔screen conversion, cursor-anchored zoom, and eased
// zoom animation. Shared by every sketch so they all pan, zoom and frame the
// same way.
//
// The world is in AU; the camera maps it to pixels with
//   screen = world * (zoom * pxPerAU) + pan
// `panX/panY` are therefore the screen position of the world origin.
//
// zoom/panX/panY/focus stay plain mutable fields because draw code reads them
// dozens of times per frame and a getter/setter layer would only be noise.

import { PX_PER_AU } from './units.js'

/**
 * @param {object} [opts]
 * @param {number} [opts.zoom]     initial zoom (1 = pxPerAU pixels per AU)
 * @param {number} [opts.panX]
 * @param {number} [opts.panY]
 * @param {number} [opts.pxPerAU]  pixels per AU at zoom 1
 * @param {number} [opts.minZoom]
 * @param {number} [opts.maxZoom]
 * @param {string} [opts.focus]    free-form focus tag owned by the sketch
 */
export function createCamera({
  zoom = 1,
  panX = 0,
  panY = 0,
  pxPerAU = PX_PER_AU,
  minZoom = 0.004,
  maxZoom = 200000,
  focus = 'free',
} = {}) {
  return {
    zoom,
    panX,
    panY,
    focus,
    // Zoom easing target — zoomAt() snaps both, animated moves set only this.
    targetZoom: zoom,
    minZoom,
    maxZoom,
    pxPerAU,

    /** Pixels per AU at the current zoom. */
    scale() {
      return this.zoom * this.pxPerAU
    },

    worldToScreen(wx, wy) {
      const s = this.scale()
      return { x: wx * s + this.panX, y: wy * s + this.panY }
    },

    screenToWorld(mx, my) {
      const s = this.scale()
      return { x: (mx - this.panX) / s, y: (my - this.panY) / s }
    },

    /** Zoom by `factor`, keeping the world point under (mx, my) pinned there. */
    zoomAt(factor, mx, my) {
      const s0 = this.scale()
      const wx = (mx - this.panX) / s0
      const wy = (my - this.panY) / s0
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor))
      this.targetZoom = this.zoom
      const s1 = this.scale()
      this.panX = mx - wx * s1
      this.panY = my - wy * s1
    },

    /** Ease `zoom` toward `targetZoom`; call once per frame. */
    tickZoom(rate = 0.08) {
      this.zoom += (this.targetZoom - this.zoom) * rate
    },

    /** Put world point (wx, wy) at the centre of a w×h viewport. */
    centerOn(wx, wy, w, h) {
      const s = this.scale()
      this.panX = w / 2 - wx * s
      this.panY = h / 2 - wy * s
    },

    /** Drag the view by a screen-space delta. */
    panBy(dx, dy) {
      this.panX += dx
      this.panY += dy
    },

    /**
     * The world point currently at the centre of the screen — the basis the
     * starfield uses for parallax.
     */
    worldCenter(w, h) {
      return this.screenToWorld(w / 2, h / 2)
    },

    /**
     * Frame a set of {x, y} world points with `padding` AU of margin, capping
     * the zoom at `maxFitZoom` so a single point doesn't zoom to infinity.
     */
    fitPoints(points, w, h, { padding = 0.35, maxFitZoom = 6 } = {}) {
      if (!points.length) return
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of points) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      const spanX = maxX - minX + padding * 2
      const spanY = maxY - minY + padding * 2
      const fit = Math.min(w / (spanX * this.pxPerAU), h / (spanY * this.pxPerAU))
      this.targetZoom = Math.max(this.minZoom, Math.min(maxFitZoom, fit))
      this.zoom = this.targetZoom
      this.centerOn((minX + maxX) / 2, (minY + maxY) / 2, w, h)
    },
  }
}
