// The one place a sketch is registered.
//
// Each prototype is a game MODE built on the shared layer (GameShell, the
// settings panel, engine/camera, engine/starfield, useCanvasLoop) — the registry
// is what the homepage lists and what the router resolves, so adding a sketch
// means dropping a `NNN-name.vue` file in here and adding one entry below.

// Vite resolves this at build time; keys look like './001-ship-pool.vue'.
const sketchModules = import.meta.glob('./*.vue')

export const SKETCHES = [
  {
    id: '001',
    name: 'Ship Pool',
    file: './001-ship-pool.vue',
    tagline: 'Fly a ship, dock a planet, sink it in the black hole.',
    description: `The full game mode. You pilot a single ship through a miniature
      solar system, drift into a planet to dock with it, then pull back and fire
      it like a cue ball. Shots are paid for with solar energy that recharges
      near the sun. Includes fog of war, a radar sweep, first-contact scans and
      a level editor.`,
    tags: ['ship', 'solar energy', 'fog of war', 'level editor'],
  },
  {
    id: '002',
    name: 'Planet Pool',
    file: './002-planet-pool.vue',
    tagline: 'No ship. Drag any planet, and pocketing one is what pays you.',
    description: `A direct-control mode: grab any planet with the mouse, pull back
      and release. There is no solar power — energy comes only from sinking
      planets, and each planet is worth a fixed yield that has nothing to do with
      how heavy it is. Mass is drawn (a planet's radius follows its mass) and so
      is yield (the segmented ring around it), so you can read both at a glance
      and decide what is worth the shot.`,
    tags: ['no ship', 'drag to shoot', 'mass = size', 'yield economy'],
  },
  {
    id: '003',
    name: '003 Hyperwarp',
    href: '/hyperwarp.html',
    tagline: 'A feel rig for drift flight, time control and the tools that bend it.',
    description: `Hyperwarp feel rig: drift flight, continuous time slider, time-stop bubble,
      antigravity, charge shockwave, teleport. WASD, Q/E, Space, Shift, mouse.`,
    tags: ['drift flight', 'time control', 'antigravity', 'teleport'],
  },
]

/** @param {string} id */
export function sketchById(id) {
  return SKETCHES.find((s) => s.id === id) || null
}

/**
 * Dynamic import for a sketch id, or null when it isn't registered.
 * @param {string} id
 * @returns {(() => Promise<object>)|null}
 */
export function loadSketch(id) {
  const sketch = sketchById(id)
  if (!sketch) return null
  return sketchModules[sketch.file] || null
}
