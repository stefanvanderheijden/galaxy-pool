<template>
  <SketchWrapper
    :is-playing="isPlaying"
    :time-scale="timeScale"
    :time-scale-min="1"
    :time-scale-max="10000000"
    :time-scale-step="1000"
    :body-count="bodyCount"
    :elapsed="0"
    :elapsed-label="elapsedLabel"
    @canvas-ready="initCanvas"
    @toggle-play="togglePlay"
    @set-timescale="setTimeScale"
    @reset="reset"
  >
    <template #settings>
      <SettingsPanel @export="settings.exportJSON()" @import="onImport">
        <SettingsSection title="Simulation">
          <SettingsRow label="Base speed"    v-model="settings.settings.sim.baseSpeed"       :min="0.1"  :max="1000" :step="0.1"   :decimals="1" tooltip="Simulation speed multiplier. 1 = real time (very slow). 365 = 1 year per second." />
        </SettingsSection>
        <SettingsSection title="Spaceship">
          <SettingsRow label="Thrust (N/kg)" v-model="settings.settings.ship.thrustAccel"    :min="1e-9" :max="1e-6" :step="1e-9"  :decimals="10" tooltip="Thrust acceleration in AU/yr². Higher = faster acceleration." />
          <SettingsRow label="Rotate speed"  v-model="settings.settings.ship.rotateSpeed"    :min="1"    :max="200"  :step="1"     :decimals="0"  tooltip="Rotation speed in rad/yr." />
        </SettingsSection>
        <SettingsSection title="Visuals">
          <SettingsRow label="Trail length"  v-model="settings.settings.visuals.trailLength" :min="50"   :max="2000" :step="50"    :decimals="0"  tooltip="Number of past positions in the spaceship trail." />
        </SettingsSection>
      </SettingsPanel>
    </template>
  </SketchWrapper>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import SketchWrapper from '../components/SketchWrapper.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import SettingsSection from '../components/SettingsSection.vue'
import SettingsRow from '../components/SettingsRow.vue'
import { useSettings } from '../composables/useSettings.js'

// =============================================================================
// CONSTANTS
// =============================================================================

const PROTOTYPE_ID = '005'

// Unit system: AU (astronomical unit), Solar masses, Julian years
// G in these units = 4π² (from Kepler's 3rd law: T²=a³ for M_sun)
const G_SIM     = 4 * Math.PI * Math.PI  // ~39.478 AU³ / (M☉ · yr²)
const PX_PER_AU = 100                     // pixels per AU at zoom = 1
const AU_KM     = 1.496e8                 // km per AU (for display labels)
const SOFTENING = 1e-5                    // AU² — prevents singularities
const MAX_DT    = 0.05                    // real-time seconds cap per frame

// Spaceship physical dimensions
const SHIP_LENGTH_AU = 1000  / AU_KM   // 1000 km in AU ≈ 6.684e-6 AU
const SHIP_WIDTH_AU  = 26   / AU_KM   // 26 km in AU  ≈ 1.738e-7 AU
const SHIP_MASS      = 5.03e-18        // M☉ — 10,000 Gt (10^13 kg / 1.989e30 kg per M☉)

// Minimum pixel size below which we switch to icon rendering
const MIN_PLANET_PX = 3   // px
const MIN_SHIP_PX   = 30  // px (length in screen pixels)

// Prediction config
const PRED_STEPS    = 600   // ghost steps per prediction run
const PRED_DT_MULT  = 6     // ghost dt = N × real frame dt
const PRED_INTERVAL = 20    // recalculate every N rendered frames

// Solar system data — all in simulation units (AU, M☉)
// Physical radii inflated for visibility; gravity uses mass only
// Approximate mean longitudes (radians) as of J2000.0 (Jan 1.5, 2000)
const SOLAR_BODIES = [
  { id: 'sun',     name: 'Sun',     mass: 1.0,       orbR: 0,      angle: 0,     color: '#FFD700', physR: 0.00465, drawR: 0.010, isFixed: true  },
  { id: 'mercury', name: 'Mercury', mass: 1.660e-7,  orbR: 0.387,  angle: 4.402, color: '#b5b5b5', physR: 1.63e-5, drawR: 0.003, isFixed: false },
  { id: 'venus',   name: 'Venus',   mass: 2.447e-6,  orbR: 0.723,  angle: 3.176, color: '#e8cda0', physR: 4.05e-5, drawR: 0.005, isFixed: false },
  { id: 'earth',   name: 'Earth',   mass: 3.003e-6,  orbR: 1.000,  angle: 1.753, color: '#4fc3f7', physR: 4.26e-5, drawR: 0.006, isFixed: false },
  { id: 'mars',    name: 'Mars',    mass: 3.213e-7,  orbR: 1.524,  angle: 5.015, color: '#e8714a', physR: 2.27e-5, drawR: 0.004, isFixed: false },
  { id: 'jupiter', name: 'Jupiter', mass: 9.543e-4,  orbR: 5.203,  angle: 0.600, color: '#c8a882', physR: 4.67e-4, drawR: 0.050, isFixed: false },
  { id: 'saturn',  name: 'Saturn',  mass: 2.857e-4,  orbR: 9.537,  angle: 0.871, color: '#e8d5a0', physR: 3.89e-4, drawR: 0.040, isFixed: false },
  { id: 'uranus',  name: 'Uranus',  mass: 4.366e-5,  orbR: 19.19,  angle: 5.466, color: '#7de8e8', physR: 1.70e-4, drawR: 0.025, isFixed: false },
  { id: 'neptune', name: 'Neptune', mass: 5.151e-5,  orbR: 30.07,  angle: 5.321, color: '#4b70dd', physR: 1.65e-4, drawR: 0.024, isFixed: false },
]

// =============================================================================
// SETTINGS
// =============================================================================

const settings = useSettings(PROTOTYPE_ID, {
  sim:     { baseSpeed: 1000000 },
  ship:    { thrustAccel: 20, rotateSpeed: 31.4 },
  visuals: { trailLength: 800 },
})

function onImport(parsed) { settings.importJSON(parsed); reset() }

onMounted(() => {
  const imported = history.state?.importedSettings
  if (imported) settings.importJSON(imported)
})

// =============================================================================
// REACTIVE STATE
// =============================================================================

const isPlaying      = ref(true)
const timeScale      = ref(settings.settings.sim.baseSpeed)
const bodyCount      = ref(0)
const elapsedLabel   = ref('')  // shown in SketchWrapper controls bar

// =============================================================================
// SIMULATION STATE — plain objects, no engine classes
// =============================================================================

// Body: { id, name, x, y, vx, vy, mass, drawR, color, isFixed, trail: [] }
let bodies = []
let ship   = null   // reference into bodies[]

// Camera
const cam = {
  zoom:   0.06,   // PX_PER_AU * zoom = px per AU
  panX:   0,
  panY:   0,
  focus:  'sun',  // 'sun' | 'ship' | 'free'
  _dragActive: false,
  _dragLastX:  0,
  _dragLastY:  0,
}

// Spaceship angular state
let shipAngle    = 0   // radians
let shipAngVel   = 0   // rad/yr

// Inputs
const keys = {}

// Prediction path
let shipPredPath  = []    // [{x,y}] in AU
let predCountdown = 0

// Trail circular buffer helper
function makeTrail(cap) {
  const buf = new Array(cap)
  let head = 0, size = 0
  return {
    push(x, y) { buf[head] = { x, y }; head = (head + 1) % cap; if (size < cap) size++ },
    points() {
      const out = []
      const start = (head - size + cap) % cap
      for (let i = 0; i < size; i++) out.push(buf[(start + i) % cap])
      return out
    },
    clear() { head = 0; size = 0 },
    get length() { return size },
  }
}

// =============================================================================
// PHYSICS — inline (AU / M☉ / yr units, no engine imports)
// =============================================================================

function gravityStep(bs, dt) {
  const n = bs.length
  const fx = new Float64Array(n)
  const fy = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = bs[j].x - bs[i].x
      const dy = bs[j].y - bs[i].y
      const distSq = dx * dx + dy * dy + SOFTENING
      const dist   = Math.sqrt(distSq)
      const f      = G_SIM * bs[i].mass * bs[j].mass / distSq
      const ffx    = f * dx / dist
      const ffy    = f * dy / dist
      if (!bs[i].isFixed) { fx[i] += ffx; fy[i] += ffy }
      if (!bs[j].isFixed) { fx[j] -= ffx; fy[j] -= ffy }
    }
  }

  for (let i = 0; i < n; i++) {
    if (bs[i].isFixed) continue
    bs[i].vx += (fx[i] / bs[i].mass) * dt
    bs[i].vy += (fy[i] / bs[i].mass) * dt
    bs[i].x  += bs[i].vx * dt
    bs[i].y  += bs[i].vy * dt
  }
}

function simStep(dt_yr, realDt_s) {
  applyShipInput(dt_yr, realDt_s)
  gravityStep(bodies, dt_yr)
}

// =============================================================================
// SPACESHIP INPUT
// =============================================================================


// Rotation speed in real-time rad/s (independent of sim time scale)
const ROT_SPEED_RPS = 1.2   // rad per real second
const ROT_DAMPING   = 0.85  // per real second (when key released)

function applyShipInput(dt_yr, realDt_s) {
  if (!ship) return
  const thrust = settings.settings.ship.thrustAccel  // AU/yr²

  // Rotation operates in real time so it always feels responsive
  if (keys['ArrowLeft']  || keys['a'] || keys['A']) shipAngVel = -ROT_SPEED_RPS
  if (keys['ArrowRight'] || keys['d'] || keys['D']) shipAngVel =  ROT_SPEED_RPS
  if (keys['x'] || keys['X']) {
    // RCS damping thrusters — kill rotation fast
    shipAngVel *= Math.pow(0.01, realDt_s)
  } else if (!keys['ArrowLeft'] && !keys['ArrowRight'] && !keys['a'] && !keys['A'] && !keys['d'] && !keys['D']) {
    shipAngVel *= Math.pow(ROT_DAMPING, realDt_s)
  }
  shipAngle += shipAngVel * realDt_s

  if (keys['ArrowUp'] || keys['w'] || keys['W']) {
    ship.vx += Math.cos(shipAngle) * thrust * dt_yr
    ship.vy += Math.sin(shipAngle) * thrust * dt_yr
  }
  if (keys['ArrowDown'] || keys['s'] || keys['S']) {
    ship.vx -= Math.cos(shipAngle) * thrust * dt_yr * 0.4
    ship.vy -= Math.sin(shipAngle) * thrust * dt_yr * 0.4
  }
}

// =============================================================================
// PATH PREDICTION (ghost simulation — no side effects on real state)
// =============================================================================

function computePrediction(realDt_yr) {
  if (!ship) return []

  // Snapshot state into plain structs
  const ghosts = bodies.map(b => ({
    id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
    mass: b.mass, isFixed: b.isFixed,
  }))

  // Find ship ghost index
  const shipIdx = ghosts.findIndex(g => g.id === 'ship')
  if (shipIdx < 0) return []

  const predDt = Math.min(PRED_DT_MULT * realDt_yr, 0.01)  // cap at 0.01 yr / ghost step
  const path   = []

  for (let step = 0; step < PRED_STEPS; step++) {
    gravityStep(ghosts, predDt)
    if (step % 6 === 0) path.push({ x: ghosts[shipIdx].x, y: ghosts[shipIdx].y })
  }

  return path
}

// =============================================================================
// SCENE SETUP
// =============================================================================

function buildScene(w, h) {
  bodies = []
  shipAngle    = -Math.PI / 2
  shipAngVel   = 0
  shipPredPath = []

  for (const bd of SOLAR_BODIES) {
    const r = bd.orbR
    let x = 0, y = 0, vx = 0, vy = 0

    if (!bd.isFixed && r > 0) {
      const a = bd.angle
      const v = Math.sqrt(G_SIM * 1.0 / r)
      x  =  Math.cos(a) * r
      y  =  Math.sin(a) * r
      vx = -Math.sin(a) * v
      vy =  Math.cos(a) * v
    }

    bodies.push({
      id:      bd.id,
      name:    bd.name,
      x, y, vx, vy,
      mass:    bd.mass,
      drawR:   bd.drawR,
      color:   bd.color,
      isFixed: bd.isFixed,
      trail:   makeTrail(bd.isFixed ? 0 : settings.settings.visuals.trailLength),
    })
  }

  // Ship: start at 1.5 AU, circular orbit
  const shipR   = 1.5
  const shipOrb = Math.sqrt(G_SIM * 1.0 / shipR)
  ship = {
    id: 'ship', name: 'Ship',
    x: shipR, y: 0,
    vx: 0, vy: shipOrb,
    mass: SHIP_MASS,
    drawR: SHIP_LENGTH_AU / 2,
    color: '#4fc3f7',
    isFixed: false,
    trail: makeTrail(settings.settings.visuals.trailLength),
  }
  bodies.push(ship)

  // Center camera on Sun initially
  cam.panX  = w / 2
  cam.panY  = h / 2
  cam.focus = 'sun'
}

// =============================================================================
// CAMERA HELPERS
// =============================================================================

function scale() { return cam.zoom * PX_PER_AU }

function worldToScreen(wx, wy) {
  const s = scale()
  return { x: wx * s + cam.panX, y: wy * s + cam.panY }
}

function screenToWorld(sx, sy) {
  const s = scale()
  return { x: (sx - cam.panX) / s, y: (sy - cam.panY) / s }
}

function zoomAt(factor, mx, my) {
  const s0 = scale()
  const wx = (mx - cam.panX) / s0
  const wy = (my - cam.panY) / s0
  cam.zoom = Math.max(0.004, Math.min(200000, cam.zoom * factor))
  const s1 = scale()
  cam.panX = mx - wx * s1
  cam.panY = my - wy * s1
}

function applyFocusMode(w, h) {
  if (cam.focus === 'sun') {
    cam.panX = w / 2
    cam.panY = h / 2
  } else if (cam.focus === 'ship' && ship) {
    const s = scale()
    cam.panX = w / 2 - ship.x * s
    cam.panY = h / 2 - ship.y * s
  }
}

// =============================================================================
// GRID DRAWING
// =============================================================================

function drawGrid(ctx, w, h) {
  const s   = scale()
  const x0  = -cam.panX / s
  const x1  = (w - cam.panX) / s
  const y0  = -cam.panY / s
  const y1  = (h - cam.panY) / s
  const rng = x1 - x0

  // Pick a round step that gives ~6 lines
  const rawStep = rng / 6
  const mag     = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm    = rawStep / mag
  const step    = norm < 2 ? mag : norm < 5 ? 2 * mag : 5 * mag

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.strokeStyle = 'rgba(255,255,255,0.055)'
  ctx.lineWidth   = 1 / s

  const startX = Math.floor(x0 / step) * step
  const startY = Math.floor(y0 / step) * step

  ctx.beginPath()
  for (let x = startX; x <= x1 + step; x += step) {
    ctx.moveTo(x, y0); ctx.lineTo(x, y1)
  }
  for (let y = startY; y <= y1 + step; y += step) {
    ctx.moveTo(x0, y); ctx.lineTo(x1, y)
  }
  ctx.stroke()

  // Axes — slightly brighter
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.moveTo(0, y0); ctx.lineTo(0, y1)
  ctx.moveTo(x0, 0); ctx.lineTo(x1, 0)
  ctx.stroke()

  ctx.restore()

  // Grid scale label in screen-space corner
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const labelAU   = step.toFixed(step < 0.1 ? 4 : step < 1 ? 2 : step < 10 ? 1 : 0) + ' AU'
  const labelKM   = step > 0.001
    ? '  (' + (step * AU_KM).toExponential(2) + ' km)'
    : ''
  ctx.font         = '11px monospace'
  ctx.fillStyle    = 'rgba(255,255,255,0.2)'
  ctx.textAlign    = 'left'
  ctx.fillText('grid: ' + labelAU + labelKM, 12, h - 12)
  ctx.restore()
}

// =============================================================================
// ORBIT CIRCLES
// =============================================================================

function drawOrbits(ctx) {
  const s = scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'
  ctx.lineWidth   = 0.5 / s

  for (const bd of SOLAR_BODIES) {
    if (bd.orbR === 0) continue
    ctx.beginPath()
    ctx.arc(0, 0, bd.orbR, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

// =============================================================================
// PREDICTION PATH
// =============================================================================

function drawPredictionPath(ctx) {
  if (shipPredPath.length < 2) return
  const s = scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.4)'
  ctx.lineWidth   = 1.5 / s
  ctx.setLineDash([3 / s, 5 / s])

  ctx.beginPath()
  ctx.moveTo(shipPredPath[0].x, shipPredPath[0].y)
  for (let i = 1; i < shipPredPath.length; i++) {
    ctx.lineTo(shipPredPath[i].x, shipPredPath[i].y)
  }
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

// =============================================================================
// BODY RENDERING
// =============================================================================

function drawBody(ctx, body, w, h) {
  const s        = scale()
  const screenR  = body.drawR * s

  // Trail (always in world space)
  const pts = body.trail?.points?.() || []
  if (pts.length >= 2) {
    ctx.save()
    ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
    ctx.strokeStyle = body.id === 'ship'
      ? 'rgba(79,195,247,0.35)'
      : body.color + '55'
    ctx.lineWidth = Math.max(0.8 / s, 0.00001)
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
    ctx.restore()
  }

  if (body.id === 'ship') {
    drawShip(ctx, body, screenR, w, h)
    return
  }

  // Check if body is visible at current zoom
  if (screenR >= MIN_PLANET_PX) {
    // Draw body in world space
    ctx.save()
    ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)

    if (body.id === 'sun') {
      // Glow layers
      const g = ctx.createRadialGradient(body.x, body.y, 0, body.x, body.y, body.drawR * 4)
      g.addColorStop(0, '#FFFAAA')
      g.addColorStop(0.25, '#FFD700')
      g.addColorStop(0.6, 'rgba(255,160,0,0.3)')
      g.addColorStop(1, 'rgba(255,100,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(body.x, body.y, body.drawR * 4, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(body.x, body.y, body.drawR, 0, Math.PI * 2)
    ctx.fillStyle = body.color
    ctx.fill()

    // Saturn rings
    if (body.id === 'saturn') {
      ctx.save()
      ctx.translate(body.x, body.y)
      ctx.scale(1, 0.3)
      ctx.strokeStyle = 'rgba(232,213,160,0.45)'
      ctx.lineWidth   = body.drawR * 0.6 / 0.3
      ctx.beginPath()
      ctx.arc(0, 0, body.drawR * 2.2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  } else {
    // Icon in screen space
    const sp = worldToScreen(body.x, body.y)
    // Clip to screen bounds
    if (sp.x < -20 || sp.x > w + 20 || sp.y < -20 || sp.y > h + 20) return

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Glow for sun even when tiny
    if (body.id === 'sun') {
      const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 18)
      g.addColorStop(0, 'rgba(255,215,0,0.9)')
      g.addColorStop(0.5, 'rgba(255,160,0,0.3)')
      g.addColorStop(1, 'rgba(255,100,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, 18, 0, Math.PI * 2)
      ctx.fill()
    }

    const r = body.id === 'sun' ? 5 : 3
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2)
    ctx.fillStyle = body.color
    ctx.fill()

    // Label
    ctx.font      = '10px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.textAlign = 'center'
    ctx.fillText(body.name, sp.x, sp.y + r + 11)

    ctx.restore()
  }
}

function drawShip(ctx, body, screenLen, w, h) {
  const s  = scale()
  const sp = worldToScreen(body.x, body.y)

  if (sp.x < -60 || sp.x > w + 60 || sp.y < -60 || sp.y > h + 60) return

  if (screenLen >= MIN_SHIP_PX) {
    // Draw in world space at real scale
    ctx.save()
    ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
    ctx.translate(body.x, body.y)
    ctx.rotate(shipAngle)

    const L  = SHIP_LENGTH_AU
    const W  = SHIP_WIDTH_AU
    const hw = W / 2

    // Hull
    ctx.fillStyle   = '#2a3f5f'
    ctx.strokeStyle = '#4fc3f7'
    ctx.lineWidth   = W * 0.3
    ctx.beginPath()
    // Main fuselage
    ctx.rect(-L * 0.6, -hw, L * 0.8, W)
    ctx.fill()
    ctx.stroke()

    // Nose cone
    ctx.fillStyle = '#4fc3f7'
    ctx.beginPath()
    ctx.moveTo(L * 0.2, 0)
    ctx.lineTo(-L * 0.1, -hw * 1.2)
    ctx.lineTo(-L * 0.1,  hw * 1.2)
    ctx.closePath()
    ctx.fill()

    // Engine glow (rear)
    if (keys['ArrowUp']) {
      const eg = ctx.createRadialGradient(-L * 0.6, 0, 0, -L * 0.6, 0, W * 3)
      eg.addColorStop(0, 'rgba(255,140,0,0.9)')
      eg.addColorStop(0.5, 'rgba(255,60,0,0.4)')
      eg.addColorStop(1, 'rgba(255,0,0,0)')
      ctx.fillStyle = eg
      ctx.beginPath()
      ctx.arc(-L * 0.6, 0, W * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    if (keys['ArrowDown']) {
      const rg = ctx.createRadialGradient(L * 0.2, 0, 0, L * 0.2, 0, W * 2)
      rg.addColorStop(0, 'rgba(0,150,255,0.7)')
      rg.addColorStop(1, 'rgba(0,100,255,0)')
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.arc(L * 0.2, 0, W * 2, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  } else {
    // Icon in screen space
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.translate(sp.x, sp.y)
    ctx.rotate(shipAngle)

    const sz = 12  // icon half-length in px

    // Triangle pointing in ship heading (+x in local space)
    ctx.fillStyle   = '#4fc3f7'
    ctx.strokeStyle = 'rgba(79,195,247,0.5)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(sz,   0)
    ctx.lineTo(-sz,  sz * 0.5)
    ctx.lineTo(-sz * 0.6, 0)
    ctx.lineTo(-sz, -sz * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Engine glow
    if (keys['ArrowUp']) {
      ctx.fillStyle = 'rgba(255,100,0,0.6)'
      ctx.beginPath()
      ctx.moveTo(-sz, -sz * 0.4)
      ctx.lineTo(-sz * 2.5, 0)
      ctx.lineTo(-sz, sz * 0.4)
      ctx.closePath()
      ctx.fill()
    }

    ctx.restore()

    // "Ship" label
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.font      = '10px monospace'
    ctx.fillStyle = 'rgba(79,195,247,0.6)'
    ctx.textAlign = 'center'
    ctx.fillText('Ship', sp.x, sp.y + 20)
    ctx.restore()
  }
}

// =============================================================================
// HUD OVERLAY
// =============================================================================

function drawHUD(ctx, w, h) {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Focus buttons
  const buttons = [
    { label: 'Focus: Sun',  focus: 'sun',  zoom: 0.06 },
    { label: 'Focus: Ship', focus: 'ship', zoom: 800  },
  ]
  const bw = 100, bh = 22, gap = 6, startX = 12, startY = 12

  buttons.forEach((btn, i) => {
    const bx = startX + i * (bw + gap)
    const active = cam.focus === btn.focus
    ctx.fillStyle   = active ? 'rgba(79,195,247,0.25)' : 'rgba(0,0,0,0.5)'
    ctx.strokeStyle = active ? '#4fc3f7' : 'rgba(255,255,255,0.2)'
    ctx.lineWidth   = 1
    roundRect(ctx, bx, startY, bw, bh, 3)
    ctx.fill()
    ctx.stroke()

    ctx.font      = '11px monospace'
    ctx.fillStyle = active ? '#4fc3f7' : 'rgba(255,255,255,0.5)'
    ctx.textAlign = 'center'
    ctx.fillText(btn.label, bx + bw / 2, startY + bh / 2 + 4)
  })

  // Speed / distance info (top-right)
  if (ship) {
    const speed_au_yr  = Math.sqrt(ship.vx ** 2 + ship.vy ** 2)
    const speed_km_s   = speed_au_yr * AU_KM / (365.25 * 24 * 3600)
    const sun = bodies.find(b => b.id === 'sun')
    const dist_au = sun
      ? Math.sqrt((ship.x - sun.x) ** 2 + (ship.y - sun.y) ** 2)
      : 0

    ctx.font      = '11px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.textAlign = 'right'
    ctx.fillText(`Speed: ${speed_km_s.toFixed(2)} km/s`, w - 12, h - 26)
    ctx.fillText(`Dist from Sun: ${dist_au.toFixed(4)} AU`, w - 12, h - 12)
  }

  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// =============================================================================
// MAIN RENDER
// =============================================================================

function render(ctx, w, h) {
  ctx.clearRect(0, 0, w, h)

  applyFocusMode(w, h)

  drawGrid(ctx, w, h)
  drawOrbits(ctx)
  drawPredictionPath(ctx)

  for (const body of bodies) {
    drawBody(ctx, body, w, h)
  }

  drawHUD(ctx, w, h)
}

// =============================================================================
// MAIN LOOP
// =============================================================================

let rafId    = null
let lastTime = null
let _w = 0, _h = 0
let simYears = 0

function initCanvas(canvas) {
  if (!canvas) return
  let ctx = null

  // --- Keyboard ---
  function onKeyDown(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault()
    }
    keys[e.key] = true
  }
  function onKeyUp(e) { keys[e.key] = false }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup',   onKeyUp)

  // --- Mouse: pan and zoom ---
  function onMouseDown(e) {
    if (e.button !== 0) return
    cam._dragActive = true
    cam._dragLastX  = e.clientX
    cam._dragLastY  = e.clientY
  }
  function onMouseMove(e) {
    if (!cam._dragActive) return
    const dx = e.clientX - cam._dragLastX
    const dy = e.clientY - cam._dragLastY
    if (Math.abs(dx) + Math.abs(dy) > 2) cam.focus = 'free'
    cam.panX       += dx
    cam.panY       += dy
    cam._dragLastX  = e.clientX
    cam._dragLastY  = e.clientY
  }
  function onMouseUp() { cam._dragActive = false }
  function onWheel(e) {
    e.preventDefault()
    const factor = Math.pow(1.12, -e.deltaY / 100)
    zoomAt(factor, e.offsetX, e.offsetY)
  }

  // --- HUD button click (focus buttons) ---
  function onCanvasClick(e) {
    const rect    = canvas.getBoundingClientRect()
    const cx      = (e.clientX - rect.left)
    const cy      = (e.clientY - rect.top)
    const bw = 100, bh = 22, gap = 6, startX = 12, startY = 12
    const focusModes = ['sun', 'ship']
    focusModes.forEach((fm, i) => {
      const bx = startX + i * (bw + gap)
      if (cx >= bx && cx <= bx + bw && cy >= startY && cy <= startY + bh) {
        cam.focus = fm
        if (fm === 'sun')  cam.zoom = 0.06
        if (fm === 'ship') cam.zoom = 800
      }
    })
  }

  canvas.addEventListener('mousedown',  onMouseDown)
  canvas.addEventListener('mousemove',  onMouseMove)
  canvas.addEventListener('mouseup',    onMouseUp)
  canvas.addEventListener('mouseleave', onMouseUp)
  canvas.addEventListener('wheel',      onWheel, { passive: false })
  canvas.addEventListener('click',      onCanvasClick)

  // --- Resize ---
  function resizeCanvas() {
    const rect  = canvas.parentElement.getBoundingClientRect()
    _w = rect.width
    _h = rect.height - 36
    canvas.width  = _w
    canvas.height = _h
    canvas.style.width  = _w + 'px'
    canvas.style.height = _h + 'px'
    ctx = canvas.getContext('2d')
    buildScene(_w, _h)
  }

  const observer = new ResizeObserver(resizeCanvas)
  observer.observe(canvas.parentElement)
  resizeCanvas()

  // --- Animation loop ---
  function loop(ts) {
    if (lastTime !== null) {
      const realDt    = Math.min((ts - lastTime) / 1000, MAX_DT)  // seconds
      const simScale  = timeScale.value
      const dt_yr     = realDt * simScale / (365.25 * 24 * 3600)  // yr per frame

      if (isPlaying.value) {
        simStep(dt_yr, realDt)
        simYears += dt_yr

        // Record trails
        for (const body of bodies) {
          if (body.trail && body.trail.push) body.trail.push(body.x, body.y)
        }

        bodyCount.value  = bodies.length
        const yr  = Math.floor(simYears)
        const day = (simYears - yr) * 365.25
        elapsedLabel.value = `Yr ${yr.toLocaleString()} Day ${day.toFixed(1)}`

        // Prediction
        predCountdown--
        if (predCountdown <= 0) {
          predCountdown = PRED_INTERVAL
          shipPredPath  = computePrediction(dt_yr)
        }
      }
    }
    lastTime = ts
    if (ctx) render(ctx, _w, _h)
    rafId = requestAnimationFrame(loop)
  }

  rafId = requestAnimationFrame(loop)

  onUnmounted(() => {
    cancelAnimationFrame(rafId)
    observer.disconnect()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup',   onKeyUp)
    canvas.removeEventListener('mousedown',  onMouseDown)
    canvas.removeEventListener('mousemove',  onMouseMove)
    canvas.removeEventListener('mouseup',    onMouseUp)
    canvas.removeEventListener('mouseleave', onMouseUp)
    canvas.removeEventListener('wheel',      onWheel)
    canvas.removeEventListener('click',      onCanvasClick)
  })
}

// =============================================================================
// CONTROLS
// =============================================================================

function togglePlay() { isPlaying.value = !isPlaying.value }
function setTimeScale(s) { timeScale.value = s }
function reset() {
  simYears       = 0
  shipPredPath   = []
  predCountdown  = 0
  lastTime       = null
  isPlaying.value    = true
  timeScale.value    = settings.settings.sim.baseSpeed
  buildScene(_w, _h)
}

watch(() => settings.settings.sim.baseSpeed, (v) => { timeScale.value = v })
watch(() => settings.settings.visuals.trailLength, (v) => {
  for (const b of bodies) {
    if (b.trail) b.trail = makeTrail(v)
  }
})
</script>
