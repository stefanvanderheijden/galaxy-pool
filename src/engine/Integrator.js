/**
 * Numerical integration for body motion.
 */
export const Integrator = {
  /**
   * Advance all non-fixed bodies one time step using symplectic Euler integration.
   * Updates velocity from accumulated force, then updates position.
   * @param {Body[]} bodies
   * @param {number} dt - Time step in seconds
   */
  stepAll(bodies, dt) {
    for (const body of bodies) {
      if (body.isFixed) continue

      // v += (F/m) * dt
      body.velocity.x += (body._force.x / body.mass) * dt
      body.velocity.y += (body._force.y / body.mass) * dt

      // x += v * dt
      body.position.x += body.velocity.x * dt
      body.position.y += body.velocity.y * dt

      body.resetForce()
    }
  },
}
