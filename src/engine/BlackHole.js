import { Body } from './Body.js'

/**
 * A gravitational sink. Fixed in place.
 * Only exerts gravity within influenceRadius; force ramps up linearly from 0 at the edge.
 * Captures bodies that enter captureRadius.
 */
export class BlackHole extends Body {
  /**
   * @param {object} opts
   * @param {number} [opts.captureRadius]   - Bodies within this distance are consumed.
   * @param {number} [opts.influenceRadius] - Gravity only acts within this distance (0 = unlimited).
   */
  constructor(opts) {
    const captureRadius = opts.captureRadius ?? 30
    super({
      mass: 10000,
      color: '#000000',
      isFixed: true,
      ...opts,
      radius: captureRadius,
    })
    this.captureRadius   = captureRadius
    this.influenceRadius = opts.influenceRadius ?? 0 // 0 = unlimited
  }

  /**
   * Returns true if the given body is within captureRadius.
   * @param {Body} body
   */
  isCapturing(body) {
    const dx = body.position.x - this.position.x
    const dy = body.position.y - this.position.y
    return Math.sqrt(dx * dx + dy * dy) < this.captureRadius
  }

  /**
   * Gravity falloff factor for a body at `dist` pixels away.
   * Returns 0 outside influenceRadius, ramps linearly to 1 at the core.
   * Returns 1 always when influenceRadius is 0 (unlimited).
   * @param {number} dist
   * @returns {number} 0–1
   */
  influenceFactor(dist) {
    if (!this.influenceRadius) return 1
    if (dist >= this.influenceRadius) return 0
    return 1 - dist / this.influenceRadius
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    const { x, y } = this.position
    const outerRadius = this.influenceRadius > 0 ? this.influenceRadius : this.radius * 10

    // Influence region: dashed boundary circle
    if (this.influenceRadius > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, this.influenceRadius, 0, Math.PI * 2)
      ctx.setLineDash([6, 6])
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.2)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }

    // Gravitational rings: quadratically spaced — denser near the core.
    const RING_COUNT = 12
    const SPOKE_COUNT = 12
    const innerEdge = this.radius
    const span = outerRadius - innerEdge
    ctx.save()
    ctx.setLineDash([])

    // Rings
    for (let i = 1; i <= RING_COUNT; i++) {
      const t = i / RING_COUNT
      const r = innerEdge + span * t * t
      const alpha = 0.2 * (1 - t * 0.85)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 140, 0, ${alpha.toFixed(3)})`
      ctx.lineWidth = 0.75
      ctx.stroke()
    }

    // Spokes: lines from just outside core to outer radius, fading out
    for (let i = 0; i < SPOKE_COUNT; i++) {
      const angle = (i / SPOKE_COUNT) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const grad = ctx.createLinearGradient(
        x + cos * innerEdge, y + sin * innerEdge,
        x + cos * outerRadius, y + sin * outerRadius
      )
      grad.addColorStop(0,   'rgba(255, 140, 0, 0.12)')
      grad.addColorStop(1,   'rgba(255, 140, 0, 0)')
      ctx.beginPath()
      ctx.moveTo(x + cos * innerEdge,  y + sin * innerEdge)
      ctx.lineTo(x + cos * outerRadius, y + sin * outerRadius)
      ctx.strokeStyle = grad
      ctx.lineWidth = 0.75
      ctx.stroke()
    }

    ctx.restore()

    // Accretion glow
    const gradient = ctx.createRadialGradient(x, y, this.radius * 0.8, x, y, this.radius * 2.5)
    gradient.addColorStop(0,   'rgba(255, 140, 0, 0.6)')
    gradient.addColorStop(0.4, 'rgba(180,  60, 0, 0.3)')
    gradient.addColorStop(1,   'rgba(0, 0, 0, 0)')
    ctx.beginPath()
    ctx.arc(x, y, this.radius * 2.5, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()

    // Core
    ctx.beginPath()
    ctx.arc(x, y, this.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#050505'
    ctx.fill()
  }
}
