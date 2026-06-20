// Seeded pseudo-random number generator (linear congruential).
//
// Deterministic for a given seed — used for the starfield/nebula so the
// background is stable across reloads and resizes. Returns a function that
// yields floats in [0, 1).
export function seededRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
