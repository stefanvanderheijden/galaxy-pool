/**
 * Base class for all physics objects in the simulation.
 * Positions are in pixels, mass in arbitrary units, time in seconds.
 */
export class Body {
  /**
   * @param {object} opts
   * @param {string} opts.id - Unique identifier
   * @param {{x:number, y:number}} opts.position
   * @param {{x:number, y:number}} [opts.velocity]
   * @param {number} [opts.mass]
   * @param {number} [opts.radius]
   * @param {string} [opts.color]
   * @param {boolean} [opts.isFixed] - If true, forces are not applied
   */
  constructor({ id, position, velocity = { x: 0, y: 0 }, mass = 100, radius = 10, color = '#ffffff', isFixed = false }) {
    this.id = id
    this.position = { ...position }
    this.velocity = { ...velocity }
    this.mass = mass
    this.radius = radius
    this.color = color
    this.isFixed = isFixed
    this._force = { x: 0, y: 0 }
    /** @type {{x:number,y:number}[]} Rolling position history for trail rendering. */
    this.trail = []
    /** Maximum number of trail points kept. 0 = no trail. */
    this.trailLength = 0
  }

  /**
   * Accumulate a force vector for the current step.
   * @param {{x:number, y:number}} force
   */
  applyForce(force) {
    this._force.x += force.x
    this._force.y += force.y
  }

  /** Record current position into the trail buffer. Call once per frame, not per step. */
  recordTrail() {
    if (this.trailLength === 0) return
    this.trail.push({ x: this.position.x, y: this.position.y })
    if (this.trail.length > this.trailLength) this.trail.shift()
  }

  /** Zero out accumulated force (called after each integration step). */
  resetForce() {
    this._force.x = 0
    this._force.y = 0
  }

  /**
   * Draw the trail (if any) then the body as a filled circle.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this.trail.length > 1) {
      ctx.beginPath()
      ctx.moveTo(this.trail[0].x, this.trail[0].y)
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y)
      }
      ctx.strokeStyle = this.color
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.35
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.beginPath()
    ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2)
    ctx.fillStyle = this.color
    ctx.fill()
  }
}
