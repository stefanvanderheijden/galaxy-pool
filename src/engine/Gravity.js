/**
 * Newtonian gravity calculations between bodies.
 */
export const Gravity = {
  /**
   * Apply gravitational forces between all unique pairs of bodies.
   * Fixed bodies receive no force but still exert gravity.
   * @param {Body[]} bodies
   * @param {number} G - Gravitational constant
   */
  applyAll(bodies, G) {
    const softening = 25 // pixels^2, prevents singularities at close range

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]
        const b = bodies[j]

        const dx = b.position.x - a.position.x
        const dy = b.position.y - a.position.y
        const distSq = dx * dx + dy * dy + softening
        const dist = Math.sqrt(distSq)

        const forceMag = (G * a.mass * b.mass) / distSq
        const fx = (forceMag * dx) / dist
        const fy = (forceMag * dy) / dist

        if (!a.isFixed) a.applyForce({ x: fx, y: fy })
        if (!b.isFixed) b.applyForce({ x: -fx, y: -fy })
      }
    }
  },
}
