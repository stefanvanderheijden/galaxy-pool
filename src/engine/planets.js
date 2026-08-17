// Planet-scale helpers: how a planet's mass becomes something you can SEE
// (its drawn radius) and something you can FEEL (how hard it is to shoot).
//
// Pure functions, no Vue/DOM — see planets.test.js.

/**
 * Drawn radius from mass.
 *
 * At constant density a sphere's radius goes with the cube root of its mass, so
 * `exponent = 1/3` is the physically honest mapping and the default. A larger
 * exponent exaggerates the spread (useful when a level's masses are close
 * together and you still want to read them apart at a glance); `0` makes every
 * planet the same size.
 *
 * @param {number} mass        planet mass (M☉)
 * @param {object} [opts]
 * @param {number} [opts.refMass]    mass that maps exactly to refRadius
 * @param {number} [opts.refRadius]  radius (AU) of a refMass planet
 * @param {number} [opts.exponent]   mass→radius power (1/3 = constant density)
 * @param {number} [opts.minRadius]  floor so a featherweight is still clickable
 * @returns {number} radius in AU
 */
export function radiusFromMass(
  mass,
  { refMass = 3e-6, refRadius = 0.02, exponent = 1 / 3, minRadius = 0.004 } = {},
) {
  if (!(mass > 0) || !(refMass > 0)) return minRadius
  return Math.max(minRadius, refRadius * Math.pow(mass / refMass, exponent))
}

/**
 * Velocity change a shot imparts to a planet.
 *
 * `power` is the shot strength the cue delivers (0..1 of the drag, times the
 * sketch's power setting) expressed as the Δv a *reference-mass* planet would
 * get. `massExponent` sets how much mass resists that:
 *
 *   1   — true impulse physics: Δv = J/m, a 10× heavier planet moves 10× less
 *   0.5 — default: heavy planets are clearly sluggish but still playable
 *   0   — mass is ignored, every planet handles identically (classic pool)
 *
 * Real impulse (exponent 1) is unplayable across the mass spread these levels
 * use — the lightest body would rocket off-screen on the same pull that barely
 * nudges the heaviest — so the exponent is a tunable, not a constant.
 *
 * @param {number} power        Δv delivered to a reference-mass planet (AU/yr)
 * @param {number} mass         the planet's mass (M☉)
 * @param {object} [opts]
 * @param {number} [opts.refMass]
 * @param {number} [opts.massExponent]
 * @returns {number} Δv in AU/yr
 */
export function deltaVFromShot(power, mass, { refMass = 3e-6, massExponent = 0.5 } = {}) {
  if (!(mass > 0) || !(refMass > 0)) return power
  return power * Math.pow(refMass / mass, massExponent)
}
