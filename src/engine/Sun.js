import { Body } from './Body.js'

/**
 * A fixed central star. Draws as a bright glowing circle.
 * mass and radius are fully independent — set them separately.
 */
export class Sun extends Body {
  constructor(opts) {
    super({
      mass: 8000,
      radius: 28,
      color: '#ffe066',
      isFixed: true,
      ...opts,
    })
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    const { x, y } = this.position
    const r = this.radius

    // Outer soft glow
    const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3)
    glow.addColorStop(0,   'rgba(255, 220, 80, 0.35)')
    glow.addColorStop(0.5, 'rgba(255, 160, 20, 0.12)')
    glow.addColorStop(1,   'rgba(0, 0, 0, 0)')
    ctx.beginPath()
    ctx.arc(x, y, r * 3, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()

    // Core
    const core = ctx.createRadialGradient(x, y, 0, x, y, r)
    core.addColorStop(0,   '#fff8d0')
    core.addColorStop(0.5, '#ffe066')
    core.addColorStop(1,   '#ffaa00')
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = core
    ctx.fill()
  }
}
