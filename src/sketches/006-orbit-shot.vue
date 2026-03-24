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
          <SettingsRow label="Base speed"    v-model="settings.settings.sim.baseSpeed"       :min="0.1"  :max="1000" :step="0.1"   :decimals="1" tooltip="Simulation speed multiplier." />
        </SettingsSection>
        <SettingsSection title="Spaceship">
          <SettingsRow label="Thrust"        v-model="settings.settings.ship.thrustAccel"    :min="1"    :max="200"  :step="1"     :decimals="0"  tooltip="Thrust acceleration in AU/yr². Default 20." />
          <SettingsRow label="Rotate speed"  v-model="settings.settings.ship.rotateSpeed"    :min="0.2"  :max="6"    :step="0.1"   :decimals="1"  tooltip="Rotation speed in rad/s (real-time)." />
        </SettingsSection>
        <SettingsSection title="Orbit Shot">
          <SettingsRow label="Ring radius (AU)"      v-model="settings.settings.orbit.ringRadiusMult"      :min="0.05" :max="2"     :step="0.05"  :decimals="2"  tooltip="Capture ring radius in AU. Same for all planets." />
          <SettingsRow label="Velocity threshold"    v-model="settings.settings.orbit.velMatchThreshold"   :min="0.05" :max="1.0"   :step="0.05"  :decimals="2"  tooltip="Max relative speed fraction to auto-dock. Lower = harder to dock." />
          <SettingsRow label="Shot power"            v-model="settings.settings.orbit.shotPower"           :min="100"  :max="5000"  :step="100"   :decimals="0"  tooltip="Impulse power for planet shots. Higher = more kick." />
          <SettingsRow label="Max drag (px)"         v-model="settings.settings.orbit.maxDrag"             :min="50"   :max="400"   :step="10"    :decimals="0"  tooltip="Maximum drag distance for shot aiming." />
          <SettingsRow label="Recoil"                v-model="settings.settings.orbit.recoilMult"          :min="0"    :max="1"     :step="0.01"  :decimals="2"  tooltip="Fraction of planet impulse applied back to ship as recoil." />
          <SettingsRow label="Planet grav boost"    v-model="settings.settings.orbit.planetGravBoost"     :min="1"    :max="5000"  :step="50"    :decimals="0"  tooltip="Gravity multiplier for planet→ship attraction only. Sun is unaffected." />
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

const PROTOTYPE_ID = '006'

// Unit system: AU (astronomical unit), Solar masses, Julian years
// G in these units = 4π² (from Kepler's 3rd law: T²=a³ for M_sun)
const G_SIM     = 4 * Math.PI * Math.PI  // ~39.478 AU³ / (M☉ · yr²)
const PX_PER_AU = 100                     // pixels per AU at zoom = 1
const AU_KM     = 1.496e8                 // km per AU (for display labels)
const SOFTENING = 1e-5                    // AU² — prevents singularities
const MAX_DT    = 0.05                    // real-time seconds cap per frame

// Spaceship physical dimensions
const SHIP_LENGTH_AU = 1000 / AU_KM   // 1000 km in AU ≈ 6.684e-6 AU
const SHIP_WIDTH_AU  = 26  / AU_KM   // 26 km in AU  ≈ 1.738e-7 AU
const SHIP_MASS      = 5.03e-18       // M☉ — 10,000 Gt

// Minimum pixel size below which we switch to icon rendering
const MIN_PLANET_PX = 3   // px
const MIN_SHIP_PX   = 30  // px (length in screen pixels)

// Prediction config
const PRED_STEPS    = 600   // ghost steps per prediction run
const PRED_DT_MULT  = 6     // ghost dt = N × real frame dt
const PRED_INTERVAL = 20    // recalculate every N rendered frames

// Planet-shot prediction
const SHOT_PRED_STEPS = 300

// Solar system data — all in simulation units (AU, M☉)
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
  ship:    { thrustAccel: 20, rotateSpeed: 3 },
  orbit:   {
    ringRadiusMult:     0.3,
    velMatchThreshold:  0.35,
    shotPower:          800,
    maxDrag:            250,
    recoilMult:         0.05,
    planetGravBoost:    500,
  },
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

const isPlaying    = ref(true)
const timeScale    = ref(settings.settings.sim.baseSpeed)
const bodyCount    = ref(0)
const elapsedLabel = ref('')

// =============================================================================
// SIMULATION STATE
// =============================================================================

let bodies = []
let ship   = null   // reference into bodies[]

// Camera
const cam = {
  zoom:         0.33,
  panX:         0,
  panY:         0,
  focus:        'sun',  // 'sun' | 'ship' | 'orbit' | 'free'
  _dragActive:  false,
  _dragLastX:   0,
  _dragLastY:   0,
}

// Camera zoom animation
let camTargetZoom = 0.33

// Spaceship angular state
let shipAngle  = 0   // radians
let shipAngVel = 0   // rad/s

// Inputs
const keys = {}

// Prediction path
let shipPredPath  = []
let predCountdown = 0

// Orbit game state
// mode: 'free' | 'docked'
let orbitState = { mode: 'free', planet: null, shipOffset: null }

// Drag for aiming the shot (screen-space pixels)
let orbitDrag = null  // null | { startX, startY, curX, curY }

// Cooldown after firing — real-time seconds remaining
let dockCooldown = 0


// Shockwave particles — spawned on fireShot
// Each: { x, y, r, maxR, alpha, color }  — x/y/r in world AU
let shockwaves = []

// =============================================================================
// TRAIL CIRCULAR BUFFER
// =============================================================================

function makeTrail(cap) {
  const buf = new Array(cap)
  let head = 0, size = 0
  return {
    push(x, y) { buf[head] = { x, y }; head = (head + 1) % cap; if (size < cap) size++ },
    points() {
      const out   = []
      const start = (head - size + cap) % cap
      for (let i = 0; i < size; i++) out.push(buf[(start + i) % cap])
      return out
    },
    clear() { head = 0; size = 0 },
    get length() { return size },
  }
}

// =============================================================================
// PHYSICS
// =============================================================================

function gravityStep(bs, dt, planetBoost = 1) {
  const n  = bs.length
  const fx = new Float64Array(n)
  const fy = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx     = bs[j].x - bs[i].x
      const dy     = bs[j].y - bs[i].y
      const distSq = dx * dx + dy * dy + SOFTENING
      const dist   = Math.sqrt(distSq)
      const f      = G_SIM * bs[i].mass * bs[j].mass / distSq
      // Apply boost only on ship↔planet pairs (not ship↔sun, not planet↔planet)
      const isShipPlanetPair = (bs[i].id === 'ship' && bs[j].isPlanet) ||
                               (bs[j].id === 'ship' && bs[i].isPlanet)
      const boost  = isShipPlanetPair ? planetBoost : 1
      const ffx    = f * boost * dx / dist
      const ffy    = f * boost * dy / dist
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
  if (dockCooldown > 0) dockCooldown -= realDt_s

  const boost = settings.settings.orbit.planetGravBoost

  if (orbitState.mode === 'free') {
    applyShipInput(dt_yr, realDt_s)
    gravityStep(bodies, dt_yr, boost)
    checkOrbitCapture()
  } else if (orbitState.mode === 'docked') {
    gravityStep(bodies, dt_yr, boost)
    const planet = orbitState.planet
    if (planet) {
      // Ship orbits at 2× planet drawR, nose always pointing at planet.
      // Drag rotates the ship around the planet — drag angle in screen space
      // maps directly to the ship's orbit angle in world space.
      let orbitAngle
      if (orbitDrag) {
        const ddx = orbitDrag.curX - orbitDrag.startX
        const ddy = orbitDrag.curY - orbitDrag.startY
        const dd  = Math.sqrt(ddx * ddx + ddy * ddy)
        if (dd > 2) {
          // drag direction in screen space = orbit angle (ship is on that side of planet)
          orbitAngle = Math.atan2(ddy, ddx)
        } else {
          orbitAngle = Math.atan2(orbitState.shipOffset.dy, orbitState.shipOffset.dx)
        }
      } else {
        orbitAngle = Math.atan2(orbitState.shipOffset.dy, orbitState.shipOffset.dx)
      }

      // Preserve the natural capture distance, only update the angle
      const dockDist = Math.sqrt(orbitState.shipOffset.dx ** 2 + orbitState.shipOffset.dy ** 2)
      orbitState.shipOffset.dx = Math.cos(orbitAngle) * dockDist
      orbitState.shipOffset.dy = Math.sin(orbitAngle) * dockDist

      ship.x  = planet.x + orbitState.shipOffset.dx
      ship.y  = planet.y + orbitState.shipOffset.dy
      ship.vx = planet.vx
      ship.vy = planet.vy
      // Nose always points toward planet center
      shipAngle = Math.atan2(-orbitState.shipOffset.dy, -orbitState.shipOffset.dx)
    }
  }
}

// =============================================================================
// ORBIT CAPTURE LOGIC
// =============================================================================

function checkOrbitCapture() {
  if (!ship) return
  if (dockCooldown > 0) return
  const threshold   = settings.settings.orbit.velMatchThreshold
  const ringMult    = settings.settings.orbit.ringRadiusMult

  for (const body of bodies) {
    if (body.isFixed)          continue
    if (body.id === 'sun')     continue
    if (body.id === 'ship')    continue

    const captureRingR = ringMult  // in AU

    const dx   = ship.x - body.x
    const dy   = ship.y - body.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > captureRingR) continue

    // Ship is inside the ring — check velocity match
    const relVx      = ship.vx - body.vx
    const relVy      = ship.vy - body.vy
    const relSpeed   = Math.sqrt(relVx * relVx + relVy * relVy)
    const planetSpeed = Math.sqrt(body.vx * body.vx + body.vy * body.vy)

    if (relSpeed < planetSpeed * threshold) {
      // Dock — ship arrived naturally via gravity, lock it where it is
      const offsetDx = ship.x - body.x
      const offsetDy = ship.y - body.y
      shipAngle = Math.atan2(-offsetDy, -offsetDx)  // nose toward planet

      orbitState = {
        mode:       'docked',
        planet:     body,
        shipOffset: { dx: offsetDx, dy: offsetDy },
      }

      cam.focus = 'orbit'
      break
    }
  }
}

// =============================================================================
// UNDOCK
// =============================================================================

function undock(kick = true) {
  if (orbitState.mode !== 'docked') return

  if (kick && ship) {
    // Small random kick to break away
    const angle = Math.random() * Math.PI * 2
    ship.vx += Math.cos(angle) * 0.1
    ship.vy += Math.sin(angle) * 0.1
  }

  orbitState = { mode: 'free', planet: null, shipOffset: null }
  orbitDrag  = null
  cam.focus  = 'ship'
}

// =============================================================================
// SHOT FIRING
// =============================================================================

function fireShot() {
  if (orbitState.mode !== 'docked' || !orbitDrag) return
  const planet  = orbitState.planet
  if (!planet) return

  const { startX, startY, curX, curY } = orbitDrag
  const ddx  = curX - startX
  const ddy  = curY - startY
  const dist = Math.sqrt(ddx * ddx + ddy * ddy)
  if (dist < 2) { undock(true); return }

  const maxDrag  = settings.settings.orbit.maxDrag
  const clamped  = Math.min(dist, maxDrag)
  const nx       = ddx / dist  // drag direction unit vector
  const ny       = ddy / dist

  // dv proportional to drag fraction, shot direction is OPPOSITE to drag
  const dv = (clamped / maxDrag) * settings.settings.orbit.shotPower * 0.01

  // Apply impulse to planet (opposite to drag direction)
  planet.vx += -nx * dv
  planet.vy += -ny * dv

  // Recoil to ship (same as drag direction = opposite of planet shot)
  const recoil = dv * settings.settings.orbit.recoilMult
  if (ship) {
    ship.vx += nx * recoil
    ship.vy += ny * recoil
  }

  // Start cooldown — prevent re-docking for 5 real seconds
  dockCooldown = 5.0

  // Spawn shockwave at planet position — large slow wave
  shockwaves.push({
    x:        planet.x,
    y:        planet.y,
    r:        0,
    maxR:     planet.drawR * 300,   // ~30 AU for Earth-sized planet — solar-system scale
    alpha:    1.0,
    duration: 3.5,                  // real-time seconds to fully expand
    age:      0,
    color:    planet.color,
  })

  // Update ship offset now that planet velocity changed
  // (ship will be released from lock)
  undock(false)
}

// =============================================================================
// SPACESHIP INPUT
// =============================================================================

function applyShipInput(dt_yr, realDt_s) {
  if (!ship) return
  const thrust   = settings.settings.ship.thrustAccel  // AU/yr²
  const rotSpeed = settings.settings.ship.rotateSpeed  // rad/s (real-time)

  if (keys['ArrowLeft']  || keys['a'] || keys['A']) shipAngVel = -rotSpeed
  if (keys['ArrowRight'] || keys['d'] || keys['D']) shipAngVel =  rotSpeed
  if (!keys['ArrowLeft'] && !keys['ArrowRight'] && !keys['a'] && !keys['A'] && !keys['d'] && !keys['D']) {
    shipAngVel *= Math.pow(0.01, realDt_s)
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
// PATH PREDICTION — ship (ghost simulation, no side effects)
// =============================================================================

function computePrediction(realDt_yr) {
  if (!ship) return []
  if (orbitState.mode !== 'free') return []

  const ghosts = bodies.map(b => ({
    id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
    mass: b.mass, isFixed: b.isFixed,
  }))

  const shipIdx = ghosts.findIndex(g => g.id === 'ship')
  if (shipIdx < 0) return []

  const predDt = Math.min(PRED_DT_MULT * realDt_yr, 0.01)
  const path   = []

  const boost = settings.settings.orbit.planetGravBoost
  for (let step = 0; step < PRED_STEPS; step++) {
    gravityStep(ghosts, predDt, boost)
    if (step % 6 === 0) path.push({ x: ghosts[shipIdx].x, y: ghosts[shipIdx].y })
  }

  return path
}

// =============================================================================
// PLANET POST-SHOT PREDICTION
// =============================================================================

function computeShotPrediction(planet, nx, ny, dv) {
  if (!planet) return []

  const ghosts = bodies.map(b => ({
    id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
    mass: b.mass, isFixed: b.isFixed,
  }))

  const pidx = ghosts.findIndex(g => g.id === planet.id)
  if (pidx < 0) return []

  // Apply hypothetical impulse
  ghosts[pidx].vx += -nx * dv
  ghosts[pidx].vy += -ny * dv

  const predDt = 0.005
  const path   = []

  for (let step = 0; step < SHOT_PRED_STEPS; step++) {
    gravityStep(ghosts, predDt)
    if (step % 5 === 0) path.push({ x: ghosts[pidx].x, y: ghosts[pidx].y })
  }

  return path
}

// =============================================================================
// SCENE SETUP
// =============================================================================

function buildScene(w, h) {
  bodies        = []
  shipAngle     = -Math.PI / 2
  shipAngVel    = 0
  shipPredPath  = []
  orbitState    = { mode: 'free', planet: null, shipOffset: null }
  orbitDrag     = null
  dockCooldown  = 0
  camTargetZoom = cam.zoom

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
      id:       bd.id,
      name:     bd.name,
      x, y, vx, vy,
      mass:     bd.mass,
      drawR:    bd.drawR,
      color:    bd.color,
      isFixed:  bd.isFixed,
      isPlanet: !bd.isFixed && bd.id !== 'ship',
      trail:    makeTrail(bd.isFixed ? 0 : settings.settings.visuals.trailLength),
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

  cam.panX      = w / 2
  cam.panY      = h / 2
  cam.focus     = 'sun'
  cam.zoom      = 0.33
  camTargetZoom = 0.33
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
  const wx  = (mx - cam.panX) / s0
  const wy  = (my - cam.panY) / s0
  cam.zoom      = Math.max(0.004, Math.min(200000, cam.zoom * factor))
  camTargetZoom = cam.zoom
  const s1  = scale()
  cam.panX  = mx - wx * s1
  cam.panY  = my - wy * s1
}

function applyFocusMode(w, h) {
  // Animate zoom toward target
  cam.zoom += (camTargetZoom - cam.zoom) * 0.08

  if (cam.focus === 'sun') {
    cam.panX = w / 2
    cam.panY = h / 2
  } else if (cam.focus === 'ship' && ship) {
    const s  = scale()
    cam.panX = w / 2 - ship.x * s
    cam.panY = h / 2 - ship.y * s
  } else if (cam.focus === 'orbit' && orbitState.planet) {
    const s  = scale()
    const p  = orbitState.planet
    cam.panX = w / 2 - p.x * s
    cam.panY = h / 2 - p.y * s
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

  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.moveTo(0, y0); ctx.lineTo(0, y1)
  ctx.moveTo(x0, 0); ctx.lineTo(x1, 0)
  ctx.stroke()

  ctx.restore()

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const labelAU = step.toFixed(step < 0.1 ? 4 : step < 1 ? 2 : step < 10 ? 1 : 0) + ' AU'
  const labelKM = step > 0.001
    ? '  (' + (step * AU_KM).toExponential(2) + ' km)'
    : ''
  ctx.font      = '11px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.textAlign = 'left'
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
// CAPTURE RINGS
// =============================================================================

function drawCaptureRings(ctx) {
  if (orbitState.mode === 'docked') return  // no rings when already docked
  if (!ship) return

  const s           = scale()
  const ringMult    = settings.settings.orbit.ringRadiusMult
  const threshold   = settings.settings.orbit.velMatchThreshold

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)

  for (const body of bodies) {
    if (body.isFixed)       continue
    if (body.id === 'sun')  continue
    if (body.id === 'ship') continue

    const captureRingR = ringMult

    // Distance from ship
    const dx      = ship.x - body.x
    const dy      = ship.y - body.y
    const dist    = Math.sqrt(dx * dx + dy * dy)
    const nearby  = dist < captureRingR * 2

    // Velocity match percentage (for color)
    let matchPct = 0
    if (nearby) {
      const relVx      = ship.vx - body.vx
      const relVy      = ship.vy - body.vy
      const relSpeed   = Math.sqrt(relVx * relVx + relVy * relVy)
      const planetSpeed = Math.sqrt(body.vx * body.vx + body.vy * body.vy)
      matchPct = Math.max(0, Math.min(1, 1 - relSpeed / (planetSpeed * threshold)))
    }

    const alpha = nearby
      ? 0.65 + matchPct * 0.35
      : 0.45

    // Parse color for rgba
    const [r, g, b] = hexToRgb(body.color)

    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.lineWidth   = (nearby ? 2.0 : 1.5) / s
    ctx.setLineDash([4 / s, 3 / s])
    ctx.beginPath()
    ctx.arc(body.x, body.y, captureRingR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Docked glow ring
    if (dist < captureRingR && matchPct > 0) {
      // Show fill arc for match progress
      ctx.strokeStyle = `rgba(${r},${g},${b},${0.1 + matchPct * 0.3})`
      ctx.lineWidth   = 4 / s
      ctx.beginPath()
      ctx.arc(body.x, body.y, captureRingR * 0.92, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * matchPct)
      ctx.stroke()
    }
  }

  ctx.restore()
}

// =============================================================================
// DOCKED GLOW RING
// =============================================================================

function drawDockedRing(ctx) {
  if (orbitState.mode !== 'docked' || !orbitState.planet) return
  const planet       = orbitState.planet
  const ringMult     = settings.settings.orbit.ringRadiusMult
  const captureRingR = ringMult
  const s            = scale()
  const [r, g, b]    = hexToRgb(planet.color)

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)

  // Pulsing glow ring — use sin of a timer
  const pulse = 0.4 + 0.25 * Math.sin(Date.now() / 400)

  ctx.strokeStyle = `rgba(${r},${g},${b},${pulse})`
  ctx.lineWidth   = 2 / s
  ctx.shadowBlur  = 8 / s
  ctx.shadowColor = planet.color
  ctx.beginPath()
  ctx.arc(planet.x, planet.y, captureRingR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.restore()
}

// =============================================================================
// ORBIT CUE VISUALIZATION
// =============================================================================

function drawOrbitCue(ctx) {
  if (orbitState.mode !== 'docked' || !orbitDrag) return
  const planet = orbitState.planet
  if (!planet) return

  const { startX, startY, curX, curY } = orbitDrag
  const ddx  = curX - startX
  const ddy  = curY - startY
  const dist = Math.sqrt(ddx * ddx + ddy * ddy)
  if (dist < 2) return

  const maxDrag = settings.settings.orbit.maxDrag
  const clamped = Math.min(dist, maxDrag)
  const nx      = ddx / dist
  const ny      = ddy / dist
  const power   = clamped / maxDrag  // 0..1

  const sp = worldToScreen(planet.x, planet.y)
  const s  = scale()
  const pxR = planet.drawR * s  // planet radius in pixels

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Cue stick: extends from planet in drag direction (away from shot)
  const cueStart = {
    x: sp.x + nx * (pxR + 4),
    y: sp.y + ny * (pxR + 4),
  }
  const cueEnd = {
    x: sp.x + nx * (clamped + pxR + 30),
    y: sp.y + ny * (clamped + pxR + 30),
  }

  ctx.setLineDash([6, 4])
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth   = 1.5
  ctx.beginPath()
  ctx.moveTo(cueStart.x, cueStart.y)
  ctx.lineTo(cueEnd.x, cueEnd.y)
  ctx.stroke()
  ctx.setLineDash([])

  // Shot direction arrow (opposite to drag)
  const shotLen = clamped * 0.8
  const arrowTip = {
    x: sp.x - nx * (shotLen + pxR),
    y: sp.y - ny * (shotLen + pxR),
  }
  const arrowBase = {
    x: sp.x - nx * pxR,
    y: sp.y - ny * pxR,
  }
  const perp = { x: -ny, y: nx }

  ctx.strokeStyle = 'rgba(79,195,247,0.75)'
  ctx.fillStyle   = 'rgba(79,195,247,0.75)'
  ctx.lineWidth   = 2

  // Arrow shaft
  ctx.beginPath()
  ctx.moveTo(arrowBase.x, arrowBase.y)
  ctx.lineTo(arrowTip.x, arrowTip.y)
  ctx.stroke()

  // Arrow head
  const hw = 6
  ctx.beginPath()
  ctx.moveTo(arrowTip.x, arrowTip.y)
  ctx.lineTo(arrowTip.x + nx * hw * 2 + perp.x * hw, arrowTip.y + ny * hw * 2 + perp.y * hw)
  ctx.lineTo(arrowTip.x + nx * hw * 2 - perp.x * hw, arrowTip.y + ny * hw * 2 - perp.y * hw)
  ctx.closePath()
  ctx.fill()

  // Power ring around planet
  ctx.strokeStyle = `rgba(79,195,247,${0.3 + power * 0.5})`
  ctx.lineWidth   = 3
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, pxR + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * power)
  ctx.stroke()

  // Power percentage label
  ctx.font      = '12px monospace'
  ctx.fillStyle = 'rgba(79,195,247,0.9)'
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.round(power * 100)}%`, sp.x, sp.y + pxR + 22)

  ctx.restore()

  // Planet post-shot prediction path
  const dv       = (clamped / maxDrag) * settings.settings.orbit.shotPower * 0.01
  const predPath = computeShotPrediction(planet, nx, ny, dv)
  if (predPath.length >= 2) {
    const [r, g, b] = hexToRgb(planet.color)
    ctx.save()
    ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
    ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`
    ctx.lineWidth   = 1.5 / s
    ctx.setLineDash([3 / s, 5 / s])
    ctx.beginPath()
    ctx.moveTo(predPath[0].x, predPath[0].y)
    for (let i = 1; i < predPath.length; i++) {
      ctx.lineTo(predPath[i].x, predPath[i].y)
    }
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
}

// =============================================================================
// SHIP PREDICTION PATH
// =============================================================================

function drawPredictionPath(ctx) {
  if (shipPredPath.length < 2) return
  const s = scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.strokeStyle = 'rgba(79,195,247,0.4)'
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
// COLOR HELPERS
// =============================================================================

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lighten(hex, t) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r + (255-r)*t)},${Math.round(g + (255-g)*t)},${Math.round(b + (255-b)*t)})`
}
function darken(hex, t) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r*(1-t))},${Math.round(g*(1-t))},${Math.round(b*(1-t))})`
}

// =============================================================================
// BODY RENDERING
// =============================================================================

function drawBody(ctx, body, w, h) {
  const s       = scale()
  const screenR = body.drawR * s

  // Trail
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

  const sp = worldToScreen(body.x, body.y)
  if (sp.x < -60 || sp.x > w + 60 || sp.y < -60 || sp.y > h + 60) return

  if (screenR >= MIN_PLANET_PX) {
    ctx.save()
    ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)

    if (body.id === 'sun') {
      const g = ctx.createRadialGradient(body.x, body.y, body.drawR * 0.8, body.x, body.y, body.drawR * 5)
      g.addColorStop(0,   'rgba(255,220,80,0.5)')
      g.addColorStop(0.4, 'rgba(255,140,0,0.15)')
      g.addColorStop(1,   'rgba(255,80,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(body.x, body.y, body.drawR * 5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Sphere shading
    const ox = body.x - body.drawR * 0.3
    const oy = body.y - body.drawR * 0.3
    const sg = ctx.createRadialGradient(ox, oy, 0, body.x, body.y, body.drawR)
    sg.addColorStop(0,   lighten(body.color, 0.5))
    sg.addColorStop(0.5, body.color)
    sg.addColorStop(1,   darken(body.color, 0.55))
    ctx.beginPath()
    ctx.arc(body.x, body.y, body.drawR, 0, Math.PI * 2)
    ctx.fillStyle = sg
    ctx.fill()

    // Saturn rings
    if (body.id === 'saturn') {
      ctx.save()
      ctx.translate(body.x, body.y)
      ctx.scale(1, 0.28)
      ctx.strokeStyle = 'rgba(232,213,160,0.5)'
      ctx.lineWidth   = body.drawR * 0.55 / 0.28
      ctx.beginPath()
      ctx.arc(0, 0, body.drawR * 2.3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  } else {
    // Icon mode
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    if (body.id === 'sun') {
      const g = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, 22)
      g.addColorStop(0,   'rgba(255,240,100,1)')
      g.addColorStop(0.3, 'rgba(255,180,0,0.5)')
      g.addColorStop(1,   'rgba(255,80,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, 22, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#FFE566'
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = body.color
      ctx.fill()
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2)
      ctx.strokeStyle = body.color + '66'
      ctx.lineWidth   = 1
      ctx.stroke()
    }

    ctx.font      = '10px monospace'
    ctx.fillStyle = body.color + 'aa'
    ctx.textAlign = 'center'
    ctx.fillText(body.name, sp.x, sp.y + 18)

    ctx.restore()
  }
}

function drawShip(ctx, body, screenLen, w, h) {
  const s  = scale()
  const sp = worldToScreen(body.x, body.y)

  if (sp.x < -60 || sp.x > w + 60 || sp.y < -60 || sp.y > h + 60) return

  if (screenLen >= MIN_SHIP_PX) {
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

    // Engine glow (thrust)
    if (keys['ArrowUp'] && orbitState.mode === 'free') {
      const eg = ctx.createRadialGradient(-L * 0.6, 0, 0, -L * 0.6, 0, W * 3)
      eg.addColorStop(0,   'rgba(255,140,0,0.9)')
      eg.addColorStop(0.5, 'rgba(255,60,0,0.4)')
      eg.addColorStop(1,   'rgba(255,0,0,0)')
      ctx.fillStyle = eg
      ctx.beginPath()
      ctx.arc(-L * 0.6, 0, W * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    if (keys['ArrowDown'] && orbitState.mode === 'free') {
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

    const sz = 12
    const now = Date.now()

    // --- Forward main engine plume ---
    if ((keys['ArrowUp'] || keys['w'] || keys['W']) && orbitState.mode === 'free') {
      // Animated flicker: vary length with noise
      const flicker = 0.7 + 0.3 * Math.sin(now / 40) + 0.15 * Math.sin(now / 17)
      const plumeLen = sz * 2.2 * flicker
      const grad = ctx.createLinearGradient(-sz, 0, -sz - plumeLen, 0)
      grad.addColorStop(0,   'rgba(255,200,80,0.95)')
      grad.addColorStop(0.3, 'rgba(255,100,20,0.7)')
      grad.addColorStop(1,   'rgba(255,40,0,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(-sz, -sz * 0.35)
      ctx.lineTo(-sz - plumeLen, 0)
      ctx.lineTo(-sz,  sz * 0.35)
      ctx.closePath()
      ctx.fill()
    }

    // --- Retro brake plume (nose) ---
    if ((keys['ArrowDown'] || keys['s'] || keys['S']) && orbitState.mode === 'free') {
      const flicker = 0.7 + 0.3 * Math.sin(now / 35)
      const plumeLen = sz * 1.4 * flicker
      const grad = ctx.createLinearGradient(sz, 0, sz + plumeLen, 0)
      grad.addColorStop(0,   'rgba(80,160,255,0.9)')
      grad.addColorStop(1,   'rgba(0,80,255,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(sz, -sz * 0.25)
      ctx.lineTo(sz + plumeLen, 0)
      ctx.lineTo(sz,  sz * 0.25)
      ctx.closePath()
      ctx.fill()
    }

    // --- RCS rotation thrusters ---
    const rotL = keys['ArrowLeft']  || keys['a'] || keys['A']
    const rotR = keys['ArrowRight'] || keys['d'] || keys['D']
    if ((rotL || rotR) && orbitState.mode === 'free') {
      const flicker = 0.65 + 0.35 * Math.sin(now / 25)
      const rcsLen  = sz * 1.1 * flicker
      // RCS fires on both ends perpendicular to ship axis, opposite sides
      // Turning left (CCW): nose fires right (+y), tail fires left (-y)
      // Turning right (CW): nose fires left (-y), tail fires right (+y)
      const noseSign = rotL ?  1 : -1
      const tailSign = rotL ? -1 :  1
      ctx.fillStyle = 'rgba(120,200,255,0.75)'

      // Nose RCS (fires sideways from front)
      ctx.beginPath()
      ctx.moveTo(sz * 0.5, 0)
      ctx.lineTo(sz * 0.5 + rcsLen * 0.3, noseSign * rcsLen)
      ctx.lineTo(sz * 0.1, noseSign * rcsLen * 0.3)
      ctx.closePath()
      ctx.fill()

      // Tail RCS (fires opposite side from rear)
      ctx.beginPath()
      ctx.moveTo(-sz * 0.7, 0)
      ctx.lineTo(-sz * 0.7 - rcsLen * 0.2, tailSign * rcsLen)
      ctx.lineTo(-sz * 0.4, tailSign * rcsLen * 0.3)
      ctx.closePath()
      ctx.fill()
    }

    // Ship body
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

    ctx.restore()

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
// VELOCITY MATCH INDICATOR (bottom-center HUD element while inside a ring)
// =============================================================================

function drawVelocityMatchHUD(ctx, w, h) {
  if (orbitState.mode !== 'free' || !ship) return

  const ringMult  = settings.settings.orbit.ringRadiusMult
  const threshold = settings.settings.orbit.velMatchThreshold

  // Find nearest planet inside its ring
  let bestPlanet = null, bestPct = -1

  for (const body of bodies) {
    if (body.isFixed || body.id === 'sun' || body.id === 'ship') continue

    const captureRingR = ringMult
    const dx   = ship.x - body.x
    const dy   = ship.y - body.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > captureRingR) continue

    const relVx       = ship.vx - body.vx
    const relVy       = ship.vy - body.vy
    const relSpeed    = Math.sqrt(relVx * relVx + relVy * relVy)
    const planetSpeed = Math.sqrt(body.vx * body.vx + body.vy * body.vy)
    const pct         = Math.max(0, Math.min(1, 1 - relSpeed / (planetSpeed * threshold)))

    if (pct > bestPct) { bestPct = pct; bestPlanet = body }
  }

  if (!bestPlanet) {
    // Show approach hint for nearby rings (within 2x ring radius)
    for (const body of bodies) {
      if (body.isFixed || body.id === 'sun' || body.id === 'ship') continue
      const captureRingR = ringMult
      const dx   = ship.x - body.x
      const dy   = ship.y - body.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < captureRingR * 2) {
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.font      = '12px monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.textAlign = 'center'
        ctx.fillText('MATCH VELOCITY TO DOCK', w / 2, h - 30)
        ctx.restore()
        return
      }
    }
    return
  }

  const pct    = Math.round(bestPct * 100)
  const locked = pct >= 99

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  const label = locked
    ? `LOCKED — ${bestPlanet.name}`
    : `MATCHING VELOCITY: ${pct}%`

  // Color: red → yellow → green
  const r = Math.round(255 * (1 - bestPct))
  const g = Math.round(220 * bestPct)
  const color = `rgba(${r},${g},80,0.9)`

  ctx.font      = 'bold 13px monospace'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(label, w / 2, h - 30)

  // Bar below text
  const barW  = 200
  const barH  = 4
  const barX  = w / 2 - barW / 2
  const barY  = h - 22

  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillRect(barX, barY, barW, barH)
  ctx.fillStyle = color
  ctx.fillRect(barX, barY, barW * bestPct, barH)

  ctx.restore()
}

// =============================================================================
// HUD OVERLAY
// =============================================================================

function drawHUD(ctx, w, h) {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Focus buttons
  const baseButtons = [
    { label: 'Focus: Sun',  focus: 'sun'  },
    { label: 'Focus: Ship', focus: 'ship' },
  ]
  const extraButtons = orbitState.mode === 'docked' && orbitState.planet
    ? [{ label: `Focus: ${orbitState.planet.name}`, focus: 'orbit' }]
    : []
  const buttons = [...baseButtons, ...extraButtons]

  const bw = 110, bh = 22, gap = 6, startX = 12, startY = 12

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

  // Docked mode status
  if (orbitState.mode === 'docked' && orbitState.planet) {
    const planet = orbitState.planet
    const [r, g, b] = hexToRgb(planet.color)

    ctx.font      = 'bold 14px monospace'
    ctx.fillStyle = `rgba(${r},${g},${b},0.95)`
    ctx.textAlign = 'center'
    ctx.fillText(`DOCKED: ${planet.name.toUpperCase()}`, w / 2, startY + bh + 24)

    ctx.font      = '11px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('PARTICLE ACCELERATOR ARMED  •  Drag to aim  •  [ESC] to undock', w / 2, startY + bh + 42)
  }

  // Speed / distance info (top-right)
  if (ship) {
    const speed_au_yr = Math.sqrt(ship.vx ** 2 + ship.vy ** 2)
    const speed_km_s  = speed_au_yr * AU_KM / (365.25 * 24 * 3600)
    const sun         = bodies.find(b => b.id === 'sun')
    const dist_au     = sun
      ? Math.sqrt((ship.x - sun.x) ** 2 + (ship.y - sun.y) ** 2)
      : 0

    ctx.font      = '11px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.textAlign = 'right'
    ctx.fillText(`Speed: ${speed_km_s.toFixed(2)} km/s`, w - 12, h - 26)
    ctx.fillText(`Dist from Sun: ${dist_au.toFixed(4)} AU`, w - 12, h - 12)
  }

  ctx.restore()

  // Velocity match / approach indicator
  drawVelocityMatchHUD(ctx, w, h)
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
// SHOCKWAVE ANIMATION
// =============================================================================

function tickShockwaves(realDt) {
  for (const sw of shockwaves) {
    sw.age += realDt
    const t  = Math.min(sw.age / sw.duration, 1)
    // Ease-out cubic: fast at start, decelerates
    const et = 1 - Math.pow(1 - t, 3)
    sw.r     = sw.maxR * et
    sw.alpha = 1 - t              // linear fade over full duration
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    if (shockwaves[i].age >= shockwaves[i].duration) shockwaves.splice(i, 1)
  }
}

function drawShockwaves(ctx) {
  if (shockwaves.length === 0) return
  const s = scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)

  for (const sw of shockwaves) {
    if (sw.r <= 0) continue
    const a         = Math.max(0, sw.alpha)
    const t         = sw.age / sw.duration
    const [r, g, b] = hexToRgb(sw.color)

    // Leading bright white ring — thick at start, thins as it expands
    const ringW = Math.max(0.5, (1 - t) * 8 + 1)
    ctx.beginPath()
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.95})`
    ctx.lineWidth   = ringW / s
    ctx.stroke()

    // Colored glow halo just inside the leading ring
    ctx.beginPath()
    ctx.arc(sw.x, sw.y, sw.r * 0.88, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.55})`
    ctx.lineWidth   = (ringW * 2.5) / s
    ctx.stroke()

    // Soft inner fill — big radial glow at start
    if (t < 0.5) {
      const fillA = a * (0.5 - t) * 0.4
      const grad  = ctx.createRadialGradient(sw.x, sw.y, 0, sw.x, sw.y, sw.r)
      grad.addColorStop(0,   `rgba(255,255,255,${fillA})`)
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${fillA * 0.5})`)
      grad.addColorStop(1,   `rgba(${r},${g},${b},0)`)
      ctx.beginPath()
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
    }
  }

  ctx.restore()
}

// =============================================================================
// MAIN RENDER
// =============================================================================

function render(ctx, w, h, realDt) {
  ctx.clearRect(0, 0, w, h)

  tickShockwaves(realDt)
  applyFocusMode(w, h)

  drawGrid(ctx, w, h)
  drawOrbits(ctx)
  drawCaptureRings(ctx)
  drawPredictionPath(ctx)

  for (const body of bodies) {
    drawBody(ctx, body, w, h)
  }

  drawShockwaves(ctx)
  drawDockedRing(ctx)
  drawOrbitCue(ctx)
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
    // Escape: undock
    if (e.key === 'Escape' && orbitState.mode === 'docked') {
      undock(true)
      return
    }
    keys[e.key] = true
  }
  function onKeyUp(e) { keys[e.key] = false }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup',   onKeyUp)

  // --- Mouse ---
  function onMouseDown(e) {
    if (e.button !== 0) return

    // Docked mode: start drag for aiming shot
    if (orbitState.mode === 'docked') {
      const rect = canvas.getBoundingClientRect()
      const cx   = e.clientX - rect.left
      const cy   = e.clientY - rect.top
      orbitDrag  = { startX: cx, startY: cy, curX: cx, curY: cy }
      return
    }

    // Free mode: start camera pan
    cam._dragActive = true
    cam._dragLastX  = e.clientX
    cam._dragLastY  = e.clientY
  }

  function onMouseMove(e) {
    if (orbitState.mode === 'docked' && orbitDrag) {
      const rect    = canvas.getBoundingClientRect()
      orbitDrag.curX = e.clientX - rect.left
      orbitDrag.curY = e.clientY - rect.top
      return
    }

    if (!cam._dragActive) return
    const dx = e.clientX - cam._dragLastX
    const dy = e.clientY - cam._dragLastY
    if (Math.abs(dx) + Math.abs(dy) > 2) cam.focus = 'free'
    cam.panX       += dx
    cam.panY       += dy
    cam._dragLastX  = e.clientX
    cam._dragLastY  = e.clientY
  }

  function onMouseUp(e) {
    // Fire shot if docked and dragging
    if (orbitState.mode === 'docked' && orbitDrag) {
      fireShot()
      orbitDrag = null
      return
    }
    cam._dragActive = false
  }

  function onWheel(e) {
    e.preventDefault()
    const factor = Math.pow(1.12, -e.deltaY / 100)
    zoomAt(factor, e.offsetX, e.offsetY)
  }

  // --- HUD button click ---
  function onCanvasClick(e) {
    const rect    = canvas.getBoundingClientRect()
    const cx      = e.clientX - rect.left
    const cy      = e.clientY - rect.top
    const bw = 110, bh = 22, gap = 6, startX = 12, startY = 12

    const focusModes = ['sun', 'ship']
    if (orbitState.mode === 'docked' && orbitState.planet) focusModes.push('orbit')

    focusModes.forEach((fm, i) => {
      const bx = startX + i * (bw + gap)
      if (cx >= bx && cx <= bx + bw && cy >= startY && cy <= startY + bh) {
        cam.focus = fm
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
    canvas.width        = _w
    canvas.height       = _h
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
    let realDt = 0
    if (lastTime !== null) {
      realDt             = Math.min((ts - lastTime) / 1000, MAX_DT)  // seconds
      const simScale     = timeScale.value
      const dt_yr        = realDt * simScale / (365.25 * 24 * 3600)  // yr per frame

      if (isPlaying.value) {
        simStep(dt_yr, realDt)
        simYears += dt_yr

        for (const body of bodies) {
          if (body.trail && body.trail.push) body.trail.push(body.x, body.y)
        }

        bodyCount.value = bodies.length
        const yr  = Math.floor(simYears)
        const day = (simYears - yr) * 365.25
        elapsedLabel.value = `Yr ${yr.toLocaleString()} Day ${day.toFixed(1)}`

        // Prediction (only in free mode)
        predCountdown--
        if (predCountdown <= 0) {
          predCountdown = PRED_INTERVAL
          shipPredPath  = computePrediction(dt_yr)
        }
      }
    }
    lastTime = ts
    if (ctx) render(ctx, _w, _h, realDt)
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
  simYears      = 0
  shipPredPath  = []
  predCountdown = 0
  lastTime      = null
  isPlaying.value  = true
  timeScale.value  = settings.settings.sim.baseSpeed
  buildScene(_w, _h)
}

watch(() => settings.settings.sim.baseSpeed, (v) => { timeScale.value = v })
watch(() => settings.settings.visuals.trailLength, (v) => {
  for (const b of bodies) {
    if (b.trail) b.trail = makeTrail(v)
  }
})
</script>
