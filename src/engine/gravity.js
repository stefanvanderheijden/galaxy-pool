// Two-state inter-planet gravity.
//
// At real scale a planet's pull on another planet is nothing — the sun is a
// million times heavier, so a solar system is really "N bodies orbiting one
// body" and the planets may as well not see each other. That is physically true
// and dramatically useless: nothing you shoot ever disturbs anything else.
//
// So planets here have two states:
//
//   STABLE — on rails. Feels the sun (and the pocket) and nothing else.
//   ROGUE  — knocked loose. Feels, and exerts, a comically exaggerated planetary
//            gravity: `boost` multiplies G by several thousand inside a short
//            influence radius, which puts a planet's pull in the same league as
//            the star's.
//
// A pair interacts if EITHER body is rogue, and the force is applied to both, so
// momentum is conserved between them. Stable↔stable pairs are skipped, which is
// what keeps the opening rack sitting still on its circular orbits.
//
// Being pulled HARD ENOUGH is what wakes a stable planet — not merely being near
// a rogue. Inside the influence radius there is always some pull, and waking on
// any of it would knock the whole rack loose on the first fly-past; a planet only
// goes rogue once the pull it receives passes `wakeAccel`. One good break can
// then cascade, but a distant pass just bends an orbit.
//
// (Sketch 001 has an older, differently-tuned variant of this inline; it can
// migrate here once someone is willing to re-tune that mode's feel.)

import { G_SIM, SOFTENING } from './units.js'

// Closest approach used in the force law, as a fraction of the influence radius.
// Without it a near-direct hit divides by ~0 and launches a planet to infinity.
const MIN_DIST_FRACTION = 0.08

// Acceleration one body of `sourceMass` produces at distance `dist`.
function rogueAccel(sourceMass, dist, influenceR, boost, softening) {
  const clamped = Math.max(dist, influenceR * MIN_DIST_FRACTION)
  // Linear falloff to zero at the rim, so the field has a definite edge the
  // player can be shown rather than an infinite tail.
  const falloff = 1 - clamped / influenceR
  if (falloff <= 0) return 0
  return (G_SIM * boost * falloff * sourceMass) / (clamped * clamped + softening)
}

/**
 * Apply one step of rogue-state gravity, in place.
 *
 * Bodies are `{ x, y, vx, vy, mass, rogue }` — the same objects the sim and the
 * shot prediction both use, so the preview and the outcome agree.
 *
 * @param {object[]} bodies
 * @param {number} dt timestep in years
 * @param {object} opts
 * @param {number} opts.influenceR  radius (AU) at which the pull reaches zero
 * @param {number} opts.boost       multiplier on G — thousands, deliberately
 * @param {number} [opts.wakeAccel] pull (AU/yr²) a stable body must feel to wake
 * @param {boolean} [opts.wake]     whether a hard enough pull promotes to rogue
 * @param {number} [opts.softening]
 * @returns {object[]} bodies newly woken this step (empty when wake is false)
 */
export function applyRogueGravity(
  bodies,
  dt,
  { influenceR, boost, wakeAccel = Infinity, wake = true, softening = SOFTENING } = {},
) {
  const woken = []
  if (!(boost > 0) || !(influenceR > 0)) return woken

  // Net pull received by each stable body this step, accumulated as a VECTOR so
  // two rogues pulling a planet in opposite directions correctly cancel out
  // instead of adding up to a wake.
  const pullX = wake ? new Float64Array(bodies.length) : null
  const pullY = wake ? new Float64Array(bodies.length) : null

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]
      const b = bodies[j]
      // The whole point: two planets both on their rails ignore each other.
      if (!a.rogue && !b.rogue) continue

      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist === 0 || dist >= influenceR) continue

      const ux = dx / dist
      const uy = dy / dist
      const accelOnA = rogueAccel(b.mass, dist, influenceR, boost, softening)
      const accelOnB = rogueAccel(a.mass, dist, influenceR, boost, softening)

      a.vx += ux * accelOnA * dt
      a.vy += uy * accelOnA * dt
      b.vx -= ux * accelOnB * dt
      b.vy -= uy * accelOnB * dt

      // Only a stable body can be woken, and only by what it actually feels.
      if (wake) {
        if (!a.rogue) {
          pullX[i] += ux * accelOnA
          pullY[i] += uy * accelOnA
        }
        if (!b.rogue) {
          pullX[j] -= ux * accelOnB
          pullY[j] -= uy * accelOnB
        }
      }
    }
  }

  // Flip states only after the whole pass: a body promoted mid-loop would start
  // interacting with pairs later in the same step, making the result depend on
  // iteration order.
  if (wake && wakeAccel !== Infinity) {
    for (let i = 0; i < bodies.length; i++) {
      if (bodies[i].rogue) continue
      if (Math.hypot(pullX[i], pullY[i]) >= wakeAccel) {
        bodies[i].rogue = true
        woken.push(bodies[i])
      }
    }
  }
  return woken
}

/**
 * Distance at which one body of `sourceMass` pulls hard enough to wake a stable
 * planet — the radius worth drawing as the "danger" ring, as opposed to the
 * influence radius where the field merely reaches zero.
 *
 * The pull falls monotonically with distance inside the influence radius, so a
 * bisection converges quickly. Returns 0 when this body can never wake anything.
 *
 * @returns {number} radius in AU (0 if the threshold is never reached)
 */
export function wakeRadius(
  sourceMass,
  { influenceR, boost, wakeAccel, softening = SOFTENING, iterations = 24 } = {},
) {
  if (!(boost > 0) || !(influenceR > 0) || !(wakeAccel > 0)) return 0
  const minDist = influenceR * MIN_DIST_FRACTION
  // Even at closest approach the pull is too weak: nothing to draw.
  if (rogueAccel(sourceMass, minDist, influenceR, boost, softening) < wakeAccel) return 0
  // Strong enough everywhere inside the field: the whole field is dangerous.
  if (rogueAccel(sourceMass, influenceR, influenceR, boost, softening) >= wakeAccel) {
    return influenceR
  }

  let lo = minDist
  let hi = influenceR
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2
    if (rogueAccel(sourceMass, mid, influenceR, boost, softening) >= wakeAccel) lo = mid
    else hi = mid
  }
  return lo
}
