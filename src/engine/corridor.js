// Projection corridors: a predicted path drawn as two rails that spread apart
// as they run, so the picture says "here, then roughly here, then who knows"
// instead of promising a single exact line.
//
// The spread is honest about what a forecast is worth. Every one of these paths
// comes from integrating an approximation forward, and the further out you look
// the less the answer means — a corridor that widens with distance shows that,
// where a hairline does not.
//
// Geometry only: the caller decides colour, alpha and how fast it fades.
// Batched the same way trails are (see engine/trail.js) — a corridor of a
// thousand points is a dozen polylines, not two thousand stroke() calls.

/**
 * Build the two edges of a widening corridor, grouped into contiguous bands.
 *
 * Each band carries `t` (0 at the start of the path, 1 at the end) so the caller
 * can fade it out, and consecutive bands share their boundary points so the
 * polylines join seamlessly.
 *
 * @param {{x: number, y: number, t?: number}[]} points the predicted path
 * @param {object} [opts]
 * @param {number} [opts.bands]      how many single-alpha polylines per edge
 * @param {number} [opts.maxOffset]  half-width at the far end, in world units
 * @param {number} [opts.widenPow]   <1 spreads early, >1 keeps it tight then flares
 * @returns {{t: number, left: object[], right: object[]}[]}
 */
export function corridorBands(points, { bands = 12, maxOffset = 0, widenPow = 0.9 } = {}) {
  if (!points || points.length < 2) return []

  const n = points.length
  const left = new Array(n)
  const right = new Array(n)

  for (let i = 0; i < n; i++) {
    // A point's own `t` wins when it has one: a path integrated with adaptive
    // steps is not evenly spaced in time, and the spread should follow time.
    const t = points[i].t ?? i / (n - 1)
    // Central difference for the tangent, so the rails stay parallel to the
    // curve rather than to whichever segment happens to end here.
    const before = points[Math.max(0, i - 1)]
    const after = points[Math.min(n - 1, i + 1)]
    const dx = after.x - before.x
    const dy = after.y - before.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const off = Math.pow(Math.max(0, Math.min(1, t)), widenPow) * maxOffset
    left[i] = { x: points[i].x + nx * off, y: points[i].y + ny * off }
    right[i] = { x: points[i].x - nx * off, y: points[i].y - ny * off }
  }

  const segments = n - 1
  const count = Math.max(1, Math.min(bands, segments))
  const out = []
  for (let b = 0; b < count; b++) {
    const start = Math.floor((b * segments) / count)
    const end = Math.floor(((b + 1) * segments) / count)
    if (end <= start) continue
    const midIndex = Math.min(n - 1, Math.floor((start + end) / 2))
    out.push({
      t: points[midIndex].t ?? (b + 0.5) / count,
      // end + 1 so this band ends where the next begins — no gap at the seam.
      left: left.slice(start, end + 1),
      right: right.slice(start, end + 1),
    })
  }
  return out
}
