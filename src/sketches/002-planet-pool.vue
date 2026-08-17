<template>
  <GameShell
    :is-playing="isPlaying"
    :show-speed="false"
    :body-count="bodyCount"
    :elapsed-label="elapsedLabel"
    @canvas-ready="initCanvas"
    @toggle-play="togglePlay"
    @reset="reset"
  >
    <button class="help-toggle" @click="helpOpen = true">? Help</button>

    <div v-if="helpOpen" class="modal-backdrop" @click.self="helpOpen = false">
      <div class="modal-box help-box">
        <div class="modal-title">Planet Pool — how it works</div>
        <div class="modal-body help-body">
          <p class="help-intro">
            No ship. You reach straight into the system and play the planets themselves: pull one
            back like a cue ball, let go, and let orbital gravity carry it into the black hole.
          </p>

          <div class="help-h">1 · The shot</div>
          <p>
            <strong>Press and hold on a planet</strong>, drag <em>away</em> from it, and
            <strong>release</strong>. The planet fires in the opposite direction to your pull —
            classic pool. Pull further for more power; the arc gauge on the cue shows how much.
            Release right next to the planet (or press <strong>Esc</strong>) to cancel for free.
          </p>
          <p>
            <strong>Time stops while you aim.</strong> Lining a shot up against a moving target
            would be a reflex test, not a pool shot — so the moment you grab a planet the whole
            system holds still, and the dashed preview is exactly what will happen.
          </p>

          <div class="help-h">2 · Mass is drawn as size</div>
          <p>
            A planet's <strong>radius follows its mass</strong>, so the big ones really are the
            heavy ones. Mass is what resists your shot: the same pull that flings a light world
            across the system barely nudges a heavy one. Aim heavy planets early, while you can
            still afford the power.
          </p>

          <div class="help-h">3 · Yield is drawn as a ring</div>
          <p>
            Around every planet is a <strong>segmented ring</strong> — that is its
            <strong>energy yield</strong>: what you are paid when you sink it. Yield has
            <strong>nothing to do with mass</strong>. A cheap little rock can be the richest thing
            on the table, and the giant you spent half your power moving may pay almost nothing.
            Read the ring, not the size.
          </p>

          <div class="help-h">4 · Stable and rogue</div>
          <p>
            A planet sitting on its opening orbit is <strong>stable</strong>: it feels the sun and
            nothing else. Real planetary gravity is about a ten-thousandth of the star's here, so
            left alone the rack would never disturb itself.
          </p>
          <p>
            The moment you shoot one it goes <strong>rogue</strong>, and its gravity is turned up to
            something comical — enough to rival the sun at close range. A rogue is drawn with a
            bright outline inside its field: a faint <strong>outer rim</strong> where its pull fades
            to nothing, and a live <strong>inner ring</strong> where the pull is strong enough to
            tear a stable planet off its orbit.
          </p>
          <p>
            Drift a stable planet through that inner ring and it is knocked loose too — it goes
            rogue and starts pulling on everything in turn. A single well-placed break can unravel
            the whole rack. A distant pass only bends an orbit; it takes a real tug to wake
            something.
          </p>

          <div class="help-h">5 · Energy</div>
          <p>
            There is no solar power here. <strong>Pocketing a planet is your only income.</strong>
            Every shot spends energy from the bar on the left (the red segment previews what the
            current pull will cost), and the shot is capped at whatever you have left. Sink a planet
            in the black hole and its yield is added to the bar.
          </p>
          <p>
            A planet that falls into the <strong>sun</strong> is destroyed and pays
            <strong>nothing</strong>. One flung out past the edge of the system is
            <strong>lost</strong> the same way. Run the bar to zero with planets still on the table
            and the run is stranded — reset and try a different order.
          </p>

          <div class="help-h">6 · The band</div>
          <p>
            The crackling line strung between two anchors is an
            <strong>elastic band</strong>, and it guards the approach to the pocket. It is not a
            wall: a planet pushes <em>into</em> it, the band bends to follow, and the further it is
            carried the harder the two stretched halves pull back — so it takes the planet's speed
            away and hands it back the other way.
          </p>
          <p>
            The dashed rails either side show how far it will stretch before it
            <strong>lets go</strong>: hit it hard enough and the planet punches straight through. A
            hit near the middle comes back the way it went in; a glancing hit near an anchor
            <strong>skids along</strong> the band instead. Both ends are open, so you can also just
            go round it.
          </p>

          <div class="help-h">7 · Looking around</div>
          <p>
            The level is revealed at the start by a scan expanding out from the sun. After that:
            <strong>right-drag</strong> to pan, <strong>scroll</strong> to zoom,
            <strong>click empty space</strong> (or press <strong>Z</strong>) to re-centre on the
            sun, and <strong>F</strong> to fit the whole system on screen.
          </p>

          <div class="help-h">8 · The clock</div>
          <p>
            The curved band at the bottom is time. <strong>Hold Q</strong> to wind it down toward
            real time and <strong>hold E</strong> to wind it up to 20M× — the bead slides
            continuously, so there is no jump between "too slow to bother" and "too fast to follow".
            The notch in the middle is <strong>1M×</strong>, the speed the game is played at: about
            half a minute to the orbit. Let go and the slider springs back to it.
            <strong>1</strong>–<strong>4</strong> jump straight to 1×, 100K×, 1M× and 20M×.
          </p>

          <div class="help-h">Controls</div>
          <p class="help-keys">
            <strong>Left-drag a planet</strong> — aim &amp; fire (time holds) &nbsp;·&nbsp;
            <strong>Esc</strong> — cancel the shot &nbsp;·&nbsp; <strong>Right-drag</strong> — pan
            &nbsp;·&nbsp; <strong>Wheel</strong> — zoom &nbsp;·&nbsp; <strong>Z</strong> — centre on
            the sun &nbsp;·&nbsp; <strong>F</strong> — fit the system &nbsp;·&nbsp;
            <strong>Q</strong> / <strong>E</strong> hold — time slower / faster &nbsp;·&nbsp;
            <strong>1–4</strong> — time presets &nbsp;·&nbsp; <strong>R</strong> — reset.
          </p>
        </div>
        <button class="modal-close" @click="helpOpen = false">Close</button>
      </div>
    </div>

    <template #controls>
      <button class="ctrl-btn" @click="focusSun">◎ Sun</button>
      <button class="ctrl-btn" @click="fitSystem">⤢ Fit</button>
    </template>

    <template #settings>
      <SettingsPanel @export="settings.exportJSON()" @import="onImport">
        <SettingsSection title="The cue">
          <SettingsRow
            v-model="settings.settings.cue.shotPower"
            label="Shot power (AU/yr)"
            :min="0.2"
            :max="10"
            :step="0.1"
            :decimals="1"
            tooltip="Δv a full-power shot gives a reference-mass planet. Every other planet scales from this by its mass."
          />
          <SettingsRow
            v-model="settings.settings.cue.maxDrag"
            label="Max drag (px)"
            :min="60"
            :max="400"
            :step="10"
            :decimals="0"
            tooltip="Pull distance that counts as full power. Pulling further does nothing."
          />
          <SettingsRow
            v-model="settings.settings.cue.shotCost"
            label="Full-shot cost"
            :min="0"
            :max="120"
            :step="5"
            :decimals="0"
            tooltip="Energy a full-power shot spends. A half-power pull costs half of it."
          />
          <SettingsRow
            v-model="settings.settings.cue.massExponent"
            label="Mass resistance"
            :min="0"
            :max="1"
            :step="0.05"
            :decimals="2"
            tooltip="How much mass resists a shot. 1 = true impulse physics (Δv = J/m), 0 = mass ignored (classic pool). The default keeps heavy planets sluggish but still playable."
          />
        </SettingsSection>

        <SettingsSection title="Planets">
          <SettingsRow
            v-model="settings.settings.planets.sizeExponent"
            label="Mass → size"
            :min="0"
            :max="1"
            :step="0.01"
            :decimals="2"
            tooltip="Power law from mass to drawn radius. 0.33 is constant density (physically honest); higher exaggerates the spread so masses read apart at a glance."
          />
          <SettingsRow
            v-model="settings.settings.planets.sizeScale"
            label="Planet size (AU)"
            :min="0.01"
            :max="0.15"
            :step="0.005"
            :decimals="3"
            tooltip="Drawn radius of a reference-mass planet. Purely visual — it does not change the physics."
          />
        </SettingsSection>

        <SettingsSection title="Rogue gravity">
          <SettingsRow
            v-model="settings.settings.rogue.boost"
            label="Rogue pull"
            :min="0"
            :max="60000"
            :step="500"
            :decimals="0"
            tooltip="Multiplier on G between rogue planets. Real planetary gravity is about 1/10000th of the sun's here, so nothing you shot would ever disturb anything — this is the knob that makes planets matter to each other. 0 switches the whole mechanic off."
          />
          <SettingsRow
            v-model="settings.settings.rogue.influence"
            label="Rogue reach (AU)"
            :min="0.05"
            :max="1.5"
            :step="0.05"
            :decimals="2"
            tooltip="Radius at which a rogue planet's pull falls to zero — the outer dashed rim drawn around it."
          />
          <SettingsRow
            v-model="settings.settings.rogue.wakeAccel"
            label="Wake threshold"
            :min="0.5"
            :max="60"
            :step="0.5"
            :decimals="1"
            tooltip="Net pull (AU/yr²) a stable planet must feel before it is knocked loose and goes rogue itself. The solid inner ring on a rogue shows where that happens. Lower = chain reactions spread easily; higher = only a close pass breaks the rack. For scale, the sun pulls at about 39 AU/yr² from 1 AU."
          />
        </SettingsSection>

        <SettingsSection title="Elastic band">
          <SettingsRow
            v-model="settings.settings.band.stiffness"
            label="Band stiffness"
            :min="0"
            :max="20000"
            :step="250"
            :decimals="0"
            tooltip="How hard the band pulls back per unit of stretch. 0 switches it off entirely. Too soft and every shot punches straight through it."
          />
          <SettingsRow
            v-model="settings.settings.band.reach"
            label="Band depth (AU)"
            :min="0.05"
            :max="1.5"
            :step="0.05"
            :decimals="2"
            tooltip="How far a planet can carry the band past its rest line before it lets go. Deeper means more room to absorb a fast planet — and a bigger window to punch through."
          />
        </SettingsSection>

        <SettingsSection title="Table">
          <SettingsRow
            v-model="settings.settings.table.pocketRadius"
            label="Pocket radius (AU)"
            :min="0.02"
            :max="0.4"
            :step="0.01"
            :decimals="2"
            tooltip="How close a planet must get to the black hole to be sunk."
          />
          <SettingsRow
            v-model="settings.settings.table.pocketPull"
            label="Pocket pull"
            :min="0"
            :max="5"
            :step="0.1"
            :decimals="1"
            tooltip="Black hole mass (M☉). It pulls planets inside its influence radius, from any direction."
          />
          <SettingsRow
            v-model="settings.settings.table.pocketInfluence"
            label="Pocket influence (AU)"
            :min="0.1"
            :max="3"
            :step="0.1"
            :decimals="1"
            tooltip="Radius within which the black hole pulls at all."
          />
          <SettingsRow
            v-model="settings.settings.table.startEnergy"
            label="Starting energy"
            :min="0"
            :max="400"
            :step="10"
            :decimals="0"
            tooltip="Energy in the bar at the break. Applied on the next reset."
          />
        </SettingsSection>

        <SettingsSection title="Time">
          <div class="steering-field">
            <div class="steering-header">
              <span class="steering-label">Slider springs home</span>
            </div>
            <div class="steering-options">
              <button
                class="steering-btn"
                :class="{ active: settings.settings.time.spring }"
                @click="settings.settings.time.spring = true"
              >
                On
              </button>
              <button
                class="steering-btn"
                :class="{ active: !settings.settings.time.spring }"
                @click="settings.settings.time.spring = false"
              >
                Off
              </button>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Reveal &amp; visuals">
          <SettingsRow
            v-model="settings.settings.reveal.duration"
            label="Reveal time (s)"
            :min="0"
            :max="12"
            :step="0.5"
            :decimals="1"
            tooltip="How long the opening scan takes to expand from the sun over the whole level. Replays on reset."
          />
          <SettingsRow
            v-model="settings.settings.visuals.trailLength"
            label="Trail length"
            :min="0"
            :max="4000"
            :step="50"
            :decimals="0"
            tooltip="Number of past positions kept in a planet's trail. Applied on the next reset."
          />
        </SettingsSection>
      </SettingsPanel>
    </template>
  </GameShell>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import GameShell from '../components/GameShell.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import SettingsSection from '../components/SettingsSection.vue'
import SettingsRow from '../components/SettingsRow.vue'
import { useSettings } from '../composables/useSettings.js'
import { useCanvasLoop } from '../composables/useCanvasLoop.js'
import { createTimeWarp, planSubsteps, formatWarp } from '../engine/timeWarp.js'
import { G_SIM, SECONDS_PER_YEAR } from '../engine/units.js'
import { makeTrail, batchTrail } from '../engine/trail.js'
import { createCamera } from '../engine/camera.js'
import { createStarfield } from '../engine/starfield.js'
import { radiusFromMass, deltaVFromShot } from '../engine/planets.js'
import { applyRogueGravity, wakeRadius } from '../engine/gravity.js'
import { corridorBands } from '../engine/corridor.js'
import { bandResponse, bandShape } from '../engine/elasticBand.js'
import hubbleUrl from '../Images/hubble.jpg'

// =============================================================================
// WHAT THIS SKETCH IS
// =============================================================================
// Game mode 002. No ship: the player grabs a planet directly and shoots it, and
// the ONLY source of energy is sinking planets. Two properties of a planet are
// deliberately independent, and both are drawn:
//
//   mass  → the planet's RADIUS (and how much it resists a shot)
//   yield → the SEGMENTED RING around it (and what sinking it pays)
//
// So the biggest thing on the table is not the most valuable thing on the table,
// and the player has to read the rings to plan an order of shots.
//
// Everything that isn't specific to this mode is shared: GameShell + the settings
// panel (components/), the camera, the parallax sky and the mass/shot math
// (engine/), and canvas sizing + the rAF loop (composables/useCanvasLoop.js).

const SKETCH_ID = 'galaxy-pool-002-planet-pool'

const helpOpen = ref(false)

// =============================================================================
// CONSTANTS
// =============================================================================

// GameShell's control bar is an absolute overlay, and this sketch hides its
// stepped speed widget (it draws its own time band instead), so the bar is
// shorter here than in 001. Measure it rather than hardcoding a height that
// would leave a dead strip along the bottom.
const CONTROL_BAR_FALLBACK_H = 48
function controlBarHeight(canvas) {
  return canvas?.parentElement?.querySelector('.controls')?.offsetHeight ?? CONTROL_BAR_FALLBACK_H
}

const SUN = {
  mass: 1.0,
  // Drawn larger than the heaviest planet on the table (Ferrum lands at ~0.062
  // AU with the default size settings) so the star still reads as the star,
  // without either of them ballooning into caricature.
  drawR: 0.085,
  color: '#FFD700',
  // A planet that touches this is destroyed and pays nothing.
  killR: 0.105,
}

// The pocket. Parked well outside every orbit so nothing drifts in on its own —
// planets only reach it because the player put them there.
const POCKET = {
  x: 4.8,
  y: 2.5,
  drawR: 0.09,
  color: '#b48cff',
}

// An elastic band, strung between two anchors — the cushion of this table. It
// is angled across the lower right so a planet fired out that way is thrown back
// UP toward the pocket: the bank shot. See engine/elasticBand.js for how it
// catches and returns a planet.
// Set square across the sun → pocket line, about two thirds of the way out, so
// it is a barrier rather than a glancing rail: the direct shot at the hole is
// blocked, and you either round an anchor or bank off it.
const BAND = {
  x1: 3.6,
  y1: 0.1,
  x2: 2.15,
  y2: 2.9,
  color: '#7fe4ff',
}

// Mass a planet's drawn radius and shot response are both measured against
// (≈ Earth). Also the unit the HUD reports mass in.
const REF_MASS = 3.003e-6 // M☉ — one Earth mass

// Yield the ring is scaled against: a MAX_YIELD planet lights every segment.
const MAX_YIELD = 100
const YIELD_SEGMENTS = 12

// A planet this far from the sun is gone for good.
const ESCAPE_R = 40

// Trail rendering budget. Ten single-alpha polylines read the same as a
// per-segment fade and cost three orders of magnitude fewer draw calls, and
// points landing within ~1.5px of each other are dropped before drawing.
const TRAIL_BANDS = 10
const TRAIL_MIN_STEP_PX = 1.5

// Pull shorter than this is a cancel, not a shot.
const SHOT_DEADZONE_PX = 10
// Extra pixels around a planet's disc that still count as grabbing it, so small
// planets stay clickable when zoomed out.
const GRAB_MARGIN_PX = 14
// How far a press may travel and still count as a click, not a drag.
const CLICK_SLOP_PX = 4

// Shot prediction.
// How wide the forecast corridor has spread by the end of its horizon, and how
// many single-alpha polylines each edge is drawn with.
const PRED_SPREAD_AU = 0.05
const PRED_BANDS = 14
const PRED_HORIZON_YR = 0.75
const PRED_STEPS = 900
const PRED_DT_YR = PRED_HORIZON_YR / PRED_STEPS

// The table. Masses span ~10× and yields are deliberately UNCORRELATED with
// them: Ferrum is the heaviest and nearly worthless, Hollow is the lightest and
// the richest, and the ones in between are shuffled so the pattern can't be
// guessed from size alone.
const PLANET_SET = [
  {
    id: 'ferrum',
    name: 'Ferrum',
    mass: 8.0e-6,
    orbR: 0.58,
    angle: 0.4,
    energyYield: 20,
    color: '#c07a3c',
    note: 'Iron core, stripped mantle. Dense, slow, and almost worthless.',
  },
  {
    id: 'vesper',
    name: 'Vesper',
    mass: 1.6e-6,
    orbR: 0.84,
    angle: 2.6,
    energyYield: 75,
    color: '#e8cda0',
    note: 'Thick reactive atmosphere. Light to move and rich to sink.',
  },
  {
    id: 'tessera',
    name: 'Tessera',
    mass: 4.2e-6,
    orbR: 1.15,
    angle: 4.9,
    energyYield: 35,
    color: '#5fd0bd',
    note: 'Tiled crust over a deep ocean. Heavy going, modest return.',
  },
  {
    id: 'hollow',
    name: 'Hollow',
    mass: 8.0e-7,
    orbR: 1.46,
    angle: 1.2,
    energyYield: 95,
    color: '#c9a7ff',
    note: 'Cavernous and nearly empty. The best payout on the table.',
  },
  {
    id: 'cinder',
    name: 'Cinder',
    mass: 6.0e-6,
    orbR: 1.78,
    angle: 3.9,
    energyYield: 45,
    color: '#e8714a',
    note: 'Burnt-out furnace world. Big, and worth rather more than it looks.',
  },
  {
    id: 'wisp',
    name: 'Wisp',
    mass: 1.1e-6,
    orbR: 2.1,
    angle: 5.6,
    energyYield: 60,
    color: '#7fd4ff',
    note: 'Barely held together. Answers to the lightest touch.',
  },
]

const TOTAL_PLANETS = PLANET_SET.length
const TOTAL_YIELD = PLANET_SET.reduce((sum, p) => sum + p.energyYield, 0)

// =============================================================================
// SETTINGS
// =============================================================================

const settings = useSettings(SKETCH_ID, {
  cue: {
    shotPower: 3.0, // AU/yr delivered to a reference-mass planet at full pull
    maxDrag: 220, // px of pull that counts as full power
    shotCost: 45, // energy a full-power shot spends
    massExponent: 0.5, // how hard mass resists the shot (see engine/planets.js)
  },
  planets: {
    sizeExponent: 1 / 3, // constant density
    sizeScale: 0.045, // drawn radius (AU) of a reference-mass planet
  },
  band: {
    // Enough to turn a planet around inside the band's depth at ordinary shot
    // speeds; a hard enough hit still punches straight through it.
    stiffness: 2500,
    reach: 0.35, // AU it stretches past its rest line before letting go
  },
  table: {
    pocketRadius: 0.12,
    pocketPull: 1.2,
    pocketInfluence: 0.9,
    startEnergy: 140,
  },
  rogue: {
    // Comically large on purpose: at real scale a planet's pull on another
    // planet is ~1e-4 of the sun's and nothing you shoot ever disturbs anything.
    boost: 12000,
    influence: 0.35, // AU — where a rogue's pull reaches zero
    wakeAccel: 8, // AU/yr² of net pull needed to knock a stable planet loose
  },
  time: {
    // With the spring on, the clock is a throttle you hold rather than a mode
    // you leave switched on: release Q/E and it returns to the cruising speed.
    spring: true,
  },
  reveal: { duration: 6 },
  visuals: { trailLength: 900 },
})

function onImport(parsed) {
  settings.importJSON(parsed)
  reset()
}

// =============================================================================
// REACTIVE STATE (for GameShell)
// =============================================================================

const isPlaying = ref(true)
const bodyCount = ref(0)
const elapsedLabel = ref('')

// Continuous time warp, ported from the hyperwarp rig (engine/timeWarp.js).
// 1,000,000× is pinned at the centre because that is the speed this mode is
// actually played at: an orbit takes about half a minute, which is long enough
// to line a shot up and short enough to watch one land. Q winds down to a crawl
// for a close pass, E winds up to 20M× to skip ahead, and letting go springs the
// control back home.
const TIME_PRESETS = [1, 100000, 1000000, 20000000]
const warp = createTimeWarp({ min: 1, mid: 1e6, max: 2e7, spring: true })

// Integration ceiling. At 20M× a whole frame is ~0.01 sim-years, which a single
// Euler step turns into precessing orbits and planets tunnelling through each
// other's fields; substepping keeps the physics honest at any warp. The step
// COUNT is capped too, so a slow frame loses accuracy instead of hanging.
const MAX_SUBSTEP_YR = 1e-4
const MAX_SUBSTEPS = 64

// =============================================================================
// SIMULATION STATE
// =============================================================================

let planets = [] // every planet ever spawned, including sunk/burned/lost ones
let simYears = 0

// Energy — the whole economy of this mode.
let energy = 0
// What the BAR is showing. Energy arrives in motes from the pocket and is spent
// in one lump on a shot, and either way a bar that jumped would lose the moment.
// `energyShown` chases `energy` so the fill grows and drains visibly; every
// gameplay decision still reads the true value.
let energyShown = 0
let energyBanked = 0 // lifetime income, for the score readout
let energySpent = 0

let shotsFired = 0
let pocketed = [] // planets sunk, in order
let burned = [] // planets lost to the sun
let lost = [] // planets flung out of the system

// Opening reveal: a circle centred on the sun whose radius grows until it covers
// the whole view. Purely a presentation layer — it hides nothing from the
// physics, and once it completes the overlay stops being drawn at all.
//
// Tracked as PROGRESS (0..1 over the configured seconds) rather than as a radius
// in AU. A fixed AU target was wrong twice over: it finished before reaching the
// corners of a wide window, so the last of the fog vanished in one frame instead
// of being swept away, and how long the sweep appeared to take depended on the
// zoom. Progress against a target measured from the viewport fixes both — the
// scan always ends exactly as it covers the last corner.
let revealProgress = 0

// World radius the scan has to reach: the furthest canvas corner from the sun,
// plus a little margin so the edge never clips inside the frame.
function revealTargetR(w, h) {
  const sun = cam.worldToScreen(0, 0)
  const dx = Math.max(sun.x, w - sun.x)
  const dy = Math.max(sun.y, h - sun.y)
  return (Math.hypot(dx, dy) / cam.scale()) * 1.02
}

// Current scan radius in AU.
function revealR(w = _w, h = _h) {
  return revealProgress * revealTargetR(w, h)
}

// Shockwave rings, spawned by shots and by pocketing.
let shockwaves = []
// Sparks that fly out of the pocket when a planet is sunk.
let sparks = []
// Energy in transit from the pocket to the band. A sunk planet's yield is not
// credited on impact — it is carried up in motes and banked as each one lands,
// so the bar visibly grows FROM the black hole rather than jumping.
let energyFlights = []

// Camera (shared: engine/camera.js).
const cam = createCamera({ zoom: 2, focus: 'sun' })

// Parallax sky (shared: engine/starfield.js). Lighter than the module default:
// this mode has no fog of war to hide, so the field can sit on a visible nebula
// rather than on near-black, and the Hubble backdrop is turned up to carry it.
// (001 keeps the darker default, where the contrast between explored space and
// fog is doing real work.)
// Two skies kept to hand. `black` is the one in use: plain black with no photo
// backdrop and no nebula, so the star layers carry the depth on their own.
// `photo` lays the tiled Hubble image behind them instead.
const SKY_PRESETS = {
  photo: {
    backdropUrl: hubbleUrl,
    baseColor: '#0b1020',
    backdropAlpha: 0.3,
    // Tiled and mirrored rather than one cover-fitted copy: at roughly a third
    // of the viewport per tile you see far more of the galaxy's structure at
    // once, and the mirroring means the repeats read as nebula, not wallpaper.
    backdropTile: true,
    backdropTileScale: 0.34,
  },
  black: { backdropUrl: null, baseColor: '#000005', nebula: false },
}

// Add `debugLayers: true` to tint stars behind the world blue and stars in
// front of it red — the quickest way to see which side of the scene a layer is
// on and how differently the two move.
const starfield = createStarfield(SKY_PRESETS.black)

// --- Input state ---
// Held time-warp keys. Q/E slide the clock for as long as they are down.
const keys = { slower: false, faster: false }
// The in-progress shot: which planet is grabbed and where the pull is now.
// { planet, curX, curY } — the anchor is the planet itself, which keeps moving,
// so the cue stays attached while the sim runs.
let shot = null

// Right-drag panning: { lastX, lastY }.
let pan = null

// Where a left press on empty space started, so mouseup can tell a click (which
// re-centres on the sun) from a drag that happened to end on empty space.
let emptyClick = null

let hoverPlanet = null

// =============================================================================
// SCENE
// =============================================================================

// Circular orbit around the (fixed, origin-centred) sun. v = sqrt(GM/r), CCW.
function circularOrbit(orbR, angle) {
  const v = Math.sqrt((G_SIM * SUN.mass) / orbR)
  return {
    x: Math.cos(angle) * orbR,
    y: Math.sin(angle) * orbR,
    vx: -Math.sin(angle) * v,
    vy: Math.cos(angle) * v,
  }
}

function planetRadius(mass) {
  return radiusFromMass(mass, {
    refMass: REF_MASS,
    refRadius: settings.settings.planets.sizeScale,
    exponent: settings.settings.planets.sizeExponent,
    minRadius: 0.008,
  })
}

function buildScene(w, h) {
  const trailLen = settings.settings.visuals.trailLength

  planets = PLANET_SET.map((def) => {
    const o = circularOrbit(def.orbR, def.angle)
    return {
      ...def,
      x: o.x,
      y: o.y,
      vx: o.vx,
      vy: o.vy,
      // Previous-step position, for the swept capture test.
      px: o.x,
      py: o.y,
      // Which side of the elastic band this planet was last outside on.
      bandSide: 0,
      status: 'live', // 'live' | 'pocketed' | 'burned' | 'lost'
      // Gravity state. Stable planets are on rails (sun only); a planet goes
      // rogue when it is shot, or when a rogue pulls it hard enough. See
      // engine/gravity.js.
      rogue: false,
      trail: makeTrail(trailLen),
    }
  })

  simYears = 0
  energy = settings.settings.table.startEnergy
  energyShown = energy
  energyBanked = 0
  energySpent = 0
  shotsFired = 0
  pocketed = []
  burned = []
  lost = []
  shockwaves = []
  sparks = []
  energyFlights = []
  shot = null
  pan = null
  hoverPlanet = null
  revealProgress = 0
  invalidatePrediction()

  starfield.build()
  fitSystem(w, h)
  bodyCount.value = livePlanets().length + 1
}

function livePlanets() {
  return planets.filter((p) => p.status === 'live')
}

// The clock stops by itself while a shot is being aimed. Lining a shot up
// against a moving target is a reflex test, not a pool shot — and it also makes
// the prediction exact, since nothing drifts between aiming and firing.
//
// This is deliberately NOT the same thing as `isPlaying`: that stays the
// player's own play/pause intent, so releasing the cue never resumes a sim they
// paused on purpose.
function simRunning() {
  return isPlaying.value && !shot
}

// =============================================================================
// PHYSICS
// =============================================================================

// The current rogue-gravity field, read straight from the settings panel.
// The band as the physics wants it, with the live settings folded in.
function bandField() {
  return {
    x1: BAND.x1,
    y1: BAND.y1,
    x2: BAND.x2,
    y2: BAND.y2,
    reach: settings.settings.band.reach,
    stiffness: settings.settings.band.stiffness,
  }
}

function rogueField(wake = true) {
  return {
    influenceR: settings.settings.rogue.influence,
    boost: settings.settings.rogue.boost,
    wakeAccel: settings.settings.rogue.wakeAccel,
    wake,
  }
}

// One step of the world, in place. THE one stepper: the live sim and the shot
// preview both call it, so what the dashed line promises is what happens.
//
// The sun is fixed at the origin and outweighs everything by six orders of
// magnitude, so it acts on every planet regardless of state; the pocket is a
// short-range well. Planet-on-planet gravity is the interesting part and lives
// in engine/gravity.js — only rogue planets take part in it.
//
// `wake` is off for the preview: the prediction must not mutate the real world's
// gravity states while you are only thinking about a shot.
function stepWorld(bodies, dt, { wake = true } = {}) {
  const pocketMass = settings.settings.table.pocketPull
  const pocketInfluence = settings.settings.table.pocketInfluence

  const pocketR = settings.settings.table.pocketRadius
  // Read once per step rather than per body — this runs up to 64 times a frame.
  const bandFieldCache = bandField()

  for (const p of bodies) {
    // Where this body starts the step, so capture can test the whole path it
    // travels rather than just where it happens to land.
    p.px = p.x
    p.py = p.y

    // Sun. The effective distance is floored at the kill radius: inside that the
    // planet is destroyed anyway, and an unclamped 1/r² there is a singularity
    // that flings bodies across the system.
    const r = Math.hypot(p.x, p.y)
    const rEff = Math.max(r, SUN.killR)
    const a = (G_SIM * SUN.mass) / (rEff * rEff)
    if (r > 0) {
      p.vx -= (p.x / r) * a * dt
      p.vy -= (p.y / r) * a * dt
    }

    // The elastic band. It needs to know which side the planet came from, so it
    // carries one number per body; see engine/elasticBand.js.
    const band = bandResponse(bandFieldCache, p.x, p.y, p.bandSide ?? 0)
    p.bandSide = band.side
    if (band.engaged) {
      p.vx += band.ax * dt
      p.vy += band.ay * dt
    }

    // Black hole — local, omnidirectional, and only inside its influence radius,
    // so it reads as a pocket with a lip rather than a second sun. Floored at
    // the capture radius for the same reason as the sun: a planet that deep is
    // being pocketed, and the force there should never be able to launch it.
    if (pocketMass > 0 && pocketInfluence > 0) {
      const dx = POCKET.x - p.x
      const dy = POCKET.y - p.y
      const d = Math.hypot(dx, dy)
      if (d > 0 && d < pocketInfluence) {
        const dEff = Math.max(d, pocketR)
        const falloff = 1 - d / pocketInfluence
        const pa = (G_SIM * pocketMass * falloff) / (dEff * dEff)
        p.vx += (dx / d) * pa * dt
        p.vy += (dy / d) * pa * dt
      }
    }
  }

  // Planet ↔ planet, rogues only.
  const woken = applyRogueGravity(bodies, dt, rogueField(wake))

  for (const p of bodies) {
    p.x += p.vx * dt
    p.y += p.vy * dt
  }
  return woken
}

function gravityStep(dt) {
  const woken = stepWorld(livePlanets(), dt)
  // Getting knocked loose is a real event — announce it.
  for (const p of woken) {
    spawnShockwave(p.x, p.y, settings.settings.rogue.influence * 0.9, p.color)
  }
}

// Closest approach of the segment a→b to the point c. Capture has to be tested
// against the whole step, not its endpoint: a fast planet can cross the pocket
// entirely between two samples, and testing only where it landed would let it
// pass straight through.
function segmentDistance(ax, ay, bx, by, cx, cy) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(cx - ax, cy - ay)
  let t = ((cx - ax) * dx + (cy - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(cx - (ax + t * dx), cy - (ay + t * dy))
}

// Called after EVERY substep, not once per frame. A frame can be 64 substeps at
// high warp, which was long enough for a planet to dive into the pocket, get
// whipped around it and leave again before anything looked — the planet "shot
// off" instead of being sunk.
function resolveOutcomes() {
  const pocketR = settings.settings.table.pocketRadius

  for (const p of planets) {
    if (p.status !== 'live') continue

    const fromX = p.px ?? p.x
    const fromY = p.py ?? p.y

    if (segmentDistance(fromX, fromY, p.x, p.y, POCKET.x, POCKET.y) <= pocketR) {
      sinkPlanet(p)
      continue
    }

    const killR = SUN.killR + planetRadius(p.mass) * 0.5
    if (segmentDistance(fromX, fromY, p.x, p.y, 0, 0) <= killR) {
      p.status = 'burned'
      burned.push(p)
      releaseIfHeld(p)
      spawnShockwave(p.x, p.y, planetRadius(p.mass) * 26, '#ff8a3d')
      continue
    }

    if (Math.hypot(p.x, p.y) > ESCAPE_R) {
      p.status = 'lost'
      lost.push(p)
      releaseIfHeld(p)
    }
  }

  bodyCount.value = livePlanets().length + 1
}

function sinkPlanet(p) {
  p.status = 'pocketed'
  pocketed.push(p)
  releaseIfHeld(p)

  // The payout flies to the bar instead of appearing in it — see tickEnergyFlights.
  const motes = Math.max(4, Math.min(10, Math.round(p.energyYield / 11)))
  for (let i = 0; i < motes; i++) {
    energyFlights.push({
      amount: p.energyYield / motes,
      color: p.color,
      age: 0,
      // Staggered, so the payout arrives as a stream rather than a volley.
      delay: i * 0.09,
      life: 0.85 + Math.random() * 0.35,
      // Alternate sides: the bar fills symmetrically, so feed both tips.
      side: i % 2 === 0 ? -1 : 1,
      // Sideways bow on the flight path, so the motes fan out instead of
      // stacking on one line.
      bow: (Math.random() - 0.5) * 0.5,
    })
  }

  spawnShockwave(POCKET.x, POCKET.y, 0.55, p.color)
  const count = 14 + Math.round(p.energyYield / 6)
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const speed = 0.15 + Math.random() * 0.6
    sparks.push({
      x: POCKET.x,
      y: POCKET.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      age: 0,
      life: 0.6 + Math.random() * 0.7,
      color: p.color,
    })
  }
}

function releaseIfHeld(p) {
  if (shot && shot.planet === p) shot = null
}

function spawnShockwave(x, y, maxR, color) {
  shockwaves.push({ x, y, r: 0, maxR, age: 0, life: 1.1, color })
}

// Chase the true balance. Exponential, plus a floor rate so the last fraction of
// a unit does not crawl for ever.
function tickEnergyDisplay(realDt) {
  const gap = energy - energyShown
  if (Math.abs(gap) < 0.05) {
    energyShown = energy
    return
  }
  const step = gap * Math.min(1, realDt * 6) + Math.sign(gap) * 8 * realDt
  energyShown = Math.abs(step) >= Math.abs(gap) ? energy : energyShown + step
}

// Advance the motes and bank each one as it lands.
function tickEnergyFlights(realDt) {
  for (let i = energyFlights.length - 1; i >= 0; i--) {
    const f = energyFlights[i]
    if (f.delay > 0) {
      f.delay -= realDt
      continue
    }
    f.age += realDt
    if (f.age >= f.life) {
      energy += f.amount
      energyBanked += f.amount
      energyFlights.splice(i, 1)
    }
  }
}

// Where a mote is right now, in SCREEN space: a quadratic bezier from the pocket
// to the tip of the bar's fill. Both ends are recomputed every frame, so the
// flight tracks the camera and the growing fill instead of drifting off them.
function energyFlightPoint(f, w, h) {
  const from = cam.worldToScreen(POCKET.x, POCKET.y)
  const g = bandGeometry(w, h, 'top')
  const frac = Math.max(0, Math.min(1, energyShown / energyScaleMax()))
  const to = bandPoint(g, 0.5 + (f.side * frac) / 2)

  const u = Math.max(0, Math.min(1, f.age / f.life))
  // Ease out, so a mote decelerates into the bar.
  const e = 1 - Math.pow(1 - u, 2.2)
  // Control point lifted toward the top of the screen and pushed sideways, for
  // a lobbed arc rather than a straight line.
  const cxp = (from.x + to.x) / 2 + (to.y - from.y) * 0.22 * f.bow
  const cyp = (from.y + to.y) / 2 - Math.abs(to.x - from.x) * 0.28
  const inv = 1 - e
  return {
    x: inv * inv * from.x + 2 * inv * e * cxp + e * e * to.x,
    y: inv * inv * from.y + 2 * inv * e * cyp + e * e * to.y,
    u,
  }
}

function drawEnergyFlights(ctx, w, h) {
  if (!energyFlights.length) return
  ctx.save()
  for (const f of energyFlights) {
    if (f.delay > 0) continue
    const p = energyFlightPoint(f, w, h)
    // A short tail, sampled slightly behind the head.
    const trail = energyFlightPoint({ ...f, age: Math.max(0, f.age - 0.06) }, w, h)
    const fade = 1 - Math.pow(p.u, 3)

    ctx.strokeStyle = rgba(f.color, 0.35 * fade)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(trail.x, trail.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9)
    glow.addColorStop(0, `rgba(190,255,220,${0.85 * fade})`)
    glow.addColorStop(1, 'rgba(140,240,190,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(225,255,240,${0.95 * fade})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function tickEffects(realDt) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i]
    s.age += realDt
    if (s.age >= s.life) shockwaves.splice(i, 1)
    else s.r = s.maxR * (s.age / s.life)
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]
    s.age += realDt
    if (s.age >= s.life) {
      sparks.splice(i, 1)
      continue
    }
    // Sparks live in world space but drift in real time, so they read the same
    // at every time-scale.
    s.x += s.vx * realDt * 0.12
    s.y += s.vy * realDt * 0.12
  }
}

// =============================================================================
// THE SHOT
// =============================================================================

// Pull vector, in screen pixels, from the grabbed planet to the cursor.
function shotPull() {
  if (!shot) return null
  const sp = cam.worldToScreen(shot.planet.x, shot.planet.y)
  const dx = shot.curX - sp.x
  const dy = shot.curY - sp.y
  const dist = Math.hypot(dx, dy)
  return { sp, dx, dy, dist }
}

// 0..1 of a full-power shot, from the pull length alone (before energy caps it).
function requestedPower() {
  const pull = shotPull()
  if (!pull || pull.dist < SHOT_DEADZONE_PX) return 0
  return Math.min(pull.dist, settings.settings.cue.maxDrag) / settings.settings.cue.maxDrag
}

// What the current aim would cost, and what it can actually afford — the energy
// bar previews both, so an over-pull visibly runs into the ceiling.
function shotDraw() {
  const requested = requestedPower() * settings.settings.cue.shotCost
  return { requested, affordable: Math.min(requested, energy) }
}

// Power actually delivered: the requested pull, scaled down if the bar can't
// cover it. A shot on an empty bar is a dud, not a free shot.
function effectivePower() {
  const requested = requestedPower()
  const cost = requested * settings.settings.cue.shotCost
  if (cost <= 0) return 0
  return requested * Math.min(1, energy / cost)
}

function fireShot() {
  const pull = shotPull()
  if (!shot || !pull) return
  const planet = shot.planet

  // A pull inside the deadzone is a deliberate cancel — no cost, no kick.
  if (pull.dist < SHOT_DEADZONE_PX) {
    shot = null
    return
  }

  const power = effectivePower()
  const cost = requestedPower() * settings.settings.cue.shotCost
  const spend = Math.min(cost, energy)
  energy = Math.max(0, energy - spend)
  energySpent += spend

  // A dud on an empty bar isn't a shot taken — don't score it as one.
  if (power > 0) {
    shotsFired++
    // Classic pool: the ball leaves opposite to the pull.
    const nx = -pull.dx / pull.dist
    const ny = -pull.dy / pull.dist
    const dv = deltaVFromShot(power * settings.settings.cue.shotPower, planet.mass, {
      refMass: REF_MASS,
      massExponent: settings.settings.cue.massExponent,
    })
    planet.vx += nx * dv
    planet.vy += ny * dv
    // Taking the shot is what knocks it off its rails: from here it feels, and
    // exerts, the exaggerated planetary gravity.
    planet.rogue = true

    spawnShockwave(planet.x, planet.y, planetRadius(planet.mass) * 18, planet.color)
  }

  shot = null
  invalidatePrediction()
}

// Where the aimed planet would go. This runs the WHOLE system forward on
// throwaway copies using the same stepper as the sim, not just the one planet
// against the sun — with rogue planets in play a shot's path depends on what
// else is loose out there, and a preview that ignored them would lie.
//
// Waking is disabled: thinking about a shot must not knock anything loose. The
// consequence is that the preview under-states a chain reaction rather than
// over-stating it.
//
// Returns { points, hitPocket, hitSun } — the outcome flags colour the preview.
function predictShot() {
  const pull = shotPull()
  const none = { points: [], hitPocket: false, hitSun: false }
  if (!shot || !pull || pull.dist < SHOT_DEADZONE_PX) return none

  const power = effectivePower()
  const nx = -pull.dx / pull.dist
  const ny = -pull.dy / pull.dist

  // Copies, so the preview can never touch the real bodies.
  const ghosts = livePlanets().map((p) => ({
    x: p.x,
    y: p.y,
    px: p.x,
    py: p.y,
    vx: p.vx,
    vy: p.vy,
    mass: p.mass,
    rogue: p.rogue,
    bandSide: p.bandSide,
  }))
  const aimed = ghosts[livePlanets().indexOf(shot.planet)]
  if (!aimed) return none

  const dv = deltaVFromShot(power * settings.settings.cue.shotPower, aimed.mass, {
    refMass: REF_MASS,
    massExponent: settings.settings.cue.massExponent,
  })
  aimed.vx += nx * dv
  aimed.vy += ny * dv
  aimed.rogue = true

  const pocketR = settings.settings.table.pocketRadius
  const points = [{ x: aimed.x, y: aimed.y }]
  let hitPocket = false
  let hitSun = false

  for (let i = 0; i < PRED_STEPS; i++) {
    stepWorld(ghosts, PRED_DT_YR, { wake: false })
    points.push({ x: aimed.x, y: aimed.y })

    // Stop the preview where the shot would end — swept, exactly like the sim.
    if (segmentDistance(aimed.px, aimed.py, aimed.x, aimed.y, POCKET.x, POCKET.y) <= pocketR) {
      hitPocket = true
      break
    }
    if (segmentDistance(aimed.px, aimed.py, aimed.x, aimed.y, 0, 0) <= SUN.killR) {
      hitSun = true
      break
    }
    if (Math.hypot(aimed.x, aimed.y) > ESCAPE_R) break
  }
  return { points, hitPocket, hitSun }
}

// The preview is an n-body run over every live planet, which is far too much to
// redo 60 times a second for a picture that has not changed. Time is frozen
// while aiming, so the ONLY thing that can move the line is the cursor — cache
// on the aim and recompute when it actually moves.
let predCache = { key: null, value: null }

function cachedPrediction() {
  if (!shot) return { points: [], hitPocket: false, hitSun: false }
  const p = shot.planet
  const key = `${p.id}|${shot.curX}|${shot.curY}|${p.x}|${p.y}|${energy}`
  if (predCache.key !== key) predCache = { key, value: predictShot() }
  return predCache.value
}

function invalidatePrediction() {
  predCache = { key: null, value: null }
}

// =============================================================================
// CAMERA
// =============================================================================

function focusSun(w = _w, h = _h) {
  cam.focus = 'sun'
  cam.centerOn(0, 0, w, h)
}

// Frame the sun, the pocket and every orbit the level uses.
function fitSystem(w = _w, h = _h) {
  const pts = [{ x: 0, y: 0 }, POCKET, { x: BAND.x1, y: BAND.y1 }, { x: BAND.x2, y: BAND.y2 }]
  for (const p of PLANET_SET) {
    pts.push({ x: p.orbR, y: p.orbR }, { x: -p.orbR, y: -p.orbR })
  }
  cam.fitPoints(pts, w, h, { padding: 0.4, maxFitZoom: 6 })
  cam.focus = 'free'
}

// The sun stays put, so 'sun' focus just means "keep the origin centred" — it
// survives resizes without fighting the player's right-drag panning.
function applyFocus(w, h) {
  cam.tickZoom(0.18)
  // An eased zoom is repositioning the view to keep the cursor anchored; letting
  // the focus mode also drive the pan in the same frame would fight it.
  if (cam.focus === 'sun' && !cam.zoomAnchor) cam.centerOn(0, 0, w, h)
}

// =============================================================================
// REVEAL
// =============================================================================

// The opening scan. It grows in REAL time (not sim time) so it plays out the
// same however fast the clock is running, and it is finished — permanently —
// once it covers the level.
function tickReveal(realDt) {
  if (revealProgress >= 1) return
  const duration = settings.settings.reveal.duration
  if (duration <= 0) {
    revealProgress = 1
    return
  }
  revealProgress = Math.min(1, revealProgress + realDt / duration)
}

const revealDone = () => revealProgress >= 1

// True once the scan has reached a world point — used to gate grabbing a planet
// the player cannot see yet.
function revealed(x, y) {
  return revealDone() || Math.hypot(x, y) <= revealR()
}

// =============================================================================
// COLOUR HELPERS
// =============================================================================

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}
function lighten(hex, t) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`
}
function darken(hex, t) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r * (1 - t))},${Math.round(g * (1 - t))},${Math.round(b * (1 - t))})`
}

// Yield colour ramp: dim copper for a poor planet, bright gold for a rich one.
// Same ramp is used by the ring, the roster and the payout text so the player
// only has to learn one scale.
function yieldColor(energyYield) {
  const t = Math.max(0, Math.min(1, energyYield / MAX_YIELD))
  const r = Math.round(190 + 65 * t)
  const g = Math.round(120 + 110 * t)
  const b = Math.round(50 + 70 * t)
  return `rgb(${r},${g},${b})`
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// =============================================================================
// WORLD RENDERING
// =============================================================================

function drawOrbitGuides(ctx) {
  const s = cam.scale()
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 0.6 / s
  for (const def of PLANET_SET) {
    ctx.beginPath()
    ctx.arc(0, 0, def.orbR, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawSun(ctx) {
  const sp = cam.worldToScreen(0, 0)
  const s = cam.scale()
  const r = Math.max(4, SUN.drawR * s)

  ctx.save()
  const glow = ctx.createRadialGradient(sp.x, sp.y, r * 0.6, sp.x, sp.y, r * 3.5)
  glow.addColorStop(0, 'rgba(255,220,80,0.45)')
  glow.addColorStop(0.4, 'rgba(255,140,0,0.14)')
  glow.addColorStop(1, 'rgba(255,80,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, r * 3.5, 0, Math.PI * 2)
  ctx.fill()

  const disc = ctx.createRadialGradient(sp.x - r * 0.3, sp.y - r * 0.3, 0, sp.x, sp.y, r)
  disc.addColorStop(0, lighten(SUN.color, 0.55))
  disc.addColorStop(0.5, SUN.color)
  disc.addColorStop(1, darken(SUN.color, 0.5))
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPocket(ctx, timeS) {
  const sp = cam.worldToScreen(POCKET.x, POCKET.y)
  const s = cam.scale()
  const holeR = Math.max(3, POCKET.drawR * s)
  const captureR = settings.settings.table.pocketRadius * s
  const influenceR = settings.settings.table.pocketInfluence * s

  ctx.save()

  // Influence field — where the pocket starts helping.
  const field = ctx.createRadialGradient(sp.x, sp.y, holeR, sp.x, sp.y, influenceR)
  field.addColorStop(0, 'rgba(150,110,255,0.16)')
  field.addColorStop(1, 'rgba(120,80,255,0)')
  ctx.fillStyle = field
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, influenceR, 0, Math.PI * 2)
  ctx.fill()

  ctx.setLineDash([5, 7])
  ctx.strokeStyle = 'rgba(180,140,255,0.22)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, influenceR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Accretion swirl.
  for (let i = 0; i < 3; i++) {
    const rr = captureR * (0.75 + i * 0.28)
    const spin = timeS * (0.7 - i * 0.16) + i * 1.7
    ctx.strokeStyle = `rgba(190,150,255,${0.3 - i * 0.07})`
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, rr, spin, spin + Math.PI * 1.25)
    ctx.stroke()
  }

  // The pocket mouth.
  ctx.strokeStyle = 'rgba(200,170,255,0.75)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, captureR, 0, Math.PI * 2)
  ctx.stroke()

  // The hole itself.
  const hole = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, holeR)
  hole.addColorStop(0, '#000')
  hole.addColorStop(0.75, '#05030c')
  hole.addColorStop(1, 'rgba(90,50,180,0.5)')
  ctx.fillStyle = hole
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, holeR, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(180,140,255,0.65)'
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('POCKET', sp.x, sp.y + captureR + 16)
  ctx.restore()
}

// The elastic band, drawn as a live electric line.
//
// At rest it hums along its anchors with a small jitter. When a planet is caught
// it bends through the contact point, and everything scales with the stretch:
// the jitter gets wilder, the glow brighter, the core whiter. The load on the
// band is the thing the player needs to read — how close this shot is to
// punching through — so the drawing is driven by exactly the number the physics
// uses.
function drawBand(ctx, timeS) {
  const s = cam.scale()
  const field = bandField()

  // Single planet ↔ band interaction for now: the first one caught wins.
  let contact = null
  let load = 0
  for (const p of planets) {
    if (p.status !== 'live') continue
    const r = bandResponse(field, p.x, p.y, p.bandSide ?? 0)
    if (r.engaged) {
      contact = { x: p.x, y: p.y }
      // Normalised against the deepest stretch this band can hold, so 1 means
      // "about to let go".
      const maxStretch =
        Math.hypot(BAND.x2 - BAND.x1, BAND.y2 - BAND.y1) *
        (Math.sqrt(
          1 + Math.pow((2 * field.reach) / Math.hypot(BAND.x2 - BAND.x1, BAND.y2 - BAND.y1), 2),
        ) -
          1)
      load = Math.max(0, Math.min(1, r.stretch / (maxStretch || 1)))
      break
    }
  }

  const path = bandShape(BAND, contact).map((pt) => cam.worldToScreen(pt.x, pt.y))
  const reachPx = field.reach * s

  ctx.save()

  // The slack the band has left, as two faint rails at its stretch limit.
  const ax = path[0]
  const bx = path[path.length - 1]
  const dx = bx.x - ax.x
  const dy = bx.y - ax.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  ctx.setLineDash([4, 8])
  ctx.strokeStyle = rgba(BAND.color, 0.16)
  ctx.lineWidth = 1
  for (const sign of [1, -1]) {
    ctx.beginPath()
    ctx.moveTo(ax.x + nx * reachPx * sign, ax.y + ny * reachPx * sign)
    ctx.lineTo(bx.x + nx * reachPx * sign, bx.y + ny * reachPx * sign)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // Jagged polyline along the (possibly bent) band. The jitter is a couple of
  // sine terms rather than random, so the arc crawls instead of seething.
  const jitterPx = (1.2 + load * 9) * Math.min(2, Math.max(0.5, s / 140))
  const points = []
  for (let seg = 0; seg < path.length - 1; seg++) {
    const p0 = path[seg]
    const p1 = path[seg + 1]
    const segDx = p1.x - p0.x
    const segDy = p1.y - p0.y
    const segLen = Math.hypot(segDx, segDy) || 1
    const jx = -segDy / segLen
    const jy = segDx / segLen
    const steps = Math.max(6, Math.min(26, Math.round(segLen / 18)))
    for (let i = seg === 0 ? 0 : 1; i <= steps; i++) {
      const u = i / steps
      // Pinned at both ends of each run, loosest in the middle.
      const envelope = Math.sin(u * Math.PI)
      const n =
        Math.sin(u * 11 + timeS * 7 + seg * 2.1) * 0.6 + Math.sin(u * 23 - timeS * 11 + seg) * 0.4
      const off = n * envelope * jitterPx
      points.push({ x: p0.x + segDx * u + jx * off, y: p0.y + segDy * u + jy * off })
    }
  }

  const stroke = (width, alpha, color) => {
    ctx.strokeStyle = rgba(color, alpha)
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    ctx.stroke()
  }

  // Wide glow, then the filament, then a white-hot core under load.
  ctx.globalCompositeOperation = 'lighter'
  stroke(10 + load * 14, 0.1 + load * 0.16, BAND.color)
  stroke(4 + load * 4, 0.28 + load * 0.3, BAND.color)
  stroke(1.4, 0.75 + load * 0.25, load > 0.02 ? '#ffffff' : BAND.color)
  ctx.globalCompositeOperation = 'source-over'

  // Anchor posts.
  for (const anchor of [path[0], path[path.length - 1]]) {
    const glow = ctx.createRadialGradient(anchor.x, anchor.y, 0, anchor.x, anchor.y, 14)
    glow.addColorStop(0, rgba(BAND.color, 0.6 + load * 0.4))
    glow.addColorStop(1, rgba(BAND.color, 0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(anchor.x, anchor.y, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e8fbff'
    ctx.beginPath()
    ctx.arc(anchor.x, anchor.y, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawTrail(ctx, p) {
  const pts = p.trail?.points?.() || []
  if (pts.length < 2) return
  const s = cam.scale()

  // One stroke per BAND, not per segment — see batchTrail in engine/trail.js.
  // Points closer than ~1.5 screen pixels are dropped, which at a wide zoom
  // throws away most of the buffer for no visible difference.
  const bands = batchTrail(pts, { bands: TRAIL_BANDS, minStep: TRAIL_MIN_STEP_PX / s })
  if (!bands.length) return

  const [r, g, b] = hexToRgb(p.color)
  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  // BUTT caps, not round: each band is a separate stroke at its own alpha, and a
  // round cap paints a filled half-disc at the seam that the neighbouring band
  // then paints over — every seam showed up as a bead on the trail.
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  ctx.lineWidth = planetRadius(p.mass) * 0.22

  for (const band of bands) {
    ctx.strokeStyle = `rgba(${r},${g},${b},${0.02 + band.t * 0.18})`
    ctx.beginPath()
    ctx.moveTo(band.points[0].x, band.points[0].y)
    for (let i = 1; i < band.points.length; i++) ctx.lineTo(band.points[i].x, band.points[i].y)
    ctx.stroke()
  }
  ctx.restore()
}

// A rogue planet's gravity, made visible: the outer dashed rim is where its pull
// reaches zero, and the inner solid ring is where the pull is strong enough to
// knock a stable planet loose. Anything that drifts inside the inner ring joins
// the chain reaction, so that ring is the one the player actually plays against.
function drawRogueField(ctx, p, timeS) {
  const sp = cam.worldToScreen(p.x, p.y)
  const s = cam.scale()
  const rimR = settings.settings.rogue.influence * s
  if (rimR < 6) return

  const wakeR =
    wakeRadius(p.mass, {
      influenceR: settings.settings.rogue.influence,
      boost: settings.settings.rogue.boost,
      wakeAccel: settings.settings.rogue.wakeAccel,
    }) * s

  ctx.save()
  const field = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, rimR)
  field.addColorStop(0, rgba(p.color, 0.16))
  field.addColorStop(0.55, rgba(p.color, 0.06))
  field.addColorStop(1, rgba(p.color, 0))
  ctx.fillStyle = field
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, rimR, 0, Math.PI * 2)
  ctx.fill()

  // Outer rim — the edge of the field.
  ctx.setLineDash([3, 6])
  ctx.strokeStyle = rgba(p.color, 0.3)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, rimR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Inner ring — the wake threshold. Slowly rotating dashes so a live field
  // reads as dangerous rather than decorative.
  if (wakeR > 4) {
    ctx.setLineDash([7, 5])
    ctx.lineDashOffset = -(timeS * 14) % 12
    ctx.strokeStyle = rgba(p.color, 0.75)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, wakeR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineDashOffset = 0
  }
  ctx.restore()
}

// The two readable properties of a planet, drawn together:
//   the DISC's radius is its mass,
//   the RING around it is its energy yield.
function drawPlanet(ctx, p, w, h) {
  const sp = cam.worldToScreen(p.x, p.y)
  const s = cam.scale()
  const r = Math.max(3, planetRadius(p.mass) * s)
  const ringR = r + 8

  if (sp.x < -120 || sp.x > w + 120 || sp.y < -120 || sp.y > h + 120) return

  const isHeld = shot && shot.planet === p
  const isHover = hoverPlanet === p

  ctx.save()

  // Halo under a grabbed or hovered planet.
  if (isHeld || isHover) {
    const halo = ctx.createRadialGradient(sp.x, sp.y, r, sp.x, sp.y, ringR + 14)
    halo.addColorStop(0, rgba(p.color, isHeld ? 0.4 : 0.22))
    halo.addColorStop(1, rgba(p.color, 0))
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, ringR + 14, 0, Math.PI * 2)
    ctx.fill()
  }

  // Disc — shaded so the size difference reads as volume, not as a flat dot.
  const disc = ctx.createRadialGradient(sp.x - r * 0.35, sp.y - r * 0.35, r * 0.1, sp.x, sp.y, r)
  disc.addColorStop(0, lighten(p.color, 0.45))
  disc.addColorStop(0.55, p.color)
  disc.addColorStop(1, darken(p.color, 0.55))
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2)
  ctx.fill()

  // Terminator, so the sphere reads at small sizes too.
  ctx.strokeStyle = rgba(p.color, 0.5)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2)
  ctx.stroke()

  drawYieldRing(ctx, sp.x, sp.y, ringR, p, isHeld || isHover)

  // Rogue planets carry a bright outline, so state is legible on the body
  // itself and not only from the field around it.
  if (p.rogue) {
    ctx.strokeStyle = rgba(p.color, 0.95)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, r + 2.5, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

// Segmented ring = energy yield. Twelve slots; a MAX_YIELD planet lights all of
// them. Unlit slots stay visible so the ring always reads as "N out of a scale",
// not as an arbitrary arc.
function drawYieldRing(ctx, cx, cy, ringR, p, emphasised) {
  const lit = Math.round((p.energyYield / MAX_YIELD) * YIELD_SEGMENTS)
  const step = (Math.PI * 2) / YIELD_SEGMENTS
  const gap = step * 0.3
  const color = yieldColor(p.energyYield)

  ctx.save()
  ctx.lineCap = 'butt'
  for (let i = 0; i < YIELD_SEGMENTS; i++) {
    // Start at the top and run clockwise, like a gauge.
    const a0 = -Math.PI / 2 + i * step + gap / 2
    const a1 = a0 + step - gap
    const on = i < lit
    ctx.strokeStyle = on ? color : 'rgba(255,255,255,0.09)'
    ctx.lineWidth = on ? (emphasised ? 3.4 : 2.6) : 1.6
    ctx.beginPath()
    ctx.arc(cx, cy, ringR, a0, a1)
    ctx.stroke()
  }

  if (emphasised) {
    ctx.shadowColor = color
    ctx.shadowBlur = 10
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + step * lit)
    ctx.stroke()
    ctx.shadowBlur = 0
  }
  ctx.restore()
}

// Name / mass / yield next to a planet. Shown for the grabbed or hovered planet
// always, and for everything else once the view is close enough to have room.
function drawPlanetLabel(ctx, p) {
  const sp = cam.worldToScreen(p.x, p.y)
  const r = Math.max(3, planetRadius(p.mass) * cam.scale())
  // While this planet is being aimed, the power arc sits at r + 18 — start the
  // text outside it so the two don't overlap.
  const x = sp.x + r + (shot && shot.planet === p ? 34 : 16)
  const y = sp.y - r - 6

  ctx.save()
  ctx.textAlign = 'left'
  ctx.font = '11px monospace'
  ctx.fillStyle = rgba(p.color, 0.95)
  ctx.fillText(p.name.toUpperCase(), x, y)

  ctx.font = '10px monospace'
  ctx.fillStyle = 'rgba(180,190,210,0.6)'
  ctx.fillText(`${(p.mass / REF_MASS).toFixed(2)} M⊕`, x, y + 13)

  ctx.fillStyle = yieldColor(p.energyYield)
  ctx.fillText(`+${p.energyYield} energy`, x, y + 26)
  ctx.restore()
}

// =============================================================================
// CUE RENDERING
// =============================================================================

function drawCue(ctx) {
  const pull = shotPull()
  if (!shot || !pull) return

  const p = shot.planet
  const { sp, dist } = pull
  const r = Math.max(3, planetRadius(p.mass) * cam.scale())
  const power = requestedPower()
  const affordable = effectivePower()
  const cancelling = dist < SHOT_DEADZONE_PX

  ctx.save()

  if (cancelling) {
    // Deadzone: releasing here is a free cancel, so say so plainly.
    ctx.strokeStyle = 'rgba(230,110,110,0.9)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, r + 12, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(230,130,130,0.9)'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('RELEASE TO CANCEL', sp.x, sp.y + r + 30)
    ctx.restore()
    return
  }

  const nx = -pull.dx / dist
  const ny = -pull.dy / dist
  const clamped = Math.min(dist, settings.settings.cue.maxDrag)

  // The pull itself: cue line from the planet back to the cursor.
  ctx.strokeStyle = rgba(p.color, 0.5)
  ctx.lineWidth = 2
  ctx.setLineDash([6, 5])
  ctx.beginPath()
  ctx.moveTo(sp.x, sp.y)
  ctx.lineTo(sp.x + pull.dx, sp.y + pull.dy)
  ctx.stroke()
  ctx.setLineDash([])

  // Fire direction: a solid arrow the length of the (clamped) pull.
  const tipX = sp.x + nx * (clamped + r)
  const tipY = sp.y + ny * (clamped + r)
  const grad = ctx.createLinearGradient(sp.x, sp.y, tipX, tipY)
  grad.addColorStop(0, rgba(p.color, 0.15))
  grad.addColorStop(1, rgba(p.color, 0.95))
  ctx.strokeStyle = grad
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(sp.x + nx * r, sp.y + ny * r)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  const head = 9
  const a = Math.atan2(ny, nx)
  ctx.fillStyle = rgba(p.color, 0.95)
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(tipX - Math.cos(a - 0.4) * head, tipY - Math.sin(a - 0.4) * head)
  ctx.lineTo(tipX - Math.cos(a + 0.4) * head, tipY - Math.sin(a + 0.4) * head)
  ctx.closePath()
  ctx.fill()

  // Power arc around the planet: full sweep = full power. A second, dimmer arc
  // shows how much of that the energy bar can actually pay for.
  const arcR = r + 18
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, arcR, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255,120,120,0.55)'
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, arcR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * power)
  ctx.stroke()

  ctx.strokeStyle = rgba(p.color, 0.95)
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, arcR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * affordable)
  ctx.stroke()

  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = affordable < power - 0.001 ? 'rgba(255,140,140,0.95)' : 'rgba(210,220,240,0.85)'
  const label =
    affordable < power - 0.001
      ? `${Math.round(affordable * 100)}% — NOT ENOUGH ENERGY`
      : `${Math.round(power * 100)}% · −${Math.round(power * settings.settings.cue.shotCost)}`
  ctx.fillText(label, sp.x, sp.y - arcR - 10)

  ctx.restore()
}

function drawPrediction(ctx, prediction) {
  const path = prediction.points
  if (path.length < 2) return
  const s = cam.scale()
  // ONE colour, whatever the outcome. Tinting the line green when the shot
  // happens to reach the pocket would hand the player the answer before they
  // take the shot — the corridor's job is to show where the planet goes, and
  // judging what that means is the game.
  const color = '#8fb4ff'
  const [r, g, b] = hexToRgb(color)

  // The forecast is an approximation integrated forward, and it is worth less
  // the further out it goes. So the line is drawn as a corridor that spreads as
  // it runs and fades to nothing rather than stopping at a hard marker — the
  // picture says "here, then roughly here, then who knows".
  const bands = corridorBands(path, {
    bands: PRED_BANDS,
    maxOffset: PRED_SPREAD_AU,
    widenPow: 0.85,
  })
  if (!bands.length) return

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 1.3 / s

  for (const band of bands) {
    const alpha = 0.6 * Math.pow(1 - band.t, 1.5)
    if (alpha <= 0.004) continue
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
    for (const edge of [band.left, band.right]) {
      ctx.beginPath()
      ctx.moveTo(edge[0].x, edge[0].y)
      for (let i = 1; i < edge.length; i++) ctx.lineTo(edge[i].x, edge[i].y)
      ctx.stroke()
    }
  }
  ctx.restore()

  // The one thing still worth saying is the hazard: flying a planet into the sun
  // destroys it for nothing. Sinking it is left for the player to see coming.
  if (prediction.hitSun) {
    const end = path[path.length - 1]
    const sp = cam.worldToScreen(end.x, end.y)
    ctx.save()
    ctx.fillStyle = 'rgba(255,138,92,0.75)'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('BURNS UP', sp.x, sp.y - 10)
    ctx.restore()
  }
}

function drawEffects(ctx) {
  const s = cam.scale()

  ctx.save()
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY)
  for (const sw of shockwaves) {
    const t = sw.age / sw.life
    ctx.strokeStyle = rgba(sw.color, (1 - t) * 0.6)
    ctx.lineWidth = (2.5 * (1 - t)) / s
    ctx.beginPath()
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (const sp of sparks) {
    const t = sp.age / sp.life
    ctx.fillStyle = rgba(sp.color, (1 - t) * 0.9)
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, (2.2 * (1 - t) + 0.6) / s, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// =============================================================================
// REVEAL OVERLAY
// =============================================================================

// Black everywhere the opening scan hasn't reached yet, with a bright leading
// edge. Drawn as one rect with a reverse-wound circle punched out of it.
function drawRevealOverlay(ctx, w, h) {
  if (revealDone()) return

  const sp = cam.worldToScreen(0, 0)
  const rpx = Math.max(0, revealR(w, h) * cam.scale())

  ctx.save()

  // The unscanned region: one flat fill of the whole canvas with a hole punched
  // in it. Flat fills are cheap; what used to be expensive here was a radial
  // gradient over the entire disc plus a shadow-blurred ring, both of which ran
  // every frame of the sweep. The soft edge is now four plain strokes just
  // inside the rim, which reads the same and costs nothing.
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  // moveTo first: rect() leaves a current point, and without this the arc would
  // be joined to it by a stray line the fill then has to resolve.
  ctx.moveTo(sp.x + rpx, sp.y)
  ctx.arc(sp.x, sp.y, rpx, 0, Math.PI * 2, true)
  ctx.fillStyle = '#04050b'
  ctx.fill()

  // Feathered inner edge: concentric strokes fading inward.
  for (let i = 0; i < 4; i++) {
    const rr = rpx - 4 - i * 7
    if (rr <= 0) break
    ctx.strokeStyle = `rgba(4,5,11,${0.45 - i * 0.1})`
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, rr, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Leading scan ring — two strokes instead of a shadow blur.
  ctx.strokeStyle = 'rgba(79,195,247,0.18)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, rpx, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(79,195,247,0.6)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, rpx, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = 'rgba(79,195,247,0.75)'
  ctx.font = '11px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`SURVEYING SYSTEM · ${Math.round(revealProgress * 100)}%`, w / 2, h - 124)
  ctx.restore()
}

// =============================================================================
// HUD
// =============================================================================

// Both readouts are the same curved band: an arc of a circle far off-screen, so
// it reads as a shallow curve rather than a straight rule. The time band hangs
// from a centre ABOVE the screen and sags like a hammock; the energy band hangs
// from a centre BELOW it and domes upward. Same object, mirrored.
const BAND_SPAN = 0.38 // radians of visible arc
const BAND_TOP_INSET = 34 // px from the top of the canvas to the dome's peak
const BAND_BOTTOM_INSET = 54 // px from the bottom to the hammock's lowest point

function bandGeometry(w, h, edge) {
  const R = w * 1.1
  return edge === 'bottom'
    ? { R, cxp: w / 2, cyp: h - R - BAND_BOTTOM_INSET, dir: 1 }
    : { R, cxp: w / 2, cyp: R + BAND_TOP_INSET, dir: -1 }
}

// Angle along a band at position t (0 = left end, 1 = right end).
function bandAngle(g, t) {
  return g.dir === 1
    ? Math.PI / 2 + BAND_SPAN / 2 - BAND_SPAN * t
    : -Math.PI / 2 - BAND_SPAN / 2 + BAND_SPAN * t
}

function bandPoint(g, t) {
  const a = bandAngle(g, t)
  return { x: g.cxp + Math.cos(a) * g.R, y: g.cyp + Math.sin(a) * g.R }
}

// Stroke a run of the band between two positions.
function strokeBandArc(ctx, g, t0, t1, style, width) {
  if (Math.abs(t1 - t0) < 1e-4) return
  const a0 = bandAngle(g, t0)
  const a1 = bandAngle(g, t1)
  ctx.strokeStyle = style
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.arc(g.cxp, g.cyp, g.R, Math.min(a0, a1), Math.max(a0, a1))
  ctx.stroke()
}

// Vertical energy column. The bar is stored energy; while aiming, the top slice
// of it turns red to show what the shot will take, and an outline above it shows
// the part of the pull the bar cannot cover.
// Energy the band's full width represents. Fixed for a run, so the fill can be
// compared with itself over time rather than silently rescaling under the
// player as they bank more.
function energyScaleMax() {
  return Math.max(settings.settings.table.startEnergy, TOTAL_YIELD * 0.6, 100)
}

// Energy, drawn as the mirror of the time band: a shallow dome across the top.
//
// It fills SYMMETRICALLY from the middle out — an empty tank is a single point
// of light at the centre and a full one reaches both ends. Reading it is a
// glance at how wide the light is, not a comparison against a scale, and the
// growth is visible from either side of the screen.
function drawEnergyBand(ctx, w, h) {
  const g = bandGeometry(w, h, 'top')
  const scaleMax = energyScaleMax()
  const frac = Math.max(0, Math.min(1, energyShown / scaleMax))
  const draw = shot ? shotDraw() : null

  // Half-widths as band positions either side of centre.
  const half = frac / 2
  const spendHalf = draw ? Math.min(half, draw.affordable / scaleMax / 2) : 0
  const keepHalf = half - spendHalf
  const overHalf = draw
    ? Math.min(0.5 - half, (draw.requested - draw.affordable) / scaleMax / 2)
    : 0

  ctx.save()

  // The rail, and ticks at the ends so "full" has a visible destination.
  strokeBandArc(ctx, g, 0, 1, 'rgba(120,150,200,0.18)', 5)
  for (const t of [0, 1]) {
    const a = bandAngle(g, t)
    ctx.strokeStyle = 'rgba(120,150,200,0.3)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(g.cxp + Math.cos(a) * (g.R - 6), g.cyp + Math.sin(a) * (g.R - 6))
    ctx.lineTo(g.cxp + Math.cos(a) * (g.R + 6), g.cyp + Math.sin(a) * (g.R + 6))
    ctx.stroke()
  }

  // Stored energy, mirrored either side of the middle.
  if (keepHalf > 0) {
    strokeBandArc(ctx, g, 0.5 - keepHalf, 0.5 + keepHalf, 'rgba(127,224,168,0.9)', 5)
  }
  // The slice the current pull would burn, at the outer ends of the fill.
  if (spendHalf > 0) {
    strokeBandArc(ctx, g, 0.5 - half, 0.5 - keepHalf, 'rgba(235,90,90,0.9)', 5)
    strokeBandArc(ctx, g, 0.5 + keepHalf, 0.5 + half, 'rgba(235,90,90,0.9)', 5)
  }
  // Pull the bar cannot pay for, sketched beyond the fill.
  if (overHalf > 0.001) {
    ctx.setLineDash([3, 4])
    strokeBandArc(ctx, g, 0.5 - half - overHalf, 0.5 - half, 'rgba(235,90,90,0.45)', 3)
    strokeBandArc(ctx, g, 0.5 + half, 0.5 + half + overHalf, 'rgba(235,90,90,0.45)', 3)
    ctx.setLineDash([])
  }

  // The centre bead: always lit, so an empty tank still reads as a live gauge
  // rather than a broken one.
  const mid = bandPoint(g, 0.5)
  const glow = ctx.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, 14)
  glow.addColorStop(0, energyShown > 0 ? 'rgba(160,240,200,0.85)' : 'rgba(235,120,120,0.8)')
  glow.addColorStop(1, 'rgba(120,240,180,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(mid.x, mid.y, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = energyShown > 0 ? '#dffbe9' : '#ffb4b4'
  ctx.beginPath()
  ctx.arc(mid.x, mid.y, 3.5, 0, Math.PI * 2)
  ctx.fill()

  // Leading beads at the two tips of the fill.
  if (frac > 0.004) {
    for (const t of [0.5 - half, 0.5 + half]) {
      const p = bandPoint(g, t)
      ctx.fillStyle = 'rgba(200,255,225,0.95)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Readout under the dome.
  ctx.textAlign = 'center'
  ctx.font = 'bold 13px monospace'
  ctx.fillStyle = energyShown > 0 ? 'rgba(190,240,215,0.95)' : 'rgba(235,120,120,0.95)'
  ctx.fillText(String(Math.round(energyShown)), w / 2, BAND_TOP_INSET + 30)
  ctx.font = '9px monospace'
  ctx.fillStyle = 'rgba(130,170,150,0.55)'
  ctx.fillText(`ENERGY · BANKED ${Math.round(energyBanked)}`, w / 2, BAND_TOP_INSET + 44)
  ctx.restore()
}

// Roster: every planet on the table with its two numbers side by side, so the
// mass/yield independence is legible even without hunting around the field.
function drawRoster(ctx, w) {
  const panelW = 208
  const rowH = 34
  const x = w - panelW - 14
  const y = 52
  const ph = 30 + planets.length * rowH

  const maxMass = Math.max(...PLANET_SET.map((p) => p.mass))

  ctx.save()
  ctx.fillStyle = 'rgba(8,10,20,0.72)'
  ctx.strokeStyle = 'rgba(79,195,247,0.22)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, panelW, ph, 6)
  ctx.fill()
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.font = '9px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText('PLANET', x + 12, y + 18)
  ctx.fillStyle = 'rgba(140,170,220,0.55)'
  ctx.fillText('MASS', x + 96, y + 18)
  ctx.fillStyle = 'rgba(220,180,90,0.6)'
  ctx.fillText('YIELD', x + 152, y + 18)

  planets.forEach((p, i) => {
    const ry = y + 28 + i * rowH
    const live = p.status === 'live'
    const alpha = live ? 1 : 0.32

    if (hoverPlanet === p || (shot && shot.planet === p)) {
      ctx.fillStyle = 'rgba(79,195,247,0.1)'
      roundRect(ctx, x + 6, ry - 2, panelW - 12, rowH - 4, 4)
      ctx.fill()
    }

    // Swatch, sized like the planet is on the field.
    const swR = 4 + 6 * Math.pow(p.mass / maxMass, 1 / 3)
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(x + 18, ry + 10, swR, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '10px monospace'
    ctx.fillStyle = live ? 'rgba(220,228,240,0.9)' : 'rgba(160,170,190,0.7)'
    ctx.fillText(p.name, x + 32, ry + 8)

    ctx.font = '8px monospace'
    ctx.fillStyle =
      p.status === 'pocketed'
        ? 'rgba(140,230,170,0.85)'
        : p.status === 'burned'
          ? 'rgba(255,140,90,0.8)'
          : p.status === 'lost'
            ? 'rgba(150,160,190,0.7)'
            : p.rogue
              ? 'rgba(255,205,120,0.95)'
              : 'rgba(120,135,165,0.7)'
    const statusText =
      p.status === 'pocketed'
        ? `SUNK +${p.energyYield}`
        : p.status === 'burned'
          ? 'BURNED · 0'
          : p.status === 'lost'
            ? 'LOST · 0'
            : p.rogue
              ? `ROGUE · ${(p.mass / REF_MASS).toFixed(2)} M⊕`
              : `${(p.mass / REF_MASS).toFixed(2)} M⊕`
    ctx.fillText(statusText, x + 32, ry + 19)

    // Mass bar (blue) and yield bar (gold) — same length scale, different
    // meanings, deliberately adjacent so they can be compared row by row.
    const massFrac = p.mass / maxMass
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(x + 96, ry + 4, 48, 5)
    ctx.fillStyle = `rgba(110,170,235,${0.85 * alpha})`
    ctx.fillRect(x + 96, ry + 4, 48 * massFrac, 5)

    const yieldFrac = p.energyYield / MAX_YIELD
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(x + 152, ry + 4, 42, 5)
    ctx.fillStyle = yieldColor(p.energyYield)
    ctx.globalAlpha = alpha
    ctx.fillRect(x + 152, ry + 4, 42 * yieldFrac, 5)

    ctx.font = '9px monospace'
    ctx.fillStyle = `rgba(220,200,150,${0.75 * alpha})`
    ctx.fillText(`+${p.energyYield}`, x + 152, ry + 20)

    ctx.globalAlpha = 1
  })
  ctx.restore()
}

// Run tally, tucked to the right of the energy column.
function drawScoreHUD(ctx) {
  ctx.save()
  ctx.textAlign = 'left'
  ctx.font = '11px monospace'
  ctx.fillStyle = 'rgba(140,160,190,0.8)'
  ctx.fillText(`SUNK ${pocketed.length}/${TOTAL_PLANETS}`, 16, 66)
  ctx.fillStyle = 'rgba(110,125,150,0.75)'
  ctx.fillText(`shots ${shotsFired} · spent ${Math.round(energySpent)}`, 16, 82)
  if (burned.length || lost.length) {
    ctx.fillStyle = 'rgba(220,130,110,0.75)'
    ctx.fillText(`burned ${burned.length} · lost ${lost.length}`, 16, 98)
  }
  ctx.restore()
}

function drawHint(ctx, w, h) {
  const remaining = livePlanets().length
  let msg
  if (!revealDone()) msg = ''
  else if (remaining === 0) msg = ''
  else if (shot) msg = 'Drag away to aim · release to fire · release near the planet to cancel'
  else if (energy <= 0)
    msg = 'No energy left — the run is stranded. Press R (or ↺ Reset) to rack up again.'
  else msg = 'Drag a planet to shoot it · right-drag to pan · click empty space to centre the sun'
  if (!msg) return

  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = '11px monospace'
  ctx.fillStyle = energy <= 0 ? 'rgba(235,120,120,0.9)' : 'rgba(150,165,190,0.65)'
  ctx.fillText(msg, w / 2, h - 102)
  ctx.restore()
}

// The time warp control, drawn as a curved band across the foot of the screen —
// the hyperwarp rig's design, and much the better one. The band is an arc of a
// huge circle centred ABOVE the screen, so it sags like a hammock: its lowest
// point is the middle, which is exactly where the bead rests and where the
// cruising speed is pinned. Slow is left, fast is right, and the notch marks
// home. The bead rides `warp.shown`, the eased twin of the real position, so
// jumping to a preset glides instead of snapping.
function drawTimeBand(ctx, w, h) {
  const R = w * 1.1
  const cxp = w / 2
  const cyp = h - R - 54
  const span = 0.38 // radians of visible arc
  const held = !simRunning()

  ctx.save()

  // The rail.
  ctx.strokeStyle = held ? 'rgba(90,110,150,0.18)' : 'rgba(120,150,200,0.25)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(cxp, cyp, R, Math.PI / 2 - span / 2, Math.PI / 2 + span / 2)
  ctx.stroke()

  // Centre notch — the home position the spring returns to.
  const na = Math.PI / 2
  ctx.strokeStyle = 'rgba(160,190,240,0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cxp + Math.cos(na) * (R - 9), cyp + Math.sin(na) * (R - 9))
  ctx.lineTo(cxp + Math.cos(na) * (R + 9), cyp + Math.sin(na) * (R + 9))
  ctx.stroke()

  // End ticks, so the travel has visible limits.
  for (const side of [-1, 1]) {
    const ea = Math.PI / 2 + (side * span) / 2
    ctx.strokeStyle = 'rgba(120,150,200,0.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cxp + Math.cos(ea) * (R - 6), cyp + Math.sin(ea) * (R - 6))
    ctx.lineTo(cxp + Math.cos(ea) * (R + 6), cyp + Math.sin(ea) * (R + 6))
    ctx.stroke()
  }

  // The bead. x grows with t, so the angle DECREASES from the left end.
  const a = Math.PI / 2 + span / 2 - span * warp.shown
  const bx = cxp + Math.cos(a) * R
  const by = cyp + Math.sin(a) * R
  const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 16)
  glow.addColorStop(0, held ? 'rgba(150,170,200,0.6)' : 'rgba(190,220,255,0.95)')
  glow.addColorStop(1, 'rgba(120,170,255,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(bx, by, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = held ? 'rgba(190,200,215,0.7)' : '#e8f0fa'
  ctx.beginPath()
  ctx.arc(bx, by, 4, 0, Math.PI * 2)
  ctx.fill()

  // Readout under the bead.
  ctx.textAlign = 'center'
  ctx.font = 'bold 13px monospace'
  ctx.fillStyle = held ? 'rgba(150,165,190,0.65)' : 'rgba(190,215,245,0.95)'
  ctx.fillText(formatWarp(warp.shownWarp()), w / 2, h - 30)

  ctx.font = '9px monospace'
  ctx.fillStyle = 'rgba(130,150,185,0.5)'
  ctx.fillText('Q ◂ TIME ▸ E', w / 2, h - 15)
  ctx.restore()
}

// While a shot is being lined up the simulation is held. Say so, rather than
// leaving the player to wonder why the planets stopped.
function drawTimeHeld(ctx, w) {
  if (!shot || !isPlaying.value) return
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = '10px monospace'
  const label = '⏸ TIME HELD WHILE AIMING'
  const tw = ctx.measureText(label).width + 22
  ctx.fillStyle = 'rgba(10,14,28,0.8)'
  ctx.strokeStyle = 'rgba(79,195,247,0.35)'
  ctx.lineWidth = 1
  roundRect(ctx, w / 2 - tw / 2, BAND_TOP_INSET + 54, tw, 20, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(150,205,240,0.9)'
  ctx.fillText(label, w / 2, BAND_TOP_INSET + 68)
  ctx.restore()
}

function drawRunOver(ctx, w, h) {
  // Wait for the payouts to land, or the final balance would be shown short.
  if (livePlanets().length > 0 || energyFlights.length || Math.abs(energy - energyShown) > 0.5) {
    return
  }

  ctx.save()
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(4,6,14,0.72)'
  roundRect(ctx, w / 2 - 190, h / 2 - 92, 380, 184, 10)
  ctx.fill()
  ctx.strokeStyle = 'rgba(79,195,247,0.35)'
  ctx.lineWidth = 1
  roundRect(ctx, w / 2 - 190, h / 2 - 92, 380, 184, 10)
  ctx.stroke()

  ctx.fillStyle = '#4fc3f7'
  ctx.font = '16px monospace'
  ctx.fillText('TABLE CLEARED', w / 2, h / 2 - 56)

  ctx.font = '12px monospace'
  ctx.fillStyle = 'rgba(200,215,235,0.9)'
  ctx.fillText(`Sunk ${pocketed.length} of ${TOTAL_PLANETS}`, w / 2, h / 2 - 26)
  ctx.fillStyle = 'rgba(140,230,170,0.9)'
  ctx.fillText(
    `Energy banked ${Math.round(energyBanked)} of ${TOTAL_YIELD} possible`,
    w / 2,
    h / 2 - 6,
  )
  ctx.fillStyle = 'rgba(200,215,235,0.75)'
  ctx.fillText(
    `Spent ${Math.round(energySpent)} over ${shotsFired} shot${shotsFired === 1 ? '' : 's'}`,
    w / 2,
    h / 2 + 14,
  )
  if (burned.length || lost.length) {
    ctx.fillStyle = 'rgba(220,130,110,0.85)'
    ctx.fillText(`Wasted: ${burned.length} burned, ${lost.length} lost`, w / 2, h / 2 + 34)
  }
  ctx.fillStyle = 'rgba(140,155,180,0.7)'
  ctx.font = '11px monospace'
  ctx.fillText(`Final balance ${Math.round(energy)}`, w / 2, h / 2 + 58)
  ctx.fillStyle = 'rgba(120,135,165,0.6)'
  ctx.fillText('R — rack up again', w / 2, h / 2 + 76)
  ctx.restore()
}

// =============================================================================
// FRAME
// =============================================================================

function render(ctx, w, h, timeS) {
  const c = cam.worldCenter(w, h)
  starfield.draw(ctx, w, h, c.x, c.y, cam.scale())

  drawOrbitGuides(ctx)
  drawBand(ctx, timeS)
  drawPocket(ctx, timeS)
  drawSun(ctx)

  for (const p of planets) {
    if (p.status !== 'live') continue
    drawTrail(ctx, p)
  }

  // Gravity fields under the planets, so a rogue's reach is never hidden by a
  // disc sitting on top of it.
  for (const p of planets) {
    if (p.status === 'live' && p.rogue) drawRogueField(ctx, p, timeS)
  }

  if (shot) drawPrediction(ctx, cachedPrediction())

  for (const p of planets) {
    if (p.status !== 'live') continue
    drawPlanet(ctx, p, w, h)
  }

  drawEffects(ctx)

  // Stars in FRONT of the system: drawn over the world so that zooming in sends
  // them sweeping outward past the camera. Under the cue and the HUD, which have
  // to stay readable.
  starfield.drawForeground(ctx, w, h, c.x, c.y, cam.scale())

  drawCue(ctx)

  // Labels last, over the field but under the fog and HUD. Zoomed out they'd
  // collide with each other, so only the planet in play gets one.
  const labelAll = cam.zoom > 3.2
  for (const p of planets) {
    if (p.status !== 'live') continue
    if (labelAll || hoverPlanet === p || (shot && shot.planet === p)) drawPlanetLabel(ctx, p)
  }

  drawRevealOverlay(ctx, w, h)

  drawEnergyFlights(ctx, w, h)
  drawEnergyBand(ctx, w, h)
  drawRoster(ctx, w)
  drawScoreHUD(ctx)
  drawTimeBand(ctx, w, h)
  drawTimeHeld(ctx, w)
  drawHint(ctx, w, h)
  drawRunOver(ctx, w, h)
}

// =============================================================================
// MAIN LOOP
// =============================================================================

let loop = null
let _w = 0
let _h = 0
let teardown = null

function planetAtScreen(mx, my) {
  const s = cam.scale()
  let best = null
  let bestD = Infinity
  for (const p of planets) {
    if (p.status !== 'live') continue
    if (!revealed(p.x, p.y)) continue
    const sp = cam.worldToScreen(p.x, p.y)
    const d = Math.hypot(mx - sp.x, my - sp.y)
    const grabR = Math.max(3, planetRadius(p.mass) * s) + GRAB_MARGIN_PX
    if (d <= grabR && d < bestD) {
      best = p
      bestD = d
    }
  }
  return best
}

function initCanvas(canvas) {
  if (!canvas) return

  // --- Keyboard ---
  function isTypingTarget(el) {
    if (!el) return false
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
  }

  function onKeyDown(e) {
    if (isTypingTarget(e.target)) return

    if (e.key === 'Escape') {
      shot = null
      return
    }
    // Q/E are HELD, not tapped — the slide happens in the frame loop.
    if (e.key === 'q' || e.key === 'Q') {
      keys.slower = true
      return
    }
    if (e.key === 'e' || e.key === 'E') {
      keys.faster = true
      return
    }
    if (e.key >= '1' && e.key <= '4') {
      warp.setWarp(TIME_PRESETS[Number(e.key) - 1])
      return
    }
    if (e.key === 'r' || e.key === 'R') {
      reset()
      return
    }
    if (e.key === 'z' || e.key === 'Z') {
      focusSun()
      return
    }
    if (e.key === 'f' || e.key === 'F') {
      fitSystem()
    }
  }

  // --- Mouse ---
  function localPoint(e) {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onMouseDown(e) {
    const pt = localPoint(e)

    // Right button (or middle) pans.
    if (e.button === 2 || e.button === 1) {
      pan = { lastX: pt.x, lastY: pt.y }
      cam.focus = 'free'
      e.preventDefault()
      return
    }
    if (e.button !== 0) return

    const p = planetAtScreen(pt.x, pt.y)
    if (p) {
      shot = { planet: p, curX: pt.x, curY: pt.y }
      invalidatePrediction()
      emptyClick = null
    } else {
      shot = null
      // Remember where a click on empty space started: only a click that stays
      // put re-centres the camera, so a stray drag doesn't yank the view.
      emptyClick = { x: pt.x, y: pt.y }
    }
  }

  function onMouseMove(e) {
    const pt = localPoint(e)

    if (pan) {
      const dx = pt.x - pan.lastX
      const dy = pt.y - pan.lastY
      cam.panBy(dx, dy)
      pan.lastX = pt.x
      pan.lastY = pt.y
      return
    }

    if (shot) {
      shot.curX = pt.x
      shot.curY = pt.y
      return
    }

    hoverPlanet = planetAtScreen(pt.x, pt.y)
    canvas.style.cursor = hoverPlanet ? 'grab' : 'default'
  }

  function onMouseUp(e) {
    const pt = localPoint(e)

    if (pan && (e.button === 2 || e.button === 1)) {
      pan = null
      return
    }
    if (e.button !== 0) return

    if (shot) {
      shot.curX = pt.x
      shot.curY = pt.y
      fireShot()
      emptyClick = null
      return
    }

    // A left click on empty space re-centres the view on the sun.
    if (emptyClick && Math.hypot(pt.x - emptyClick.x, pt.y - emptyClick.y) <= CLICK_SLOP_PX) {
      focusSun()
    }
    emptyClick = null
  }

  function onMouseLeave() {
    hoverPlanet = null
    pan = null
    emptyClick = null
    // Losing the cursor mid-pull would leave the cue stuck to the planet, so
    // treat it as a cancel rather than a shot.
    shot = null
  }

  function onWheel(e) {
    e.preventDefault()
    // Zoom about the CENTRE of the view, not the cursor. Cursor-anchored zoom is
    // usually the nicer gesture, but the star field expands about the centre of
    // the screen — that is what "the camera is here" means to a parallax field —
    // so anchoring the world somewhere else gives the two different fixed points
    // and the whole scene feels like it is sliding under itself.
    //
    // Move the TARGET and let the camera ease into it: a wheel delivers discrete
    // notches, and applying each one directly makes the view jump.
    cam.zoomToward(Math.pow(1.12, -e.deltaY / 100), _w / 2, _h / 2)
  }

  function onContextMenu(e) {
    e.preventDefault() // right-drag is the pan gesture
  }

  function onKeyUp(e) {
    if (e.key === 'q' || e.key === 'Q') keys.slower = false
    if (e.key === 'e' || e.key === 'E') keys.faster = false
  }
  // A key held while the window loses focus never sends its keyup, which would
  // leave the clock sliding forever.
  function clearKeys() {
    keys.slower = false
    keys.faster = false
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearKeys)
  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('mouseleave', onMouseLeave)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)

  // --- Canvas sizing + frame loop (shared: composables/useCanvasLoop.js) ---
  loop = useCanvasLoop(canvas, {
    bottomInset: () => controlBarHeight(canvas),
    onResize(w, h, isFirst) {
      _w = w
      _h = h
      if (isFirst) buildScene(w, h)
      else starfield.build()
    },
    onFrame(realDt, ctx, w, h) {
      // The clock slides on the real clock, so the control still responds while
      // the simulation itself is paused or held for a shot.
      warp.spring = settings.settings.time.spring
      warp.update(realDt, { slower: keys.slower, faster: keys.faster })

      tickReveal(realDt)
      tickEffects(realDt)
      tickEnergyFlights(realDt)
      tickEnergyDisplay(realDt)
      applyFocus(w, h)

      if (simRunning()) {
        const dt_yr = (realDt * warp.warp()) / SECONDS_PER_YEAR
        // Substepped, so the physics is the same whether the clock is crawling
        // or racing — see planSubsteps in engine/timeWarp.js.
        const { steps, h } = planSubsteps(dt_yr, {
          maxStep: MAX_SUBSTEP_YR,
          maxSteps: MAX_SUBSTEPS,
        })
        for (let i = 0; i < steps; i++) {
          gravityStep(h)
          resolveOutcomes()
        }
        simYears += dt_yr
        for (const p of planets) {
          if (p.status === 'live') p.trail.push(p.x, p.y)
        }
        elapsedLabel.value = `Year ${simYears.toFixed(2)}`
      }

      render(ctx, w, h, performance.now() / 1000)
    },
  })

  teardown = () => {
    loop.stop()
    loop = null
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', clearKeys)
    clearKeys()
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mouseup', onMouseUp)
    canvas.removeEventListener('mouseleave', onMouseLeave)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('contextmenu', onContextMenu)
  }
}

// =============================================================================
// CONTROLS
// =============================================================================

function togglePlay() {
  isPlaying.value = !isPlaying.value
}

function reset() {
  loop?.resetClock()
  isPlaying.value = true
  warp.reset()
  buildScene(_w, _h)
}

onUnmounted(() => teardown?.())
</script>

<style scoped>
.help-toggle {
  position: absolute;
  top: 12px;
  right: 108px;
  z-index: 100;
  background: rgba(15, 15, 30, 0.9);
  color: #aaa;
  border: 1px solid #2a2a4a;
  border-radius: 4px;
  padding: 5px 12px;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
  letter-spacing: 0.05em;
}
.help-toggle:hover {
  background: rgba(26, 26, 60, 0.95);
  color: #e0e0e0;
  border-color: #4fc3f7;
}

.ctrl-btn {
  background: #1a1a2e;
  color: #e0e0e0;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
  font-family: monospace;
  font-size: 13px;
}
.ctrl-btn:hover {
  background: #2a2a4e;
}

/* Two-state toggle inside the settings panel — same control 001 uses. */
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
  grid-template-columns: repeat(2, 1fr);
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

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.modal-box {
  background: #0d1020;
  border: 1px solid #2a3a5a;
  border-radius: 8px;
  padding: 20px 22px 16px;
  max-width: 560px;
  font-family: monospace;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.6);
}

.help-box {
  max-height: 82vh;
  display: flex;
  flex-direction: column;
}

.modal-title {
  color: #4fc3f7;
  font-size: 14px;
  letter-spacing: 0.08em;
  margin-bottom: 14px;
}

.modal-body {
  color: #aab;
  font-size: 12.5px;
  line-height: 1.7;
}

.help-body {
  overflow-y: auto;
  padding-right: 6px;
}

.help-intro {
  color: #ccd;
  margin-bottom: 14px;
}

.help-h {
  color: #7bafd6;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 16px 0 6px;
}

.help-body p {
  margin-bottom: 8px;
}

.help-body strong {
  color: #dde;
}

.help-keys {
  color: #889;
  font-size: 11.5px;
  line-height: 1.9;
}

.modal-close {
  margin-top: 16px;
  align-self: flex-start;
  background: #1a2540;
  color: #9cf;
  border: 1px solid #2a3a5a;
  border-radius: 4px;
  padding: 5px 14px;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
}
.modal-close:hover {
  background: #24345a;
}
</style>
