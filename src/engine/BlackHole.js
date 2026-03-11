import { Body } from './Body.js'

/**
 * A gravitational sink. Fixed in place, draws bodies into its captureRadius.
 */
export class BlackHole extends Body {
  /**
   * @param {object} opts - Same as Body options plus captureRadius.
   * @param {number} [opts.captureRadius] - Distance at which bodies are consumed.
   */
  constructor(opts) {
    super({
      mass: 10000,
      radius: 20,
      color: '#000000',
      isFixed: true,
      ...opts,
    })
    this.captureRadius = opts.captureRadius ?? this.radius * 1.5
  }

  /**
   * Returns true if the given body is within captureRadius.
   * @param {Body} body
   * @returns {boolean}
   */
  isCapturing(body) {
    const dx = body.position.x - this.position.x
    const dy = body.position.y - this.position.y
    return Math.sqrt(dx * dx + dy * dy) < this.captureRadius
  }

  /**
   * Draw as a dark circle with a glowing accretion ring.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    // Outer glow ring
    const gradient = ctx.createRadialGradient(
      this.position.x, this.position.y, this.radius * 0.8,
      this.position.x, this.position.y, this.radius * 2.5,
    )
    gradient.addColorStop(0, 'rgba(255, 140, 0, 0.6)')
    gradient.addColorStop(0.4, 'rgba(180, 60, 0, 0.3)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx.beginPath()
    ctx.arc(this.position.x, this.position.y, this.radius * 2.5, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()

    // Core: solid dark circle
    ctx.beginPath()
    ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#050505'
    ctx.fill()
  }
}
