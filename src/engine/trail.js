// Fixed-capacity ring buffer of {x, y} points for body motion trails.
//
// push() overwrites the oldest point once full; points() returns them in
// chronological (oldest-first) order. A non-positive capacity yields an inert
// trail (keeps nothing) — used for fixed bodies like the sun and to guard
// against `% 0 = NaN`.
export function makeTrail(cap) {
  if (!(cap > 0)) {
    return {
      push() {},
      points: () => [],
      clear() {},
      get length() {
        return 0
      },
    }
  }

  const buf = new Array(cap)
  let head = 0
  let size = 0

  return {
    push(x, y) {
      buf[head] = { x, y }
      head = (head + 1) % cap
      if (size < cap) size++
    },
    points() {
      const out = []
      const start = (head - size + cap) % cap
      for (let i = 0; i < size; i++) out.push(buf[(start + i) % cap])
      return out
    },
    clear() {
      head = 0
      size = 0
    },
    get length() {
      return size
    },
  }
}

// ── Drawing a trail cheaply ──────────────────────────────────────────────────
//
// A trail fades from nearly transparent at its tail to visible at its head. The
// obvious way to draw that is one stroke() per segment, each with its own alpha
// — and with a few thousand points per body that is thousands of draw calls per
// frame, which measurably dominates the frame budget (~15fps of a 57fps budget
// in sketch 002 at default settings).
//
// batchTrail() does the two things that fix it, both purely:
//
//   1. DECIMATE — drop points closer together than `minStep` (world units). When
//      zoomed out, dozens of consecutive points land on the same pixel; keeping
//      them costs draw calls and changes nothing on screen. The head point is
//      always kept, so the trail stays attached to its body.
//   2. BAND — group the remaining segments into a handful of contiguous runs,
//      each drawn as ONE polyline at a single alpha. Ten bands across a fade
//      that only spans alpha 0.02→0.20 is indistinguishable from a per-segment
//      gradient, and it is ten stroke() calls instead of thousands.
//
// Consecutive bands share their boundary point, so the polylines join without
// gaps. Each band carries `t` (0 at the tail, 1 at the head) for the caller to
// turn into an alpha or a colour.

/**
 * @param {{x: number, y: number}[]} points oldest-first, as from trail.points()
 * @param {object} [opts]
 * @param {number} [opts.bands]   how many single-alpha polylines to produce
 * @param {number} [opts.minStep] drop points closer than this to the last kept one
 * @returns {{t: number, points: {x: number, y: number}[]}[]} tail-first bands
 */
export function batchTrail(points, { bands = 10, minStep = 0 } = {}) {
  if (!points || points.length < 2) return []

  let kept = points
  if (minStep > 0) {
    kept = [points[0]]
    const min2 = minStep * minStep
    for (let i = 1; i < points.length - 1; i++) {
      const last = kept[kept.length - 1]
      const dx = points[i].x - last.x
      const dy = points[i].y - last.y
      if (dx * dx + dy * dy >= min2) kept.push(points[i])
    }
    // The head is never optional: without it the trail detaches from the body.
    kept.push(points[points.length - 1])
  }
  if (kept.length < 2) return []

  const segments = kept.length - 1
  const n = Math.max(1, Math.min(bands, segments))
  const out = []
  for (let b = 0; b < n; b++) {
    const start = Math.floor((b * segments) / n)
    const end = Math.floor(((b + 1) * segments) / n)
    if (end <= start) continue
    // end + 1 so this band ends where the next one begins — no gap at the seam.
    out.push({ t: (b + 0.5) / n, points: kept.slice(start, end + 1) })
  }
  return out
}
