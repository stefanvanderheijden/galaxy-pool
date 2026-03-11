import { Body } from './Body.js'
import { Blast } from './Blast.js'

/**
 * Player-controlled spaceship.
 *
 * Shape: T — horizontal crossbar (head) at the top, narrow shaft below.
 * Pivot = junction of shaft and head (center of crossbar base).
 * Forward direction = toward the head (−y in local space).
 *
 * Controls:
 *   ArrowUp    – main thrust (forward, fires from shaft bottom)
 *   ArrowDown  – reverse thrust (fires from shaft top / head junction)
 *   ArrowLeft  – rotate counter-clockwise (rotational thrusters)
 *   ArrowRight – rotate clockwise (rotational thrusters)
 *
 * Rotation thrusters are on the long sides (left/right faces) of the head.
 * To rotate left (CCW): right face fires rightward (+x), left face fires leftward (−x).
 * To rotate right (CW): mirrored.
 * Rotational inertia: angular velocity accumulates and decays with damping.
 */
export class Spaceship extends Body {
  constructor(opts) {
    super({
      mass: 50,
      radius: 6,    // matches headR — collision radius = head radius
      color: '#c0d8f0',
      ...opts,
    })
    this.angle           = opts.angle       ?? -Math.PI / 2
    this.thrustForce     = opts.thrustForce ?? 500
    this.rotateSpeed     = opts.rotateSpeed ?? 0.65  // max angular accel (rad/s²)
    this.angularVelocity = 0
    this.angularDamping  = 0.85  // multiplied per second (1 = no damping)
    this._keys     = {}
    this.thrusting  = false
    this.reversing  = false
    this.rotating   = null  // 'left' | 'right' | null
  }

  setKeys(keys) { this._keys = keys }

  /**
   * Fire a blast from the ship's head position.
   * Applies recoil impulse to the ship and returns a Blast instance.
   * @param {object} [opts] - Blast options forwarded to Blast constructor
   * @returns {Blast}
   */
  fireBlast(opts = {}) {
    const recoilImpulse = 300
    // Recoil: push ship opposite to blast direction
    const blastAngle = this.angle + Math.PI
    this.velocity.x -= Math.cos(blastAngle) * recoilImpulse / this.mass
    this.velocity.y -= Math.sin(blastAngle) * recoilImpulse / this.mass

    return new Blast({
      speed: 120,
      ...opts,
      origin: { ...this.position },
      angle:  this.angle + Math.PI,  // blast fires forward (head direction)
    })
  }

  applyInput(dt) {
    // Rotation: apply angular acceleration, accumulate angular velocity
    this.rotating = null
    if (this._keys['ArrowLeft']) {
      this.angularVelocity -= this.rotateSpeed * dt
      this.rotating = 'left'
    }
    if (this._keys['ArrowRight']) {
      this.angularVelocity += this.rotateSpeed * dt
      this.rotating = 'right'
    }

    // Angular damping
    this.angularVelocity *= Math.pow(this.angularDamping, dt)

    // Clamp to prevent spin-out
    const maxOmega = this.rotateSpeed * 1.5
    this.angularVelocity = Math.max(-maxOmega, Math.min(maxOmega, this.angularVelocity))

    // Integrate rotation
    this.angle += this.angularVelocity * dt

    // Main thrust (forward) and reverse
    this.thrusting = false
    this.reversing = false
    const fwd = this._keys['ArrowUp']
    const rev = this._keys['ArrowDown']
    if (fwd || rev) {
      const dir = fwd ? -1 : 0.5
      this.thrusting = !!fwd
      this.reversing = !!rev
      const fx = Math.cos(this.angle) * this.thrustForce * dir
      const fy = Math.sin(this.angle) * this.thrustForce * dir
      this.applyForce({ x: fx, y: fy })
    }
  }

  draw(ctx) {
    // Trail
    if (this.trail.length > 1) {
      ctx.beginPath()
      ctx.moveTo(this.trail[0].x, this.trail[0].y)
      for (let i = 1; i < this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y)
      ctx.strokeStyle = this.color
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.25
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const { x, y } = this.position
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(this.angle - Math.PI / 2)

    // Dimensions (local space)
    const headR  = 6    // radius of circular head (matches collision radius)
    const headW  = headR  // kept as alias for thruster x-positions
    const headH  = headR  // kept as alias for reverse flame y-position
    const shaftW = 2    // half-width of shaft
    const shaftL = 52   // shaft length below origin

    // --- Main exhaust flame (bottom of shaft, fires when thrusting forward) ---
    if (this.thrusting) {
      const fl = 10 + Math.random() * 8
      const grad = ctx.createLinearGradient(0, shaftL, 0, shaftL + fl)
      grad.addColorStop(0,   'rgba(255, 200, 80, 0.9)')
      grad.addColorStop(0.4, 'rgba(255, 100, 20, 0.6)')
      grad.addColorStop(1,   'rgba(255,  60,  0, 0)')
      ctx.beginPath()
      ctx.moveTo(-shaftW, shaftL)
      ctx.lineTo(0, shaftL + fl)
      ctx.lineTo( shaftW, shaftL)
      ctx.fillStyle = grad
      ctx.fill()
    }

    // --- Reverse flame (tip of shaft, fires when reversing) ---
    if (this.reversing) {
      const fl = 10 + Math.random() * 8
      const grad = ctx.createLinearGradient(0, 0, 0, -fl)
      grad.addColorStop(0,   'rgba(255, 200, 80, 0.9)')
      grad.addColorStop(0.4, 'rgba(255, 100, 20, 0.6)')
      grad.addColorStop(1,   'rgba(255,  60,  0, 0)')
      ctx.beginPath()
      ctx.moveTo(-shaftW, 0)
      ctx.lineTo(0, -fl)
      ctx.lineTo( shaftW, 0)
      ctx.fillStyle = grad
      ctx.fill()
    }

    // --- Rotation thruster flame at shaft tip (far end), firing sideways (±x) ---
    // Rotating left (CCW):  fires rightward (+x)
    // Rotating right (CW):  fires leftward (−x)
    if (this.rotating) {
      const fl = 8 + Math.random() * 6
      const dir = this.rotating === 'left' ? -1 : 1
      const tx  = dir > 0 ? shaftW : -shaftW
      const endX = tx + dir * fl
      const grad = ctx.createLinearGradient(tx, shaftL, endX, shaftL)
      grad.addColorStop(0,   'rgba(100, 200, 255, 0.85)')
      grad.addColorStop(0.5, 'rgba( 60, 120, 255, 0.5)')
      grad.addColorStop(1,   'rgba( 20,  60, 255, 0)')
      ctx.beginPath()
      ctx.moveTo(tx, shaftL - 3)
      ctx.lineTo(endX, shaftL)
      ctx.lineTo(tx,   shaftL + 3)
      ctx.fillStyle = grad
      ctx.fill()
    }

    // --- Shaft ---
    ctx.beginPath()
    ctx.rect(-shaftW, 0, shaftW * 2, shaftL)
    ctx.fillStyle = '#4a6a8a'
    ctx.fill()
    ctx.strokeStyle = '#7aafd6'
    ctx.lineWidth = 0.75
    ctx.stroke()

    // --- Head (circle) ---
    ctx.beginPath()
    ctx.arc(0, 0, headR, 0, Math.PI * 2)
    ctx.fillStyle = '#5a8ab0'
    ctx.fill()
    ctx.strokeStyle = '#a0d0f0'
    ctx.lineWidth = 1
    ctx.stroke()

    // Cockpit window
    ctx.beginPath()
    ctx.arc(0, -headR * 0.35, 3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(180, 230, 255, 0.7)'
    ctx.fill()

    ctx.restore()
  }
}
