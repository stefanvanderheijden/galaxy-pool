import { Gravity } from './Gravity.js'
import { Integrator } from './Integrator.js'
import { Collisions } from './Collisions.js'
import { BlackHole } from './BlackHole.js'

/**
 * Owns the body list and drives the physics pipeline each tick.
 * Does NOT own requestAnimationFrame — the composable handles that.
 */
export class Simulation {
  /**
   * @param {object} opts
   * @param {Body[]} [opts.bodies]
   * @param {number} [opts.gravitationalConstant]
   * @param {number} [opts.timeScale]
   */
  constructor({ bodies = [], gravitationalConstant = 0.5, timeScale = 1 } = {}) {
    this.bodies = [...bodies]
    this.G = gravitationalConstant
    this.timeScale = timeScale
    this.state = 'running'
    this.elapsed = 0
    this._captureCallbacks = []
  }

  /**
   * Advance the simulation by dt seconds (real time).
   * Gravity → Integration → Collisions → BlackHole captures.
   * @param {number} dt - Real-time delta in seconds
   */
  step(dt) {
    if (this.state !== 'running') return

    const scaledDt = dt * this.timeScale
    this.elapsed += scaledDt

    Gravity.applyAll(this.bodies, this.G)
    Integrator.stepAll(this.bodies, scaledDt)
    Collisions.resolveAll(this.bodies)

    // Check black hole captures
    const blackHoles = this.bodies.filter(b => b instanceof BlackHole)
    const toRemove = new Set()

    for (const bh of blackHoles) {
      for (const body of this.bodies) {
        if (body === bh || body instanceof BlackHole) continue
        if (bh.isCapturing(body)) {
          toRemove.add(body.id)
          this._captureCallbacks.forEach(cb => cb(body, bh))
        }
      }
    }

    if (toRemove.size > 0) {
      this.bodies = this.bodies.filter(b => !toRemove.has(b.id))
    }
  }

  /**
   * Add a body to the simulation.
   * @param {Body} body
   */
  addBody(body) {
    this.bodies.push(body)
  }

  /**
   * Remove a body by id.
   * @param {string} id
   */
  removeBody(id) {
    this.bodies = this.bodies.filter(b => b.id !== id)
  }

  /** Pause the simulation. */
  pause() {
    this.state = 'paused'
  }

  /** Resume the simulation. */
  play() {
    this.state = 'running'
  }

  /**
   * Set the time scale. 0 = paused, 0.25 = slow, 1 = normal, 4 = fast.
   * @param {number} scale
   */
  setTimeScale(scale) {
    this.timeScale = scale
  }

  /**
   * Register a callback fired when a body is captured by a black hole.
   * @param {function(body, blackHole): void} cb
   */
  onCapture(cb) {
    this._captureCallbacks.push(cb)
  }
}
