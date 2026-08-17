// Continuous time warp — the model behind the curved speed band.
//
// Ported from the hyperwarp feel rig (public/hyperwarp.html), which got this
// right where the older stepped control did not. Two ideas make it work:
//
//   1. A CONTINUOUS slider, not four fixed steps. You hold a key and the clock
//      slides; there is no jump between "too slow to watch" and "too fast to
//      follow", and the position itself is a readable piece of state.
//
//   2. A PINNED CENTRE. The scale is log-linear in two halves with the sketch's
//      normal cruising speed pinned exactly at t = 0.5 — the left half spans
//      min→mid, the right half mid→max. So the resting position of the control
//      is the speed the game is actually played at, and both "slow down to
//      watch" and "wind forward" are deflections away from home. The two halves
//      cover very different numbers of decades on purpose: fine control where
//      you need it, range where you don't.
//
// With `spring` on, letting go of both keys pulls the slider back to that centre
// — time control becomes something you hold, like a throttle, rather than a mode
// you leave switched on.

/**
 * Warp multiplier for a slider position.
 * @param {number} t 0..1
 */
export function warpAt(t, { min = 1, mid = 1e5, max = 5e6 } = {}) {
  const clamped = Math.max(0, Math.min(1, t))
  const logMin = Math.log10(min)
  const logMid = Math.log10(mid)
  const logMax = Math.log10(max)
  return clamped <= 0.5
    ? Math.pow(10, logMin + (clamped / 0.5) * (logMid - logMin))
    : Math.pow(10, logMid + ((clamped - 0.5) / 0.5) * (logMax - logMid))
}

/**
 * Slider position that produces a given warp — the inverse of warpAt, for
 * jumping the control to a preset.
 */
export function tForWarp(warp, { min = 1, mid = 1e5, max = 5e6 } = {}) {
  const w = Math.max(min, Math.min(max, warp))
  const logMin = Math.log10(min)
  const logMid = Math.log10(mid)
  const logMax = Math.log10(max)
  const logW = Math.log10(w)
  return logW <= logMid
    ? (0.5 * (logW - logMin)) / (logMid - logMin)
    : 0.5 + (0.5 * (logW - logMid)) / (logMax - logMid)
}

/**
 * Split a frame's worth of simulated time into integration substeps.
 *
 * At high warp a single Euler step per frame is far too coarse — orbits precess,
 * close passes tunnel straight through each other, and a shot lands somewhere
 * the preview never predicted. Capping the step size fixes that; capping the
 * COUNT means a slow frame degrades accuracy instead of freezing the tab.
 *
 * @returns {{steps: number, h: number}} number of substeps and the step size
 */
export function planSubsteps(dtYr, { maxStep = 1e-4, maxSteps = 64 } = {}) {
  if (!(dtYr > 0)) return { steps: 0, h: 0 }
  const steps = dtYr > maxStep ? Math.min(maxSteps, Math.ceil(dtYr / maxStep)) : 1
  return { steps, h: dtYr / steps }
}

/**
 * A live time-warp control.
 *
 * @param {object} [opts]
 * @param {number} [opts.min] warp at the far left of the slider
 * @param {number} [opts.mid] warp pinned at the centre — the sketch's home speed
 * @param {number} [opts.max] warp at the far right
 * @param {number} [opts.slideRate] slider travel per second while a key is held
 * @param {number} [opts.springRate] how fast it returns to centre when released
 * @param {number} [opts.easeRate] how fast the displayed bead catches the value
 * @param {boolean} [opts.spring] return to centre on release
 */
export function createTimeWarp({
  min = 1,
  mid = 1e5,
  max = 5e6,
  slideRate = 0.45,
  springRate = 3,
  easeRate = 10,
  spring = true,
} = {}) {
  const range = { min, mid, max }

  return {
    range,
    spring,
    slideRate,
    springRate,
    easeRate,
    // The real position, and the eased twin the bead is drawn at so the display
    // glides instead of snapping when the value jumps to a preset.
    t: 0.5,
    shown: 0.5,

    warp() {
      return warpAt(this.t, this.range)
    },

    /** Warp at the DISPLAYED position — what the readout should say. */
    shownWarp() {
      return warpAt(this.shown, this.range)
    },

    /** Jump straight to a multiplier (a preset key). The bead eases across. */
    setWarp(warp) {
      this.t = tForWarp(warp, this.range)
    },

    reset() {
      this.t = 0.5
      this.shown = 0.5
    },

    /**
     * Advance the control one frame.
     * @param {number} realDt seconds of wall-clock time
     * @param {{slower?: boolean, faster?: boolean}} input held keys
     */
    update(realDt, { slower = false, faster = false } = {}) {
      if (slower) this.t = Math.max(0, this.t - this.slideRate * realDt)
      if (faster) this.t = Math.min(1, this.t + this.slideRate * realDt)
      if (this.spring && !slower && !faster) {
        this.t += (0.5 - this.t) * Math.min(1, realDt * this.springRate)
      }
      this.shown += (this.t - this.shown) * Math.min(1, realDt * this.easeRate)
      return this.warp()
    },

    /** How far the slider is from home, 0..1 — for cost or display emphasis. */
    deflection() {
      return Math.abs(this.t - 0.5) * 2
    },
  }
}

/** Compact label for a multiplier: 250x, 100K, 5.0M. */
export function formatWarp(warp) {
  if (warp < 1000) return `${warp.toFixed(0)}×`
  if (warp < 1e6) return `${(warp / 1000).toFixed(0)}K`
  return `${(warp / 1e6).toFixed(1)}M`
}
