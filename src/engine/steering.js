// Pure steering math for the three control modes. No Vue, no DOM, no globals —
// every function takes an explicit state snapshot and RETURNS what should happen,
// leaving the caller (Game.vue) to mutate the ship and spawn particles. This is
// what makes the steering logic unit-testable.
//
// Coordinate convention: screen space, +x right, +y DOWN. "Left of travel"
// (port) is therefore `forward` rotated +90° → (fwdY, -fwdX).
//
//   Tank   — A/D rotate the heading; W thrusts along it; S brakes retrograde.
//   Screen — W/A/S/D thrust up/down/left/right in absolute screen space.
//   Drift  — relative to direction of travel: W prograde, S retrograde,
//            A/D thrust to port/starboard.

// AU/yr below which the velocity gives no usable heading, so Drift/coast fall
// back to the ship's current facing instead.
export const SPEED_FRAME_MIN = 1e-3

// A no-op result: nothing thrust this frame.
function coastResult(shipAngle, { speed, vx, vy, coastThreshold = 1e-4 } = {}) {
  // When coasting with real motion, point the nose along travel.
  const angle = speed > coastThreshold ? Math.atan2(vy, vx) : shipAngle
  return { dvx: 0, dvy: 0, shipAngle: angle, brake: false, particle: null, active: false }
}

/**
 * Compute the steering effect for one frame.
 *
 * @param {object} s
 * @param {number} s.vx,s.vy      ship velocity (AU/yr)
 * @param {number} s.shipAngle    current heading (rad)
 * @param {object} s.keys         { w, a, s, d, space } booleans
 * @param {string} s.steering     "tank" | "screen" | "drift"
 * @param {number} s.thrust       thrust acceleration (AU/yr²)
 * @param {number} s.dt_yr        sim-time step (yr)
 * @param {number} s.realDt_s     real-time step (s) — used for Tank rotation
 * @param {number} s.turnSpeed    Tank rotation rate (rad/s)
 * @returns {{dvx:number, dvy:number, shipAngle:number, brake:boolean,
 *            particle:({power:number, angle:number}|null), active:boolean}}
 *   `brake: true` means apply the shared retrograde brake instead of dvx/dvy.
 *   `particle` describes a thrust-plume burst to spawn, or null.
 *   `active` mirrors the old `thrustActiveLastFrame` (a burst happened).
 */
export function computeThrust(s) {
  const { keys, steering } = s

  // Spacebar = full retrograde brake, in every mode.
  if (keys.space) {
    return { dvx: 0, dvy: 0, shipAngle: s.shipAngle, brake: true, particle: null, active: true }
  }

  if (steering === 'tank') return computeTank(s)
  if (steering === 'screen') return computeScreen(s)
  return computeDrift(s)
}

function computeTank(s) {
  const { keys, thrust, dt_yr, realDt_s } = s
  const turnSpeed = s.turnSpeed ?? 3.5

  let shipAngle = s.shipAngle
  if (keys.a) shipAngle -= turnSpeed * realDt_s
  if (keys.d) shipAngle += turnSpeed * realDt_s

  // S brakes (retrograde). Handled by the caller's shared brake helper.
  if (keys.s) {
    return { dvx: 0, dvy: 0, shipAngle, brake: true, particle: null, active: true }
  }

  // W thrusts forward along the heading.
  if (keys.w) {
    const dvx = Math.cos(shipAngle) * thrust * dt_yr
    const dvy = Math.sin(shipAngle) * thrust * dt_yr
    return {
      dvx,
      dvy,
      shipAngle,
      brake: false,
      particle: { power: 1, angle: shipAngle },
      active: true,
    }
  }

  // A/D-only (or nothing): heading may have changed, but no thrust.
  return { dvx: 0, dvy: 0, shipAngle, brake: false, particle: null, active: false }
}

function computeScreen(s) {
  const { vx, vy, keys, thrust, dt_yr } = s
  let fx = 0
  let fy = 0
  if (keys.w) fy -= 1
  if (keys.s) fy += 1
  if (keys.a) fx -= 1
  if (keys.d) fx += 1

  if (fx === 0 && fy === 0) {
    return coastResult(s.shipAngle, { speed: Math.hypot(vx, vy), vx, vy })
  }

  const flen = Math.hypot(fx, fy)
  fx /= flen
  fy /= flen

  const forceAngle = Math.atan2(fy, fx)
  return {
    dvx: fx * thrust * dt_yr,
    dvy: fy * thrust * dt_yr,
    shipAngle: forceAngle,
    brake: false,
    particle: { power: 1, angle: forceAngle },
    active: true,
  }
}

function computeDrift(s) {
  const { vx, vy, keys, thrust, dt_yr } = s
  const speed = Math.hypot(vx, vy)

  // Travel-frame basis: forward = direction of travel; left = forward rotated +90°.
  const fwdAngle = speed > SPEED_FRAME_MIN ? Math.atan2(vy, vx) : s.shipAngle
  const fwdX = Math.cos(fwdAngle)
  const fwdY = Math.sin(fwdAngle)
  const leftX = fwdY
  const leftY = -fwdX

  const longitudinal = (keys.w ? 1 : 0) - (keys.s ? 1 : 0)
  const lateral = (keys.a ? 1 : 0) - (keys.d ? 1 : 0) // A = +left, D = +right

  // Coasting: point the nose along travel.
  if (longitudinal === 0 && lateral === 0) {
    return {
      dvx: 0,
      dvy: 0,
      shipAngle: speed > 1e-4 ? fwdAngle : s.shipAngle,
      brake: false,
      particle: null,
      active: false,
    }
  }

  // Pure retrograde (S alone): clamped brake, like spacebar.
  if (longitudinal < 0 && lateral === 0) {
    return {
      dvx: 0,
      dvy: 0,
      shipAngle: speed > 1e-6 ? fwdAngle : s.shipAngle,
      brake: true,
      particle: null,
      active: true,
    }
  }

  // Build the thrust vector in the travel frame, normalized so diagonals
  // (e.g. prograde + port) don't exceed single-axis thrust.
  let tx = fwdX * longitudinal + leftX * lateral
  let ty = fwdY * longitudinal + leftY * lateral
  const tlen = Math.hypot(tx, ty)
  if (tlen < 1e-9) {
    return { dvx: 0, dvy: 0, shipAngle: s.shipAngle, brake: false, particle: null, active: false }
  }
  tx /= tlen
  ty /= tlen

  const forceAngle = Math.atan2(ty, tx)
  return {
    dvx: tx * thrust * dt_yr,
    dvy: ty * thrust * dt_yr,
    shipAngle: forceAngle,
    brake: false,
    particle: { power: 1, angle: forceAngle },
    active: true,
  }
}

/**
 * THRUST/BRAKE/COAST classification for the HUD indicator. Pure.
 * @returns {{mode:"coast"|"brake"|"forward", power:number}}
 */
export function getThrustState({ keys, steering }) {
  if (keys.space) return { mode: 'brake', power: 1 }

  if (steering === 'tank') {
    if (keys.s) return { mode: 'brake', power: 1 }
    if (keys.w) return { mode: 'forward', power: 1 }
    return { mode: 'coast', power: 0 }
  }

  const longitudinal = (keys.w ? 1 : 0) - (keys.s ? 1 : 0)
  const lateral = (keys.a ? 1 : 0) - (keys.d ? 1 : 0)
  if (steering === 'drift' && longitudinal < 0 && lateral === 0) {
    return { mode: 'brake', power: 1 }
  }
  if (longitudinal !== 0 || lateral !== 0) return { mode: 'forward', power: 1 }
  return { mode: 'coast', power: 0 }
}
