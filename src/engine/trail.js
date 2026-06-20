// Fixed-capacity ring buffer of {x, y} points for body motion trails.
//
// push() overwrites the oldest point once full; points() returns them in
// chronological (oldest-first) order. A non-positive capacity yields an inert
// trail (keeps nothing) — used for fixed bodies like the sun and to guard
// against `% 0 = NaN`.
export function makeTrail(cap) {
  if (!(cap > 0)) {
    return {
      push() {},
      points: () => [],
      clear() {},
      get length() {
        return 0
      },
    }
  }

  const buf = new Array(cap)
  let head = 0
  let size = 0

  return {
    push(x, y) {
      buf[head] = { x, y }
      head = (head + 1) % cap
      if (size < cap) size++
    },
    points() {
      const out = []
      const start = (head - size + cap) % cap
      for (let i = 0; i < size; i++) out.push(buf[(start + i) % cap])
      return out
    },
    clear() {
      head = 0
      size = 0
    },
    get length() {
      return size
    },
  }
}
