/**
 * Elastic collision detection and resolution between bodies.
 */
export const Collisions = {
  /**
   * Check all pairs for overlap and resolve with elastic collision response.
   * Conserves momentum and kinetic energy. Applies positional correction.
   * Fixed bodies are treated as immovable walls.
   * @param {Body[]} bodies
   */
  resolveAll(bodies) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]
        const b = bodies[j]

        const dx = b.position.x - a.position.x
        const dy = b.position.y - a.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = a.radius + b.radius

        if (dist >= minDist || dist === 0) continue

        // Normal vector from a to b
        const nx = dx / dist
        const ny = dy / dist

        // Positional correction: push apart so they no longer overlap
        const overlap = minDist - dist
        if (!a.isFixed && !b.isFixed) {
          a.position.x -= nx * overlap * 0.5
          a.position.y -= ny * overlap * 0.5
          b.position.x += nx * overlap * 0.5
          b.position.y += ny * overlap * 0.5
        } else if (!a.isFixed) {
          a.position.x -= nx * overlap
          a.position.y -= ny * overlap
        } else if (!b.isFixed) {
          b.position.x += nx * overlap
          b.position.y += ny * overlap
        }

        // Relative velocity along the normal
        const dvx = b.velocity.x - a.velocity.x
        const dvy = b.velocity.y - a.velocity.y
        const relVelNormal = dvx * nx + dvy * ny

        // Only resolve if bodies are approaching
        if (relVelNormal >= 0) continue

        // Elastic impulse scalar
        const restitution = 0.9
        let impulse = -(1 + restitution) * relVelNormal
        if (!a.isFixed && !b.isFixed) {
          impulse /= (1 / a.mass + 1 / b.mass)
        } else {
          impulse *= (a.isFixed ? b.mass : a.mass)
        }

        if (!a.isFixed) {
          a.velocity.x -= (impulse / a.mass) * nx
          a.velocity.y -= (impulse / a.mass) * ny
        }
        if (!b.isFixed) {
          b.velocity.x += (impulse / b.mass) * nx
          b.velocity.y += (impulse / b.mass) * ny
        }
      }
    }
  },
}
