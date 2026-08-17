// Canvas plumbing every sketch needs: size the canvas to its container, keep it
// sized as the window changes, run a requestAnimationFrame loop with a clamped
// real delta, and hand back a single teardown function.
//
// A sketch supplies only the two callbacks that differ between game modes:
//   onResize(w, h, isFirst) — (re)build anything that depends on viewport size
//   onFrame(realDt, ctx, w, h) — advance and draw one frame
//
// Deliberately NOT handled here: input. Every mode binds its own mouse/key
// listeners, because what a click means is the whole point of a prototype.

import { MAX_DT } from '../engine/units.js'

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 * @param {number|(() => number)} [opts.bottomInset]  px of the container reserved
 *        for an overlaid control bar. Pass a function to measure it on every
 *        resize, for a bar whose height depends on what it is showing.
 * @param {number} [opts.maxDt]        cap on the per-frame real delta, in seconds
 * @param {(w: number, h: number, isFirst: boolean) => void} [opts.onResize]
 * @param {(realDt: number, ctx: CanvasRenderingContext2D, w: number, h: number) => void} opts.onFrame
 * @returns {{stop: Function, width: Function, height: Function, context: Function, resetClock: Function}}
 */
export function useCanvasLoop(canvas, { bottomInset = 0, maxDt = MAX_DT, onResize, onFrame }) {
  const insetPx = () => (typeof bottomInset === 'function' ? bottomInset() : bottomInset) || 0

  let ctx = null
  let w = 0
  let h = 0
  let rafId = null
  let lastTime = null
  let resized = false

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect()
    w = rect.width
    // The control bar is an overlay, not a sibling in flow, so the canvas has to
    // reserve its height explicitly or the bottom of the scene hides behind it.
    h = Math.max(0, rect.height - insetPx())
    canvas.width = w
    canvas.height = h
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    // A resize invalidates the 2D context's state, so re-fetch it.
    ctx = canvas.getContext('2d')

    const isFirst = !resized
    resized = true
    onResize?.(w, h, isFirst)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas.parentElement)
  resize()

  function loop(ts) {
    // First frame after a start or a clock reset advances nothing — there is no
    // previous timestamp to measure against, and using one would jump the sim.
    const realDt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, maxDt)
    lastTime = ts
    if (ctx) onFrame(realDt, ctx, w, h)
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)

  return {
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = null
      observer.disconnect()
    },
    /** Drop the frame clock so the next frame reports dt 0 (used by reset). */
    resetClock() {
      lastTime = null
    },
    width: () => w,
    height: () => h,
    context: () => ctx,
  }
}
