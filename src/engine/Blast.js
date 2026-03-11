/**
 * Directional shockwave blast fired from the spaceship's head.
 *
 * The blast expands as two radii (inner, outer) outward from the origin.
 * Any body between inner and outer radius AND within the cone half-angle
 * receives an outward force for that frame.
 *
 * Parameters:
 *   origin   – {x, y} world position (ship head at fire time)
 *   angle    – heading angle of ship (radians), blast fires in this direction
 *   speed    – expansion speed (px/s)
 *   width    – radial thickness of the wave (px)
 *   maxR     – outer radius at which blast expires
 *   halfAngle – half-width of cone in radians (default 25° → ~0.436 rad)
 *   force    – peak force magnitude applied to caught bodies
 */
export class Blast {
  constructor({ origin, angle, speed = 300, width = 40, maxR = 350, halfAngle = Math.PI / 180 * 25, force = 800 }) {
    this.origin    = { ...origin }
    this.angle     = angle
    this.speed     = speed
    this.width     = width
    this.maxR      = maxR
    this.halfAngle = halfAngle
    this.force     = force
    this.innerR    = 0
    this.outerR    = 0
    this.done      = false
  }

  /**
   * Advance blast and apply forces to affected bodies.
   * @param {Body[]} bodies
   * @param {number} dt - scaled dt in seconds
   */
  update(bodies, dt) {
    this.outerR += this.speed * dt
    if (this.outerR >= this.width) this.innerR += this.speed * dt

    if (this.outerR >= this.maxR) {
      this.done = true
    }

    for (const body of bodies) {
      if (body.isFixed) continue

      const dx = body.position.x - this.origin.x
      const dy = body.position.y - this.origin.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < this.innerR || dist > this.outerR) continue
      if (dist === 0) continue

      // Check cone
      const bodyAngle = Math.atan2(dy, dx)
      let dAngle = bodyAngle - this.angle
      // Normalize to [-π, π]
      while (dAngle >  Math.PI) dAngle -= 2 * Math.PI
      while (dAngle < -Math.PI) dAngle += 2 * Math.PI
      if (Math.abs(dAngle) > this.halfAngle) continue

      // Force pointing away from origin, scaled by proximity to wave center
      const waveCenter = (this.innerR + this.outerR) / 2
      const falloff = 1 - Math.abs(dist - waveCenter) / (this.width / 2)
      const mag = this.force * Math.max(0, falloff)
      body.applyForce({ x: (dx / dist) * mag, y: (dy / dist) * mag })
    }
  }

  /**
   * Draw the blast arc.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this.done) return

    const progress = this.outerR / this.maxR
    const alpha = (1 - progress) * 0.7

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = `rgba(180, 230, 255, 1)`
    ctx.lineWidth = Math.max(1, this.outerR - this.innerR)

    const startAngle = this.angle - this.halfAngle
    const endAngle   = this.angle + this.halfAngle
    const midR = (this.innerR + this.outerR) / 2

    ctx.beginPath()
    ctx.arc(this.origin.x, this.origin.y, midR, startAngle, endAngle)
    ctx.stroke()

    ctx.globalAlpha = 1
    ctx.restore()
  }
}
