import { Body } from './Body.js'

/**
 * A standard orbiting body. Extends Body with planet-appropriate defaults.
 */
export class Planet extends Body {
  /**
   * @param {object} opts - Same as Body options; color and mass have planet defaults.
   */
  constructor(opts) {
    super({
      mass: 200,
      radius: 8,
      color: '#4fc3f7',
      ...opts,
    })
  }
}
