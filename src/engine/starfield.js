// Parallax star background: layered starfield + nebula clouds + an optional
// photo backdrop. Shared by every sketch so they all sit in the same sky.
//
// The field is a fixed, seeded tile of size (tw, th) that is scrolled and wrapped
// under the camera. Each layer scrolls at its own `depth`, which is what produces
// the parallax: distant layers barely move, near ones slide fast.
//
// Everything here is per-instance state, created by createStarfield() — a sketch
// owns its own field, so two sketches mounted in sequence never share buffers.

import { seededRandom } from './rng.js'

// Pixels of parallax drift per AU the camera center moves through the world.
// Driving parallax from the camera's WORLD center (not its pan offset) keeps it
// anchored to whatever the camera follows — ship, sun, or planet — and makes it
// independent of zoom and of the screen-center constant baked into the pan.
export const PARALLAX_GAIN = 120

// Stellar color palette by spectral class frequency.
const STAR_COLORS = [
  // Common — white/yellow-white (G/F class)
  { rgb: '255,255,245', weight: 0.28 },
  { rgb: '255,248,220', weight: 0.18 },
  // Blue-white (A/B class)
  { rgb: '180,210,255', weight: 0.15 },
  { rgb: '140,185,255', weight: 0.1 },
  { rgb: '100,160,255', weight: 0.06 },
  // Orange/yellow (K class)
  { rgb: '255,218,150', weight: 0.1 },
  { rgb: '255,190,110', weight: 0.06 },
  // Red (M class)
  { rgb: '255,140,100', weight: 0.04 },
  { rgb: '255,100,80', weight: 0.02 },
  // Rare hot blue (O class)
  { rgb: '180,220,255', weight: 0.01 },
]

// Nebula palette: blue, purple, teal, magenta, deep red, indigo.
const NEBULA_COLORS = [
  [40, 80, 200],
  [120, 40, 200],
  [20, 160, 180],
  [180, 30, 160],
  [180, 30, 60],
  [60, 20, 180],
]

const LAYER_DEFS = [
  // Deep background — dense, tiny, almost no movement
  { count: 320, depth: 0.004, alpha: 0.18, size: 0.45 },
  // Mid field
  { count: 180, depth: 0.03, alpha: 0.32, size: 0.7 },
  // Near field — sparser, brighter, noticeably faster
  { count: 90, depth: 0.1, alpha: 0.52, size: 1.05 },
  // Foreground — few large bright stars, clearly faster
  { count: 28, depth: 0.22, alpha: 0.82, size: 1.6 },
  // Hero stars — very few, large, fast, with diffraction spikes
  { count: 7, depth: 0.42, alpha: 1.0, size: 2.4, hero: true },
]

// Reference zoom the parallax drift is calibrated against.
const ZOOM_REF = 0.33

// Backdrop photo tuning. It is drawn very translucent over the black base so it
// reads as depth rather than as an image, and it drifts harder than the deep
// stars (0.004) so panning visibly slides it.
const BACKDROP_DEPTH = 0.16 // parallax strength
const BACKDROP_MARGIN = 0.45 // fraction of viewport kept as drift headroom

export function wrap(value, max) {
  return ((value % max) + max) % max
}

function pickStarColor(rand) {
  const r = rand()
  let acc = 0
  for (const c of STAR_COLORS) {
    acc += c.weight
    if (r < acc) return c.rgb
  }
  return STAR_COLORS[0].rgb
}

/**
 * Build the (deterministic) star layers and nebula clouds for a viewport.
 * Pure — no canvas, no DOM — so it can be unit-tested.
 *
 * @param {number} w viewport width in px
 * @param {number} h viewport height in px
 * @param {{starSeed?: number, nebulaSeed?: number}} [seeds]
 * @returns {{starLayers: object[], nebulaClouds: object[], tw: number, th: number}}
 */
export function buildStarfieldData(w, h, { starSeed = 0x6a51cafe, nebulaSeed = 0xdeadbeef } = {}) {
  const rand = seededRandom(starSeed)
  // The tile overfills the viewport so wrapping seams stay off-screen.
  const tw = Math.max(w * 3.5, 2800)
  const th = Math.max(h * 3.5, 2200)

  const starLayers = LAYER_DEFS.map((def) => ({
    ...def,
    tw,
    th,
    stars: Array.from({ length: def.count }, () => ({
      x: rand() * tw,
      y: rand() * th,
      r: def.size * (0.55 + rand() * 1.4),
      twinkle: rand() * Math.PI * 2,
      twinkleSpeed: 0.4 + rand() * 1.2,
      color: pickStarColor(rand),
    })),
  }))

  const nrand = seededRandom(nebulaSeed)
  const nebulaClouds = Array.from({ length: 9 }, () => {
    const [r, g, b] = NEBULA_COLORS[Math.floor(nrand() * NEBULA_COLORS.length)]
    return {
      x: nrand() * tw,
      y: nrand() * th,
      rx: (0.18 + nrand() * 0.32) * tw,
      ry: (0.12 + nrand() * 0.22) * th,
      alpha: 0.028 + nrand() * 0.038,
      color: `${r},${g},${b}`,
      depth: 0.002 + nrand() * 0.025,
      tw,
      th,
    }
  })

  return { starLayers, nebulaClouds, tw, th }
}

/**
 * Create a starfield instance.
 *
 * @param {object} [opts]
 * @param {string|null} [opts.backdropUrl]   optional photo laid under the stars
 * @param {number} [opts.backdropAlpha]      how translucent that photo is
 * @param {string} [opts.baseColor]          fill painted behind everything
 * @param {number} [opts.starSeed]
 * @param {number} [opts.nebulaSeed]
 * @returns {{build: Function, draw: Function, isBuilt: Function}}
 */
export function createStarfield({
  backdropUrl = null,
  backdropAlpha = 0.16,
  baseColor = '#01020a',
  starSeed = 0x6a51cafe,
  nebulaSeed = 0xdeadbeef,
} = {}) {
  let starLayers = []
  let nebulaClouds = []

  // Loaded once; drawImage is skipped until it decodes. Guarded so the module
  // stays importable outside the browser (unit tests run in node).
  let backdrop = null
  if (backdropUrl && typeof Image !== 'undefined') {
    backdrop = new Image()
    backdrop.src = backdropUrl
  }

  function build(w, h) {
    const data = buildStarfieldData(w, h, { starSeed, nebulaSeed })
    starLayers = data.starLayers
    nebulaClouds = data.nebulaClouds
  }

  function drawBackdrop(ctx, w, h, parX, parY) {
    if (!backdrop || !backdrop.complete || !backdrop.naturalWidth) return
    const iw = backdrop.naturalWidth
    const ih = backdrop.naturalHeight
    // Parallax offset (opposite the camera's motion, like the star layers).
    const ox = -parX * BACKDROP_DEPTH
    const oy = -parY * BACKDROP_DEPTH
    // Cover fit + margin so the image overfills the viewport on every side,
    // leaving room for the drift offset without ever exposing an edge.
    const fit = Math.max(w / iw, h / ih) * (1 + BACKDROP_MARGIN * 2)
    const dw = iw * fit
    const dh = ih * fit
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = backdropAlpha
    ctx.drawImage(backdrop, (w - dw) / 2 + ox, (h - dh) / 2 + oy, dw, dh)
    ctx.restore()
  }

  /**
   * Paint the sky. `camWorldX/Y` is the world point at the centre of the screen
   * (the inverse of worldToScreen at w/2, h/2); `zoom` drives a small extra
   * drift so zooming feels like moving through the field, not scaling a poster.
   */
  function draw(ctx, w, h, camWorldX = 0, camWorldY = 0, zoom = ZOOM_REF) {
    if (!starLayers.length) build(w, h)

    const t = Date.now() / 1000
    const parX = camWorldX * PARALLAX_GAIN
    const parY = camWorldY * PARALLAX_GAIN
    const zoomBase = Math.log2(Math.max(zoom, 0.004) / ZOOM_REF) * 18

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, w, h)
    ctx.restore()

    // Photo backdrop sits over the black base, under nebula and stars.
    drawBackdrop(ctx, w, h, parX, parY)

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // --- Nebula clouds ---
    ctx.globalCompositeOperation = 'screen'
    for (const cloud of nebulaClouds) {
      const zoomDrift = zoomBase * cloud.depth
      let cx = wrap(cloud.x - wrap(parX * cloud.depth - zoomDrift, cloud.tw), cloud.tw)
      let cy = wrap(cloud.y - wrap(parY * cloud.depth + zoomDrift * 0.6, cloud.th), cloud.th)
      if (cx > w + cloud.rx) cx -= cloud.tw
      if (cy > h + cloud.ry) cy -= cloud.th

      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(1, cloud.ry / cloud.rx)
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, cloud.rx)
      grad.addColorStop(0, `rgba(${cloud.color},${cloud.alpha})`)
      grad.addColorStop(0.4, `rgba(${cloud.color},${(cloud.alpha * 0.5).toFixed(3)})`)
      grad.addColorStop(1, `rgba(${cloud.color},0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(0, 0, cloud.rx, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.globalCompositeOperation = 'source-over'

    // --- Stars ---
    for (const layer of starLayers) {
      const zoomDrift = zoomBase * layer.depth
      // Negated: as the camera moves +x through the world, the stars slide -x.
      const ox = wrap(-parX * layer.depth + zoomDrift, layer.tw)
      const oy = wrap(-parY * layer.depth - zoomDrift * 0.6, layer.th)

      for (const star of layer.stars) {
        let x = wrap(star.x + ox, layer.tw)
        let y = wrap(star.y + oy, layer.th)
        if (x > w + 20) x -= layer.tw
        if (y > h + 20) y -= layer.th
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue

        const twinkle = 0.78 + 0.22 * Math.sin(t * star.twinkleSpeed + star.twinkle)
        const alpha = layer.alpha * twinkle

        // Soft halo
        const haloR = star.r * (layer.hero ? 5 : 2.6)
        const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR)
        halo.addColorStop(
          0,
          `rgba(${star.color},${(alpha * (layer.hero ? 0.55 : 0.2)).toFixed(3)})`,
        )
        halo.addColorStop(1, `rgba(${star.color},0)`)
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(x, y, haloR, 0, Math.PI * 2)
        ctx.fill()

        // Star disc
        ctx.fillStyle = `rgba(${star.color},${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, star.r, 0, Math.PI * 2)
        ctx.fill()

        // Diffraction spikes for hero stars
        if (layer.hero) {
          const spikeLen = star.r * (8 + 4 * twinkle)
          const spikeAlpha = alpha * 0.55
          ctx.lineCap = 'round'
          for (const angle of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
            for (const sign of [1, -1]) {
              const ax = Math.cos(angle) * sign
              const ay = Math.sin(angle) * sign
              const sg = ctx.createLinearGradient(x, y, x + ax * spikeLen, y + ay * spikeLen)
              sg.addColorStop(0, `rgba(${star.color},${spikeAlpha.toFixed(3)})`)
              sg.addColorStop(1, `rgba(${star.color},0)`)
              ctx.strokeStyle = sg
              ctx.lineWidth = star.r * 0.55
              ctx.beginPath()
              ctx.moveTo(x, y)
              ctx.lineTo(x + ax * spikeLen, y + ay * spikeLen)
              ctx.stroke()
            }
          }
        }
      }
    }

    ctx.restore()
  }

  return {
    build,
    draw,
    isBuilt: () => starLayers.length > 0,
  }
}
