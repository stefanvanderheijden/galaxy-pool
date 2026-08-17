// An elastic band strung between two anchors — a cushion for planets to bounce
// off, modelled the way a real band behaves rather than as a reflecting wall.
//
// A wall just flips the velocity component along its normal: instant, lossless
// and completely insensitive to how hard the planet arrived. A band does
// something better. The planet pushes PAST the band's rest line, the band bends
// to follow it, and the further it is carried the longer the two halves are
// stretched and the harder they pull back. A slow planet dents it and is nudged
// away; a fast one sinks deep, is brought to a stop, and is thrown back out.
//
//   rest:      A ─────────────── B
//   caught:    A ╲            ╱ B        the band bends to the planet, so its
//                 ╲___●___╱             total length exceeds |AB| — the stretch
//
// The stretch is (|AP| + |PB|) − |AB|, exactly the extra length the band has
// been forced into. Each half pulls along its own direction with tension
// proportional to that stretch, so the net restoring force is
//
//     F = stiffness · stretch · normalise(û(P→A) + û(P→B))
//
// pointing straight back toward the rest line and vanishing smoothly as the
// planet returns to it. That sum of two unit vectors is the whole trick: caught
// near the middle the halves pull almost straight back, and caught near an
// anchor they pull mostly sideways, so a glancing hit skids along the band
// instead of rebounding off it.
//
// WHICH SIDE. A band is not a force field around a line — it does nothing at all
// to a planet that has not yet reached it. Approaching from above, a planet
// falls freely until it crosses the rest line; only then is it in the band. So a
// response needs to know which side the planet came from, and that is the one
// piece of state a caller has to keep: `side`, +1 or −1, the side the planet was
// last seen OUTSIDE on. Pass it in, store what comes back.
//
// Push through hard enough — further than `reach` past the line — and the band
// lets go. A big enough hit is supposed to break through a cushion.
//
// The response is an ACCELERATION, not a force: every planet bounces the same
// way regardless of mass. Mass already decides how hard a planet is to shoot;
// letting it also decide whether the planet punches through would make the heavy
// ones unplayable.

const OUTSIDE = { engaged: false, stretch: 0, ax: 0, ay: 0 }

/**
 * How a band responds to one body this step.
 *
 * @param {{x1,y1,x2,y2,reach,stiffness}} band `reach` is how far past the rest
 *        line the band will stretch before letting go.
 * @param {number} px
 * @param {number} py
 * @param {number} side the side the body was last outside on (+1, −1, or 0 if
 *        it has never been seen outside)
 * @returns {{engaged: boolean, t: number, signedDist: number, stretch: number,
 *            ax: number, ay: number, side: number}} `side` is the value to store
 *          for next time; `ax/ay` are 0 unless engaged.
 */
export function bandResponse(band, px, py, side = 0) {
  const sx = band.x2 - band.x1
  const sy = band.y2 - band.y1
  const len2 = sx * sx + sy * sy
  if (len2 <= 0) return { ...OUTSIDE, t: 0, signedDist: 0, side }

  const len = Math.sqrt(len2)
  // Where the planet sits along the band, and which side of it, signed.
  const t = ((px - band.x1) * sx + (py - band.y1) * sy) / len2
  const signedDist = ((px - band.x1) * -sy + (py - band.y1) * sx) / len
  const dist = Math.abs(signedDist)
  const here = Math.sign(signedDist) || 1

  // Only BETWEEN the anchors: past either end there is no band, and a planet
  // rounding an anchor should sail by. Beyond `reach` it has either not arrived
  // yet or has broken through — either way it is outside, and this is where the
  // remembered side gets refreshed.
  if (t <= 0 || t >= 1 || dist >= band.reach) {
    return { ...OUTSIDE, t, signedDist, side: here }
  }

  // Inside the strip but still on the side it came from: it has not reached the
  // band yet, so nothing touches it.
  if (side === 0 || here === side) {
    return { ...OUTSIDE, t, signedDist, side: side === 0 ? here : side }
  }

  const aLen = Math.hypot(px - band.x1, py - band.y1)
  const bLen = Math.hypot(px - band.x2, py - band.y2)
  const stretch = Math.max(0, aLen + bLen - len)
  if (stretch <= 0 || aLen === 0 || bLen === 0) {
    return { ...OUTSIDE, t, signedDist, side }
  }

  // The two halves pull toward their own anchors; their sum is the net tension.
  let fx = (band.x1 - px) / aLen + (band.x2 - px) / bLen
  let fy = (band.y1 - py) / aLen + (band.y2 - py) / bLen
  const fl = Math.hypot(fx, fy)
  if (fl < 1e-9) return { ...OUTSIDE, t, signedDist, side }
  fx /= fl
  fy /= fl

  const magnitude = band.stiffness * stretch
  return {
    engaged: true,
    t,
    signedDist,
    stretch,
    ax: fx * magnitude,
    ay: fy * magnitude,
    side,
  }
}

/**
 * The band's drawn shape: its anchors, plus the contact point when a planet is
 * caught in it. Two segments when engaged, one when at rest.
 */
export function bandShape(band, contact) {
  const a = { x: band.x1, y: band.y1 }
  const b = { x: band.x2, y: band.y2 }
  return contact ? [a, contact, b] : [a, b]
}
