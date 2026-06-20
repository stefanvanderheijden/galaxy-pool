<template>
  <GameShell
    :is-playing="isPlaying"
    :time-scale="timeScale"
    :body-count="bodyCount"
    :elapsed-label="elapsedLabel"
    @canvas-ready="initCanvas"
    @toggle-play="togglePlay"
    @reset="reset"
  >
    <template #settings>
      <SettingsPanel @export="settings.exportJSON()" @import="onImport">
        <SettingsSection title="Spaceship">
          <div class="steering-field">
            <div class="steering-header">
              <span class="steering-label">
                Steering
                <button class="info-btn" title="More info" @click.stop="steeringModalOpen = true">
                  i
                </button>
              </span>
            </div>
            <div class="steering-options">
              <button
                v-for="opt in STEERING_OPTIONS"
                :key="opt.value"
                class="steering-btn"
                :class="{ active: settings.settings.ship.steering === opt.value }"
                @click="settings.settings.ship.steering = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <SettingsRow
            v-model="settings.settings.ship.thrustAccel"
            label="Thrust"
            :min="1"
            :max="1500"
            :step="10"
            :decimals="0"
            tooltip="Thrust acceleration in AU/yr²."
          />
          <SettingsRow
            v-if="settings.settings.ship.steering === 'tank'"
            v-model="settings.settings.ship.turnSpeed"
            label="Turn speed"
            :min="0.5"
            :max="10"
            :step="0.5"
            :decimals="1"
            tooltip="How fast the ship rotates with A/D keys in Tank steering (rad/s)."
          />
        </SettingsSection>

        <!-- Steering mode explainer modal -->
        <div
          v-if="steeringModalOpen"
          class="modal-backdrop"
          @click.self="steeringModalOpen = false"
        >
          <div class="modal-box">
            <div class="modal-title">Steering mode</div>
            <div class="modal-body">
              How W/A/S/D drive the ship:<br /><br />
              <strong>Tank</strong> — A/D rotate the ship, W thrusts along its heading, S brakes.<br /><br />
              <strong>Screen</strong> — W/A/S/D push up/down/left/right in screen space.<br /><br />
              <strong>Drift</strong> — relative to your direction of travel: W prograde (speed up),
              S retrograde (brake), A/D thrust to port/starboard.<br /><br />
              Spacebar is a full retrograde brake in every mode.
            </div>
            <button class="modal-close" @click="steeringModalOpen = false">Close</button>
          </div>
        </div>
        <SettingsSection title="Orbit Shot">
          <SettingsRow
            v-model="settings.settings.orbit.ringRadiusMult"
            label="Ring radius (AU)"
            :min="0.05"
            :max="2"
            :step="0.05"
            :decimals="2"
            tooltip="Capture ring radius in AU. Same for all planets."
          />
          <SettingsRow
            v-model="settings.settings.orbit.shotPower"
            label="Shot power"
            :min="100"
            :max="80000"
            :step="100"
            :decimals="0"
            tooltip="Impulse power for planet shots. Higher = more kick."
          />
          <SettingsRow
            v-model="settings.settings.orbit.maxDrag"
            label="Max drag (px)"
            :min="50"
            :max="400"
            :step="10"
            :decimals="0"
            tooltip="Maximum drag distance for shot aiming."
          />
          <SettingsRow
            v-model="settings.settings.orbit.recoilMult"
            label="Recoil"
            :min="0"
            :max="1"
            :step="0.01"
            :decimals="2"
            tooltip="Fraction of planet impulse applied back to ship as recoil."
          />
          <SettingsRow
            v-model="settings.settings.orbit.planetGravBoost"
            label="Planet grav boost"
            :min="1"
            :max="80000"
            :step="50"
            :decimals="0"
            tooltip="Local gravity boost between planets within their influence radius."
          />
          <SettingsRow
            v-model="settings.settings.orbit.planetInfluenceRadius"
            label="Planet influence (AU)"
            :min="0.01"
            :max="0.5"
            :step="0.01"
            :decimals="2"
            tooltip="Radius within which planets exert local gravity on each other."
          />
        </SettingsSection>
        <SettingsSection title="Black hole">
          <SettingsRow
            v-model="settings.settings.blackhole.mass"
            label="Mass"
            :min="0"
            :max="5"
            :step="0.05"
            :decimals="2"
            tooltip="Local ship-only gravity. Planets are not affected."
          />
          <SettingsRow
            v-model="settings.settings.blackhole.influenceRadius"
            label="Influence radius"
            :min="0.1"
            :max="4"
            :step="0.1"
            :decimals="2"
            tooltip="AU radius where the black hole can pull the ship."
          />
          <SettingsRow
            v-model="settings.settings.blackhole.coneAngleDeg"
            label="Cone direction (°)"
            :min="0"
            :max="360"
            :step="5"
            :decimals="0"
            tooltip="Direction the gravitational cone points, in degrees."
          />
          <SettingsRow
            v-model="settings.settings.blackhole.coneHalfAngleDeg"
            label="Cone half-angle (°)"
            :min="5"
            :max="180"
            :step="5"
            :decimals="0"
            tooltip="Half-width of the cone. 180° = full sphere (no cone)."
          />
        </SettingsSection>
        <SettingsSection title="Fog of war">
          <div class="steering-field">
            <div class="steering-header">
              <span class="steering-label">Fog</span>
            </div>
            <div class="steering-options">
              <button
                class="steering-btn"
                :class="{ active: settings.settings.fog.enabled }"
                @click="settings.settings.fog.enabled = true"
              >
                On
              </button>
              <button
                class="steering-btn"
                :class="{ active: !settings.settings.fog.enabled }"
                @click="settings.settings.fog.enabled = false"
              >
                Off
              </button>
            </div>
          </div>
          <SettingsRow
            v-model="settings.settings.fog.revealRadius"
            label="Sight radius (AU)"
            :min="0.1"
            :max="3"
            :step="0.05"
            :decimals="2"
            tooltip="Vision circle around the ship. Grid cells it overlaps become permanently visible — revealing the sun, black hole, gas cloud and any object that later passes through them."
          />
          <SettingsRow
            v-model="settings.settings.fog.radarRadius"
            label="Radar radius (AU)"
            :min="0.1"
            :max="5"
            :step="0.05"
            :decimals="2"
            tooltip="Reach of the rotating radar sweep. A planet inside this range is detected the moment the sweep line crosses it, then tracked at its true position forever."
          />
          <SettingsRow
            v-model="settings.settings.fog.radarSweepSpeed"
            label="Radar sweep (rad/s)"
            :min="0.2"
            :max="6"
            :step="0.1"
            :decimals="1"
            tooltip="Rotation speed of the radar sweep, in rad/s at 1,000,000× time. The sweep runs on sim time, so it slows, speeds up and freezes with the simulation."
          />
          <SettingsRow
            v-model="settings.settings.fog.cellSize"
            label="Fog cell size (AU)"
            :min="0.1"
            :max="1"
            :step="0.05"
            :decimals="2"
            tooltip="Edge length of one fog grid square. Smaller = finer reveal that hugs the sight circle; larger = chunkier, cheaper."
          />
        </SettingsSection>
        <SettingsSection title="Visuals">
          <SettingsRow
            v-model="settings.settings.visuals.trailLength"
            label="Trail length"
            :min="50"
            :max="5000"
            :step="50"
            :decimals="0"
            tooltip="Number of past positions in body trails."
          />
        </SettingsSection>
      </SettingsPanel>
    </template>
  </GameShell>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import GameShell from './components/GameShell.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import SettingsSection from './components/SettingsSection.vue'
import SettingsRow from './components/SettingsRow.vue'
import { useSettings } from './composables/useSettings.js'
import { TIME_STEP_VALUES } from './timeSteps.js'
import { G_SIM, SOFTENING, AU_KM, PX_PER_AU, MAX_DT, SECONDS_PER_YEAR } from './engine/units.js'
import { seededRandom } from './engine/rng.js'
import { makeTrail } from './engine/trail.js'
import { computeThrust, getThrustState as classifyThrust } from './engine/steering.js'
import hubbleUrl from './Images/hubble.jpg'

// =============================================================================
// CONSTANTS
// =============================================================================

const GAME_ID = 'galaxy-pool'

// Steering modes — how W/A/S/D drive the ship. See applyShipInput().
const STEERING_OPTIONS = [
  { value: 'tank', label: 'Tank' },
  { value: 'screen', label: 'Screen' },
  { value: 'drift', label: 'Drift' },
]
const steeringModalOpen = ref(false)

// Unit system (AU, Solar masses, Julian years) and the physics/render tunables
// G_SIM, SOFTENING, AU_KM, PX_PER_AU, MAX_DT, SECONDS_PER_YEAR come from
// engine/units.js — see that file for the derivations.

// Spaceship physical dimensions
const SHIP_LENGTH_AU = 1000 / AU_KM // 1000 km in AU ≈ 6.684e-6 AU
const SHIP_DRAW_R = 0.022 // display radius in AU — ~8px at default zoom
const SHIP_MASS = 5.03e-18 // M☉ — 10,000 Gt

// Minimum pixel size below which we switch to icon rendering
const MIN_PLANET_PX = 3 // px

// Prediction config
const PRED_HORIZON_YR = 0.5 // simulated years to preview
const PRED_BASE_DT_YR = 0.001 // max ghost timestep before adaptive tightening
const PRED_TARGET_SEGMENT_PX = 7 // keeps fast projected curves visually smooth
const PRED_MAX_STEPS = 3000
const PRED_INTERVAL = 3 // recalculate every N rendered frames
// Projection corridor geometry in SIM-space (AU), so the divergence is anchored
// to the world and grows/shrinks with zoom instead of being a fixed screen size.
const PRED_CORRIDOR_HALF_AU = 0.022 // corridor half-width at the far end
const PRED_CORRIDOR_LINE_AU = 0.0015 // line thickness

const CAPTURE_DURATION_S = 1.25
const CAPTURE_DWELL_YR = 0.008 // sim-years ship must stay within ring to trigger capture
const SLINGSHOT_ORBIT_MIN_R = 0.018
const SLINGSHOT_ORBIT_R_MULT = 2.8
const BLACK_HOLE = {
  id: 'blackhole',
  name: 'Black Hole',
  // Upper-right, outside every planet orbit (~2.05 AU from the sun) and away from
  // all three planets' START positions, so nothing spawns on or orbits into it.
  x: 1.7,
  y: 1.15,
  drawR: 0.035,
  captureR: 0.05,
  color: '#b48cff', // radar accent (the hole itself renders dark)
  // Radar/scan state — like a body's, but the black hole lives outside bodies[].
  // Reset in buildScene via resetFog().
  detected: false,
  scanned: false,
  scanProgress: 0,
  info: {
    classification: 'Singularity',
    diameterKm: 30, // ~event-horizon scale, schematic
    gravityG: 1e6,
    dayHours: 0,
    moons: 0,
    tempC: -270,
    desc: 'Gravitational sink. Crosses the horizon, nothing returns — including light.',
  },
}
const SUN_GRAVITY_WELL_R = 0.18
const SUN_DESTRUCTION_R = 0.028
const DEBRIS_COUNT = 22

// Gas cloud — a drag region shaped as a thick line (a capsule): the spine runs
// between two endpoints (x1,y1)→(x2,y2) and the cloud extends radius `r` to
// either side. Distance-to-cloud is the distance to that segment, so a body's
// drag/density depends on how close it is to the spine, not to a single point.
// Bodies AND the ship passing through it bleed off velocity, like atmospheric
// drag. dragPerYr is the fraction of velocity shed per simulation year at the
// cloud's core (soft falloff to zero at the edge). Sits in the UPPER-LEFT,
// entirely OUTSIDE the planets' orbits (nearest point ~1.69 AU from the sun,
// clear of Mars's 1.524 AU orbit), well clear of the black hole (~1.5 AU from its
// influence circle) AND away from every planet's START position — so planets
// never plow through it on their stable paths, only the ship (or a stray planet).
const GAS_CLOUD = {
  x1: -1.3,
  y1: 1.7,
  x2: -0.4,
  y2: 1.95,
  r: 0.3,
  dragPerYr: 9.0,
  color: '120,180,140', // soft green nebula
}

// Distance from a point to the gas cloud's spine segment, plus the closest
// point on the spine (used for both physics and rendering).
function gasCloudSpineClosest(px, py) {
  const { x1, y1, x2, y2 } = GAS_CLOUD
  const sx = x2 - x1
  const sy = y2 - y1
  const len2 = sx * sx + sy * sy
  let t = len2 > 0 ? ((px - x1) * sx + (py - y1) * sy) / len2 : 0
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const cx = x1 + t * sx
  const cy = y1 + t * sy
  const dx = px - cx
  const dy = py - cy
  return { cx, cy, t, dist: Math.sqrt(dx * dx + dy * dy) }
}

// Solar system data — all in simulation units (AU, M☉)
const SOLAR_BODIES = [
  {
    id: 'sun',
    name: 'Sun',
    mass: 1.0,
    orbR: 0,
    angle: 0,
    color: '#FFD700',
    physR: 0.00465,
    drawR: 0.01,
    isFixed: true,
    info: {
      classification: 'G-type star',
      diameterKm: 1391000,
      gravityG: 28,
      dayHours: 600, // ~25 Earth days equatorial rotation
      moons: 8,
      tempC: 5500, // photosphere
      desc: 'Yellow dwarf. Fusion core anchoring the system; do not approach.',
    },
  },
  {
    id: 'venus',
    name: 'Venus',
    mass: 2.447e-6,
    orbR: 0.723,
    angle: 3.176,
    color: '#e8cda0',
    physR: 4.05e-5,
    drawR: 0.005,
    isFixed: false,
    info: {
      classification: 'Terrestrial',
      diameterKm: 12104,
      gravityG: 0.9,
      dayHours: 5832, // 243 Earth days, retrograde
      moons: 0,
      tempC: 464,
      desc: 'Runaway greenhouse. Crushing CO₂ atmosphere, sulphuric clouds.',
    },
  },
  {
    id: 'earth',
    name: 'Earth',
    mass: 3.003e-6,
    orbR: 1.0,
    angle: 1.753,
    color: '#4fc3f7',
    physR: 4.26e-5,
    drawR: 0.006,
    isFixed: false,
    info: {
      classification: 'Terrestrial',
      diameterKm: 12742,
      gravityG: 1.0,
      dayHours: 24,
      moons: 1,
      tempC: 15,
      desc: 'Cradle world. Liquid water, breathable atmosphere, abundant life.',
    },
  },
  {
    id: 'mars',
    name: 'Mars',
    mass: 3.213e-7,
    orbR: 1.524,
    angle: 5.015,
    color: '#e8714a',
    physR: 2.27e-5,
    drawR: 0.004,
    isFixed: false,
    info: {
      classification: 'Terrestrial',
      diameterKm: 6779,
      gravityG: 0.38,
      dayHours: 24.7,
      moons: 2,
      tempC: -63,
      desc: 'Cold desert. Thin CO₂ air, polar ice, ancient riverbeds.',
    },
  },
]

// =============================================================================
// SETTINGS
// =============================================================================

const settings = useSettings(GAME_ID, {
  sim: { baseSpeed: 1000000 },
  ship: {
    thrustAccel: 360,
    turnSpeed: 3.5, // Tank steering only: A/D rotation rate (rad/s)
    steering: 'drift', // "tank" | "screen" | "drift"
  },
  orbit: {
    ringRadiusMult: 0.1,
    shotPower: 800,
    maxDrag: 250,
    recoilMult: 0.05,
    planetGravBoost: 1500,
    planetInfluenceRadius: 0.2,
  },
  blackhole: {
    mass: 0.8,
    influenceRadius: 0.45,
    coneAngleDeg: 290,
    coneHalfAngleDeg: 55,
  },
  fog: {
    enabled: true,
    revealRadius: 0.55, // AU — vision circle; grid cells it overlaps become seen forever
    radarRadius: 0.8, // AU — sweep range; a planet is detected when the sweep line crosses it
    radarSweepSpeed: 1.6, // rad/s — rotation speed of the radar sweep line
    cellSize: 0.25, // AU — edge length of one fog grid cell (coarse; tunable)
  },
  visuals: { trailLength: 1600 },
})

function onImport(parsed) {
  settings.importJSON(parsed)
  reset()
}

// =============================================================================
// REACTIVE STATE
// =============================================================================

const isPlaying = ref(true)
const timeScale = ref(1000000)
const bodyCount = ref(0)
const elapsedLabel = ref('')

const TIME_STEPS = TIME_STEP_VALUES // shared with GameShell via timeSteps.js
let timeScaleStepIdx = 2 // start at 1,000,000
let timeScaleTarget = TIME_STEPS[timeScaleStepIdx]

// =============================================================================
// SIMULATION STATE
// =============================================================================

let bodies = []
let ship = null // reference into bodies[]
let starLayers = []

// Fog of war — SPARSE GRID MODEL.
// The world is tiled by square cells of edge `cellSize` AU in ABSOLUTE sim space
// (fixed to the world, independent of camera/zoom/ship). A cell is keyed by its
// integer (col,row) = (floor(x/cell), floor(y/cell)); negatives are fine. Each
// cell is 'unseen' until the ship's vision circle overlaps it, at which point it
// is added to `fogSeen` PERMANENTLY (sticky — keys are only ever added). A seen
// cell renders clear forever, so anything later passing through it is visible.
// This replaces both the moving ship-sight clear circle AND the per-landmark
// discovery flags: the sun / black hole / gas cloud are plain world geometry now,
// visible iff their cells are seen.
//
// Radar is a SEPARATE, orthogonal mechanic: a planet's sticky `body.detected`
// flag (set within radarRadius) keeps it visible even over unseen cells. The grid
// never touches `body.detected`.
let fogSeen = new Set() // keys "col,row" of permanently-seen cells
// Bounding box (in cell indices) of all seen cells — lets the renderer iterate
// only the explored region and bulk-fill the unexplored margins.
let fogBboxColMin = Infinity
let fogBboxColMax = -Infinity
let fogBboxRowMin = Infinity
let fogBboxRowMax = -Infinity

// Radar sweep: a line rotating around the ship at radarSweepSpeed. A trackable
// body inside radarRadius is detected only when the sweep line crosses its
// bearing (not by mere proximity). `radarAngle` accumulates; `radarPrevAngle` is
// last frame's value so we can test which bearings the line swept through.
let radarAngle = 0
let radarPrevAngle = 0
// Per-body blink animation, keyed by body.id: { t, dur, pulses }. The sweep line
// fires a blink every time it crosses an in-range body — a DOUBLE blink on first
// acquisition (pulses 2), a single acknowledging ping (pulses 1) on every later
// hit. t counts down from dur; the draw maps it to `pulses` flashes.
let radarBlink = {}
const RADAR_BLINK_DUR_DOUBLE = 0.9 // seconds for the two-pulse acquisition blink
const RADAR_BLINK_DUR_SINGLE = 0.45 // seconds for the one-pulse per-hit ping

function fogCell() {
  return settings.settings.fog.cellSize
}
function cellKey(col, row) {
  return col + ',' + row // integers only → unambiguous, no decimal/comma clash
}
// World-point convenience: is the cell containing (x,y) seen?
function worldCellSeen(x, y) {
  const cell = fogCell()
  return fogSeen.has(cellKey(Math.floor(x / cell), Math.floor(y / cell)))
}

// Bodies radar can lock onto and then track forever: the planets and the sun.
// (The gas cloud is static map geometry revealed by sight, not a radar contact.)
function isRadarTrackable(body) {
  return body.isPlanet || body.id === 'sun'
}

// All radar contacts: the trackable bodies PLUS the black hole, which is a
// scannable landmark but lives outside bodies[] (it's a fixed constant, not a
// physics body). Everything that sweeps/draws/scans radar iterates this so the
// black hole behaves exactly like the sun and planets — detect, blink, name,
// HUD — without entangling it with the physics integrator.
function radarTargets() {
  const out = []
  for (const body of bodies) if (isRadarTrackable(body)) out.push(body)
  out.push(BLACK_HOLE)
  return out
}

// Reset clears EVERY seen cell. Called from buildScene(), which is the only
// caller and which also re-creates bodies (so radar `detected` flags reset
// implicitly there). Reassigning a fresh Set lets the old one GC.
function resetFog() {
  fogSeen = new Set()
  fogBboxColMin = Infinity
  fogBboxColMax = -Infinity
  fogBboxRowMin = Infinity
  fogBboxRowMax = -Infinity
  radarAngle = 0
  radarPrevAngle = 0
  radarBlink = {}
  // The black hole's radar flags live on a persistent constant, so clear them
  // here (bodies-based contacts reset implicitly when buildScene rebuilds bodies).
  BLACK_HOLE.detected = false
  BLACK_HOLE.scanned = false
  BLACK_HOLE.scanProgress = 0
}

// Camera
const cam = {
  zoom: 0.33,
  panX: 0,
  panY: 0,
  focus: 'sun', // 'sun' | 'ship' | 'orbit' | 'free'
}

// Camera zoom animation
let camTargetZoom = 0.33

// Spaceship angular state
let shipAngle = 0 // radians

// Mouse — still used for slingshot aim
const mouse = {
  x: 0,
  y: 0,
  hasPosition: false,
}

// WASD keyboard state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
}

function clearKeys() {
  keys.w = keys.a = keys.s = keys.d = keys.space = false
}

// Prediction path
let shipPredPath = []
let predCountdown = 0

// Orbit game state
// mode: 'free' | 'capturing' | 'slingshot'
let orbitState = { mode: 'free', planet: null, shipOffset: null }

// Drag for aiming the shot (screen-space pixels)
let orbitDrag = null // null | { startX, startY, curX, curY }

// Cooldown after firing — real-time seconds remaining
let captureCooldown = 0
let captureReleaseLockPlanetId = null

// Shockwave particles — spawned on fireShot
// Each: { x, y, r, maxR, alpha, color }  — x/y/r in world AU
let shockwaves = []
let debris = []
let thrustParticles = []
let solarParticles = []
let blackHoleScore = 0
let blackHoleConsumed = [] // { name, color, physR } in order of consumption
let shipLoss = null
let sunPenalty = 0
let totalEnergySpent = 0
let finalScoreShown = false
let deathFocus = null
let deathTextAge = 0 // real-seconds since death, for text fade-in

const TOTAL_PLANETS = SOLAR_BODIES.filter((b) => !b.isFixed).length

// Solar energy system
const SOLAR_MAX_ENERGY = 100 // arbitrary units
const SOLAR_CHARGE_RATE = 18 // units/s at reference distance
const SOLAR_CHARGE_REF_DIST = 0.15 // AU — reference distance for full rate (~Mercury perihelion)
const SOLAR_SHOT_COST = 90 // energy units consumed at full-power shot
let shipEnergy = 30
let solarEfficiency = 0 // 0..1, recomputed each frame

// =============================================================================
// STARFIELD DATA
// =============================================================================
// makeTrail (ring buffer) and seededRandom (PRNG) come from engine/.

// Stellar color palette by spectral class frequency
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

function pickStarColor(rand) {
  const r = rand()
  let acc = 0
  for (const c of STAR_COLORS) {
    acc += c.weight
    if (r < acc) return c.rgb
  }
  return STAR_COLORS[0].rgb
}

// Nebula clouds — seeded random soft blobs drawn as radial gradients
let nebulaClouds = []

// Hubble backdrop — a faint, translucent photo laid over the black base so the
// player can tell SEEN space (image shows through) from fog (solid black). Loaded
// once; drawImage no-ops until it decodes.
//
// Parallax: the image drifts opposite the camera's world motion (parX/parY are
// the camera's world position × PARALLAX_GAIN). HUBBLE_DEPTH controls how strong
// the effect is — well above the deep starfield (0.004) so the photo visibly
// slides as you pan, reading as a near-ish backdrop. To keep its edges off-screen
// at the largest drift, we cover-fit with extra HUBBLE_MARGIN headroom.
const HUBBLE_ALPHA = 0.16 // very translucent overlay
const HUBBLE_DEPTH = 0.16 // parallax strength (strong drift; deep stars are 0.004)
const HUBBLE_MARGIN = 0.45 // fraction of viewport reserved as drift headroom
const hubbleImg = new Image()
hubbleImg.src = hubbleUrl

function drawHubbleBackdrop(ctx, w, h, parX, parY) {
  if (!hubbleImg.complete || !hubbleImg.naturalWidth) return
  const iw = hubbleImg.naturalWidth
  const ih = hubbleImg.naturalHeight
  // Parallax offset (opposite the camera's motion, like the star layers).
  const ox = -parX * HUBBLE_DEPTH
  const oy = -parY * HUBBLE_DEPTH
  // Cover fit + margin so the image overfills the viewport by HUBBLE_MARGIN on
  // every side, leaving room for the drift offset without exposing an edge.
  const scale = Math.max(w / iw, h / ih) * (1 + HUBBLE_MARGIN * 2)
  const dw = iw * scale
  const dh = ih * scale
  const dx = (w - dw) / 2 + ox
  const dy = (h - dh) / 2 + oy
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = HUBBLE_ALPHA
  ctx.drawImage(hubbleImg, dx, dy, dw, dh)
  ctx.restore()
}

function buildStarfield(w, h) {
  const rand = seededRandom(0x6a51cafe)
  const layerDefs = [
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
  const tw = Math.max(w * 3.5, 2800)
  const th = Math.max(h * 3.5, 2200)

  starLayers = layerDefs.map((def) => ({
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

  // Nebula clouds — fixed to canvas tile, very slow parallax
  const nebulaRand = seededRandom(0xdeadbeef)
  nebulaClouds = Array.from({ length: 9 }, () => {
    const hue = Math.floor(nebulaRand() * 6)
    // Palette: blue, purple, teal, magenta, deep red, indigo
    const colors = [
      [40, 80, 200],
      [120, 40, 200],
      [20, 160, 180],
      [180, 30, 160],
      [180, 30, 60],
      [60, 20, 180],
    ]
    const [r, g, b] = colors[hue]
    return {
      x: nebulaRand() * tw,
      y: nebulaRand() * th,
      rx: (0.18 + nebulaRand() * 0.32) * tw,
      ry: (0.12 + nebulaRand() * 0.22) * th,
      alpha: 0.028 + nebulaRand() * 0.038,
      color: `${r},${g},${b}`,
      depth: 0.002 + nebulaRand() * 0.025,
      tw,
      th,
    }
  })
}

// =============================================================================
// PHYSICS
// =============================================================================

function gravityStep(bs, dt) {
  const n = bs.length
  const fx = new Float64Array(n)
  const fy = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Ship is only pulled by the sun — skip ship↔planet pairs entirely
      const involvesPlanet =
        (bs[i].id === 'ship' && bs[j].isPlanet) || (bs[j].id === 'ship' && bs[i].isPlanet)
      if (involvesPlanet) continue

      const dx = bs[j].x - bs[i].x
      const dy = bs[j].y - bs[i].y
      const distSq = dx * dx + dy * dy + SOFTENING
      const dist = Math.sqrt(distSq)
      const f = (G_SIM * bs[i].mass * bs[j].mass) / distSq
      const ffx = (f * dx) / dist
      const ffy = (f * dy) / dist
      if (!bs[i].isFixed) {
        fx[i] += ffx
        fy[i] += ffy
      }
      if (!bs[j].isFixed) {
        fx[j] -= ffx
        fy[j] -= ffy
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (bs[i].isFixed) continue
    bs[i].vx += (fx[i] / bs[i].mass) * dt
    bs[i].vy += (fy[i] / bs[i].mass) * dt
    bs[i].x += bs[i].vx * dt
    bs[i].y += bs[i].vy * dt
  }
}

function applyInterPlanetGravityLocal(bs, dt, boost) {
  if (boost <= 1) return
  const influenceR = settings.settings.orbit.planetInfluenceRadius
  if (influenceR <= 0) return
  const planets = bs.filter((b) => b.isPlanet && !b.isFixed)
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i]
      const b = planets[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distSq = dx * dx + dy * dy + SOFTENING
      const dist = Math.sqrt(distSq)
      if (dist >= influenceR) continue
      // Clamp effective distance to 10% of influence radius to cap max gravity
      const minDist = influenceR * 0.1
      const clampedDist = Math.max(dist, minDist)
      const clampedDistSq = clampedDist * clampedDist + SOFTENING
      // Linear falloff: full strength at center, zero at edge
      const falloff = 1 - clampedDist / influenceR
      const accel = (G_SIM * boost * falloff * 100) / (clampedDistSq / clampedDist)
      a.vx += (dx / dist) * accel * b.mass * dt
      a.vy += (dy / dist) * accel * b.mass * dt
      b.vx -= (dx / dist) * accel * a.mass * dt
      b.vy -= (dy / dist) * accel * a.mass * dt
    }
  }
}

function applyBlackHoleGravityToShipLike(target, dt) {
  const bh = settings.settings.blackhole
  if (!target || !bh || bh.mass <= 0 || bh.influenceRadius <= 0) return

  const dx = BLACK_HOLE.x - target.x
  const dy = BLACK_HOLE.y - target.y
  const distSq = dx * dx + dy * dy + SOFTENING
  const dist = Math.sqrt(distSq)
  if (dist >= bh.influenceRadius) return

  // Cone masking: direction FROM black hole toward target
  const halfAngle = ((bh.coneHalfAngleDeg ?? 180) * Math.PI) / 180
  if (halfAngle < Math.PI) {
    const coneAngle = ((bh.coneAngleDeg ?? 0) * Math.PI) / 180
    const coneDirX = Math.cos(coneAngle)
    const coneDirY = Math.sin(coneAngle)
    // Unit vector from BH to target
    const toTargetX = -dx / dist
    const toTargetY = -dy / dist
    const cosAngle = coneDirX * toTargetX + coneDirY * toTargetY
    const cosHalf = Math.cos(halfAngle)
    if (cosAngle < cosHalf) return // outside cone entirely
    // Smooth falloff toward cone edges (0 at edge, 1 at center axis)
    const angularFactor = (cosAngle - cosHalf) / (1 - cosHalf)
    const smoothFactor = angularFactor * angularFactor

    const falloff = 1 - dist / bh.influenceRadius
    const accel = (G_SIM * bh.mass * falloff * smoothFactor) / distSq
    target.vx += (dx / dist) * accel * dt
    target.vy += (dy / dist) * accel * dt
  } else {
    const falloff = 1 - dist / bh.influenceRadius
    const accel = (G_SIM * bh.mass * falloff) / distSq
    target.vx += (dx / dist) * accel * dt
    target.vy += (dy / dist) * accel * dt
  }
}

function applyBlackHoleGravityLocal(bs, dt) {
  for (const body of bs) {
    if (body.isFixed) continue
    applyBlackHoleGravityToShipLike(body, dt)
  }
}

function applySolarGravityWell(bs, dt) {
  const sun = bs.find((b) => b.id === 'sun')
  if (!sun) return

  for (const body of bs) {
    if (body.isFixed || body.id === 'sun') continue

    const dx = sun.x - body.x
    const dy = sun.y - body.y
    const distSq = dx * dx + dy * dy + SOFTENING
    const dist = Math.sqrt(distSq)
    if (dist >= SUN_GRAVITY_WELL_R) continue

    const ux = dx / dist
    const uy = dy / dist
    const well = Math.max(
      0,
      Math.min(1, 1 - (dist - SUN_DESTRUCTION_R) / (SUN_GRAVITY_WELL_R - SUN_DESTRUCTION_R)),
    )
    const strength = well * well

    // Extra local pull: a gameplay gravity well, not realism.
    // It adds speed toward the sun without braking the flyby trajectory.
    const accel = (G_SIM * sun.mass * strength * 0.7) / distSq
    body.vx += ux * accel * dt
    body.vy += uy * accel * dt
  }
}

// Velocity drag inside the gas cloud. Soft falloff (full at the core, zero at the
// edge). Uses exponential decay so it's stable and timescale-independent: a body
// loses the same fraction of speed per sim-year regardless of frame rate or dt.
function applyGasCloudDrag(bs, dt) {
  if (GAS_CLOUD.dragPerYr <= 0) return
  for (const body of bs) {
    if (body.isFixed) continue
    const dist = gasCloudSpineClosest(body.x, body.y).dist
    if (dist >= GAS_CLOUD.r) continue

    // 1 at the spine → 0 at the edge (smoothstep for a gentle boundary).
    const e = 1 - dist / GAS_CLOUD.r
    const density = e * e * (3 - 2 * e)
    const decay = Math.exp(-GAS_CLOUD.dragPerYr * density * dt)
    body.vx *= decay
    body.vy *= decay
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function getSlingshotOrbitRadius(planet) {
  return Math.max(planet.drawR * SLINGSHOT_ORBIT_R_MULT, SLINGSHOT_ORBIT_MIN_R)
}

function stepSystemWhileShipAutopilots(dt_yr, planetBoost) {
  if (!ship) return gravityStep(bodies, dt_yr)
  ship.isFixed = true
  applyGasCloudDrag(bodies, dt_yr)
  applyInterPlanetGravityLocal(bodies, dt_yr, planetBoost)
  gravityStep(bodies, dt_yr)
  ship.isFixed = false
}

function updateSolarCharge(realDt_s) {
  if (!ship) return
  const sun = bodies.find((b) => b.id === 'sun')
  const dist = sun ? Math.sqrt((ship.x - sun.x) ** 2 + (ship.y - sun.y) ** 2) : Infinity
  // Inverse-square falloff capped at 1; very close to sun = full efficiency
  const rawEff = Math.min(1, (SOLAR_CHARGE_REF_DIST / Math.max(dist, 0.05)) ** 2)
  solarEfficiency = rawEff
  shipEnergy = Math.min(SOLAR_MAX_ENERGY, shipEnergy + SOLAR_CHARGE_RATE * rawEff * realDt_s)
}

function tickSolarParticles(realDt_s, w, h) {
  // Gauge/bar positions — MUST mirror drawEnergyHUD's minimal layout (incl. the
  // bezel inset of 5 + 8 = 13px per side from the outer device footprint).
  const outerX = 12
  const outerY = 46
  const outerH = h - outerY - 14
  const inset = 13
  const panelX = outerX + inset
  const panelY = outerY + inset
  const panelW = 78 - inset * 2
  const panelH = outerH - inset * 2
  const gaugeR = 15
  const gaugeSectionH = gaugeR * 2 + 32
  const barW = 10
  const barX = panelX + 6
  const barCx = barX + barW / 2
  const barY = panelY + 20
  const barH = panelH - gaugeSectionH - 20 - 12
  const gaugeCx = panelX + panelW / 2
  const gaugeCy = panelY + panelH - gaugeR - 12

  // Spawn rate: up to 40 particles/s at 100% efficiency
  const spawnRate = solarEfficiency * 40
  const spawnCount = spawnRate * realDt_s
  const whole = Math.floor(spawnCount)
  const frac = spawnCount - whole
  const toSpawn = whole + (Math.random() < frac ? 1 : 0)

  for (let i = 0; i < toSpawn; i++) {
    // Random offset near gauge center
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * 8
    solarParticles.push({
      x: gaugeCx + Math.cos(angle) * r,
      y: gaugeCy + Math.sin(angle) * r,
      targetX: barCx + (Math.random() - 0.5) * 10,
      targetY: barY + Math.random() * barH * (1 - shipEnergy / SOLAR_MAX_ENERGY),
      age: 0,
      duration: 0.4 + Math.random() * 0.35,
      alpha: 0.6 + Math.random() * 0.4,
      size: 1 + Math.random() * 1.5,
    })
  }

  // Tick existing particles
  for (let i = solarParticles.length - 1; i >= 0; i--) {
    const p = solarParticles[i]
    p.age += realDt_s
    if (p.age >= p.duration) {
      solarParticles.splice(i, 1)
    }
  }
}

function simStep(dt_yr, realDt_s) {
  if (captureCooldown > 0) captureCooldown -= realDt_s
  updateSolarCharge(realDt_s)

  const boost = settings.settings.orbit.planetGravBoost

  if (orbitState.mode === 'free') {
    applyShipInput(dt_yr, realDt_s)
    applyBlackHoleGravityLocal(bodies, dt_yr)
    applySolarGravityWell(bodies, dt_yr)
    applyGasCloudDrag(bodies, dt_yr)
    applyInterPlanetGravityLocal(bodies, dt_yr, boost)
    gravityStep(bodies, dt_yr)
    resolveBodyDestruction()
    checkOrbitCapture(dt_yr)
  } else if (orbitState.mode === 'capturing') {
    stepSystemWhileShipAutopilots(dt_yr, boost)
    updateCapture(dt_yr, realDt_s)
  } else if (orbitState.mode === 'slingshot') {
    stepSystemWhileShipAutopilots(dt_yr, boost)
    const planet = orbitState.planet
    if (planet && ship) {
      const offset = orbitState.shipOffset || getDockedShipOffset(planet)
      ship.x = planet.x + offset.dx
      ship.y = planet.y + offset.dy
      ship.vx = planet.vx
      ship.vy = planet.vy
    }
  }
}

// =============================================================================
// ORBIT CAPTURE LOGIC
// =============================================================================

function checkOrbitCapture(dt_yr) {
  if (!ship) return
  if (captureCooldown > 0) return
  if (isCaptureReleaseLocked()) return

  for (const body of bodies) {
    if (body.isFixed) continue
    if (body.id === 'sun') continue
    if (body.id === 'ship') continue
    // Can't dock with a body you haven't fully observed yet — finish the
    // first-contact scan first.
    if (!body.scanned) continue

    const { distancePct } = getApproachMatch(body)
    if (distancePct >= 1) {
      body.captureTimeInRange = (body.captureTimeInRange || 0) + dt_yr
      if (body.captureTimeInRange >= CAPTURE_DWELL_YR) {
        beginOrbitCapture(body)
        break
      }
    } else {
      body.captureTimeInRange = 0
    }
  }
}

function isCaptureReleaseLocked() {
  if (!captureReleaseLockPlanetId) return false

  const lockedPlanet = bodies.find((body) => body.id === captureReleaseLockPlanetId)
  if (!lockedPlanet) {
    captureReleaseLockPlanetId = null
    return false
  }

  const { dist, captureRingR } = getApproachMatch(lockedPlanet)
  if (dist > captureRingR * 2.5) {
    captureReleaseLockPlanetId = null
    return false
  }

  return true
}

function beginOrbitCapture(planet) {
  if (!ship || !planet) return

  const dx = ship.x - planet.x
  const dy = ship.y - planet.y
  const dockOffset = getDockedShipOffset(planet, dx, dy)
  const startRelVx = ship.vx - planet.vx
  const startRelVy = ship.vy - planet.vy

  orbitState = {
    mode: 'capturing',
    planet,
    shipOffset: { dx, dy },
    dockOffset,
    capture: {
      age: 0,
      simAge: 0,
      duration: CAPTURE_DURATION_S,
      startDx: dx,
      startDy: dy,
      startRelVx,
      startRelVy,
    },
  }

  orbitDrag = null
}

function updateCapture(dt_yr, realDt_s) {
  if (!ship || orbitState.mode !== 'capturing' || !orbitState.planet || !orbitState.capture) return

  const planet = orbitState.planet
  const capture = orbitState.capture
  capture.age += realDt_s
  capture.simAge += dt_yr

  const rawT = Math.min(1, capture.age / capture.duration)
  const t = easeInOutCubic(rawT)
  const driftDx = capture.startDx + capture.startRelVx * capture.simAge
  const driftDy = capture.startDy + capture.startRelVy * capture.simAge
  const dockOffset = orbitState.dockOffset || getDockedShipOffset(planet)

  orbitState.shipOffset = {
    dx: driftDx + (dockOffset.dx - driftDx) * t,
    dy: driftDy + (dockOffset.dy - driftDy) * t,
  }

  const prevX = ship.x
  const prevY = ship.y
  ship.x = planet.x + orbitState.shipOffset.dx
  ship.y = planet.y + orbitState.shipOffset.dy
  if (dt_yr > 0) {
    ship.vx = (ship.x - prevX) / dt_yr
    ship.vy = (ship.y - prevY) / dt_yr
  }

  if (rawT >= 1) {
    ship.x = planet.x + dockOffset.dx
    ship.y = planet.y + dockOffset.dy
    ship.vx = planet.vx
    ship.vy = planet.vy
    orbitState = {
      mode: 'slingshot',
      planet,
      shipOffset: { ...dockOffset },
    }
  }
}

function getDockedShipOffset(planet, fromDx = 1, fromDy = 0) {
  const dist = Math.sqrt(fromDx * fromDx + fromDy * fromDy)
  const angle = dist > 1e-6 ? Math.atan2(fromDy, fromDx) : 0
  const r = getSlingshotOrbitRadius(planet)
  return {
    dx: Math.cos(angle) * r,
    dy: Math.sin(angle) * r,
  }
}

// =============================================================================
// BREAK ORBIT
// =============================================================================

function breakOrbit(kick = true) {
  if (orbitState.mode !== 'slingshot' && orbitState.mode !== 'capturing') return

  if (kick && ship) {
    // Small random kick to break away
    const angle = Math.random() * Math.PI * 2
    ship.vx += Math.cos(angle) * 0.1
    ship.vy += Math.sin(angle) * 0.1
  }

  orbitState = { mode: 'free', planet: null, shipOffset: null }
  orbitDrag = null
  // Re-follow the ship after a slingshot, but don't override a deliberate
  // sun-center view (e.g. the player pressed Z before taking the shot).
  if (cam.focus !== 'sun') cam.focus = 'ship'
}

function updateOrbitAimFromMouse() {
  if (
    (orbitState.mode !== 'slingshot' && orbitState.mode !== 'capturing') ||
    !orbitState.planet ||
    !mouse.hasPosition
  ) {
    return
  }

  const planetScreen = worldToScreen(orbitState.planet.x, orbitState.planet.y)
  orbitDrag = {
    startX: planetScreen.x,
    startY: planetScreen.y,
    curX: mouse.x,
    curY: mouse.y,
  }
}

// =============================================================================
// SHOT FIRING
// =============================================================================

// Cancel zone: while connected to a planet, if the mouse sits within this many
// screen pixels of the planet's edge (i.e. the drag is tiny → near-zero power),
// a click CANCELS the shot instead of firing a useless dribble. The radius is the
// planet's on-screen radius plus a fixed margin so it's always clickable even for
// tiny planets. drawOrbitCue() shows a red ✕ when the mouse is in this zone.
const SHOT_CANCEL_MARGIN_PX = 26
function shotCancelRadiusPx(planet) {
  return planet.drawR * scale() + SHOT_CANCEL_MARGIN_PX
}
// True when the current aim (mouse vs planet) is inside the cancel zone.
function aimInCancelZone() {
  if (!orbitDrag || !orbitState.planet) return false
  const { startX, startY, curX, curY } = orbitDrag
  const d = Math.hypot(curX - startX, curY - startY)
  return d <= shotCancelRadiusPx(orbitState.planet)
}

// The energy the CURRENT aim would draw, as fractions of the storage bar, so the
// energy HUD can preview the cost. Returns null when not actively aiming a shot.
//   requested = what the drag asks for (uncapped, can exceed stored)
//   drawn     = what's actually spent (capped at stored energy)
// Both are 0..1 of SOLAR_MAX_ENERGY. The gap between them shows the player the
// shot is capping out at their stored power.
function currentShotDraw() {
  if (orbitState.mode !== 'slingshot' && orbitState.mode !== 'capturing') return null
  if (!orbitDrag || !orbitState.planet || aimInCancelZone()) return null
  const { startX, startY, curX, curY } = orbitDrag
  const dist = Math.hypot(curX - startX, curY - startY)
  if (dist < 2) return null
  const maxDrag = settings.settings.orbit.maxDrag
  const dragPower = Math.min(dist, maxDrag) / maxDrag // 0..1
  const requested = (dragPower * SOLAR_SHOT_COST) / SOLAR_MAX_ENERGY
  const drawn = Math.min(requested, shipEnergy / SOLAR_MAX_ENERGY)
  return { requested, drawn }
}

function fireShot() {
  if (orbitState.mode !== 'slingshot' && orbitState.mode !== 'capturing') return
  if (!orbitDrag) return
  const planet = orbitState.planet
  if (!planet) return

  const { startX, startY, curX, curY } = orbitDrag
  const ddx = curX - startX
  const ddy = curY - startY
  const dist = Math.sqrt(ddx * ddx + ddy * ddy)
  // Click inside the cancel zone (mouse near the planet → negligible power):
  // release the connection instead of firing. No random kick — this is a
  // deliberate cancel, so leave the ship where it is. Arm the release lock (as
  // firing does) so checkOrbitCapture can't instantly re-dock: the ship must
  // leave this planet's capture range before it can hook on again.
  if (dist <= shotCancelRadiusPx(planet)) {
    captureReleaseLockPlanetId = planet.id
    captureCooldown = 0.25
    breakOrbit(false)
    return
  }

  const maxDrag = settings.settings.orbit.maxDrag
  const clamped = Math.min(dist, maxDrag)
  // Classic pool: drag back, ball fires opposite — negate drag direction.
  const nx = -ddx / dist
  const ny = -ddy / dist

  const dragPower = clamped / maxDrag // 0..1 from drag distance
  // Clamp actual power to available energy fraction
  const energyFraction = Math.min(1, shipEnergy / SOLAR_SHOT_COST)
  const power = dragPower * energyFraction
  const energyCost = dragPower * SOLAR_SHOT_COST
  shipEnergy = Math.max(0, shipEnergy - energyCost)
  const dv = power * settings.settings.orbit.shotPower * 0.01
  totalEnergySpent += power * settings.settings.orbit.shotPower

  planet.vx += nx * dv
  planet.vy += ny * dv

  // Recoil to ship: opposite of planet impulse.
  const recoil = dv * settings.settings.orbit.recoilMult
  if (ship) {
    ship.vx -= nx * recoil
    ship.vy -= ny * recoil
  }

  captureReleaseLockPlanetId = planet.id
  captureCooldown = 0.25

  // Spawn shockwave — cone-shaped in the shot direction, smaller than before
  shockwaves.push({
    x: planet.x,
    y: planet.y,
    r: 0,
    maxR: planet.drawR * 80,
    alpha: 1.0,
    duration: 2.0,
    age: 0,
    color: planet.color,
    angle: Math.atan2(ny, nx), // shot direction
    coneHalf: Math.PI * 0.16, // ~29° half-angle
  })

  breakOrbit(false)
}

// =============================================================================
// BODY DESTRUCTION
// =============================================================================

function isOutsideBlackHoleCone(body) {
  const bh = settings.settings.blackhole
  const halfAngle = ((bh.coneHalfAngleDeg ?? 180) * Math.PI) / 180
  if (halfAngle >= Math.PI) return false // omnidirectional — never bounces
  const coneAngle = ((bh.coneAngleDeg ?? 0) * Math.PI) / 180
  const dx = body.x - BLACK_HOLE.x
  const dy = body.y - BLACK_HOLE.y
  const dist = Math.sqrt(dx * dx + dy * dy) + 1e-10
  const toBodyX = dx / dist
  const toBodyY = dy / dist
  const cosAngle = Math.cos(coneAngle) * toBodyX + Math.sin(coneAngle) * toBodyY
  return cosAngle < Math.cos(halfAngle)
}

function bouncePlanetOffBlackHole(body) {
  // Reflect the velocity component pointing toward the BH
  const dx = BLACK_HOLE.x - body.x
  const dy = BLACK_HOLE.y - body.y
  const dist = Math.sqrt(dx * dx + dy * dy) + 1e-10
  const nx = dx / dist
  const ny = dy / dist
  const dot = body.vx * nx + body.vy * ny
  // Only reflect if actually moving toward BH
  if (dot > 0) {
    body.vx -= 2 * dot * nx
    body.vy -= 2 * dot * ny
  }
  // Lose 30% speed on bounce
  body.vx *= 0.7
  body.vy *= 0.7
  // Push body out of capture radius to avoid re-triggering
  const pushDist = BLACK_HOLE.captureR * 1.1
  body.x = BLACK_HOLE.x - nx * pushDist
  body.y = BLACK_HOLE.y - ny * pushDist

  // Small omnidirectional bounce shockwave
  shockwaves.push({
    x: BLACK_HOLE.x,
    y: BLACK_HOLE.y,
    r: 0,
    maxR: BLACK_HOLE.captureR * 2.5,
    alpha: 0.8,
    duration: 0.6,
    age: 0,
    color: body.color,
  })
}

function resolveBodyDestruction() {
  const sun = bodies.find((b) => b.id === 'sun')
  for (let i = bodies.length - 1; i >= 0; i--) {
    const body = bodies[i]
    if (body.isFixed || body.id === 'sun') continue

    const bhDx = body.x - BLACK_HOLE.x
    const bhDy = body.y - BLACK_HOLE.y
    if (Math.sqrt(bhDx * bhDx + bhDy * bhDy) <= BLACK_HOLE.captureR) {
      if (isOutsideBlackHoleCone(body)) {
        bouncePlanetOffBlackHole(body)
      } else {
        consumeBodyInBlackHole(body, i)
      }
      continue
    }

    if (sun) {
      const sunDx = body.x - sun.x
      const sunDy = body.y - sun.y
      const sunCrashR = SUN_DESTRUCTION_R + body.drawR
      if (Math.sqrt(sunDx * sunDx + sunDy * sunDy) <= sunCrashR) {
        destroyBodyInSun(body, i)
      }
    }
  }
}

function consumeBodyInBlackHole(body, index) {
  bodies.splice(index, 1)
  if (body.id === 'ship') {
    ship = null
    shipLoss = 'BLACK HOLE'
    deathTextAge = 0
    deathFocus = { x: BLACK_HOLE.x, y: BLACK_HOLE.y }
    cam.focus = 'death'
    camTargetZoom = 80
    orbitState = { mode: 'free', planet: null, shipOffset: null }
    orbitDrag = null
  } else {
    blackHoleScore++
    const def = SOLAR_BODIES.find((d) => d.id === body.id)
    blackHoleConsumed.push({
      name: body.name,
      color: body.color,
      physR: def ? def.physR : body.drawR * 0.01,
    })
  }
  updateFinalScoreState()
  if (orbitState.planet === body) breakOrbit(false)

  shockwaves.push({
    x: BLACK_HOLE.x,
    y: BLACK_HOLE.y,
    r: 0,
    maxR: BLACK_HOLE.captureR * 3.8,
    alpha: 0.9,
    duration: 1.2,
    age: 0,
    color: '#ff8c00',
  })
}

function destroyBodyInSun(body, index) {
  bodies.splice(index, 1)
  if (body.id === 'ship') {
    ship = null
    shipLoss = 'SUN'
    deathTextAge = 0
    cam.focus = 'sun'
    camTargetZoom = 55
    orbitState = { mode: 'free', planet: null, shipOffset: null }
    orbitDrag = null
  } else {
    sunPenalty++
  }
  updateFinalScoreState()
  if (orbitState.planet === body) breakOrbit(false)
  spawnSunDebris(body)
}

function updateFinalScoreState() {
  finalScoreShown = blackHoleScore + sunPenalty >= TOTAL_PLANETS
}

function spawnSunDebris(body) {
  const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy)
  const nx = speed > 1e-6 ? body.vx / speed : 1
  const ny = speed > 1e-6 ? body.vy / speed : 0
  const px = -ny
  const py = nx
  const [r, g, b] = hexToRgb(body.color)

  for (let i = 0; i < DEBRIS_COUNT; i++) {
    const offsetR = body.drawR * Math.sqrt(Math.random()) * 0.9
    const offsetA = Math.random() * Math.PI * 2
    const kick = speed * (0.06 + Math.random() * 0.2)
    const side = speed * (Math.random() - 0.5) * 0.22
    debris.push({
      x: body.x + Math.cos(offsetA) * offsetR,
      y: body.y + Math.sin(offsetA) * offsetR,
      vx: body.vx * 0.5 + (nx * kick + px * side),
      vy: body.vy * 0.5 + (ny * kick + py * side),
      size: 1.0 + Math.random() * 2.0,
      age: 0,
      duration: 0.85 + Math.random() * 1.1,
      color: `${r},${g},${b}`,
      heat: 0.15 + Math.random() * 0.25,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 8,
    })
  }
}

// =============================================================================
// SPACESHIP INPUT
// =============================================================================

// Three steering modes drive the ship from W/A/S/D, selected via the Steering
// setting. Spacebar is a full retrograde brake in every mode.
//
//   Tank   — A/D rotate the ship; W thrusts along its heading; S brakes.
//   Screen — W/A/S/D push up/down/left/right in absolute screen space.
//   Drift  — relative to direction of travel: W prograde, S retrograde,
//            A/D thrust to port/starboard.
//
// The steering MATH lives in engine/steering.js (pure, unit-tested). The
// functions here are thin adapters: snapshot ship+input state, ask the engine
// what to do, then mutate the ship and spawn particles accordingly.

// Full retrograde brake, clamped so it can never push the ship past a standstill.
// Shared by the spacebar brake in all modes (and by Drift's S-alone input).
function applyRetrogradeBrake(dt_yr, thrust) {
  const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy)
  const maxBrakeDv = thrust * dt_yr
  if (speed > 1e-6 && maxBrakeDv > 0) {
    const retroAngle = Math.atan2(-ship.vy, -ship.vx)
    const brakeDv = Math.min(speed, maxBrakeDv)
    const brakePower = brakeDv / maxBrakeDv // safe: maxBrakeDv > 0 guarded above
    ship.vx -= (ship.vx / speed) * brakeDv
    ship.vy -= (ship.vy / speed) * brakeDv
    spawnThrustParticles(brakePower, retroAngle, dt_yr)
  }
  thrustActiveLastFrame = true
}

function applyShipInput(dt_yr, realDt_s) {
  if (!ship) return

  const result = computeThrust({
    vx: ship.vx,
    vy: ship.vy,
    shipAngle,
    keys,
    steering: settings.settings.ship.steering,
    thrust: settings.settings.ship.thrustAccel,
    dt_yr,
    realDt_s,
    turnSpeed: settings.settings.ship.turnSpeed,
  })

  // Heading always tracks the engine's decision (rotation, travel-align, etc.).
  shipAngle = result.shipAngle

  if (result.brake) {
    applyRetrogradeBrake(dt_yr, settings.settings.ship.thrustAccel)
    return
  }

  ship.vx += result.dvx
  ship.vy += result.dvy
  if (result.particle) {
    spawnThrustParticles(result.particle.power, result.particle.angle, dt_yr)
  }
  thrustActiveLastFrame = result.active
}

// Wraps the pure HUD classifier with the local ship/keys/steering snapshot.
function getThrustState() {
  if (!ship) return { mode: 'coast', power: 0 }
  return classifyThrust({ keys, steering: settings.settings.ship.steering })
}

// Each thrust particle: { x, y, vx, vy, age, duration, size, spread, burstId }
// All units in sim-time (AU, yr). Spawned each thrust frame, connected as a ribbon at draw time.
let thrustBurstId = 0
let thrustActiveLastFrame = false
function spawnThrustParticles(power, forceAngle, dt_yr) {
  if (!ship || power <= 0) return

  // Plume lifetime in SIM-years. Both aging and movement use sim-time, so the
  // plume is a fixed-length physical streak (exhaustSpeed × lifeYr AU) that looks
  // the same at every timescale — it adheres to sim time, not wall-clock.
  const lifeYr = 0.04 + power * 0.02

  // Density compensation: a frame advances dt_yr of sim-time, so emit more
  // particles when more sim-time passes to keep the ribbon evenly filled.
  // Floor at 1 so thrust always emits something.
  const densityTarget = 2
  const count = Math.min(4, Math.max(1, Math.ceil((dt_yr / lifeYr) * densityTarget)))

  const backX = -Math.cos(forceAngle)
  const backY = -Math.sin(forceAngle)
  const sideX = -backY
  const sideY = backX
  const s = Math.max(scale(), 1)
  const nozzleOffset = SHIP_DRAW_R * 0.5

  if (!thrustActiveLastFrame) thrustBurstId++
  thrustActiveLastFrame = true
  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * (0.04 + power * 0.055)
    const ex = backX * Math.cos(spread) + sideX * Math.sin(spread)
    const ey = backY * Math.cos(spread) + sideY * Math.sin(spread)
    // Exhaust speed in AU/yr — a physical constant, independent of timescale.
    // Faster exhaust = a longer, more energetic streak for the same lifetime.
    const exhaustSpeed = 1.8 + power * 4.6 + (Math.random() - 0.5) * (0.4 + power * 0.7)
    const sideKick = (Math.random() - 0.5) * power * 0.2
    const offset = ((Math.random() - 0.5) * 2.0) / s

    thrustParticles.push({
      x: ship.x + backX * nozzleOffset + sideX * offset,
      y: ship.y + backY * nozzleOffset + sideY * offset,
      // Absolute velocity = ship vel + exhaust relative vel
      vx: ship.vx + ex * exhaustSpeed + sideX * sideKick,
      vy: ship.vy + ey * exhaustSpeed + sideY * sideKick,
      age: 0,
      duration: lifeYr * (0.8 + Math.random() * 0.4), // sim-years
      // Thinner plume — smaller base + power scaling.
      size: 0.3 + power * 0.4 + Math.random() * 0.15,
      spread,
      burstId: thrustBurstId,
    })
  }

  if (thrustParticles.length > 800) {
    thrustParticles.splice(0, thrustParticles.length - 800)
  }
}

// =============================================================================
// PATH PREDICTION — ship (ghost simulation, no side effects)
// =============================================================================

function computePrediction() {
  if (!ship) return []
  if (orbitState.mode !== 'free') return []
  if (shouldHidePredictionWhileBraking()) return []

  return computeProjectedPath({
    targetId: 'ship',
    targetBody: ship,
    gravityBoost: settings.settings.orbit.planetGravBoost,
  })
}

function makePredictionGhosts() {
  return bodies.map((b) => ({
    id: b.id,
    x: b.x,
    y: b.y,
    vx: b.vx,
    vy: b.vy,
    mass: b.mass,
    isFixed: b.isFixed,
    isPlanet: b.isPlanet,
  }))
}

function computeProjectedPath({
  targetId,
  targetBody,
  applyInitialImpulse = null,
  gravityBoost = 1,
}) {
  const ghosts = makePredictionGhosts()
  const targetIdx = ghosts.findIndex((g) => g.id === targetId)
  if (targetIdx < 0) return []

  if (applyInitialImpulse) applyInitialImpulse(ghosts[targetIdx])

  const path = [{ x: ghosts[targetIdx].x, y: ghosts[targetIdx].y, t: 0 }]
  const targetWorldSegment = PRED_TARGET_SEGMENT_PX / Math.max(scale(), 0.0001)
  const ghostSun = ghosts.find((g) => g.id === 'sun')
  const crashRadius = getPredictionCrashRadius(targetBody)
  let elapsed = 0
  let step = 0
  let lastX = ghosts[targetIdx].x
  let lastY = ghosts[targetIdx].y

  while (elapsed < PRED_HORIZON_YR && step < PRED_MAX_STEPS) {
    const target = ghosts[targetIdx]
    const speed = Math.sqrt(target.vx * target.vx + target.vy * target.vy)
    const speedDt = speed > 1e-6 ? targetWorldSegment / speed : PRED_BASE_DT_YR
    const predDt = Math.min(PRED_BASE_DT_YR, speedDt, PRED_HORIZON_YR - elapsed)

    applyBlackHoleGravityLocal(ghosts, predDt)
    applySolarGravityWell(ghosts, predDt)
    applyGasCloudDrag(ghosts, predDt)
    applyInterPlanetGravityLocal(ghosts, predDt, gravityBoost)
    gravityStep(ghosts, predDt)
    elapsed += predDt

    const t = elapsed / PRED_HORIZON_YR
    if (
      isPredictionInBlackHole(ghosts[targetIdx]) ||
      isPredictionInSun(ghosts[targetIdx], ghostSun, crashRadius)
    ) {
      path.push({ x: ghosts[targetIdx].x, y: ghosts[targetIdx].y, t })
      break
    }

    const dx = ghosts[targetIdx].x - lastX
    const dy = ghosts[targetIdx].y - lastY
    if (Math.sqrt(dx * dx + dy * dy) >= targetWorldSegment * 0.6) {
      path.push({ x: ghosts[targetIdx].x, y: ghosts[targetIdx].y, t })
      lastX = ghosts[targetIdx].x
      lastY = ghosts[targetIdx].y
    }

    step++
  }

  const tail = path[path.length - 1]
  const end = ghosts[targetIdx]
  if (!tail || tail.x !== end.x || tail.y !== end.y)
    path.push({ x: end.x, y: end.y, t: elapsed / PRED_HORIZON_YR })

  return path
}

function isPredictionInBlackHole(predictedShip) {
  const bh = settings.settings.blackhole
  if (!bh || bh.mass <= 0) return false

  const dx = predictedShip.x - BLACK_HOLE.x
  const dy = predictedShip.y - BLACK_HOLE.y
  return Math.sqrt(dx * dx + dy * dy) <= BLACK_HOLE.captureR
}

function isPredictionInSun(predictedBody, predictedSun, crashRadius) {
  if (!predictedSun) return false

  const dx = predictedBody.x - predictedSun.x
  const dy = predictedBody.y - predictedSun.y
  return Math.sqrt(dx * dx + dy * dy) <= crashRadius
}

function getPredictionCrashRadius(body) {
  return SUN_DESTRUCTION_R + (body?.drawR || 0)
}

function shouldHidePredictionWhileBraking() {
  if (!ship) return false
  const state = getThrustState()
  if (state.mode !== 'brake') return false

  const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy)
  return speed < 0.35
}

// =============================================================================
// PLANET POST-SHOT PREDICTION
// =============================================================================

function computeShotPrediction(planet, nx, ny, dv) {
  if (!planet) return []

  return computeProjectedPath({
    targetId: planet.id,
    targetBody: planet,
    applyInitialImpulse(target) {
      target.vx += nx * dv
      target.vy += ny * dv
    },
  })
}

// =============================================================================
// SCENE SETUP
// =============================================================================

function buildScene(w, h) {
  bodies = []
  resetFog()
  buildStarfield(w, h)
  shipAngle = -Math.PI / 2
  shipPredPath = []
  debris = []
  thrustParticles = []
  solarParticles = []
  blackHoleScore = 0
  blackHoleConsumed = []
  sunPenalty = 0
  totalEnergySpent = 0
  shipEnergy = 30
  solarEfficiency = 0
  finalScoreShown = false
  shipLoss = null
  deathFocus = null
  deathTextAge = 0
  orbitState = { mode: 'free', planet: null, shipOffset: null }
  orbitDrag = null
  captureCooldown = 0
  captureReleaseLockPlanetId = null
  camTargetZoom = cam.zoom

  for (const bd of SOLAR_BODIES) {
    const r = bd.orbR
    let x = 0,
      y = 0,
      vx = 0,
      vy = 0

    if (!bd.isFixed && r > 0) {
      const a = bd.angle
      const v = Math.sqrt((G_SIM * 1.0) / r)
      x = Math.cos(a) * r
      y = Math.sin(a) * r
      vx = -Math.sin(a) * v
      vy = Math.cos(a) * v
    }

    bodies.push({
      id: bd.id,
      name: bd.name,
      x,
      y,
      vx,
      vy,
      mass: bd.mass,
      drawR: bd.drawR,
      color: bd.color,
      isFixed: bd.isFixed,
      isPlanet: !bd.isFixed && bd.id !== 'ship',
      captureTimeInRange: 0,
      detected: false, // radar: sticky once the sweep line crosses this body
      scanned: false, // sticky once first-contact observation completes (name + details unlock)
      scanProgress: 0, // sim-years accumulated observing this body (→ scanned at SCAN_DURATION_SIMYR)
      trail: makeTrail(bd.isFixed ? 0 : settings.settings.visuals.trailLength),
    })
  }

  // Ship: start behind Mars but well OUTSIDE scanner range (so the player
  // witnesses first-contact observation when they approach), with a slight
  // catch-up velocity. 0.45 rad of arc at Mars's radius is ~0.68 AU — comfortably
  // beyond the scan range (~0.4 AU).
  const marsDef = SOLAR_BODIES.find((b) => b.id === 'mars')
  const shipR = marsDef.orbR
  const shipA = marsDef.angle - 0.45
  const shipOrb = Math.sqrt((G_SIM * 1.0) / shipR) * 1.025
  ship = {
    id: 'ship',
    name: 'Ship',
    x: Math.cos(shipA) * shipR,
    y: Math.sin(shipA) * shipR,
    vx: -Math.sin(shipA) * shipOrb,
    vy: Math.cos(shipA) * shipOrb,
    mass: SHIP_MASS,
    drawR: SHIP_LENGTH_AU / 2,
    color: '#4fc3f7',
    isFixed: false,
    trail: makeTrail(settings.settings.visuals.trailLength),
  }
  bodies.push(ship)

  cam.panX = w / 2
  cam.panY = h / 2
  cam.focus = 'ship'
  cam.zoom = 4
  camTargetZoom = 4
}

// =============================================================================
// CAMERA HELPERS
// =============================================================================

function scale() {
  return cam.zoom * PX_PER_AU
}

function worldToScreen(wx, wy) {
  const s = scale()
  return { x: wx * s + cam.panX, y: wy * s + cam.panY }
}

function zoomAt(factor, mx, my) {
  const s0 = scale()
  const wx = (mx - cam.panX) / s0
  const wy = (my - cam.panY) / s0
  cam.zoom = Math.max(0.004, Math.min(200000, cam.zoom * factor))
  camTargetZoom = cam.zoom
  const s1 = scale()
  cam.panX = mx - wx * s1
  cam.panY = my - wy * s1
}

function applyFocusMode(w, h) {
  // Animate zoom toward target
  cam.zoom += (camTargetZoom - cam.zoom) * 0.08

  if (!ship && deathFocus) cam.focus = 'death'
  else if (!ship && shipLoss === 'SUN') cam.focus = 'sun'

  if (cam.focus === 'sun') {
    cam.panX = w / 2
    cam.panY = h / 2
  } else if (cam.focus === 'death' && deathFocus) {
    const s = scale()
    cam.panX = w / 2 - deathFocus.x * s
    cam.panY = h / 2 - deathFocus.y * s
  } else if (cam.focus === 'ship' && ship) {
    const s = scale()
    cam.panX = w / 2 - ship.x * s
    cam.panY = h / 2 - ship.y * s
  } else if (cam.focus === 'orbit' && orbitState.planet) {
    const s = scale()
    const p = orbitState.planet
    cam.panX = w / 2 - p.x * s
    cam.panY = h / 2 - p.y * s
  }
}

// =============================================================================
// STARFIELD
// =============================================================================

function wrap(value, max) {
  return ((value % max) + max) % max
}

// Pixels of parallax drift per AU the camera center moves through the world.
// Driving parallax from the camera's WORLD center (not cam.panX) keeps it
// anchored to whatever the camera follows — ship, sun, or planet — and makes it
// independent of zoom and the screen-center constant baked into cam.panX.
const PARALLAX_GAIN = 120

function drawStarfield(ctx, w, h) {
  if (!starLayers.length) buildStarfield(w, h)

  const t = Date.now() / 1000

  // World point currently at the center of the screen (inverse of worldToScreen).
  const s = scale()
  const camWorldX = (w / 2 - cam.panX) / s
  const camWorldY = (h / 2 - cam.panY) / s
  // Parallax basis in pixels: how far the followed target has moved through space.
  const parX = camWorldX * PARALLAX_GAIN
  const parY = camWorldY * PARALLAX_GAIN

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#01020a'
  ctx.fillRect(0, 0, w, h)
  ctx.restore()

  // Hubble photo backdrop over the black base (so seen space reads differently
  // from fog). Drawn before nebula/stars so they layer on top of it. Parallax
  // basis (parX/parY) gives it a pronounced drift.
  drawHubbleBackdrop(ctx, w, h, parX, parY)

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // --- Nebula clouds ---
  ctx.globalCompositeOperation = 'screen'
  for (const cloud of nebulaClouds) {
    const zoomDrift = Math.log2(Math.max(cam.zoom, 0.004) / 0.33) * 18 * cloud.depth
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
    const zoomDrift = Math.log2(Math.max(cam.zoom, 0.004) / 0.33) * 18 * layer.depth
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
      halo.addColorStop(0, `rgba(${star.color},${(alpha * (layer.hero ? 0.55 : 0.2)).toFixed(3)})`)
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

// =============================================================================
// ORBIT CIRCLES
// =============================================================================

function drawOrbits(ctx) {
  const s = scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'
  ctx.lineWidth = 0.5 / s

  for (const bd of SOLAR_BODIES) {
    if (bd.orbR === 0) continue
    ctx.beginPath()
    ctx.arc(0, 0, bd.orbR, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

// =============================================================================
// BLACK HOLE
// =============================================================================

function drawBlackHole(ctx) {
  const bh = settings.settings.blackhole
  if (!bh || bh.mass <= 0) return

  const s = scale()
  const influenceR = bh.influenceRadius
  const coreR = BLACK_HOLE.drawR
  const outerR = Math.max(influenceR, coreR * 1.25)
  const coneAngle = ((bh.coneAngleDeg ?? 0) * Math.PI) / 180
  const halfAngle = ((bh.coneHalfAngleDeg ?? 180) * Math.PI) / 180
  const isCone = halfAngle < Math.PI
  const cx = BLACK_HOLE.x
  const cy = BLACK_HOLE.y
  const now = Date.now()

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)

  if (isCone) {
    // Clip all influence drawing to the cone wedge
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, outerR * 1.05, coneAngle - halfAngle, coneAngle + halfAngle)
    ctx.closePath()
    ctx.clip()

    // Cone fill — fades from core outward
    const grad = ctx.createRadialGradient(cx, cy, coreR, cx, cy, outerR)
    grad.addColorStop(0, 'rgba(255,100,0,0.18)')
    grad.addColorStop(0.5, 'rgba(255,80,0,0.07)')
    grad.addColorStop(1, 'rgba(255,60,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
    ctx.fill()

    // Concentric arcs clipped to cone
    const ringCount = 10
    for (let i = 1; i <= ringCount; i++) {
      const t = i / ringCount
      const r = coreR + (outerR - coreR) * Math.pow(t, 1.6)
      const edgePulse = i === ringCount ? 0.06 + 0.04 * Math.sin(now / 300) : 0
      const alpha = (0.2 * (1 - t * 0.75) + edgePulse).toFixed(3)
      ctx.strokeStyle = `rgba(255,140,0,${alpha})`
      ctx.lineWidth = (i === ringCount ? 1.1 : 0.6) / s
      ctx.beginPath()
      ctx.arc(cx, cy, r, coneAngle - halfAngle, coneAngle + halfAngle)
      ctx.stroke()
    }

    // Spokes within the cone
    const spokeCount = 10
    for (let i = 0; i <= spokeCount; i++) {
      const a = coneAngle - halfAngle + (i / spokeCount) * halfAngle * 2
      const cosA = Math.cos(a)
      const sinA = Math.sin(a)
      // Angular factor: 1 at center axis, 0 at edges
      const angDist = Math.abs(a - coneAngle) / halfAngle
      const spokeAlpha = (1 - angDist * angDist) * 0.18
      if (spokeAlpha < 0.01) continue
      const sg = ctx.createLinearGradient(
        cx + cosA * coreR,
        cy + sinA * coreR,
        cx + cosA * outerR,
        cy + sinA * outerR,
      )
      sg.addColorStop(0, `rgba(255,140,0,${spokeAlpha})`)
      sg.addColorStop(0.6, `rgba(255,100,0,${(spokeAlpha * 0.4).toFixed(3)})`)
      sg.addColorStop(1, 'rgba(255,80,0,0.12)')
      ctx.strokeStyle = sg
      ctx.lineWidth = 0.6 / s
      ctx.beginPath()
      ctx.moveTo(cx + cosA * coreR, cy + sinA * coreR)
      ctx.lineTo(cx + cosA * outerR, cy + sinA * outerR)
      ctx.stroke()
    }

    ctx.restore() // end clip

    // Cone edge lines (drawn outside clip so they go all the way to the boundary)
    const edgeAlpha = 0.45
    for (const sign of [-1, 1]) {
      const edgeA = coneAngle + sign * halfAngle
      ctx.strokeStyle = `rgba(255,140,0,${edgeAlpha})`
      ctx.lineWidth = 1 / s
      ctx.setLineDash([0.025, 0.03])
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(edgeA) * coreR, cy + Math.sin(edgeA) * coreR)
      ctx.lineTo(cx + Math.cos(edgeA) * outerR, cy + Math.sin(edgeA) * outerR)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Arc cap at the influence radius boundary
    ctx.strokeStyle = `rgba(255,140,0,0.22)`
    ctx.lineWidth = 1 / s
    ctx.setLineDash([0.025, 0.03])
    ctx.beginPath()
    ctx.arc(cx, cy, influenceR, coneAngle - halfAngle, coneAngle + halfAngle)
    ctx.stroke()
    ctx.setLineDash([])
  } else {
    // Full sphere fallback — original omnidirectional look
    ctx.setLineDash([0.035, 0.035])
    ctx.strokeStyle = 'rgba(255,140,0,0.2)'
    ctx.lineWidth = 1 / s
    ctx.beginPath()
    ctx.arc(cx, cy, influenceR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    const ringCount = 12
    for (let i = 1; i <= ringCount; i++) {
      const t = i / ringCount
      const r = coreR + (outerR - coreR) * Math.pow(t, 1.8)
      const edgePulse = i === ringCount ? 0.08 + 0.04 * Math.sin(now / 300) : 0
      ctx.strokeStyle = `rgba(255,140,0,${(0.22 * (1 - t * 0.78) + edgePulse).toFixed(3)})`
      ctx.lineWidth = (i === ringCount ? 1.15 : 0.7) / s
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    const spokeCount = 12
    for (let i = 0; i < spokeCount; i++) {
      const a = (i / spokeCount) * Math.PI * 2
      const cos = Math.cos(a)
      const sin = Math.sin(a)
      const sg = ctx.createLinearGradient(
        cx + cos * coreR,
        cy + sin * coreR,
        cx + cos * outerR,
        cy + sin * outerR,
      )
      sg.addColorStop(0, 'rgba(255,140,0,0.12)')
      sg.addColorStop(0.72, 'rgba(255,140,0,0.045)')
      sg.addColorStop(1, 'rgba(255,140,0,0.16)')
      ctx.strokeStyle = sg
      ctx.lineWidth = 0.7 / s
      ctx.beginPath()
      ctx.moveTo(cx + cos * coreR, cy + sin * coreR)
      ctx.lineTo(cx + cos * outerR, cy + sin * outerR)
      ctx.stroke()
    }

    const glow = ctx.createRadialGradient(cx, cy, coreR * 0.8, cx, cy, coreR * 3.4)
    glow.addColorStop(0, 'rgba(255,140,0,0.62)')
    glow.addColorStop(0.42, 'rgba(180,60,0,0.28)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, coreR * 3.4, 0, Math.PI * 2)
    ctx.fill()
  }

  // Core — always drawn (glow + dark disc)
  const coreGlow = ctx.createRadialGradient(cx, cy, coreR * 0.8, cx, cy, coreR * 3.4)
  coreGlow.addColorStop(0, 'rgba(255,140,0,0.62)')
  coreGlow.addColorStop(0.42, 'rgba(180,60,0,0.28)')
  coreGlow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = coreGlow
  ctx.beginPath()
  ctx.arc(cx, cy, coreR * 3.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#020202'
  ctx.strokeStyle = 'rgba(255,180,80,0.35)'
  ctx.lineWidth = 1 / s
  ctx.beginPath()
  ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.restore()
}

function drawSolarGravityWell(ctx) {
  const sun = bodies.find((b) => b.id === 'sun')
  if (!sun) return

  const s = scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)

  const ringCount = 5
  for (let i = 1; i <= ringCount; i++) {
    const t = i / ringCount
    const r = SUN_DESTRUCTION_R + (SUN_GRAVITY_WELL_R - SUN_DESTRUCTION_R) * t * t
    ctx.strokeStyle = `rgba(255,210,80,${(0.16 * (1 - t * 0.7)).toFixed(3)})`
    ctx.lineWidth = 0.8 / s
    ctx.beginPath()
    ctx.arc(sun.x, sun.y, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(255,80,40,0.34)'
  ctx.lineWidth = 1.4 / s
  ctx.beginPath()
  ctx.arc(sun.x, sun.y, SUN_DESTRUCTION_R, 0, Math.PI * 2)
  ctx.stroke()

  ctx.restore()
}

function drawGasCloud(ctx) {
  const s = scale()
  const t = Date.now() / 1000
  const { x1, y1, x2, y2, r, color } = GAS_CLOUD

  // Spine geometry: unit direction along the line + its perpendicular.
  const sx = x2 - x1
  const sy = y2 - y1
  const len = Math.hypot(sx, sy) || 1
  const ux = sx / len
  const uy = sy / len
  const px = -uy // perpendicular (across the cloud's width)
  const py = ux

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.globalCompositeOperation = 'screen'

  // Soft body — many overlapping radial puffs strung ALONG the spine and jittered
  // across its width so the cloud reads as a turbulent, billowing streak rather
  // than a disc or a hard tube. Puff size swells toward the middle and tapers at
  // the ends (a wispy capsule). Drift is animated so the gas churns slowly.
  const PUFFS = 22
  for (let i = 0; i < PUFFS; i++) {
    const f = PUFFS === 1 ? 0.5 : i / (PUFFS - 1) // 0..1 along the spine
    // Taper the radius toward the two ends so the streak feathers out.
    const taper = 0.45 + 0.55 * Math.sin(Math.PI * f)
    // Deterministic-ish pseudo-offsets per puff, animated by time.
    const acrossPhase = t * 0.22 + i * 2.3
    const alongPhase = t * 0.17 + i * 1.1
    const across = Math.sin(acrossPhase) * 0.55 * r // jitter across width
    const along = Math.cos(alongPhase) * 0.06 * len // jitter along length
    const bx = x1 + ux * (f * len + along) + px * across
    const by = y1 + uy * (f * len + along) + py * across
    const br = r * (0.55 + 0.55 * taper) * (0.85 + 0.3 * Math.sin(i * 1.9))
    const a = 0.1 * taper + 0.04
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br)
    grad.addColorStop(0, `rgba(${color},${a.toFixed(3)})`)
    grad.addColorStop(0.5, `rgba(${color},${(a * 0.45).toFixed(3)})`)
    grad.addColorStop(1, `rgba(${color},0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(bx, by, br, 0, Math.PI * 2)
    ctx.fill()
  }

  // Faint capsule boundary so the drag region is legible: two parallel edges
  // offset by r, capped by semicircles at each end.
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = `rgba(${color},0.16)`
  ctx.lineWidth = 1 / s
  ctx.setLineDash([6 / s, 6 / s])
  const startAng = Math.atan2(py, px)
  ctx.beginPath()
  ctx.moveTo(x1 + px * r, y1 + py * r)
  ctx.lineTo(x2 + px * r, y2 + py * r)
  ctx.arc(x2, y2, r, startAng, startAng - Math.PI, true)
  ctx.lineTo(x1 - px * r, y1 - py * r)
  ctx.arc(x1, y1, r, startAng - Math.PI, startAng, true)
  ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])

  ctx.restore()
}

// Local gas density at a world point: 1 on the cloud's spine → 0 at its edge.
function gasCloudDensityAt(x, y) {
  const dist = gasCloudSpineClosest(x, y).dist
  if (dist >= GAS_CLOUD.r) return 0
  const e = 1 - dist / GAS_CLOUD.r
  return e * e * (3 - 2 * e) // smoothstep
}

// Re-entry-style drag flare: a hot bow-shock on the LEADING edge (relative to
// velocity) of any body plowing through the gas cloud — like a heat shield. The
// intensity tracks aerodynamic heating (~ speed × local density).
function drawGasCloudFriction(ctx) {
  const s = scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.globalCompositeOperation = 'lighter'

  for (const body of bodies) {
    if (body.isFixed) continue
    const density = gasCloudDensityAt(body.x, body.y)
    if (density <= 0.001) continue

    const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy)
    if (speed < 0.05) continue

    // Heating rises with speed and how deep into the cloud the body is.
    const heat = Math.min(1, speed * density * 0.16)
    if (heat < 0.02) continue

    // Velocity-facing (leading) direction.
    const vx = body.vx / speed
    const vy = body.vy / speed
    // The ship renders at a fixed icon size (SHIP_DRAW_R), not its tiny physical
    // drawR — match that so its flare is visible.
    const r = body.id === 'ship' ? SHIP_DRAW_R : body.drawR
    // Flare sits just ahead of the body on its leading edge.
    const lead = r * 0.9
    const fx = body.x + vx * lead
    const fy = body.y + vy * lead

    // Bright bow-shock arc across the leading edge.
    const headAngle = Math.atan2(vy, vx)
    const arcR = r * (1.5 + heat * 0.8)
    ctx.lineWidth = (0.6 + heat * 1.4) * r * 0.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = `rgba(255,235,200,${(0.6 * heat).toFixed(3)})`
    ctx.beginPath()
    ctx.arc(body.x, body.y, arcR, headAngle - 1.0, headAngle + 1.0)
    ctx.stroke()

    // A short wake streak trailing back from the shoulders (optional, subtle).
    const tailLen = r * (2 + heat * 4)
    const tg = ctx.createLinearGradient(fx, fy, fx - vx * tailLen, fy - vy * tailLen)
    tg.addColorStop(0, `rgba(255,160,70,${(0.22 * heat).toFixed(3)})`)
    tg.addColorStop(1, 'rgba(255,80,30,0)')
    ctx.strokeStyle = tg
    ctx.lineWidth = arcR * 0.5
    ctx.beginPath()
    ctx.moveTo(body.x, body.y)
    ctx.lineTo(body.x - vx * tailLen, body.y - vy * tailLen)
    ctx.stroke()
  }

  ctx.restore()
}

// =============================================================================
// =============================================================================
// CAPTURE TETHER
// =============================================================================

function getApproachMatch(body) {
  if (!ship || !body) return { dist: Infinity, distancePct: 0, captureRingR: 0 }

  const captureRingR = settings.settings.orbit.ringRadiusMult
  const dx = ship.x - body.x
  const dy = ship.y - body.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const distancePct = Math.max(0, Math.min(1, 1 - (dist - captureRingR) / (captureRingR * 1.5)))

  return { dist, distancePct, captureRingR }
}

function drawCaptureTether(ctx) {
  if (!ship) return

  let planet =
    orbitState.mode === 'slingshot' || orbitState.mode === 'capturing' ? orbitState.planet : null
  let rangeGlow = orbitState.mode === 'slingshot' ? 1 : orbitState.mode === 'capturing' ? 0.85 : 0
  let lockGlow = rangeGlow

  if (!planet) {
    for (const body of bodies) {
      if (body.isFixed || body.id === 'sun' || body.id === 'ship') continue
      const { dist, distancePct, captureRingR } = getApproachMatch(body)
      if (dist > captureRingR * 2.5) continue
      if (distancePct > rangeGlow) {
        rangeGlow = distancePct
        lockGlow = distancePct
        planet = body
      }
    }
  }

  if (!planet || rangeGlow <= 0) return

  const s = scale()
  const [r, g, b] = hexToRgb(planet.color)
  const now = Date.now()
  const pulse =
    orbitState.mode === 'slingshot'
      ? 0.9 + 0.1 * Math.sin(now / 180)
      : orbitState.mode === 'capturing'
        ? 0.75 + 0.2 * Math.sin(now / 110)
        : rangeGlow * (0.82 + 0.18 * Math.sin(now / 150))
  const alpha = 0.04 + pulse * 0.58 + lockGlow * 0.18

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.lineCap = 'round'

  const dx = planet.x - ship.x
  const dy = planet.y - ship.y
  const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6)
  const nx = dx / dist
  const ny = dy / dist
  const px = -ny
  const py = nx
  const startW = Math.max(2.2 / s, dist * 0.005)
  const endW = Math.min(dist * (0.04 + rangeGlow * 0.055), 0.075)
  const scan = Math.sin(now / 360)

  const grad = ctx.createLinearGradient(ship.x, ship.y, planet.x, planet.y)
  grad.addColorStop(0, `rgba(79,195,247,${alpha * 0.16})`)
  grad.addColorStop(0.35, `rgba(79,195,247,${alpha * 0.36})`)
  grad.addColorStop(1, `rgba(${r},${g},${b},${alpha * 0.72})`)

  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(ship.x + px * startW, ship.y + py * startW)
  ctx.lineTo(planet.x + px * endW, planet.y + py * endW)
  ctx.lineTo(planet.x - px * endW, planet.y - py * endW)
  ctx.lineTo(ship.x - px * startW, ship.y - py * startW)
  ctx.closePath()
  ctx.fill()

  ctx.shadowColor = planet.color
  ctx.shadowBlur = (4 + pulse * 18 + lockGlow * 10) / s
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.1 + rangeGlow * 0.28 + lockGlow * 0.18})`
  ctx.lineWidth = (0.7 + rangeGlow * 1.3 + lockGlow * 0.8) / s
  ctx.beginPath()
  ctx.moveTo(ship.x + px * startW, ship.y + py * startW)
  ctx.lineTo(planet.x + px * endW, planet.y + py * endW)
  ctx.moveTo(ship.x - px * startW, ship.y - py * startW)
  ctx.lineTo(planet.x - px * endW, planet.y - py * endW)
  ctx.stroke()

  if (orbitState.mode === 'free') {
    ctx.shadowBlur = 0
    ctx.strokeStyle = `rgba(255,255,255,${0.16 + rangeGlow * 0.32 + lockGlow * 0.2})`
    ctx.lineWidth = (0.8 + rangeGlow * 0.9) / s
    ctx.beginPath()
    ctx.moveTo(ship.x, ship.y)
    ctx.lineTo(planet.x + px * endW * scan, planet.y + py * endW * scan)
    ctx.stroke()
  }

  ctx.shadowBlur = 0
  ctx.strokeStyle = `rgba(255,255,255,${0.08 + pulse * 0.18 + lockGlow * 0.14})`
  ctx.lineWidth = 0.7 / s
  ctx.beginPath()
  ctx.moveTo(ship.x, ship.y)
  ctx.lineTo(planet.x, planet.y)
  ctx.stroke()

  ctx.restore()
}

// =============================================================================
// SLINGSHOT ORBIT GLOW RING
// =============================================================================

function drawSlingshotRing(ctx) {
  if ((orbitState.mode !== 'slingshot' && orbitState.mode !== 'capturing') || !orbitState.planet)
    return
  const planet = orbitState.planet
  const ringMult = settings.settings.orbit.ringRadiusMult
  const captureRingR = ringMult
  const s = scale()
  const [r, g, b] = hexToRgb(planet.color)

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)

  // Pulsing glow ring — use sin of a timer
  const pulse = 0.4 + 0.25 * Math.sin(Date.now() / 400)

  ctx.strokeStyle = `rgba(${r},${g},${b},${pulse})`
  ctx.lineWidth = 2 / s
  ctx.shadowBlur = 8 / s
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
  if (orbitState.mode !== 'slingshot' && orbitState.mode !== 'capturing') return
  if (!orbitDrag) return
  const planet = orbitState.planet
  if (!planet) return

  const { startX, startY, curX, curY } = orbitDrag
  const ddx = curX - startX
  const ddy = curY - startY
  const dist = Math.sqrt(ddx * ddx + ddy * ddy)

  // Mouse in the cancel zone (near the planet): clicking will RELEASE the
  // connection, not fire. Show a red ✕ + ring so the player knows, and skip the
  // aiming cue entirely (there's no meaningful shot to preview here).
  if (aimInCancelZone()) {
    const sp = worldToScreen(planet.x, planet.y)
    const rad = shotCancelRadiusPx(planet)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.strokeStyle = 'rgba(255,80,80,0.9)'
    ctx.fillStyle = 'rgba(255,80,80,0.9)'
    ctx.lineWidth = 2
    // Dashed cancel ring marking the zone boundary.
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, rad, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    // ✕ glyph centred on the planet.
    const x = 9
    ctx.beginPath()
    ctx.moveTo(sp.x - x, sp.y - x)
    ctx.lineTo(sp.x + x, sp.y + x)
    ctx.moveTo(sp.x + x, sp.y - x)
    ctx.lineTo(sp.x - x, sp.y + x)
    ctx.stroke()
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('RELEASE', sp.x, sp.y + rad + 14)
    ctx.restore()
    return
  }
  if (dist < 2) return

  const maxDrag = settings.settings.orbit.maxDrag
  const clamped = Math.min(dist, maxDrag)
  // Drag direction (toward mouse). Shot fires opposite — classic pool.
  const dragNx = ddx / dist
  const dragNy = ddy / dist
  const shotNx = -dragNx
  const shotNy = -dragNy
  const dragPower = clamped / maxDrag // 0..1 from drag
  const energyFraction = Math.min(1, shipEnergy / SOLAR_SHOT_COST)
  const power = dragPower * energyFraction // actual capped power
  // Visual lengths respect the energy cap so the cue matches what will actually fire
  const effectiveClamped = clamped * energyFraction

  const sp = worldToScreen(planet.x, planet.y)
  const s = scale()
  const pxR = planet.drawR * s // planet radius in pixels

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Cue stick follows the full drag distance — independent of energy
  const cueStart = {
    x: sp.x + dragNx * (clamped + pxR + 8),
    y: sp.y + dragNy * (clamped + pxR + 8),
  }
  const cueEnd = {
    x: sp.x - dragNx * (pxR + 4),
    y: sp.y - dragNy * (pxR + 4),
  }

  ctx.setLineDash([6, 4])
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cueStart.x, cueStart.y)
  ctx.lineTo(cueEnd.x, cueEnd.y)
  ctx.stroke()
  ctx.setLineDash([])

  // Arrow caps at the energy-limited power — stops growing when budget is exhausted
  const shotLen = effectiveClamped * 0.8
  const arrowBase = {
    x: sp.x + shotNx * (pxR + 4),
    y: sp.y + shotNy * (pxR + 4),
  }
  const arrowTip = {
    x: sp.x + shotNx * (shotLen + pxR),
    y: sp.y + shotNy * (shotLen + pxR),
  }
  const perp = { x: -shotNy, y: shotNx }

  ctx.strokeStyle = 'rgba(79,195,247,0.75)'
  ctx.fillStyle = 'rgba(79,195,247,0.75)'
  ctx.lineWidth = 2

  // Arrow shaft
  ctx.beginPath()
  ctx.moveTo(arrowBase.x, arrowBase.y)
  ctx.lineTo(arrowTip.x, arrowTip.y)
  ctx.stroke()

  // Arrow head
  const hw = 6
  ctx.beginPath()
  ctx.moveTo(arrowTip.x, arrowTip.y)
  ctx.lineTo(arrowTip.x - shotNx * hw * 2 + perp.x * hw, arrowTip.y - shotNy * hw * 2 + perp.y * hw)
  ctx.lineTo(arrowTip.x - shotNx * hw * 2 - perp.x * hw, arrowTip.y - shotNy * hw * 2 - perp.y * hw)
  ctx.closePath()
  ctx.fill()

  // Power ring around planet
  ctx.strokeStyle = `rgba(79,195,247,${0.3 + power * 0.5})`
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, pxR + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * power)
  ctx.stroke()

  // Power percentage label
  ctx.font = '12px monospace'
  ctx.fillStyle = 'rgba(79,195,247,0.9)'
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.round(power * 100)}%`, sp.x, sp.y + pxR + 22)

  ctx.restore()

  // Planet post-shot prediction path (uses energy-capped power)
  const dv = power * settings.settings.orbit.shotPower * 0.01
  const predPath = computeShotPrediction(planet, shotNx, shotNy, dv)
  if (predPath.length >= 2) {
    const [r, g, b] = hexToRgb(planet.color)
    drawProjectionCorridor(ctx, predPath, `${r},${g},${b}`, 0.65)
  }
}

// =============================================================================
// SHIP PREDICTION PATH
// =============================================================================

function drawPredictionPath(ctx) {
  if (shouldHidePredictionWhileBraking()) return
  if (shipPredPath.length < 2) return
  drawProjectionCorridor(ctx, shipPredPath, '79,195,247', 0.6)
}

function drawProjectionCorridor(ctx, path, color, maxAlpha) {
  if (path.length < 2) return
  const s = scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Width and divergence are in SIM-space (AU), so the corridor is anchored to
  // the world: zooming in makes the divergence visibly grow, zooming out shrinks
  // it. (It scales with the trajectory, not with the screen.)
  const lineW = PRED_CORRIDOR_LINE_AU
  const maxOffset = PRED_CORRIDOR_HALF_AU

  for (let i = 1; i < path.length; i++) {
    const t = Math.max(0, Math.min(1, path[i].t ?? i / (path.length - 1)))
    const alpha = maxAlpha * Math.pow(1 - t, 1.35)
    if (alpha <= 0.003) continue

    const dx = path[i].x - path[i - 1].x
    const dy = path[i].y - path[i - 1].y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len <= 1e-8) continue

    // Perpendicular unit vector in world-space.
    const nx = -dy / len
    const ny = dx / len
    const prevT = Math.max(0, Math.min(1, path[i - 1].t ?? (i - 1) / (path.length - 1)))
    // Divergence grows along the path (corridor widens), in world-space AU.
    const prevOffset = Math.pow(prevT, 0.9) * maxOffset
    const offset = Math.pow(t, 0.9) * maxOffset

    ctx.lineWidth = lineW
    ctx.strokeStyle = `rgba(${color},${alpha})`

    ctx.beginPath()
    ctx.moveTo(path[i - 1].x + nx * prevOffset, path[i - 1].y + ny * prevOffset)
    ctx.lineTo(path[i].x + nx * offset, path[i].y + ny * offset)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(path[i - 1].x - nx * prevOffset, path[i - 1].y - ny * prevOffset)
    ctx.lineTo(path[i].x - nx * offset, path[i].y - ny * offset)
    ctx.stroke()
  }

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
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`
}
function darken(hex, t) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r * (1 - t))},${Math.round(g * (1 - t))},${Math.round(b * (1 - t))})`
}

// =============================================================================
// BODY RENDERING
// =============================================================================

function drawBody(ctx, body, w, h) {
  // Fog of war: bodies and their trails are ALWAYS drawn here, in the normal
  // world pass. The fog grid (drawn afterwards) blacks out the unseen cells on
  // top of them, so a planet and its trail are hidden exactly where space is
  // unexplored and revealed wherever a cell is seen — no per-body gating needed.
  // Radar-tracked bodies on unseen cells are additionally redrawn as blips over
  // the fog by drawTrackedOverFog() so they stay locatable in the dark.
  const s = scale()
  const screenR = body.drawR * s

  // Trail
  const pts = body.trail?.points?.() || []
  if (pts.length >= 2) {
    ctx.save()
    ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (body.id === 'ship') {
      ctx.lineWidth = SHIP_DRAW_R * 0.3
      for (let i = 1; i < pts.length; i++) {
        const t = i / (pts.length - 1)
        ctx.strokeStyle = `rgba(255,132,38,${0.03 + t * 0.3})`
        ctx.beginPath()
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y)
        ctx.lineTo(pts[i].x, pts[i].y)
        ctx.stroke()
      }
    } else {
      const [r, g, b] = hexToRgb(body.color)
      ctx.lineWidth = body.drawR * 1.2
      for (let i = 1; i < pts.length; i++) {
        const t = i / (pts.length - 1)
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.02 + t * 0.22})`
        ctx.beginPath()
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y)
        ctx.lineTo(pts[i].x, pts[i].y)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  if (body.id === 'ship') {
    return
  }

  const sp = worldToScreen(body.x, body.y)
  if (sp.x < -60 || sp.x > w + 60 || sp.y < -60 || sp.y > h + 60) return

  // The SUN keeps its full glow + disc — it's the system's anchor landmark.
  if (body.id === 'sun') {
    ctx.save()
    if (screenR >= MIN_PLANET_PX) {
      ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
      const g = ctx.createRadialGradient(
        body.x,
        body.y,
        body.drawR * 0.8,
        body.x,
        body.y,
        body.drawR * 5,
      )
      g.addColorStop(0, 'rgba(255,220,80,0.5)')
      g.addColorStop(0.4, 'rgba(255,140,0,0.15)')
      g.addColorStop(1, 'rgba(255,80,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(body.x, body.y, body.drawR * 5, 0, Math.PI * 2)
      ctx.fill()
      const sg = ctx.createRadialGradient(
        body.x - body.drawR * 0.3,
        body.y - body.drawR * 0.3,
        0,
        body.x,
        body.y,
        body.drawR,
      )
      sg.addColorStop(0, lighten(body.color, 0.5))
      sg.addColorStop(0.5, body.color)
      sg.addColorStop(1, darken(body.color, 0.55))
      ctx.beginPath()
      ctx.arc(body.x, body.y, body.drawR, 0, Math.PI * 2)
      ctx.fillStyle = sg
      ctx.fill()
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      const g = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, 22)
      g.addColorStop(0, 'rgba(255,240,100,1)')
      g.addColorStop(0.3, 'rgba(255,180,0,0.5)')
      g.addColorStop(1, 'rgba(255,80,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, 22, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#FFE566'
      ctx.fill()
    }
    ctx.restore()
    return
  }

  // VISION LAYER for a planet: just a plain dot (plus its trail, drawn above).
  // At galaxy scale a planet reads as a point anyway; the shaded sphere belongs to
  // the info HUD. No name here — identity lives on the RADAR layer once scanned
  // (drawTrackedOverFog). The dot uses the planet's own colour so eyes-on contacts
  // look natural; radar-only contacts are styled separately over the fog.
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2)
  ctx.fillStyle = body.color
  ctx.fill()
  ctx.restore()
}

function drawShip(ctx, body, screenLen, w, h) {
  const s = scale()
  const sp = worldToScreen(body.x, body.y)
  if (sp.x < -60 || sp.x > w + 60 || sp.y < -60 || sp.y > h + 60) return

  const R = SHIP_DRAW_R

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.translate(body.x, body.y)
  ctx.rotate(shipAngle)

  const lw = 1.8 / s
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Dart/arrow shape: nose at +R, tail at -R, half-width R*0.45
  const hw = R * 0.45

  // Fill
  ctx.beginPath()
  ctx.moveTo(R, 0) // nose
  ctx.lineTo(-R * 0.5, hw) // rear port
  ctx.lineTo(-R * 0.15, 0) // tail notch
  ctx.lineTo(-R * 0.5, -hw) // rear starboard
  ctx.closePath()
  ctx.fillStyle = 'rgba(20,40,65,0.85)'
  ctx.fill()

  // Outline
  ctx.strokeStyle = '#4fc3f7'
  ctx.lineWidth = lw
  ctx.stroke()

  ctx.restore()
}

// =============================================================================
// CAPTAIN'S HUD (bottom-right planetary scan when near a planet)
// =============================================================================

// How far out the scanner picks a planet up, relative to its capture ring.
const SCAN_RANGE_MULT = 4
// First-contact observation takes 4 real seconds at the 1,000,000× reference
// timescale. Stored as a sim-time threshold (sim-years), since scanProgress
// accumulates simDt — so it runs faster/slower/freezes with the simulation, like
// the radar sweep. 4s × 1e6 / SECONDS_PER_YEAR.
const SCAN_DURATION_SIMYR = (4 * 1e6) / SECONDS_PER_YEAR
// Eased 0..1 visibility so the panel fades in/out instead of popping.
let captainHudVis = 0

// `info` source for a scan target: planets and the sun carry it on their static
// SOLAR_BODIES def; the black hole carries it on the constant itself.
function scanInfoDef(target) {
  if (target.id === 'blackhole') return BLACK_HOLE
  return SOLAR_BODIES.find((d) => d.id === target.id)
}

// Pick the closest radar target (planet, sun, or black hole) within scanner
// range. Returns the live target plus the def that carries its `info`.
function getScannedPlanet() {
  if (!ship) return null
  let nearest = null
  let nearestDist = Infinity
  for (const target of radarTargets()) {
    const { dist, captureRingR } = getApproachMatch(target)
    if (dist > captureRingR * SCAN_RANGE_MULT) continue
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = target
    }
  }
  if (!nearest) return null
  const def = scanInfoDef(nearest)
  if (!def || !def.info) return null
  return { body: nearest, def, dist: nearestDist }
}

function drawCaptainHUD(ctx, w, h, realDt, simDt = 0) {
  const scan = getScannedPlanet()

  // Observation is INTERRUPTIBLE: leaving scanner range before it finishes resets
  // the counter, so it starts over next time. Reset every in-progress, unscanned
  // target that isn't the one currently in range.
  for (const t of radarTargets()) {
    if (!t.scanned && t.scanProgress > 0 && (!scan || scan.body !== t)) {
      t.scanProgress = 0
    }
  }

  // First-contact OBSERVATION. The first time a body is in scanner range, we run
  // a timed scan (sim-time, 4s @ 1Mx) before its identity unlocks. Being in range
  // implies radar detection (you can't observe what you haven't found). Only when
  // scanProgress completes does `scanned` flip — and from then on it's instant.
  let scanning = false
  if (scan) {
    scan.body.detected = true
    if (!scan.body.scanned) {
      scan.body.scanProgress += simDt
      if (scan.body.scanProgress >= SCAN_DURATION_SIMYR) {
        scan.body.scanned = true
      } else {
        scanning = true // still observing — show the animation, not the readout
      }
    }
  }
  const scanFrac = scan ? Math.min(1, scan.body.scanProgress / SCAN_DURATION_SIMYR) : 0

  // captainHudVis eases the SCAN section in/out (0 = dark "no contact", 1 = full
  // readout); the screen frame and the telemetry footer are always drawn. Keep
  // the last target while fading so leaving range dims gracefully.
  const targetVis = scan ? 1 : 0
  const rate = Math.min(1, (realDt || 0.016) * 6)
  captainHudVis += (targetVis - captainHudVis) * rate
  if (scan) drawCaptainHUD._last = scan
  const shown = scan || drawCaptainHUD._last
  const vis = captainHudVis

  // Fixed cockpit-screen geometry, bottom-right.
  const panelW = 240
  const panelH = 196
  const margin = 14
  const panelX = w - panelW - margin
  const panelY = h - panelH - 14
  const accent = '0,230,140' // classic phosphor-green CRT tint

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Sensor link lines to the live target are drawn UNDER the bezel so the screen
  // sits on top of where they meet the frame. Only when there's an active scan.
  if (shown && vis > 0.02) {
    const [lr, lg, lb] = hexToRgb(shown.body.color)
    const ps = worldToScreen(shown.body.x, shown.body.y)
    ctx.save()
    ctx.globalAlpha = vis
    ctx.strokeStyle = `rgba(${lr},${lg},${lb},0.4)`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(panelX, panelY)
    ctx.lineTo(ps.x, ps.y)
    ctx.moveTo(panelX, panelY + panelH)
    ctx.lineTo(ps.x, ps.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ps.x, ps.y, 8, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${lr},${lg},${lb},0.7)`
    ctx.stroke()
    ctx.restore()
  }

  // Physical screen frame; everything below draws inside the returned content box.
  const c = drawScreenBezel(ctx, panelX, panelY, panelW, panelH, accent)

  // The screen is split: SCAN readout (top) over a TELEMETRY footer (bottom).
  const footerH = 58
  const scanH = c.h - footerH
  const scanBottom = c.y + scanH

  // ---- TELEMETRY footer (always on) ----
  ctx.font = '8px monospace'
  ctx.textAlign = 'left'
  ctx.fillStyle = `rgba(${accent},0.55)`
  ctx.fillText('◈ TELEMETRY', c.x, scanBottom + 12)
  // Divider above the footer.
  ctx.strokeStyle = `rgba(${accent},0.18)`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(c.x, scanBottom + 4)
  ctx.lineTo(c.x + c.w, scanBottom + 4)
  ctx.stroke()

  const colA = c.x
  const colB = c.x + c.w / 2 + 6
  let speedKmS = 0
  let distAu = 0
  if (ship) {
    const speed_au_yr = Math.sqrt(ship.vx ** 2 + ship.vy ** 2)
    speedKmS = (speed_au_yr * AU_KM) / SECONDS_PER_YEAR
    const sun = bodies.find((b) => b.id === 'sun')
    distAu = sun ? Math.sqrt((ship.x - sun.x) ** 2 + (ship.y - sun.y) ** 2) : 0
  }
  const telem = [
    [colA, 'PLANETS', `${blackHoleScore - sunPenalty}`],
    [colB, 'CONSUMED', `${blackHoleScore}`],
    [colA, 'SPEED', `${speedKmS.toFixed(1)} km/s`],
    [colB, 'SUN DIST', `${distAu.toFixed(3)} AU`],
  ]
  ctx.font = '8px monospace'
  for (let i = 0; i < telem.length; i++) {
    const [tx, label, value] = telem[i]
    const ty = scanBottom + 26 + Math.floor(i / 2) * 14
    ctx.textAlign = 'left'
    ctx.fillStyle = `rgba(${accent},0.5)`
    ctx.fillText(label, tx, ty)
    ctx.fillStyle = `rgba(${accent},0.95)`
    ctx.fillText(value, tx + 52, ty)
  }

  // ---- SCAN readout (upper area) ----
  // Header row — label reflects the state.
  ctx.font = '8px monospace'
  ctx.textAlign = 'left'
  ctx.fillStyle = `rgba(${accent},0.6)`
  ctx.fillText(scanning ? '◈ OBSERVING' : '◈ SENSOR SCAN', c.x, c.y + 8)

  if (!shown || vis < 0.02) {
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(${accent},0.45)`
    ctx.font = '10px monospace'
    ctx.fillText('NO CONTACT', c.x + c.w / 2, c.y + scanH / 2)
    ctx.font = '7px monospace'
    ctx.fillStyle = `rgba(${accent},0.25)`
    ctx.fillText('AWAITING SENSOR LOCK', c.x + c.w / 2, c.y + scanH / 2 + 13)
    ctx.restore()
    return
  }

  // ---- FIRST-CONTACT OBSERVATION animation ----
  // Only while the CURRENT in-range target is still being observed. (A stale
  // last-target that's out of range falls through to its cached readout.)
  if (scanning && scan) {
    drawObservationAnim(ctx, c, scanH, accent, scanFrac)
    ctx.restore()
    return
  }

  const { body, def, dist } = shown
  const info = def.info
  const [rv, gv, bv] = hexToRgb(body.color)
  ctx.globalAlpha = vis

  ctx.textAlign = 'right'
  ctx.fillStyle = `rgba(${rv},${gv},${bv},0.9)`
  ctx.fillText(info.classification.toUpperCase(), c.x + c.w, c.y + 8)

  // Portrait (left).
  const portR = 26
  const portCx = c.x + portR + 2
  const portCy = c.y + 22 + portR
  const glow = ctx.createRadialGradient(portCx, portCy, portR * 0.5, portCx, portCy, portR * 2)
  glow.addColorStop(0, `rgba(${rv},${gv},${bv},0.3)`)
  glow.addColorStop(1, `rgba(${rv},${gv},${bv},0)`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(portCx, portCy, portR * 2, 0, Math.PI * 2)
  ctx.fill()
  const sg = ctx.createRadialGradient(
    portCx - portR * 0.3,
    portCy - portR * 0.3,
    0,
    portCx,
    portCy,
    portR,
  )
  sg.addColorStop(0, lighten(body.color, 0.5))
  sg.addColorStop(0.5, body.color)
  sg.addColorStop(1, darken(body.color, 0.55))
  ctx.fillStyle = sg
  ctx.beginPath()
  ctx.arc(portCx, portCy, portR, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.arc(portCx, portCy, portR, 0, Math.PI * 2)
  ctx.clip()
  const term = ctx.createLinearGradient(portCx - portR, portCy, portCx + portR, portCy)
  term.addColorStop(0, 'rgba(0,0,0,0)')
  term.addColorStop(0.62, 'rgba(0,0,0,0)')
  term.addColorStop(1, 'rgba(0,0,0,0.7)')
  ctx.fillStyle = term
  ctx.fillRect(portCx - portR, portCy - portR, portR * 2, portR * 2)
  ctx.restore()
  ctx.font = 'bold 10px monospace'
  ctx.fillStyle = `rgba(${rv},${gv},${bv},0.95)`
  ctx.textAlign = 'center'
  ctx.fillText(body.name.toUpperCase(), portCx, portCy + portR + 14)

  // Data rows (right).
  const distKm = dist * AU_KM
  const distLabel =
    distKm >= 1e6 ? `${(distKm / 1e6).toFixed(2)}M km` : `${Math.round(distKm).toLocaleString()} km`
  const rows = [
    ['DIAMETER', `${info.diameterKm.toLocaleString()} km`],
    ['GRAVITY', `${info.gravityG.toFixed(2)} g`],
    ['DAY', info.dayHours >= 100 ? `${Math.round(info.dayHours / 24)} d` : `${info.dayHours} h`],
    ['MOONS', `${info.moons}`],
    ['SURF TEMP', `${info.tempC}°C`],
    ['RANGE', distLabel],
  ]
  const dataX = c.x + 60
  const valX = c.x + c.w
  let ry = c.y + 22
  ctx.font = '8px monospace'
  for (const [label, value] of rows) {
    ctx.textAlign = 'left'
    ctx.fillStyle = `rgba(${accent},0.5)`
    ctx.fillText(label, dataX, ry)
    ctx.textAlign = 'right'
    ctx.fillStyle = `rgba(${accent},0.92)`
    ctx.fillText(value, valX, ry)
    ry += 12
  }
  // Flavor line.
  ctx.textAlign = 'left'
  ctx.font = '8px monospace'
  ctx.fillStyle = `rgba(${rv},${gv},${bv},0.6)`
  wrapText(ctx, info.desc, dataX, ry + 2, valX - dataX, 9)

  ctx.restore()
}

// First-contact observation animation, drawn inside the captain-HUD scan area
// `c` (content rect) with `scanH` height. An anonymous dark disc with a bright
// horizontal line sweeping up and down across it (clipped to the disc), like a
// scanner reading an unknown body, plus a caption and a sim-time progress bar.
function drawObservationAnim(ctx, c, scanH, accent, frac) {
  const cx = c.x + c.w / 2
  const r = 26
  const cy = c.y + 8 + r

  // Anonymous disc — unknown body silhouette.
  ctx.fillStyle = 'rgba(10,16,20,0.95)'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = `rgba(${accent},0.55)`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  // A faint "?" to read as unidentified.
  ctx.fillStyle = `rgba(${accent},0.3)`
  ctx.font = 'bold 22px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', cx, cy + 1)
  ctx.textBaseline = 'alphabetic'

  // Horizontal scan line sweeping up/down over the disc (clipped to it). The
  // sweep oscillates in real time so it always animates visibly; the BAR below
  // tracks the sim-time progress.
  const osc = (Math.sin(Date.now() / 420) + 1) / 2 // 0..1 ping-pong (slow sweep)
  const lineY = cy - r + osc * (r * 2)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  // Bright sweep line + a soft trailing glow band.
  const band = ctx.createLinearGradient(0, lineY - 8, 0, lineY + 8)
  band.addColorStop(0, `rgba(${accent},0)`)
  band.addColorStop(0.5, `rgba(${accent},0.28)`)
  band.addColorStop(1, `rgba(${accent},0)`)
  ctx.fillStyle = band
  ctx.fillRect(cx - r, lineY - 8, r * 2, 16)
  ctx.strokeStyle = `rgba(${accent},0.95)`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx - r, lineY)
  ctx.lineTo(cx + r, lineY)
  ctx.stroke()
  ctx.restore()

  // Caption.
  ctx.textAlign = 'center'
  ctx.font = '9px monospace'
  ctx.fillStyle = `rgba(${accent},0.85)`
  ctx.fillText('OBSERVING UNKNOWN', cx, c.y + scanH - 30)
  ctx.fillText('CELESTIAL BODY', cx, c.y + scanH - 19)

  // Sim-time progress bar.
  const barW = c.w - 20
  const barX = c.x + 10
  const barY = c.y + scanH - 10
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(barX, barY, barW, 4)
  ctx.fillStyle = `rgba(${accent},0.9)`
  ctx.fillRect(barX, barY, barW * frac, 4)
  ctx.strokeStyle = `rgba(${accent},0.4)`
  ctx.lineWidth = 1
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, 3)
}

// Simple greedy word-wrap for canvas text.
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = word
      yy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
}

// =============================================================================
// APPROACH INDICATORS (bottom-center HUD while near a planet)
// =============================================================================

function drawApproachHUD(ctx, w, h) {
  if (!ship) return
  if (orbitState.mode === 'slingshot' || orbitState.mode === 'capturing') return

  let bestPlanet = null
  let best = null
  let bestScore = -1

  for (const body of bodies) {
    if (body.isFixed || body.id === 'sun' || body.id === 'ship') continue
    const info = getApproachMatch(body)
    if (info.dist > info.captureRingR * 2.5) continue
    if (info.distancePct > bestScore) {
      bestScore = info.distancePct
      bestPlanet = body
      best = info
    }
  }

  if (!bestPlanet || !best) return

  const dwellPct = Math.min(1, (bestPlanet.captureTimeInRange || 0) / CAPTURE_DWELL_YR)

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  const panelW = 260
  const panelH = 58
  const panelX = w / 2 - panelW / 2
  const panelY = h - 78

  ctx.fillStyle = 'rgba(0,0,0,0.48)'
  ctx.strokeStyle = `rgba(79,195,247,${0.18 + best.distancePct * 0.45})`
  ctx.lineWidth = 1
  roundRect(ctx, panelX, panelY, panelW, panelH, 5)
  ctx.fill()
  ctx.stroke()

  ctx.font = 'bold 11px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.textAlign = 'center'
  ctx.fillText(`APPROACH — ${bestPlanet.name.toUpperCase()}`, w / 2, panelY + 15)

  function drawMeter(label, value, y, color) {
    const barX = panelX + 98
    const barW = 132
    const barH = 5
    ctx.font = '10px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.42)'
    ctx.textAlign = 'right'
    ctx.fillText(label, barX - 8, y + 5)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(barX, y, barW, barH)
    ctx.fillStyle = color
    ctx.fillRect(barX, y, barW * value, barH)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.textAlign = 'left'
    ctx.fillText(`${Math.round(value * 100)}%`, barX + barW + 8, y + 5)
  }

  drawMeter('RANGE', best.distancePct, panelY + 29, 'rgba(255,255,255,0.78)')
  drawMeter('DWELL', dwellPct, panelY + 43, `rgba(127,232,232,0.9)`)

  ctx.restore()
}

// =============================================================================
// HUD OVERLAY
// =============================================================================

function getTimeParts() {
  const totalMonths = Math.max(0, Math.floor(simYears * 12))
  const years = Math.floor(totalMonths / 12)
  const monthInYear = (totalMonths % 12) + 1
  return { totalMonths, years, monthInYear }
}

function drawFinalScoreOverview(ctx, w, h) {
  if (!finalScoreShown) return

  const { totalMonths, years, monthInYear } = getTimeParts()
  const score = blackHoleScore - sunPenalty
  const perfect = blackHoleScore === TOTAL_PLANETS && sunPenalty === 0
  const panelW = 390
  const panelH = 188
  const x = w / 2 - panelW / 2
  const y = h / 2 - panelH / 2

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = 'rgba(2,4,10,0.84)'
  ctx.strokeStyle = perfect ? 'rgba(255,232,150,0.75)' : 'rgba(255,120,90,0.65)'
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y, panelW, panelH, 7)
  ctx.fill()
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.font = 'bold 18px monospace'
  ctx.fillStyle = perfect ? 'rgba(255,232,150,0.98)' : 'rgba(255,180,130,0.98)'
  ctx.fillText(perfect ? 'ALL PLANETS SCORED' : 'RUN COMPLETE', w / 2, y + 28)

  ctx.font = 'bold 24px monospace'
  ctx.fillStyle = 'rgba(127,232,232,0.96)'
  ctx.fillText(`YEAR ${years.toLocaleString()}  MONTH ${monthInYear}`, w / 2, y + 62)

  ctx.font = 'bold 18px monospace'
  ctx.fillStyle = 'rgba(255,232,150,0.95)'
  ctx.fillText(`TOTAL MONTHS ${totalMonths.toLocaleString()}`, w / 2, y + 88)

  ctx.font = '14px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.fillText(`ENERGY SPENT ${Math.round(totalEnergySpent).toLocaleString()}`, w / 2, y + 116)
  ctx.fillText(
    `BLACK HOLE ${blackHoleScore}/${TOTAL_PLANETS}  •  SUN PENALTY -${sunPenalty}`,
    w / 2,
    y + 140,
  )

  ctx.font = 'bold 16px monospace'
  ctx.fillStyle = score >= TOTAL_PLANETS ? 'rgba(165,255,180,0.95)' : 'rgba(255,210,120,0.92)'
  ctx.fillText(`PLANET SCORE ${score}`, w / 2, y + 166)

  ctx.restore()
}

// =============================================================================
// BLACK HOLE TROPHY ROW
// =============================================================================

function drawConsumedPlanets(ctx, h) {
  if (blackHoleConsumed.length === 0) return

  // Find max physR to normalize sizes
  const maxPhysR = Math.max(...blackHoleConsumed.map((p) => p.physR))
  const MAX_DISPLAY_R = 22 // px for the largest planet
  const MIN_DISPLAY_R = 5 // px floor

  const padding = 12
  const labelH = 14
  const iconAreaH = MAX_DISPLAY_R * 2 + 4
  const itemW = MAX_DISPLAY_R * 2 + 16
  const totalW = blackHoleConsumed.length * itemW + padding * 2
  const panelH = iconAreaH + labelH + padding * 2
  const panelX = padding
  const panelY = h - panelH - padding

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Panel background
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.strokeStyle = 'rgba(255,140,0,0.3)'
  ctx.lineWidth = 1
  roundRect(ctx, panelX, panelY, totalW, panelH, 5)
  ctx.fill()
  ctx.stroke()

  // "INTO THE BLACK HOLE" label at top-left of panel
  ctx.font = '9px monospace'
  ctx.fillStyle = 'rgba(255,140,0,0.55)'
  ctx.textAlign = 'left'
  ctx.fillText('INTO THE BLACK HOLE', panelX + padding, panelY + 11)

  const centerY = panelY + padding + 10 + MAX_DISPLAY_R

  for (let i = 0; i < blackHoleConsumed.length; i++) {
    const planet = blackHoleConsumed[i]
    const r = Math.max(MIN_DISPLAY_R, (planet.physR / maxPhysR) * MAX_DISPLAY_R)
    const cx = panelX + padding + i * itemW + MAX_DISPLAY_R + 8

    const [rv, gv, bv] = hexToRgb(planet.color)

    // Glow halo
    const glow = ctx.createRadialGradient(cx, centerY, r * 0.5, cx, centerY, r * 2.2)
    glow.addColorStop(0, `rgba(${rv},${gv},${bv},0.28)`)
    glow.addColorStop(1, `rgba(${rv},${gv},${bv},0)`)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, centerY, r * 2.2, 0, Math.PI * 2)
    ctx.fill()

    // Sphere shading
    const ox = cx - r * 0.3
    const oy = centerY - r * 0.3
    const sg = ctx.createRadialGradient(ox, oy, 0, cx, centerY, r)
    sg.addColorStop(0, lighten(planet.color, 0.5))
    sg.addColorStop(0.5, planet.color)
    sg.addColorStop(1, darken(planet.color, 0.55))
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(cx, centerY, r, 0, Math.PI * 2)
    ctx.fill()

    // Planet name label
    ctx.font = '9px monospace'
    ctx.fillStyle = `rgba(${rv},${gv},${bv},0.85)`
    ctx.textAlign = 'center'
    ctx.fillText(planet.name, cx, centerY + MAX_DISPLAY_R + labelH)
  }

  ctx.restore()
}

function drawEnergyHUD(ctx, w, h) {
  if (!ship) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Outer device footprint, then the same cockpit-screen bezel as the captain
  // HUD. Content draws inside the returned glass rect. Minimal: a narrow column.
  const outerX = 12
  const outerY = 46 // clear of focus buttons (12 + 22 + 12)
  const outerW = 78 // room for the shot-draw preview on the bar's right
  const outerH = h - outerY - 14
  const accent = '0,230,140' // classic phosphor-green CRT tint (matches captain HUD)
  const c = drawScreenBezel(ctx, outerX, outerY, outerW, outerH, accent)

  const panelX = c.x
  const panelY = c.y
  const panelW = c.w
  const panelH = c.h

  // --- Layout constants (minimal) ---
  const gaugeR = 15
  const gaugeSectionH = gaugeR * 2 + 32 // label above + arc + % below
  const barW = 10 // thin bar
  const barX = panelX + 6 // left-biased so the shot-draw preview fits on its right
  const panelCx = panelX + panelW / 2 // labels + gauge centre on the panel, not the bar
  const barY = panelY + 20
  const barH = panelH - gaugeSectionH - 20 - 12

  const energyFrac = shipEnergy / SOLAR_MAX_ENERGY

  // --- Energy bar track ---
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  roundRect(ctx, barX, barY, barW, barH, 3)
  ctx.fill()

  // Bar fill — green at full, yellow mid, red empty.
  const fillH = barH * energyFrac
  const r = Math.round(energyFrac < 0.5 ? 255 : 255 * (1 - (energyFrac - 0.5) * 2))
  const g = Math.round(energyFrac > 0.5 ? 200 : energyFrac * 2 * 200)
  if (fillH > 0) {
    ctx.fillStyle = `rgba(${r},${g},60,0.92)`
    roundRect(ctx, barX, barY + barH - fillH, barW, fillH, 3)
    ctx.fill()
  }

  // Thin bar border.
  ctx.strokeStyle = `rgba(${accent},0.45)`
  ctx.lineWidth = 1
  roundRect(ctx, barX, barY, barW, barH, 3)
  ctx.stroke()

  // "ENGY" label above bar (compact).
  ctx.font = '8px monospace'
  ctx.fillStyle = `rgba(${accent},0.7)`
  ctx.textAlign = 'center'
  ctx.fillText('ENGY', panelCx, barY - 7)

  // Energy % label below bar.
  ctx.font = 'bold 10px monospace'
  ctx.fillStyle = `rgba(${r},${g},60,0.95)`
  ctx.fillText(`${Math.round(energyFrac * 100)}%`, panelCx, barY + barH + 13)

  // --- Shot power-draw preview ---
  // While aiming a shot, show how much stored energy it will consume: a pulsing
  // segment at the TOP of the current fill (the part that will drain), plus a
  // bracket on the right edge. If the request exceeds what's stored, the draw
  // caps at the full bar and we flag "MAX" — the shot can't use more than stored.
  const draw = currentShotDraw()
  if (draw) {
    const fillTop = barY + barH - barH * energyFrac
    const drawH = barH * draw.drawn
    const pulse = 0.45 + 0.35 * ((Math.sin(Date.now() / 200) + 1) / 2)
    // Drain segment over the top of the fill.
    ctx.fillStyle = `rgba(255,90,70,${pulse.toFixed(3)})`
    ctx.fillRect(barX, fillTop, barW, drawH)
    // Bracket + tick on the right edge marking the post-shot level.
    const postLevel = fillTop + drawH
    const bx = barX + barW + 3
    ctx.strokeStyle = `rgba(255,120,90,${(0.7 + pulse * 0.3).toFixed(3)})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(bx, fillTop)
    ctx.lineTo(bx + 3, fillTop)
    ctx.moveTo(bx + 3, fillTop)
    ctx.lineTo(bx + 3, postLevel)
    ctx.moveTo(bx + 3, postLevel)
    ctx.lineTo(bx, postLevel)
    ctx.stroke()
    // Cost readout to the right of the bar.
    ctx.save()
    ctx.textAlign = 'left'
    ctx.font = '8px monospace'
    ctx.fillStyle = 'rgba(255,120,90,0.95)'
    const costPct = Math.round(draw.drawn * 100)
    ctx.fillText(`-${costPct}%`, bx + 6, (fillTop + postLevel) / 2 + 3)
    if (draw.requested > draw.drawn + 0.001) {
      ctx.fillStyle = 'rgba(255,200,60,0.95)'
      ctx.fillText('MAX', bx + 6, (fillTop + postLevel) / 2 + 13)
    }
    ctx.restore()
  }

  // --- Solar particles (drawn before gauge so gauge renders on top) ---
  for (const p of solarParticles) {
    const t = p.age / p.duration
    const px = p.x + (p.targetX - p.x) * t
    const py = p.y + (p.targetY - p.y) * t
    const fade = t < 0.15 ? t / 0.15 : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1
    ctx.globalAlpha = p.alpha * fade
    ctx.fillStyle = 'rgba(255,230,80,1)'
    ctx.shadowColor = 'rgba(255,200,40,0.9)'
    ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.arc(px, py, p.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // --- Solar gauge — small dial centered below the bar ---
  const gaugeCx = panelCx
  const gaugeCy = panelY + panelH - gaugeR - 12
  const gaugeStart = Math.PI * 0.75
  const gaugeSpan = Math.PI * 1.5

  // "SOLAR" label above gauge.
  ctx.font = '8px monospace'
  ctx.fillStyle = 'rgba(255,200,60,0.6)'
  ctx.textAlign = 'center'
  ctx.fillText('SOLAR', gaugeCx, gaugeCy - gaugeR - 4)

  // Arc track (thin).
  ctx.beginPath()
  ctx.arc(gaugeCx, gaugeCy, gaugeR, gaugeStart, gaugeStart + gaugeSpan)
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 3
  ctx.stroke()

  // Colored arc fill.
  if (solarEfficiency > 0.005) {
    const effAngle = gaugeStart + gaugeSpan * solarEfficiency
    ctx.beginPath()
    ctx.arc(gaugeCx, gaugeCy, gaugeR, gaugeStart, effAngle)
    ctx.strokeStyle = 'rgba(255,210,90,0.95)'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // Needle.
  const needleAngle = gaugeStart + gaugeSpan * solarEfficiency
  const needleLen = gaugeR - 3
  ctx.strokeStyle = 'rgba(255,240,120,0.95)'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(gaugeCx, gaugeCy)
  ctx.lineTo(
    gaugeCx + Math.cos(needleAngle) * needleLen,
    gaugeCy + Math.sin(needleAngle) * needleLen,
  )
  ctx.stroke()

  // Pivot dot.
  ctx.fillStyle = 'rgba(255,240,120,0.95)'
  ctx.beginPath()
  ctx.arc(gaugeCx, gaugeCy, 2, 0, Math.PI * 2)
  ctx.fill()

  // Efficiency % text.
  ctx.font = '9px monospace'
  ctx.fillStyle = 'rgba(255,220,80,0.9)'
  ctx.fillText(`${Math.round(solarEfficiency * 100)}%`, gaugeCx, gaugeCy + gaugeR + 11)

  ctx.restore()
}

function drawHUD(ctx, w, h, realDt, simDt = 0) {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Focus buttons — always visible, Z = Sun, X = Ship
  const buttons = [
    { label: 'Sun [Z]', focus: 'sun' },
    { label: 'Ship [X]', focus: 'ship' },
  ]

  const bw = 110,
    bh = 22,
    gap = 6,
    startX = 12,
    startY = 12

  buttons.forEach((btn, i) => {
    const bx = startX + i * (bw + gap)
    const active = cam.focus === btn.focus
    ctx.fillStyle = active ? 'rgba(79,195,247,0.25)' : 'rgba(0,0,0,0.5)'
    ctx.strokeStyle = active ? '#4fc3f7' : 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 1
    roundRect(ctx, bx, startY, bw, bh, 3)
    ctx.fill()
    ctx.stroke()

    ctx.font = '11px monospace'
    ctx.fillStyle = active ? '#4fc3f7' : 'rgba(255,255,255,0.5)'
    ctx.textAlign = 'center'
    ctx.fillText(btn.label, bx + bw / 2, startY + bh / 2 + 4)
  })

  ctx.restore()
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Slingshot mode status
  if ((orbitState.mode === 'slingshot' || orbitState.mode === 'capturing') && orbitState.planet) {
    const planet = orbitState.planet
    const [r, g, b] = hexToRgb(planet.color)

    ctx.font = 'bold 14px monospace'
    ctx.fillStyle = `rgba(${r},${g},${b},0.95)`
    ctx.textAlign = 'center'
    ctx.fillText(`SLINGSHOT ORBIT: ${planet.name.toUpperCase()}`, w / 2, 112)

    ctx.font = '11px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText(
      'SHOT SYSTEM ARMED  •  Mouse to aim  •  Click to fire  •  ESC to break orbit',
      w / 2,
      130,
    )
  }

  if (shipLoss === 'SUN') {
    // Fade in immediately, full alpha by 2s
    const textAlpha = Math.max(0, Math.min(1, deathTextAge / 2.0))
    if (textAlpha > 0) {
      const sunSp = worldToScreen(0, 0)
      const textX = sunSp.x
      const textY = sunSp.y + 90
      ctx.textAlign = 'center'
      ctx.font = 'italic 900 62px Impact, Arial Black, sans-serif'
      ctx.lineWidth = 9
      ctx.strokeStyle = `rgba(20,4,0,${textAlpha * 0.88})`
      ctx.fillStyle = `rgba(255,82,34,${textAlpha})`
      ctx.strokeText('SUN BURNED', textX, textY)
      ctx.fillText('SUN BURNED', textX, textY)

      ctx.font = 'italic bold 13px monospace'
      ctx.fillStyle = `rgba(255,210,150,${textAlpha * 0.72})`
      ctx.fillText('MISSION TERMINATED BY SOLAR CONTACT', textX, textY + 26)
    }
  } else if (shipLoss === 'BLACK HOLE') {
    // Fade in immediately, full alpha by 2s
    const textAlpha = Math.max(0, Math.min(1, deathTextAge / 2.0))
    if (textAlpha > 0) {
      const bhSp = worldToScreen(BLACK_HOLE.x, BLACK_HOLE.y)
      const textX = bhSp.x
      const textY = bhSp.y + 90
      ctx.textAlign = 'center'
      ctx.font = 'italic 900 62px Impact, Arial Black, sans-serif'
      ctx.lineWidth = 9
      ctx.strokeStyle = `rgba(10,2,0,${textAlpha * 0.88})`
      ctx.fillStyle = `rgba(255,120,20,${textAlpha})`
      ctx.strokeText('SUCKED IN', textX, textY)
      ctx.fillText('SUCKED IN', textX, textY)

      ctx.font = 'italic bold 13px monospace'
      ctx.fillStyle = `rgba(255,180,80,${textAlpha * 0.72})`
      ctx.fillText('CONSUMED BY THE SINGULARITY', textX, textY + 26)
    }
  }

  // (Ship telemetry + scores live inside the captain HUD screen now.)

  ctx.restore()
  drawFinalScoreOverview(ctx, w, h)

  // Velocity match / approach indicator
  drawApproachHUD(ctx, w, h)

  // Captain's planetary scan (bottom-right)
  drawCaptainHUD(ctx, w, h, realDt, simDt)
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

// Draws a physical cockpit "screen": a raised dark bezel frame with a beveled
// highlight, four corner screws, and an inset glass panel with a top sheen, faint
// horizontal scanlines and an edge vignette. `accent` is an "r,g,b" string that
// tints the screen glow/border. Returns the INNER content rect (inside the glass,
// past the inset padding) so the caller draws its readout there.
function drawScreenBezel(ctx, x, y, w, h, accent) {
  // Classic-game console panel: flat black screen, a bold BRIGHT double-line
  // border (no gradients/sheen), chunky corner brackets and bold CRT scanlines.
  // Square corners read more "80s cockpit terminal" than rounded glass.
  const pad = 8
  const ix = x + 5
  const iy = y + 5
  const iw = w - 10
  const ih = h - 10

  // Flat dark backing for the whole device.
  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  ctx.fillRect(x, y, w, h)

  // Solid black CRT screen.
  ctx.fillStyle = 'rgba(0,2,4,0.96)'
  ctx.fillRect(ix, iy, iw, ih)

  // Bold CRT scanlines across the screen.
  ctx.save()
  ctx.beginPath()
  ctx.rect(ix, iy, iw, ih)
  ctx.clip()
  ctx.strokeStyle = `rgba(${accent},0.07)`
  ctx.lineWidth = 1
  for (let yy = iy + 1; yy < iy + ih; yy += 3) {
    ctx.beginPath()
    ctx.moveTo(ix, yy + 0.5)
    ctx.lineTo(ix + iw, yy + 0.5)
    ctx.stroke()
  }
  ctx.restore()

  // Double-line border: a bold bright inner line + a thinner outer line.
  ctx.strokeStyle = `rgba(${accent},0.85)`
  ctx.lineWidth = 2
  ctx.strokeRect(ix + 1, iy + 1, iw - 2, ih - 2)
  ctx.strokeStyle = `rgba(${accent},0.35)`
  ctx.lineWidth = 1
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)

  // Chunky corner brackets ⌐ ¬ for the retro console look.
  const bl = 12 // bracket arm length
  ctx.strokeStyle = `rgba(${accent},0.95)`
  ctx.lineWidth = 2
  const bx0 = ix + 1
  const by0 = iy + 1
  const bx1 = ix + iw - 1
  const by1 = iy + ih - 1
  ctx.beginPath()
  // top-left
  ctx.moveTo(bx0, by0 + bl)
  ctx.lineTo(bx0, by0)
  ctx.lineTo(bx0 + bl, by0)
  // top-right
  ctx.moveTo(bx1 - bl, by0)
  ctx.lineTo(bx1, by0)
  ctx.lineTo(bx1, by0 + bl)
  // bottom-left
  ctx.moveTo(bx0, by1 - bl)
  ctx.lineTo(bx0, by1)
  ctx.lineTo(bx0 + bl, by1)
  // bottom-right
  ctx.moveTo(bx1 - bl, by1)
  ctx.lineTo(bx1, by1)
  ctx.lineTo(bx1, by1 - bl)
  ctx.stroke()

  return { x: ix + pad, y: iy + pad, w: iw - pad * 2, h: ih - pad * 2 }
}

// =============================================================================
// SHOCKWAVE ANIMATION
// =============================================================================

function tickShockwaves(realDt) {
  for (const sw of shockwaves) {
    sw.age += realDt
    const t = Math.min(sw.age / sw.duration, 1)
    // Ease-out cubic: fast at start, decelerates
    const et = 1 - Math.pow(1 - t, 3)
    sw.r = sw.maxR * et
    sw.alpha = 1 - t // linear fade over full duration
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    if (shockwaves[i].age >= shockwaves[i].duration) shockwaves.splice(i, 1)
  }
}

function tickDebris(dt_yr, realDt) {
  for (const piece of debris) {
    piece.age += realDt
    piece.x += piece.vx * dt_yr
    piece.y += piece.vy * dt_yr
    piece.angle += piece.spin * realDt
    piece.vx *= Math.pow(0.72, realDt)
    piece.vy *= Math.pow(0.72, realDt)
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    if (debris[i].age >= debris[i].duration) debris.splice(i, 1)
  }
}

function drawDebris(ctx) {
  if (debris.length === 0) return
  const s = scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)

  for (const piece of debris) {
    const t = Math.min(piece.age / piece.duration, 1)
    const alpha = Math.pow(1 - t, 1.1)
    const pxSize = piece.size / s
    const heat = piece.heat * (1 - t)

    ctx.save()
    ctx.translate(piece.x, piece.y)
    ctx.rotate(piece.angle)
    ctx.fillStyle = `rgba(${piece.color},${alpha * 0.86})`
    ctx.strokeStyle = `rgba(255,${Math.round(165 + heat * 80)},80,${alpha * 0.42})`
    ctx.lineWidth = 0.7 / s
    ctx.beginPath()
    ctx.moveTo(pxSize * 1.2, 0)
    ctx.lineTo(-pxSize * 0.65, pxSize * 0.72)
    ctx.lineTo(-pxSize * 0.38, -pxSize * 0.85)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  ctx.restore()
}

// Particles age AND move in sim-time (dt_yr), so the plume adheres to sim time:
// its physical length and lifetime are identical at every timescale. (Spawn-time
// density compensation keeps the ribbon evenly filled as dt_yr varies.)
function tickThrustParticles(dt_yr) {
  for (const particle of thrustParticles) {
    particle.age += dt_yr
    particle.x += particle.vx * dt_yr
    particle.y += particle.vy * dt_yr
  }
  for (let i = thrustParticles.length - 1; i >= 0; i--) {
    if (thrustParticles[i].age >= thrustParticles[i].duration) {
      thrustParticles.splice(i, 1)
    }
  }
}

function drawThrustParticles(ctx) {
  if (thrustParticles.length < 2) return
  const s = scale()

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Sort youngest-first so we draw nozzle-end on top
  const sorted = thrustParticles.slice().sort((a, b) => a.age - b.age)

  // Draw line segments between consecutive particles
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]

    // Only connect particles from the same thrust burst
    if (a.burstId !== b.burstId) continue

    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    const tA = Math.min(1, a.age / a.duration)
    const tB = Math.min(1, b.age / b.duration)

    const alphaA = Math.pow(1 - tA, 1.4) * 0.9
    const alphaB = Math.pow(1 - tB, 1.4) * 0.9
    if (alphaA < 0.005 && alphaB < 0.005) continue

    const wA = a.size * 0.0022 * (3 - tA * 2.7)
    const wB = b.size * 0.0022 * (3 - tB * 2.7)

    // Hot white-blue at birth, dimmer blue at end
    const heatA = 1 - tA
    const rA = Math.round(140 + heatA * 110)
    const gA = Math.round(200 + heatA * 55)
    const rB = Math.round(140 + (1 - tB) * 110)
    const gB = Math.round(200 + (1 - tB) * 55)

    if (dist < 0.001) {
      // Particles nearly coincident — single dot at midpoint
      ctx.fillStyle = `rgba(${rA},${gA},255,${(alphaA + alphaB) * 0.5})`
      ctx.beginPath()
      ctx.arc((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (wA + wB) * 0.5, 0, Math.PI * 2)
      ctx.fill()
      continue
    }

    // Tapered quad: width wA at point a, width wB at point b
    const nx = dx / dist
    const ny = dy / dist

    // Use gradient along the segment for color/alpha transition
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
    grad.addColorStop(0, `rgba(${rA},${gA},255,${alphaA})`)
    grad.addColorStop(1, `rgba(${rB},${gB},255,${alphaB})`)

    const angleAB = Math.atan2(ny, nx) // direction a→b

    ctx.fillStyle = grad
    ctx.beginPath()
    // Start at a's port side, arc around a (cap), go to b's port side
    ctx.arc(a.x, a.y, wA, angleAB + Math.PI / 2, angleAB - Math.PI / 2, false)
    // Straight edge to b's starboard, arc around b (cap), back to a
    ctx.arc(b.x, b.y, wB, angleAB - Math.PI / 2, angleAB + Math.PI / 2, false)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

function drawThrustIndicator(ctx, w) {
  if (orbitState.mode !== 'free' || !ship) return

  const state = getThrustState()
  let label, color
  if (state.mode === 'forward') {
    label = 'THRUST'
    color = '255,176,82'
  } else if (state.mode === 'brake') {
    label = 'BRAKE'
    color = '127,232,232'
  } else {
    label = 'COAST'
    color = '180,180,180'
  }

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = `rgba(${color},0.75)`
  ctx.fillText(label, w / 2, 16)
  ctx.restore()
}

function drawShockwaves(ctx) {
  if (shockwaves.length === 0) return
  const s = scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)

  for (const sw of shockwaves) {
    if (sw.r <= 0) continue
    const a = Math.max(0, sw.alpha)
    const t = sw.age / sw.duration
    const [r, g, b] = hexToRgb(sw.color)
    const ringW = Math.max(0.5, (1 - t) * 8 + 1)

    if (sw.coneHalf != null) {
      // Directional cone shockwave — angular fade: bright at center, transparent at edges
      const steps = 24
      const dA = (sw.coneHalf * 2) / steps

      // Inner fill — angular slices, each tinted by angular falloff
      if (t < 0.6) {
        const fillPeak = a * (0.6 - t) * 0.55
        for (let i = 0; i < steps; i++) {
          const aStart = sw.angle - sw.coneHalf + i * dA
          const aEnd = aStart + dA
          const aMid = (aStart + aEnd) / 2
          const angOffset = Math.abs(aMid - sw.angle) / sw.coneHalf // 0=center, 1=edge
          const angFade = Math.cos(angOffset * Math.PI * 0.5) // cos falloff
          const angFade2 = angFade * angFade
          const sliceFillA = fillPeak * angFade2
          if (sliceFillA < 0.002) continue

          ctx.save()
          ctx.beginPath()
          ctx.moveTo(sw.x, sw.y)
          ctx.arc(sw.x, sw.y, sw.r, aStart, aEnd)
          ctx.closePath()
          ctx.clip()

          const grad = ctx.createRadialGradient(sw.x, sw.y, 0, sw.x, sw.y, sw.r)
          grad.addColorStop(0, `rgba(255,255,255,${sliceFillA.toFixed(3)})`)
          grad.addColorStop(0.3, `rgba(${r},${g},${b},${(sliceFillA * 0.7).toFixed(3)})`)
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // Leading arc — white, fades toward edges
      ctx.lineWidth = ringW / s
      ctx.lineCap = 'round'
      for (let i = 0; i < steps; i++) {
        const aStart = sw.angle - sw.coneHalf + i * dA
        const aEnd = aStart + dA
        const aMid = (aStart + aEnd) / 2
        const angOffset = Math.abs(aMid - sw.angle) / sw.coneHalf
        const angFade = Math.pow(Math.cos(angOffset * Math.PI * 0.5), 2)
        const segA = a * 0.95 * angFade
        if (segA < 0.005) continue
        ctx.beginPath()
        ctx.arc(sw.x, sw.y, sw.r, aStart, aEnd)
        ctx.strokeStyle = `rgba(255,255,255,${segA.toFixed(3)})`
        ctx.stroke()
      }

      // Colored halo just inside — same angular fade
      ctx.lineWidth = (ringW * 2.2) / s
      for (let i = 0; i < steps; i++) {
        const aStart = sw.angle - sw.coneHalf + i * dA
        const aEnd = aStart + dA
        const aMid = (aStart + aEnd) / 2
        const angOffset = Math.abs(aMid - sw.angle) / sw.coneHalf
        const angFade = Math.pow(Math.cos(angOffset * Math.PI * 0.5), 2)
        const segA = a * 0.6 * angFade
        if (segA < 0.005) continue
        ctx.beginPath()
        ctx.arc(sw.x, sw.y, sw.r * 0.86, aStart, aEnd)
        ctx.strokeStyle = `rgba(${r},${g},${b},${segA.toFixed(3)})`
        ctx.stroke()
      }
    } else {
      // Omnidirectional shockwave (black hole / sun)
      ctx.beginPath()
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.95})`
      ctx.lineWidth = ringW / s
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(sw.x, sw.y, sw.r * 0.88, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.55})`
      ctx.lineWidth = (ringW * 2.5) / s
      ctx.stroke()

      if (t < 0.5) {
        const fillA = a * (0.5 - t) * 0.4
        const grad = ctx.createRadialGradient(sw.x, sw.y, 0, sw.x, sw.y, sw.r)
        grad.addColorStop(0, `rgba(255,255,255,${fillA})`)
        grad.addColorStop(0.4, `rgba(${r},${g},${b},${fillA * 0.5})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.beginPath()
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }
    }
  }

  ctx.restore()
}

// =============================================================================
// MAIN RENDER
// =============================================================================

// =============================================================================
// FOG OF WAR
// =============================================================================

// World-space distance from the ship to a point.
function distFromShip(x, y) {
  if (!ship) return Infinity
  return Math.hypot(x - ship.x, y - ship.y)
}

// Flip every grid cell the ship's vision circle overlaps to 'seen' (permanent),
// then advance the radar sweep and acquire any body its line crosses. Called once
// per frame from render() with the real (wall-clock) frame dt.
//
// Vision marking is POSITIONAL (depends only on ship pose, not dt or frame
// count), so it is fully framerate-/timescale-independent: the same ship position
// flips exactly the same cells no matter how long it sits there. The radar sweep,
// by contrast, advances in REAL seconds so it rotates at a steady visible rate
// regardless of sim timescale (like the thrust/solar particles).
function updateFogDiscovery(realDt = 0, simDt = 0) {
  if (!settings.settings.fog.enabled || !ship) return

  // --- Vision: paint the grid (exact circle-vs-cell-square overlap) ---
  // Clamp the radius defensively: revealRadius is reachable via JSON import, so a
  // pathological value (huge / NaN) must not blow up the nested loop below.
  const cell = fogCell()
  const r = Math.min(settings.settings.fog.revealRadius, 50) // hard AU ceiling
  if (r > 0 && cell > 0) {
    const cx = ship.x
    const cy = ship.y
    const r2 = r * r
    const colMin = Math.floor((cx - r) / cell)
    const colMax = Math.floor((cx + r) / cell)
    const rowMin = Math.floor((cy - r) / cell)
    const rowMax = Math.floor((cy + r) / cell)
    for (let col = colMin; col <= colMax; col++) {
      const cellMinX = col * cell
      const cellMaxX = cellMinX + cell
      // Closest x on this column's span to the circle centre (clamp) — constant
      // per column, hoisted out of the inner loop.
      const nx = cx < cellMinX ? cellMinX : cx > cellMaxX ? cellMaxX : cx
      const dx = cx - nx
      for (let row = rowMin; row <= rowMax; row++) {
        const key = cellKey(col, row)
        if (fogSeen.has(key)) continue // already permanent — skip the math
        const cellMinY = row * cell
        const cellMaxY = cellMinY + cell
        const ny = cy < cellMinY ? cellMinY : cy > cellMaxY ? cellMaxY : cy
        const dy = cy - ny
        // Circle ∩ AABB: nearest point of the cell within r ⇒ overlap. `<=` so a
        // grazing circle still counts the cell as seen.
        if (dx * dx + dy * dy <= r2) {
          fogSeen.add(key)
          if (col < fogBboxColMin) fogBboxColMin = col
          if (col > fogBboxColMax) fogBboxColMax = col
          if (row < fogBboxRowMin) fogBboxRowMin = row
          if (row > fogBboxRowMax) fogBboxRowMax = row
        }
      }
    }
  }

  // --- Radar sweep: a line rotating around the ship; a body inside radarRadius
  // is acquired only when the sweep crosses its bearing. Sticky once acquired. ---
  const radar = settings.settings.fog.radarRadius
  radarPrevAngle = radarAngle
  // The sweep advances in SIM time (so it speeds up / slows down / freezes with
  // the simulation timescale, like the engine plume). radarSweepSpeed is
  // calibrated in rad/s at the 1,000,000× reference timescale: at simScale=1e6,
  // dt_yr = realDt·1e6/SECONDS_PER_YEAR, so multiplying simDt by
  // (SECONDS_PER_YEAR/1e6)·radarSweepSpeed reproduces radarSweepSpeed·realDt
  // there, and scales proportionally at every other timescale.
  const RADAR_REF_SCALE = 1e6
  let step = settings.settings.fog.radarSweepSpeed * (SECONDS_PER_YEAR / RADAR_REF_SCALE) * simDt
  // Clamp so one slow frame (or a big timescale) can't sweep multiple full turns
  // and skip a bearing — at most ~half a turn per frame.
  const maxStep = Math.PI
  if (step > maxStep) step = maxStep
  if (step < 0) step = 0
  radarAngle = (radarPrevAngle + step) % (Math.PI * 2)
  // The swept arc this frame is (radarPrevAngle, radarPrevAngle + step]. Test
  // EVERY in-range radar target (planets, sun, black hole — detected or not) so
  // each crossing pings.
  for (const body of radarTargets()) {
    if (distFromShip(body.x, body.y) > radar) continue
    // Bearing of the body from the ship, normalized to [0, 2π).
    let bearing = Math.atan2(body.y - ship.y, body.x - ship.x)
    if (bearing < 0) bearing += Math.PI * 2
    // Angular distance from the sweep's start to this bearing, going forward.
    let delta = bearing - radarPrevAngle
    if (delta < 0) delta += Math.PI * 2
    if (delta <= step) {
      if (!body.detected) {
        body.detected = true
        radarBlink[body.id] = { t: RADAR_BLINK_DUR_DOUBLE, dur: RADAR_BLINK_DUR_DOUBLE, pulses: 2 }
      } else {
        // Acknowledge the hit with a single ping — but don't stomp an in-flight
        // acquisition double-blink.
        const cur = radarBlink[body.id]
        if (!cur || cur.pulses < 2) {
          radarBlink[body.id] = { t: RADAR_BLINK_DUR_SINGLE, dur: RADAR_BLINK_DUR_SINGLE, pulses: 1 }
        }
      }
    }
  }

  // Decay the blink timers.
  for (const id in radarBlink) {
    radarBlink[id].t -= realDt
    if (radarBlink[id].t <= 0) delete radarBlink[id]
  }
}

// Hard on/off fog: paint every UNSEEN grid cell that intersects the viewport
// solid opaque black, directly on the main ctx with default source-over. Seen
// cells are left untouched so the already-drawn world shows through. We only
// PAINT (never erase), so the old 'inverted fog' bug (destination-out erasing
// world pixels) cannot occur — no offscreen layer needed.
//
// Iteration is bounded to the explored region: outside the bbox of all seen
// cells everything is unseen, so we bulk-fill those margins with up to four
// fillRects and per-cell iterate ONLY the explored-bbox ∩ viewport. Cost is
// O(explored cells in view), constant in zoom — even fully zoomed out the loop
// never explodes.
function drawFogGrid(ctx, w, h) {
  if (!settings.settings.fog.enabled) return
  const s = scale()
  const cell = fogCell()

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0) // raster in raw screen pixels
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#000'

  // Nothing explored yet → the whole viewport is unseen.
  if (fogSeen.size === 0) {
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
    return
  }

  // Viewport → world AABB (inverse of worldToScreen; transform is axis-aligned,
  // s>0 always since cam.zoom floors at 0.004, so min<max with no sign flip).
  const worldMinX = (0 - cam.panX) / s
  const worldMaxX = (w - cam.panX) / s
  const worldMinY = (0 - cam.panY) / s
  const worldMaxY = (h - cam.panY) / s

  // Viewport cell window.
  const vColMin = Math.floor(worldMinX / cell)
  const vColMax = Math.floor(worldMaxX / cell)
  const vRowMin = Math.floor(worldMinY / cell)
  const vRowMax = Math.floor(worldMaxY / cell)

  // Per-cell iteration window = viewport ∩ explored bbox. Everything outside the
  // explored bbox is definitionally unseen → bulk-fill it, don't iterate it.
  const iColMin = Math.max(vColMin, fogBboxColMin)
  const iColMax = Math.min(vColMax, fogBboxColMax)
  const iRowMin = Math.max(vRowMin, fogBboxRowMin)
  const iRowMax = Math.min(vRowMax, fogBboxRowMax)

  // Explored bbox entirely off-screen → the whole viewport is unseen.
  if (iColMin > iColMax || iRowMin > iRowMax) {
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
    return
  }

  // Screen pixel extent of the iteration window (snapped: floor near / ceil far).
  const ix0 = Math.floor(iColMin * cell * s + cam.panX)
  const ix1 = Math.ceil((iColMax + 1) * cell * s + cam.panX)
  const iy0 = Math.floor(iRowMin * cell * s + cam.panY)
  const iy1 = Math.ceil((iRowMax + 1) * cell * s + cam.panY)

  // Bulk-black the four viewport margins OUTSIDE the iteration window.
  if (iy0 > 0) ctx.fillRect(0, 0, w, iy0) // top
  if (iy1 < h) ctx.fillRect(0, iy1, w, h - iy1) // bottom
  if (ix0 > 0) ctx.fillRect(0, iy0, ix0, iy1 - iy0) // left
  if (ix1 < w) ctx.fillRect(ix1, iy0, w - ix1, iy1 - iy0) // right

  // Per-cell: fill UNSEEN cells black; skip seen ones. Edges snapped to a shared
  // integer grid (floor near / ceil far) so adjacent black rects meet with no gap
  // and at most a sub-pixel bleed into a seen neighbour — never a full opaque px.
  for (let col = iColMin; col <= iColMax; col++) {
    const cx0 = Math.floor(col * cell * s + cam.panX)
    const cx1 = Math.ceil((col + 1) * cell * s + cam.panX)
    for (let row = iRowMin; row <= iRowMax; row++) {
      if (fogSeen.has(cellKey(col, row))) continue // seen → leave world visible
      const cy0 = Math.floor(row * cell * s + cam.panY)
      const cy1 = Math.ceil((row + 1) * cell * s + cam.panY)
      ctx.fillRect(cx0, cy0, cx1 - cx0, cy1 - cy0)
    }
  }

  ctx.restore()
}

// RADAR LAYER: draws on top of the fog for every radar-detected target (planets,
// the sun, the black hole). Two cases by cell visibility:
//   • on an UNSEEN cell — the vision layer can't show it, so draw the full sensor
//     blip (a dot + containment ring) so it stays locatable over black space.
//   • on a SEEN cell — the vision-layer visual is already there, so we don't
//     redraw the blip; we only add the NAME (below).
// Identity ("scanned", set when the detail HUD has been shown for it) appends the
// target's NAME to the radar layer EVERYWHERE — seen or unseen — and tints the
// over-fog dot with the target's own colour. An un-scanned contact is a neutral
// radar-green blip with no name. We draw markers (NOT drawBody) so a planet's
// world-space trail never leaks on top of the fog.
function drawTrackedOverFog(ctx, w, h) {
  if (!settings.settings.fog.enabled) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  for (const body of radarTargets()) {
    if (!body.detected) continue
    const sp = worldToScreen(body.x, body.y)
    if (sp.x < -60 || sp.x > w + 60 || sp.y < -60 || sp.y > h + 60) continue

    const big = body.id === 'sun' || body.id === 'blackhole'
    const identified = body.scanned
    const onFog = !worldCellSeen(body.x, body.y)
    const ring = big ? 11 : 7

    // Sensor blip (dot + ring) only where the vision layer can't show the body.
    if (onFog) {
      const core = big ? 5 : 3
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, core, 0, Math.PI * 2)
      ctx.fillStyle = identified ? body.color : 'rgba(150,235,190,0.95)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, ring, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(90,230,160,0.7)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Name appears once identified (scanned), wherever the target is.
    if (identified) {
      ctx.font = '10px monospace'
      ctx.fillStyle = body.color + 'cc'
      ctx.textAlign = 'center'
      ctx.fillText(body.name, sp.x, sp.y + ring + 11)
    }
  }
  ctx.restore()
}

// Radar blink: a bright ring that pulses at a body's position when the sweep line
// crosses it — twice on first acquisition (pulses 2), once as an acknowledging
// ping on every later crossing (pulses 1). Drawn above the fog so it shows whether
// the body sits on a seen or unseen cell.
function drawRadarBlinks(ctx, w, h) {
  if (!settings.settings.fog.enabled) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  for (const body of radarTargets()) {
    const blink = radarBlink[body.id]
    if (!blink) continue
    const sp = worldToScreen(body.x, body.y)
    if (sp.x < -60 || sp.x > w + 60 || sp.y < -60 || sp.y > h + 60) continue
    // elapsed 0→1 across the window; `pulses` half-sine flashes (on/off[/on/off]).
    const elapsed = 1 - blink.t / blink.dur
    const wave = Math.sin(elapsed * Math.PI * blink.pulses)
    const intensity = Math.max(0, wave) // bright on the up-pulses, dark between
    if (intensity <= 0.01) continue
    const big = body.id === 'sun' || body.id === 'blackhole'
    const baseR = (big ? 14 : 10) + (1 - intensity) * 8
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, baseR, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(150,255,200,${(0.9 * intensity).toFixed(3)})`
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.restore()
}

// Radar around the ship: the range ring plus a plain rotating scan line. No
// line-of-sight circle — the grid cells appearing/disappearing already
// communicate vision. Detection happens in updateFogDiscovery when this sweep
// crosses a body's bearing.
function drawRadarRings(ctx) {
  if (!settings.settings.fog.enabled || !ship) return
  const s = scale()
  const sp = worldToScreen(ship.x, ship.y)
  const radR = settings.settings.fog.radarRadius * s

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Radar range ring (dashed).
  ctx.strokeStyle = 'rgba(90,230,160,0.28)'
  ctx.setLineDash([6, 8])
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, radR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // The scan line.
  ctx.strokeStyle = 'rgba(120,255,190,0.75)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(sp.x, sp.y)
  ctx.lineTo(sp.x + Math.cos(radarAngle) * radR, sp.y + Math.sin(radarAngle) * radR)
  ctx.stroke()

  ctx.restore()
}

function render(ctx, w, h, realDt, simDt = 0) {
  ctx.clearRect(0, 0, w, h)

  // Shockwaves and solar particles are simulation, not just decoration — freeze
  // them while paused so the whole sim stops consistently (debris/thrust/physics
  // are already gated in the loop).
  if (isPlaying.value) {
    tickShockwaves(realDt)
    tickSolarParticles(realDt, w, h)
  }
  applyFocusMode(w, h)
  updateOrbitAimFromMouse()
  updateFogDiscovery(realDt, simDt)

  drawStarfield(ctx, w, h)
  drawGasCloud(ctx)
  drawOrbits(ctx)
  drawSolarGravityWell(ctx)
  drawBlackHole(ctx)
  drawCaptureTether(ctx)

  drawThrustParticles(ctx)

  for (const body of bodies) {
    drawBody(ctx, body, w, h)
  }
  if (ship) drawShip(ctx, ship, 0, w, h)

  // Re-entry drag flare on bodies/ship plowing through the gas cloud.
  drawGasCloudFriction(ctx)

  drawShockwaves(ctx)
  drawDebris(ctx)
  drawSlingshotRing(ctx)

  // Fog of war sits above the world but below the HUD/score so chrome stays
  // legible. Black out unseen grid cells, then draw the RADAR LAYER on top of the
  // fog — all onboard-computer projections (digital data, not eyes-on, so they
  // pierce the fog): the ship's projected path, the targeted planet's projected
  // shot path + aiming cue, radar-tracked contacts, just-acquired blinks, then the
  // radar sweep + range ring.
  drawFogGrid(ctx, w, h)
  drawPredictionPath(ctx)
  drawOrbitCue(ctx)
  drawTrackedOverFog(ctx, w, h)
  drawRadarBlinks(ctx, w, h)
  drawRadarRings(ctx)

  drawConsumedPlanets(ctx, h)
  drawThrustIndicator(ctx, w)
  drawEnergyHUD(ctx, w, h)
  drawHUD(ctx, w, h, realDt, simDt)
}

// =============================================================================
// MAIN LOOP
// =============================================================================

let rafId = null
let lastTime = null
let _w = 0,
  _h = 0
let simYears = 0
let sceneBuilt = false // gate so ResizeObserver only builds the scene once
let teardown = null // assigned by initCanvas; called from onUnmounted

function initCanvas(canvas) {
  if (!canvas) return
  let ctx = null

  // --- Keyboard ---
  function isTypingTarget(el) {
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
  }

  function onKeyDown(e) {
    // Don't hijack keys while the user is typing in a settings field — otherwise
    // 'r' resets the game, '1-4' change timescale, WASD get preventDefault, etc.
    if (isTypingTarget(e.target)) return

    // Escape: break orbit/capture
    if (
      e.key === 'Escape' &&
      (orbitState.mode === 'slingshot' || orbitState.mode === 'capturing')
    ) {
      breakOrbit(true)
      return
    }
    if (e.key === 'q' || e.key === 'Q') {
      timeScaleStepIdx = Math.max(0, timeScaleStepIdx - 1)
      timeScaleTarget = TIME_STEPS[timeScaleStepIdx]
      return
    }
    if (e.key === 'e' || e.key === 'E') {
      timeScaleStepIdx = Math.min(TIME_STEPS.length - 1, timeScaleStepIdx + 1)
      timeScaleTarget = TIME_STEPS[timeScaleStepIdx]
      return
    }
    if (e.key === '1') {
      timeScaleStepIdx = 0
      timeScaleTarget = TIME_STEPS[0]
      return
    }
    if (e.key === '2') {
      timeScaleStepIdx = 1
      timeScaleTarget = TIME_STEPS[1]
      return
    }
    if (e.key === '3') {
      timeScaleStepIdx = 2
      timeScaleTarget = TIME_STEPS[2]
      return
    }
    if (e.key === '4') {
      timeScaleStepIdx = 3
      timeScaleTarget = TIME_STEPS[3]
      return
    }
    if (e.key === 'r' || e.key === 'R') {
      reset()
      return
    }
    if (e.key === 'z' || e.key === 'Z') {
      cam.focus = 'sun'
      return
    }
    if (e.key === 'x' || e.key === 'X') {
      cam.focus = 'ship'
      return
    }

    // WASD ship controls
    if (e.key === 'w' || e.key === 'W') {
      keys.w = true
      e.preventDefault()
    }
    if (e.key === 'a' || e.key === 'A') {
      keys.a = true
      e.preventDefault()
    }
    if (e.key === 's' || e.key === 'S') {
      keys.s = true
      e.preventDefault()
    }
    if (e.key === 'd' || e.key === 'D') {
      keys.d = true
      e.preventDefault()
    }
    if (e.key === ' ') {
      keys.space = true
      e.preventDefault()
    }
  }

  function onKeyUp(e) {
    if (e.key === 'w' || e.key === 'W') keys.w = false
    if (e.key === 'a' || e.key === 'A') keys.a = false
    if (e.key === 's' || e.key === 'S') keys.s = false
    if (e.key === 'd' || e.key === 'D') keys.d = false
    if (e.key === ' ') keys.space = false
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  // Releasing focus (alt-tab, clicking a settings input) can swallow the keyup
  // for a held key, leaving it stuck "down" and the ship thrusting forever.
  // Clear all keys whenever the window loses focus.
  window.addEventListener('blur', clearKeys)

  // --- Mouse ---
  function updateMouseFromEvent(e) {
    const rect = canvas.getBoundingClientRect()
    mouse.x = e.clientX - rect.left
    mouse.y = e.clientY - rect.top
    mouse.hasPosition = true
  }

  function onMouseLeave() {
    mouse.hasPosition = false
    if (orbitState.mode === 'slingshot') orbitDrag = null
  }

  function isHudFocusButtonAt(cx, cy) {
    const bw = 110,
      bh = 22,
      gap = 6,
      startX = 12,
      startY = 12
    for (let i = 0; i < 2; i++) {
      const bx = startX + i * (bw + gap)
      if (cx >= bx && cx <= bx + bw && cy >= startY && cy <= startY + bh) return true
    }
    return false
  }

  function onMouseDown(e) {
    if (e.button !== 0) return
    updateMouseFromEvent(e)

    if (isHudFocusButtonAt(mouse.x, mouse.y)) return // let onCanvasClick handle it

    if (orbitState.mode === 'slingshot' || orbitState.mode === 'capturing') {
      updateOrbitAimFromMouse()
      fireShot()
      orbitDrag = null
    }
  }

  function onMouseMove(e) {
    updateMouseFromEvent(e)

    if (orbitState.mode === 'slingshot' || orbitState.mode === 'capturing') {
      updateOrbitAimFromMouse()
      return
    }
  }

  function onMouseUp(e) {
    updateMouseFromEvent(e)

    if (orbitState.mode === 'slingshot') return
  }

  function onWheel(e) {
    e.preventDefault()
    const factor = Math.pow(1.12, -e.deltaY / 100)
    zoomAt(factor, e.offsetX, e.offsetY)
  }

  // --- HUD button click ---
  function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const bw = 110,
      bh = 22,
      gap = 6,
      startX = 12,
      startY = 12
    const focusModes = ['sun', 'ship']
    focusModes.forEach((fm, i) => {
      const bx = startX + i * (bw + gap)
      if (cx >= bx && cx <= bx + bw && cy >= startY && cy <= startY + bh) {
        cam.focus = fm
      }
    })
  }

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('mouseleave', onMouseLeave)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('click', onCanvasClick)

  // --- Resize ---
  // Resizing only updates canvas dimensions and the background starfield (which
  // is tiled to the viewport). It must NOT rebuild the scene — the camera
  // recenters itself every frame in applyFocusMode(), so a window resize leaves
  // the running game untouched. The scene is built once on the first resize and
  // thereafter only on explicit reset().
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect()
    _w = rect.width
    _h = rect.height - 96
    canvas.width = _w
    canvas.height = _h
    canvas.style.width = _w + 'px'
    canvas.style.height = _h + 'px'
    ctx = canvas.getContext('2d')

    if (!sceneBuilt) {
      buildScene(_w, _h)
      sceneBuilt = true
    } else {
      buildStarfield(_w, _h)
    }
  }

  const observer = new ResizeObserver(resizeCanvas)
  observer.observe(canvas.parentElement)
  resizeCanvas()

  // --- Animation loop ---
  function loop(ts) {
    let realDt = 0
    let simDt = 0 // sim-years advanced THIS frame (0 while paused) — drives the radar sweep
    if (lastTime !== null) {
      realDt = Math.min((ts - lastTime) / 1000, MAX_DT) // seconds

      // Animate timeScale toward target in log space for perceptually even easing.
      const cur = timeScale.value
      const tgt = timeScaleTarget
      if (Math.abs(cur - tgt) < 1) {
        timeScale.value = tgt
      } else {
        const logCur = Math.log(Math.max(1, cur))
        const logTgt = Math.log(Math.max(1, tgt))
        const logNew = logCur + (logTgt - logCur) * Math.min(1, realDt * 4)
        timeScale.value = Math.exp(logNew)
      }

      const simScale = timeScale.value
      const dt_yr = (realDt * simScale) / SECONDS_PER_YEAR // yr per frame

      if (isPlaying.value) {
        simDt = dt_yr
        simStep(dt_yr, realDt)
        tickDebris(dt_yr, realDt)
        tickThrustParticles(dt_yr)
        if (!ship && shipLoss) deathTextAge += realDt
        simYears += dt_yr

        for (const body of bodies) {
          if (body.trail && body.trail.push) body.trail.push(body.x, body.y)
        }

        bodyCount.value = bodies.length
        const { totalMonths, years, monthInYear } = getTimeParts()
        elapsedLabel.value = `Month ${totalMonths.toLocaleString()} • Year ${years.toLocaleString()} M${monthInYear}`

        // Prediction (only in free mode)
        predCountdown--
        if (predCountdown <= 0) {
          predCountdown = PRED_INTERVAL
          shipPredPath = computePrediction()
        }
      }
    }
    lastTime = ts
    if (ctx) render(ctx, _w, _h, realDt, simDt)
    // Plume is sim-time-driven, so it freezes with the sim while paused — no
    // separate paused tick needed.
    rafId = requestAnimationFrame(loop)
  }

  rafId = requestAnimationFrame(loop)

  // initCanvas runs from GameShell's @canvas-ready emit, i.e. inside the
  // child's onMounted where Game is NOT the active instance — so we can't call
  // onUnmounted() here. Instead we hand teardown back to the component's own
  // onUnmounted hook (registered at setup top-level) via this cleanup fn.
  teardown = () => {
    cancelAnimationFrame(rafId)
    rafId = null
    observer.disconnect()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', clearKeys)
    clearKeys()
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mouseup', onMouseUp)
    canvas.removeEventListener('mouseleave', onMouseLeave)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('click', onCanvasClick)
  }
}

// =============================================================================
// CONTROLS
// =============================================================================

function togglePlay() {
  isPlaying.value = !isPlaying.value
}
function reset() {
  simYears = 0
  shipPredPath = []
  predCountdown = 0
  lastTime = null
  isPlaying.value = true
  timeScaleStepIdx = 2
  timeScaleTarget = TIME_STEPS[2]
  timeScale.value = TIME_STEPS[2]
  buildScene(_w, _h)
}

// Registered here at setup top-level (not inside initCanvas, which runs under
// GameShell's instance) so teardown reliably binds to THIS component.
onUnmounted(() => teardown?.())

watch(
  () => settings.settings.visuals.trailLength,
  (v) => {
    // Preserve existing trail history across resizes — re-seed the new buffer
    // with the most recent points so dragging the slider doesn't wipe trails.
    for (const b of bodies) {
      if (!b.trail) continue
      if (b.isFixed) continue // fixed bodies keep their inert (cap 0) trail
      const prev = b.trail.points()
      const next = makeTrail(v)
      for (const p of prev.slice(-v)) next.push(p.x, p.y)
      b.trail = next
    }
  },
)
</script>

<style scoped>
/* Steering mode selector — sits in the Spaceship settings section */
.steering-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.steering-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.steering-label {
  color: #99a;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.steering-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.steering-btn {
  padding: 5px 0;
  background: #111128;
  border: 1px solid #2a2a4a;
  border-radius: 4px;
  color: #889;
  font-family: monospace;
  font-size: 11px;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s,
    border-color 0.12s;
}
.steering-btn:hover {
  background: #161640;
  color: #aab;
}
.steering-btn.active {
  background: #0d1a2a;
  border-color: #4fc3f7;
  color: #4fc3f7;
}

.info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #4a5a6a;
  background: #151530;
  color: #7bafd6;
  font-size: 9px;
  font-style: italic;
  font-family: serif;
  font-weight: bold;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}
.info-btn:hover {
  border-color: #4fc3f7;
  color: #4fc3f7;
  background: #0d1a2a;
}

/* Steering explainer modal — matches SettingsRow's modal styling */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-box {
  background: #0d0d1e;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 20px 24px;
  max-width: 340px;
  width: 90%;
  font-family: monospace;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7);
}

.modal-title {
  font-size: 13px;
  color: #4fc3f7;
  margin-bottom: 10px;
  letter-spacing: 0.05em;
}

.modal-body {
  font-size: 12px;
  color: #aab;
  line-height: 1.6;
  margin-bottom: 16px;
}
.modal-body strong {
  color: #7bafd6;
}

.modal-close {
  display: block;
  width: 100%;
  padding: 6px;
  background: #111128;
  border: 1px solid #333;
  border-radius: 4px;
  color: #aaa;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
}
.modal-close:hover {
  background: #1a1a40;
  color: #e0e0e0;
}
</style>
