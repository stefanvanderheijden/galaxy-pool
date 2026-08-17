// The sky: a parallax star field, optional nebula, optional photo backdrop.
// Shared by every sketch so they all sit in the same space.
//
// ONE RULE governs every star. A star has a real position in AU and a PARALLAX
// FACTOR k, and it is drawn at
//
//     screen = viewportCentre + (starWorld - cameraWorld) · scale · k
//
// where `scale` is the camera's pixels-per-AU. That single line is the whole
// model. Note what it depends on: the CAMERA, and nothing else. Stars know
// nothing about the planets, the ship or anything in the simulation — the field
// reacts to where the view is and how far it is zoomed, full stop.
//
// k is the only thing that separates one layer from another:
//
//     k ≪ 1   almost fixed — the distant backdrop, barely reacts to anything
//     k < 1   behind the world, drifts slower than the planets
//     k = 1   exactly at the world's distance, moves with the planets
//     k > 1   IN FRONT of the world — sweeps outward and past the camera as you
//             zoom in, which is what makes moving through space feel like moving
//
// Because the offset is measured in AU and is fixed against zoom, a star's
// screen position is smooth in the zoom: zooming in slides it steadily outward.
// (An earlier version wrapped in screen space off a large world coordinate, so a
// small zoom change jumped it across many tiles and the whole field boiled.)
//
// Each layer repeats on its own square WORLD tile, so the field is infinite in
// every direction. A star fades out toward its tile boundary, measured in tile
// units — so it is always invisible at the moment it wraps, at any zoom. Tile
// sizes run roughly inversely to k, which gives every layer a similar footprint
// on screen, and they form an octave ladder: the wide tiles carry the view when
// zoomed out, the tight ones are still dense once you have zoomed a long way in
// and the wide ones have swept off the edges.

import { seededRandom } from './rng.js'

// Stellar colour palette, by roughly how common each spectral class is.
const STAR_COLORS = [
  // Common — white / yellow-white (G, F)
  { rgb: '255,255,245', weight: 0.28 },
  { rgb: '255,248,220', weight: 0.18 },
  // Blue-white (A, B)
  { rgb: '180,210,255', weight: 0.15 },
  { rgb: '140,185,255', weight: 0.1 },
  { rgb: '100,160,255', weight: 0.06 },
  // Orange / yellow (K)
  { rgb: '255,218,150', weight: 0.1 },
  { rgb: '255,190,110', weight: 0.06 },
  // Red (M)
  { rgb: '255,140,100', weight: 0.04 },
  { rgb: '255,100,80', weight: 0.02 },
  // Rare hot blue (O)
  { rgb: '180,220,255', weight: 0.01 },
]

// The layers. `k` says where each one sits; `front: true` means it is drawn OVER
// the world by drawForeground(), everything else goes behind it in draw().
// `bloom` picks the expensive three-pass glow — the deep layers are flat discs
// because at their size nothing else would show, and there are a lot of them.
//
// A layer's FOOTPRINT is tileAU · k: the width of one tile in screen-space AU,
// so its size in pixels is footprint · scale. That is what decides the zoom band
// a layer is useful in, and the footprints below deliberately span three decades
// rather than clustering:
//
//   a wide footprint fills the screen when zoomed out, and empties as you zoom
//   in and its stars sweep off the edges;
//   a tight one would be a repeating grid of dots when zoomed out, but is still
//   dense after you have zoomed a long way in.
//
// Each layer is faded in only once its tile is big enough to not read as a grid
// (see layerVisibility), so at any zoom two or three of them are carrying the
// sky and the rest are dark. That is the ladder: no single layer can be right at
// every zoom, so they hand over.
//
// COUNTS are per tile, not per screen. A layer is at its best when its tile is
// about twice the viewport across, which is roughly six times the viewport's
// area — so a rung needs about six times as many stars as you want to SEE. They
// are cheap: an off-tile star costs one wrap and a compare, and one that draws
// is a single cached-sprite blit.
// Rungs run widest-first. Footprint (tileAU · k) drops by about 3× per rung, and
// `front` alternates in so that every zoom band has stars both behind the world
// and in front of it.
const LAYERS = [
  { id: 'l0', k: 0.012, tileAU: 50000, count: 900, size: 1.2, alpha: 0.75, halo: true },
  { id: 'l1', k: 0.03, tileAU: 5000, count: 800, size: 1.4, alpha: 0.85, halo: true },
  { id: 'l2', k: 1.5, tileAU: 80, count: 90, size: 1.8, alpha: 0.95, front: true, bloom: true },
  { id: 'l3', k: 0.09, tileAU: 555, count: 700, size: 1.6, alpha: 0.9, halo: true },
  { id: 'l4', k: 2.0, tileAU: 12.5, count: 80, size: 2.0, alpha: 1.0, front: true, bloom: true },
  { id: 'l5', k: 0.22, tileAU: 77, count: 600, size: 1.9, alpha: 0.95, halo: true },
  { id: 'l6', k: 3.2, tileAU: 1.75, count: 60, size: 2.5, alpha: 1.0, front: true, bloom: true },
  { id: 'l7', k: 0.55, tileAU: 3.45, count: 120, size: 2.4, alpha: 1.0, halo: true, spikes: true },
  { id: 'l8', k: 5.0, tileAU: 0.124, count: 45, size: 3.0, alpha: 1.0, front: true, bloom: true },
  { id: 'l9', k: 0.9, tileAU: 0.233, count: 500, size: 2.5, alpha: 1.0, halo: true },
  {
    id: 'l10',
    k: 8.0,
    tileAU: 0.00875,
    count: 30,
    size: 3.6,
    alpha: 1.0,
    front: true,
    bloom: true,
  },
]

// A layer only draws once one tile comfortably OVERFLOWS the viewport.
//
// This is not a nicety. Stars fade out toward the edge of their tile, and that
// edge is a square — so a tile smaller than the screen shows up as a literal box
// of stars floating in empty space. The threshold has to keep the whole fade
// band off-screen: the band starts at (1 − EDGE_FADE) of the half-tile, and the
// furthest visible point is the viewport's half-diagonal, which is why the
// minimum is well above 1 rather than a fraction.
const LOD_MIN = 1.6
const LOD_FULL = 2.4

/**
 * How strongly a layer should be drawn at this zoom, 0..1 — its tile size on
 * screen, relative to the viewport. Pure, and exported so the ladder can be
 * checked without a canvas.
 */
export function layerVisibility(footprintAU, scale, viewportMax) {
  if (!(viewportMax > 0)) return 0
  const span = (footprintAU * scale) / viewportMax
  if (span <= LOD_MIN) return 0
  if (span >= LOD_FULL) return 1
  const t = (span - LOD_MIN) / (LOD_FULL - LOD_MIN)
  return t * t * (3 - 2 * t) // smoothstep, so layers fade in rather than pop
}

// Nebula clouds ride the same rule for POSITION, at the depth of the deepest
// stars — but not for size. A cloud sized in AU at that depth projects to a
// radial-gradient fill thousands of pixels across, and nine of those in `screen`
// blend mode cost more than everything else in the frame combined (it took the
// sketch from 60fps to 24). They are drawn at a fixed fraction of the viewport
// instead: at this depth a cloud is effectively at infinity, so it should slide
// with the camera and NOT swell with the zoom anyway.
const NEBULA = { k: 0.03, tileAU: 380, count: 7 }
// At most this many clouds are painted in a frame, nearest the centre of the
// view first. Each one is a viewport-sized `screen`-blended fill, and when the
// camera is zoomed out they all crowd into view at once — three of them read as
// a nebula just as well as seven, and cost less than half as much.
const NEBULA_MAX_DRAW = 3
const NEBULA_COLORS = [
  [40, 80, 200],
  [120, 40, 200],
  [20, 160, 180],
  [180, 30, 160],
  [180, 30, 60],
  [60, 20, 180],
]

// Pixels-per-AU at which a star is drawn at its nominal size.
const REF_SCALE = 100

// Stars are drawn from PRE-RENDERED SPRITES, not from gradients built per star
// per frame. A thousand stars needing one to three createRadialGradient() calls
// each cost more than the rest of the frame put together (23fps at fit zoom);
// the same picture as a cached sprite blitted with globalAlpha runs at full
// rate. Twinkle and fade ride on globalAlpha and size on the destination
// rectangle, so nothing about the look is lost — only the per-frame gradient
// construction.
const SPRITE_PX = 64
// How far each kind's glow reaches, in multiples of the star's core radius.
const SPRITE_EXTENT = { bloom: 7, halo: 4, plain: 1.6, spike: 9 }
// Fraction of a tile's half-width over which a star fades out before it wraps.
const EDGE_FADE = 0.28

// Backdrop photo: its own shallow k, so it drifts like very distant scenery.
const BACKDROP_K = 0.05
const BACKDROP_MARGIN = 0.45 // cover-fit headroom, untiled mode only

/** Wrap into [0, size). */
export function wrap(value, size) {
  return ((value % size) + size) % size
}

/** Wrap into [-size/2, size/2) — a tile centred on the camera. */
export function wrapCentered(value, size) {
  return wrap(value + size / 2, size) - size / 2
}

/** Positive modulo 2, for the mirrored-tile parity test. */
const mod2 = (n) => ((n % 2) + 2) % 2

// One sprite per (colour, kind, core tint). Shared across every starfield
// instance — the images are identical and immutable.
const spriteCache = new Map()

function starSprite(color, kind, tintCore) {
  const key = `${color}|${kind}|${tintCore ? 1 : 0}`
  const cached = spriteCache.get(key)
  if (cached) return cached
  if (typeof document === 'undefined') return null

  const cv = document.createElement('canvas')
  cv.width = SPRITE_PX
  cv.height = SPRITE_PX
  const c = cv.getContext('2d')
  const R = SPRITE_PX / 2
  const centre = tintCore ? color : '255,255,255'

  if (kind === 'spike') {
    // Diffraction spikes, baked in. Drawn first so the core sits over them.
    for (const angle of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
      for (const sign of [1, -1]) {
        const ax = Math.cos(angle) * sign
        const ay = Math.sin(angle) * sign
        const g = c.createLinearGradient(R, R, R + ax * R, R + ay * R)
        g.addColorStop(0, `rgba(${color},0.55)`)
        g.addColorStop(1, `rgba(${color},0)`)
        c.strokeStyle = g
        c.lineWidth = Math.max(1, (R / SPRITE_EXTENT.spike) * 0.55)
        c.lineCap = 'round'
        c.beginPath()
        c.moveTo(R, R)
        c.lineTo(R + ax * R, R + ay * R)
        c.stroke()
      }
    }
  }

  const g = c.createRadialGradient(R, R, 0, R, R, R)
  if (kind === 'bloom') {
    g.addColorStop(0, `rgba(${centre},1)`)
    g.addColorStop(0.1, `rgba(${color},0.95)`)
    g.addColorStop(0.2, `rgba(${color},0.4)`)
    g.addColorStop(0.45, `rgba(${color},0.12)`)
    g.addColorStop(1, `rgba(${color},0)`)
  } else if (kind === 'halo' || kind === 'spike') {
    g.addColorStop(0, `rgba(${centre},1)`)
    g.addColorStop(kind === 'spike' ? 0.09 : 0.18, `rgba(${color},0.9)`)
    g.addColorStop(kind === 'spike' ? 0.16 : 0.3, `rgba(${color},0.35)`)
    g.addColorStop(1, `rgba(${color},0)`)
  } else {
    g.addColorStop(0, `rgba(${centre},1)`)
    g.addColorStop(0.45, `rgba(${color},0.95)`)
    g.addColorStop(0.75, `rgba(${color},0.3)`)
    g.addColorStop(1, `rgba(${color},0)`)
  }
  c.fillStyle = g
  c.fillRect(0, 0, SPRITE_PX, SPRITE_PX)

  spriteCache.set(key, cv)
  return cv
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
 * Build the (deterministic) sky. Pure — no canvas, no DOM.
 *
 * Star positions are scattered across their layer's tile; the draw wraps them
 * around wherever the camera happens to be, so one tile is the whole field.
 *
 * @returns {{layers: object[], nebula: object[]}}
 */
export function buildStarfieldData({ seed = 0x6a51cafe } = {}) {
  const rand = seededRandom(seed)

  const layers = LAYERS.map((def) => ({
    ...def,
    stars: Array.from({ length: def.count }, () => ({
      wx: rand() * def.tileAU,
      wy: rand() * def.tileAU,
      r: def.size * (0.6 + rand() * 0.9),
      twinkle: rand() * Math.PI * 2,
      twinkleSpeed: 0.4 + rand() * 1.2,
      color: pickStarColor(rand),
    })),
  }))

  const nrand = seededRandom(seed ^ 0xdeadbeef)
  const nebula = Array.from({ length: NEBULA.count }, () => {
    const [r, g, b] = NEBULA_COLORS[Math.floor(nrand() * NEBULA_COLORS.length)]
    return {
      wx: nrand() * NEBULA.tileAU,
      wy: nrand() * NEBULA.tileAU,
      // Radii as a fraction of the viewport's larger dimension.
      rx: 0.35 + nrand() * 0.45,
      ry: 0.25 + nrand() * 0.35,
      alpha: 0.03 + nrand() * 0.04,
      color: `${r},${g},${b}`,
    }
  })

  return { layers, nebula }
}

/**
 * Create a sky.
 *
 * @param {object} [opts]
 * @param {string|null} [opts.backdropUrl]      photo laid behind the stars
 * @param {number}  [opts.backdropAlpha]        how translucent that photo is
 * @param {boolean} [opts.backdropTile]         repeat it instead of cover-fitting
 * @param {number}  [opts.backdropTileScale]    tile height as a fraction of the viewport
 * @param {string}  [opts.baseColor]            fill painted behind everything
 * @param {boolean} [opts.nebula]               draw the nebula clouds
 * @param {number}  [opts.seed]
 * @param {boolean} [opts.debugLayers]          tint stars behind the world blue
 *                                              and stars in front of it red
 */
export function createStarfield({
  backdropUrl = null,
  backdropAlpha = 0.16,
  backdropTile = false,
  backdropTileScale = 0.5,
  baseColor = '#01020a',
  nebula = true,
  seed = 0x6a51cafe,
  debugLayers = false,
} = {}) {
  let layers = []
  let clouds = []

  // Loaded once; drawing is skipped until it decodes. Guarded so the module
  // stays importable outside a browser (the unit tests run in node).
  let backdrop = null
  if (backdropUrl && typeof Image !== 'undefined') {
    backdrop = new Image()
    backdrop.src = backdropUrl
  }

  const DEBUG_BEHIND = '90,150,255'
  const DEBUG_FRONT = '255,80,70'

  function build() {
    const data = buildStarfieldData({ seed })
    layers = data.layers
    clouds = data.nebula
  }

  // The one projection. Returns null once the item has faded out at its tile
  // boundary, so callers can skip it entirely.
  function project(item, k, tileAU, w, h, camX, camY, scale) {
    const rx = wrapCentered(item.wx - camX, tileAU)
    const ry = wrapCentered(item.wy - camY, tileAU)
    const half = tileAU / 2
    const q = Math.max(Math.abs(rx), Math.abs(ry)) / half
    const fade = Math.max(0, Math.min(1, (1 - q) / EDGE_FADE))
    if (fade <= 0.01) return null
    return { x: w / 2 + rx * scale * k, y: h / 2 + ry * scale * k, fade }
  }

  function drawBackdropTiled(ctx, w, h, camX, camY, scale) {
    const iw = backdrop.naturalWidth
    const ih = backdrop.naturalHeight
    const tileH = Math.max(64, h * backdropTileScale)
    const tileW = tileH * (iw / ih)
    const ox = -camX * scale * BACKDROP_K
    const oy = -camY * scale * BACKDROP_K
    const i0 = Math.floor(-ox / tileW)
    const j0 = Math.floor(-oy / tileH)
    const cols = Math.ceil(w / tileW) + 1
    const rows = Math.ceil(h / tileH) + 1

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = backdropAlpha
    for (let jj = 0; jj <= rows; jj++) {
      for (let ii = 0; ii <= cols; ii++) {
        const i = i0 + ii
        const j = j0 + jj
        // Alternate tiles are MIRRORED — odd columns horizontally, odd rows
        // vertically — so neighbours meet along matching edges and the seams
        // disappear without needing a tileable source image.
        const fx = mod2(i) === 0 ? 1 : -1
        const fy = mod2(j) === 0 ? 1 : -1
        ctx.save()
        ctx.translate(ox + i * tileW + (fx < 0 ? tileW : 0), oy + j * tileH + (fy < 0 ? tileH : 0))
        ctx.scale(fx, fy)
        ctx.drawImage(backdrop, 0, 0, tileW, tileH)
        ctx.restore()
      }
    }
    ctx.restore()
  }

  function drawBackdrop(ctx, w, h, camX, camY, scale) {
    if (!backdrop || !backdrop.complete || !backdrop.naturalWidth) return
    if (backdropTile) {
      drawBackdropTiled(ctx, w, h, camX, camY, scale)
      return
    }
    const iw = backdrop.naturalWidth
    const ih = backdrop.naturalHeight
    const fit = Math.max(w / iw, h / ih) * (1 + BACKDROP_MARGIN * 2)
    const dw = iw * fit
    const dh = ih * fit
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = backdropAlpha
    ctx.drawImage(
      backdrop,
      (w - dw) / 2 - camX * scale * BACKDROP_K,
      (h - dh) / 2 - camY * scale * BACKDROP_K,
      dw,
      dh,
    )
    ctx.restore()
  }

  function drawNebula(ctx, w, h, camX, camY, scale) {
    const viewportMax = Math.max(w, h)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'screen'
    const visible = []
    for (const cloud of clouds) {
      const p = project(cloud, NEBULA.k, NEBULA.tileAU, w, h, camX, camY, scale)
      if (!p) continue
      const rx = cloud.rx * viewportMax
      const ry = cloud.ry * viewportMax
      // Skip anything whose ellipse cannot reach the viewport — without this
      // every cloud pays for a full gradient fill whether it shows or not.
      if (p.x + rx < 0 || p.x - rx > w || p.y + ry < 0 || p.y - ry > h) continue
      visible.push({ cloud, p, rx, ry, d: Math.hypot(p.x - w / 2, p.y - h / 2) })
    }
    visible.sort((a, b) => a.d - b.d)

    for (const { cloud, p, rx, ry } of visible.slice(0, NEBULA_MAX_DRAW)) {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.scale(1, ry / rx)
      const a = cloud.alpha * p.fade
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
      grad.addColorStop(0, `rgba(${cloud.color},${a.toFixed(4)})`)
      grad.addColorStop(0.45, `rgba(${cloud.color},${(a * 0.45).toFixed(4)})`)
      grad.addColorStop(1, `rgba(${cloud.color},0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(0, 0, rx, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }

  function drawStar(ctx, layer, star, p, sizeScale, time, lod = 1) {
    const twinkle = 0.8 + 0.2 * Math.sin(time * star.twinkleSpeed + star.twinkle)
    const alpha = layer.alpha * twinkle * p.fade * lod
    if (alpha <= 0.012) return

    const color = debugLayers ? (layer.front ? DEBUG_FRONT : DEBUG_BEHIND) : star.color
    const kind = layer.spikes ? 'spike' : layer.bloom ? 'bloom' : layer.halo ? 'halo' : 'plain'
    const sprite = starSprite(color, kind, debugLayers)
    if (!sprite) return

    // One blit. A sprite's core radius is 1/extent of its own half-width, so
    // drawing it at 2·r·extent puts the core at exactly r.
    const reach = star.r * sizeScale * SPRITE_EXTENT[kind]
    ctx.globalAlpha = Math.min(1, alpha)
    ctx.drawImage(sprite, p.x - reach, p.y - reach, reach * 2, reach * 2)
  }

  function drawLayers(ctx, w, h, camX, camY, scale, front) {
    if (!layers.length) build()
    const time = Date.now() / 1000
    // Stars swell as the camera pushes toward them. Square root, so they grow
    // without exploding across the zoom range.
    const sizeScale = Math.max(0.8, Math.min(4, Math.sqrt(scale / REF_SCALE)))
    const viewportMax = Math.max(w, h)

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    // Additive: overlapping halos build into a glow instead of flatly painting
    // over one another.
    ctx.globalCompositeOperation = 'lighter'
    for (const layer of layers) {
      if (!!layer.front !== front) continue
      const lod = layerVisibility(layer.tileAU * layer.k, scale, viewportMax)
      if (lod <= 0.01) continue
      for (const star of layer.stars) {
        const p = project(star, layer.k, layer.tileAU, w, h, camX, camY, scale)
        if (!p) continue
        const pad = star.r * sizeScale * 10
        if (p.x < -pad || p.x > w + pad || p.y < -pad || p.y > h + pad) continue
        drawStar(ctx, layer, star, p, sizeScale * (0.75 + 0.25 * lod), time, lod)
      }
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  /**
   * Everything BEHIND the world: base fill, photo backdrop, nebula, and every
   * star layer with k below 1. Call before drawing the scene.
   *
   * @param {number} camX world x at the centre of the viewport
   * @param {number} camY world y at the centre of the viewport
   * @param {number} scale the camera's pixels-per-AU
   */
  function draw(ctx, w, h, camX = 0, camY = 0, scale = REF_SCALE) {
    if (!layers.length) build()

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, w, h)
    ctx.restore()

    drawBackdrop(ctx, w, h, camX, camY, scale)
    if (nebula) drawNebula(ctx, w, h, camX, camY, scale)
    drawLayers(ctx, w, h, camX, camY, scale, false)
  }

  /**
   * Everything IN FRONT of the world — the layers with k above 1, which sweep
   * outward past the camera as you zoom in. Call after drawing the scene and
   * before the HUD.
   */
  function drawForeground(ctx, w, h, camX = 0, camY = 0, scale = REF_SCALE) {
    drawLayers(ctx, w, h, camX, camY, scale, true)
  }

  return { build, draw, drawForeground, isBuilt: () => layers.length > 0 }
}
