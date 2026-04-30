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
          <SettingsRow
            label="Base speed"
            v-model="settings.settings.sim.baseSpeed"
            :min="0.1"
            :max="1000"
            :step="0.1"
            :decimals="1"
            tooltip="Simulation speed multiplier."
          />
        </SettingsSection>
        <SettingsSection title="Spaceship">
          <SettingsRow
            label="Thrust"
            v-model="settings.settings.ship.thrustAccel"
            :min="1"
            :max="1500"
            :step="10"
            :decimals="0"
            tooltip="Thrust acceleration in AU/yr²."
          />
          <SettingsRow
            label="Brake distance (px)"
            v-model="settings.settings.ship.brakeDistance"
            :min="0"
            :max="120"
            :step="2"
            :decimals="0"
            tooltip="Cursor distance from the ship where automatic braking is active."
          />
          <SettingsRow
            label="Min go distance (px)"
            v-model="settings.settings.ship.minGoDistance"
            :min="0"
            :max="400"
            :step="5"
            :decimals="0"
            tooltip="Cursor distance where forward thrust begins."
          />
          <SettingsRow
            label="Max distance (px)"
            v-model="settings.settings.ship.maxDistance"
            :min="40"
            :max="900"
            :step="10"
            :decimals="0"
            tooltip="Cursor distance from the ship where thrust reaches maximum."
          />
        </SettingsSection>
        <SettingsSection title="Orbit Shot">
          <SettingsRow
            label="Ring radius (AU)"
            v-model="settings.settings.orbit.ringRadiusMult"
            :min="0.05"
            :max="2"
            :step="0.05"
            :decimals="2"
            tooltip="Capture ring radius in AU. Same for all planets."
          />
          <SettingsRow
            label="Trajectory threshold"
            v-model="settings.settings.orbit.velMatchThreshold"
            :min="0.05"
            :max="1.0"
            :step="0.05"
            :decimals="2"
            tooltip="Max relative speed fraction for capture. Lower = harder to enter slingshot orbit."
          />
          <SettingsRow
            label="Shot power"
            v-model="settings.settings.orbit.shotPower"
            :min="100"
            :max="80000"
            :step="100"
            :decimals="0"
            tooltip="Impulse power for planet shots. Higher = more kick."
          />
          <SettingsRow
            label="Max drag (px)"
            v-model="settings.settings.orbit.maxDrag"
            :min="50"
            :max="400"
            :step="10"
            :decimals="0"
            tooltip="Maximum drag distance for shot aiming."
          />
          <SettingsRow
            label="Recoil"
            v-model="settings.settings.orbit.recoilMult"
            :min="0"
            :max="1"
            :step="0.01"
            :decimals="2"
            tooltip="Fraction of planet impulse applied back to ship as recoil."
          />
          <SettingsRow
            label="Planet grav boost"
            v-model="settings.settings.orbit.planetGravBoost"
            :min="1"
            :max="80000"
            :step="50"
            :decimals="0"
            tooltip="Gravity multiplier for planet→ship attraction only. Sun is unaffected."
          />
        </SettingsSection>
        <SettingsSection title="Black hole">
          <SettingsRow
            label="Mass"
            v-model="settings.settings.blackhole.mass"
            :min="0"
            :max="5"
            :step="0.05"
            :decimals="2"
            tooltip="Local ship-only gravity. Planets are not affected."
          />
          <SettingsRow
            label="Influence radius"
            v-model="settings.settings.blackhole.influenceRadius"
            :min="0.1"
            :max="4"
            :step="0.1"
            :decimals="2"
            tooltip="AU radius where the black hole can pull the ship."
          />
        </SettingsSection>
        <SettingsSection title="Visuals">
          <SettingsRow
            label="Trail length"
            v-model="settings.settings.visuals.trailLength"
            :min="50"
            :max="5000"
            :step="50"
            :decimals="0"
            tooltip="Number of past positions in body trails."
          />
        </SettingsSection>
      </SettingsPanel>
    </template>
  </SketchWrapper>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import SketchWrapper from "../components/SketchWrapper.vue";
import SettingsPanel from "../components/SettingsPanel.vue";
import SettingsSection from "../components/SettingsSection.vue";
import SettingsRow from "../components/SettingsRow.vue";
import { useSettings } from "../composables/useSettings.js";

// =============================================================================
// CONSTANTS
// =============================================================================

const PROTOTYPE_ID = "007";

// Unit system: AU (astronomical unit), Solar masses, Julian years
// G in these units = 4π² (from Kepler's 3rd law: T²=a³ for M_sun)
const G_SIM = 4 * Math.PI * Math.PI; // ~39.478 AU³ / (M☉ · yr²)
const PX_PER_AU = 100; // pixels per AU at zoom = 1
const AU_KM = 1.496e8; // km per AU (for display labels)
const SOFTENING = 1e-5; // AU² — prevents singularities
const MAX_DT = 0.05; // real-time seconds cap per frame

// Spaceship physical dimensions
const SHIP_LENGTH_AU = 1000 / AU_KM; // 1000 km in AU ≈ 6.684e-6 AU
const SHIP_WIDTH_AU = 26 / AU_KM; // 26 km in AU  ≈ 1.738e-7 AU
const SHIP_MASS = 5.03e-18; // M☉ — 10,000 Gt

// Minimum pixel size below which we switch to icon rendering
const MIN_PLANET_PX = 3; // px
const MIN_SHIP_PX = 30; // px (length in screen pixels)

// Prediction config
const PRED_HORIZON_YR = 0.5; // simulated years to preview
const PRED_BASE_DT_YR = 0.001; // max ghost timestep before adaptive tightening
const PRED_TARGET_SEGMENT_PX = 7; // keeps fast projected curves visually smooth
const PRED_MAX_STEPS = 3000;
const PRED_INTERVAL = 3; // recalculate every N rendered frames

const CAPTURE_DURATION_S = 1.25;
const SLINGSHOT_ORBIT_MIN_R = 0.018;
const SLINGSHOT_ORBIT_R_MULT = 2.8;
const BLACK_HOLE = {
  x: 1.46,
  y: -1.34,
  drawR: 0.035,
  captureR: 0.05,
};
const SUN_GRAVITY_WELL_R = 0.18;
const SUN_DESTRUCTION_R = 0.028;
const DEBRIS_COUNT = 22;

// Solar system data — all in simulation units (AU, M☉)
const SOLAR_BODIES = [
  {
    id: "sun",
    name: "Sun",
    mass: 1.0,
    orbR: 0,
    angle: 0,
    color: "#FFD700",
    physR: 0.00465,
    drawR: 0.01,
    isFixed: true,
  },
  {
    id: "venus",
    name: "Venus",
    mass: 2.447e-6,
    orbR: 0.723,
    angle: 3.176,
    color: "#e8cda0",
    physR: 4.05e-5,
    drawR: 0.005,
    isFixed: false,
  },
  {
    id: "earth",
    name: "Earth",
    mass: 3.003e-6,
    orbR: 1.0,
    angle: 1.753,
    color: "#4fc3f7",
    physR: 4.26e-5,
    drawR: 0.006,
    isFixed: false,
  },
  {
    id: "mars",
    name: "Mars",
    mass: 3.213e-7,
    orbR: 1.524,
    angle: 5.015,
    color: "#e8714a",
    physR: 2.27e-5,
    drawR: 0.004,
    isFixed: false,
  },
];

// =============================================================================
// SETTINGS
// =============================================================================

const settings = useSettings(PROTOTYPE_ID, {
  sim: { baseSpeed: 1000000 },
  ship: {
    thrustAccel: 360,
    brakeDistance: 28,
    minGoDistance: 60,
    maxDistance: 360,
  },
  orbit: {
    ringRadiusMult: 0.1,
    velMatchThreshold: 0.35,
    shotPower: 800,
    maxDrag: 250,
    recoilMult: 0.05,
    planetGravBoost: 500,
  },
  blackhole: {
    mass: 0.8,
    influenceRadius: 0.45,
  },
  visuals: { trailLength: 1600 },
});

function onImport(parsed) {
  settings.importJSON(parsed);
  reset();
}

onMounted(() => {
  const imported = history.state?.importedSettings;
  if (imported) settings.importJSON(imported);
});

// =============================================================================
// REACTIVE STATE
// =============================================================================

const isPlaying = ref(true);
const timeScale = ref(settings.settings.sim.baseSpeed);
const bodyCount = ref(0);
const elapsedLabel = ref("");

// =============================================================================
// SIMULATION STATE
// =============================================================================

let bodies = [];
let ship = null; // reference into bodies[]
let starLayers = [];

// Camera
const cam = {
  zoom: 0.33,
  panX: 0,
  panY: 0,
  focus: "sun", // 'sun' | 'ship' | 'orbit' | 'free'
};

// Camera zoom animation
let camTargetZoom = 0.33;

// Spaceship angular state
let shipAngle = 0; // radians

// Inputs
const mouse = {
  x: 0,
  y: 0,
  hasPosition: false,
};

// Prediction path
let shipPredPath = [];
let predCountdown = 0;

// Orbit game state
// mode: 'free' | 'capturing' | 'slingshot'
let orbitState = { mode: "free", planet: null, shipOffset: null };

// Drag for aiming the shot (screen-space pixels)
let orbitDrag = null; // null | { startX, startY, curX, curY }

// Cooldown after firing — real-time seconds remaining
let captureCooldown = 0;
let captureReleaseLockPlanetId = null;

// Shockwave particles — spawned on fireShot
// Each: { x, y, r, maxR, alpha, color }  — x/y/r in world AU
let shockwaves = [];
let debris = [];
let thrustParticles = [];
let blackHoleScore = 0;
let blackHoleConsumed = []; // { name, color, physR } in order of consumption
let shipLoss = null;
let sunPenalty = 0;
let totalEnergySpent = 0;
let finalScoreShown = false;

const TOTAL_PLANETS = SOLAR_BODIES.filter((b) => !b.isFixed).length;

// =============================================================================
// TRAIL CIRCULAR BUFFER
// =============================================================================

function makeTrail(cap) {
  const buf = new Array(cap);
  let head = 0,
    size = 0;
  return {
    push(x, y) {
      buf[head] = { x, y };
      head = (head + 1) % cap;
      if (size < cap) size++;
    },
    points() {
      const out = [];
      const start = (head - size + cap) % cap;
      for (let i = 0; i < size; i++) out.push(buf[(start + i) % cap]);
      return out;
    },
    clear() {
      head = 0;
      size = 0;
    },
    get length() {
      return size;
    },
  };
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildStarfield(w, h) {
  const rand = seededRandom(0x6a51cafe);
  const layerDefs = [
    { count: 90, depth: 0.018, alpha: 0.28, size: 0.7 },
    { count: 70, depth: 0.04, alpha: 0.45, size: 1.0 },
    { count: 42, depth: 0.075, alpha: 0.72, size: 1.35 },
  ];
  const tw = Math.max(w * 1.8, 1600);
  const th = Math.max(h * 1.8, 1100);

  starLayers = layerDefs.map((def) => ({
    ...def,
    tw,
    th,
    stars: Array.from({ length: def.count }, () => {
      const tint = rand();
      return {
        x: rand() * tw,
        y: rand() * th,
        r: def.size * (0.55 + rand() * 1.4),
        twinkle: rand() * Math.PI * 2,
        color:
          tint < 0.68
            ? "255,255,255"
            : tint < 0.86
              ? "178,220,255"
              : "255,226,177",
      };
    }),
  }));
}

// =============================================================================
// PHYSICS
// =============================================================================

function gravityStep(bs, dt, planetBoost = 1) {
  const n = bs.length;
  const fx = new Float64Array(n);
  const fy = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = bs[j].x - bs[i].x;
      const dy = bs[j].y - bs[i].y;
      const distSq = dx * dx + dy * dy + SOFTENING;
      const dist = Math.sqrt(distSq);
      const f = (G_SIM * bs[i].mass * bs[j].mass) / distSq;
      // Apply boost only on ship↔planet pairs (not ship↔sun, not planet↔planet)
      const isShipPlanetPair =
        (bs[i].id === "ship" && bs[j].isPlanet) ||
        (bs[j].id === "ship" && bs[i].isPlanet);
      const boost = isShipPlanetPair ? planetBoost : 1;
      const ffx = (f * boost * dx) / dist;
      const ffy = (f * boost * dy) / dist;
      if (!bs[i].isFixed) {
        fx[i] += ffx;
        fy[i] += ffy;
      }
      if (!bs[j].isFixed) {
        fx[j] -= ffx;
        fy[j] -= ffy;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (bs[i].isFixed) continue;
    bs[i].vx += (fx[i] / bs[i].mass) * dt;
    bs[i].vy += (fy[i] / bs[i].mass) * dt;
    bs[i].x += bs[i].vx * dt;
    bs[i].y += bs[i].vy * dt;
  }
}

function applyBlackHoleGravityToShipLike(target, dt) {
  const bh = settings.settings.blackhole;
  if (!target || !bh || bh.mass <= 0 || bh.influenceRadius <= 0) return;

  const dx = BLACK_HOLE.x - target.x;
  const dy = BLACK_HOLE.y - target.y;
  const distSq = dx * dx + dy * dy + SOFTENING;
  const dist = Math.sqrt(distSq);
  if (dist >= bh.influenceRadius) return;

  const falloff = 1 - dist / bh.influenceRadius;
  const accel = (G_SIM * bh.mass * falloff) / distSq;
  target.vx += (dx / dist) * accel * dt;
  target.vy += (dy / dist) * accel * dt;
}

function applyBlackHoleGravityLocal(bs, dt) {
  for (const body of bs) {
    if (body.isFixed) continue;
    applyBlackHoleGravityToShipLike(body, dt);
  }
}

function applySolarGravityWell(bs, dt) {
  const sun = bs.find((b) => b.id === "sun");
  if (!sun) return;

  for (const body of bs) {
    if (body.isFixed || body.id === "sun") continue;

    const dx = sun.x - body.x;
    const dy = sun.y - body.y;
    const distSq = dx * dx + dy * dy + SOFTENING;
    const dist = Math.sqrt(distSq);
    if (dist >= SUN_GRAVITY_WELL_R) continue;

    const ux = dx / dist;
    const uy = dy / dist;
    const well = Math.max(
      0,
      Math.min(
        1,
        1 -
          (dist - SUN_DESTRUCTION_R) / (SUN_GRAVITY_WELL_R - SUN_DESTRUCTION_R),
      ),
    );
    const strength = well * well;

    // Extra local pull: a gameplay gravity well, not realism.
    // It adds speed toward the sun without braking the flyby trajectory.
    const accel = (G_SIM * sun.mass * strength * 0.7) / distSq;
    body.vx += ux * accel * dt;
    body.vy += uy * accel * dt;
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getSlingshotOrbitRadius(planet) {
  return Math.max(planet.drawR * SLINGSHOT_ORBIT_R_MULT, SLINGSHOT_ORBIT_MIN_R);
}

function stepSystemWhileShipAutopilots(dt_yr, planetBoost) {
  if (!ship) return gravityStep(bodies, dt_yr, planetBoost);
  ship.isFixed = true;
  gravityStep(bodies, dt_yr, planetBoost);
  ship.isFixed = false;
}

function simStep(dt_yr, realDt_s) {
  if (captureCooldown > 0) captureCooldown -= realDt_s;

  const boost = settings.settings.orbit.planetGravBoost;

  if (orbitState.mode === "free") {
    applyShipInput(dt_yr, realDt_s);
    applyBlackHoleGravityLocal(bodies, dt_yr);
    applySolarGravityWell(bodies, dt_yr);
    gravityStep(bodies, dt_yr, boost);
    resolveBodyDestruction();
    checkOrbitCapture();
  } else if (orbitState.mode === "capturing") {
    stepSystemWhileShipAutopilots(dt_yr, boost);
    updateCapture(dt_yr, realDt_s);
  } else if (orbitState.mode === "slingshot") {
    stepSystemWhileShipAutopilots(dt_yr, boost);
    const planet = orbitState.planet;
    if (planet && ship) {
      ship.x = planet.x;
      ship.y = planet.y;
      ship.vx = planet.vx;
      ship.vy = planet.vy;
    }
  }
}

// =============================================================================
// ORBIT CAPTURE LOGIC
// =============================================================================

function checkOrbitCapture() {
  if (!ship) return;
  if (captureCooldown > 0) return;
  if (isCaptureReleaseLocked()) return;

  for (const body of bodies) {
    if (body.isFixed) continue;
    if (body.id === "sun") continue;
    if (body.id === "ship") continue;

    const { distancePct, matchPct } = getApproachMatch(body);
    if (distancePct >= 1 && matchPct >= 1) {
      beginOrbitCapture(body);
      break;
    }
  }
}

function isCaptureReleaseLocked() {
  if (!captureReleaseLockPlanetId) return false;

  const lockedPlanet = bodies.find((body) => body.id === captureReleaseLockPlanetId);
  if (!lockedPlanet) {
    captureReleaseLockPlanetId = null;
    return false;
  }

  const { dist, captureRingR } = getApproachMatch(lockedPlanet);
  if (dist > captureRingR * 2.5) {
    captureReleaseLockPlanetId = null;
    return false;
  }

  return true;
}

function beginOrbitCapture(planet) {
  if (!ship || !planet) return;

  const dx = ship.x - planet.x;
  const dy = ship.y - planet.y;
  const startRelVx = ship.vx - planet.vx;
  const startRelVy = ship.vy - planet.vy;

  orbitState = {
    mode: "capturing",
    planet,
    shipOffset: { dx, dy },
    capture: {
      age: 0,
      simAge: 0,
      duration: CAPTURE_DURATION_S,
      startDx: dx,
      startDy: dy,
      startRelVx,
      startRelVy,
    },
  };

  orbitDrag = null;
}

function updateCapture(dt_yr, realDt_s) {
  if (
    !ship ||
    orbitState.mode !== "capturing" ||
    !orbitState.planet ||
    !orbitState.capture
  )
    return;

  const planet = orbitState.planet;
  const capture = orbitState.capture;
  capture.age += realDt_s;
  capture.simAge += dt_yr;

  const rawT = Math.min(1, capture.age / capture.duration);
  const t = easeInOutCubic(rawT);
  const driftDx = capture.startDx + capture.startRelVx * capture.simAge;
  const driftDy = capture.startDy + capture.startRelVy * capture.simAge;

  orbitState.shipOffset = {
    dx: driftDx * (1 - t),
    dy: driftDy * (1 - t),
  };

  const prevX = ship.x;
  const prevY = ship.y;
  ship.x = planet.x + orbitState.shipOffset.dx;
  ship.y = planet.y + orbitState.shipOffset.dy;
  if (dt_yr > 0) {
    ship.vx = (ship.x - prevX) / dt_yr;
    ship.vy = (ship.y - prevY) / dt_yr;
  }

  if (rawT >= 1) {
    ship.x = planet.x;
    ship.y = planet.y;
    ship.vx = planet.vx;
    ship.vy = planet.vy;
    orbitState = {
      mode: "slingshot",
      planet,
      shipOffset: { dx: 0, dy: 0 },
    };
  }
}

// =============================================================================
// BREAK ORBIT
// =============================================================================

function breakOrbit(kick = true) {
  if (orbitState.mode !== "slingshot" && orbitState.mode !== "capturing")
    return;

  if (kick && ship) {
    // Small random kick to break away
    const angle = Math.random() * Math.PI * 2;
    ship.vx += Math.cos(angle) * 0.1;
    ship.vy += Math.sin(angle) * 0.1;
  }

  orbitState = { mode: "free", planet: null, shipOffset: null };
  orbitDrag = null;
  cam.focus = "ship";
}

function updateOrbitAimFromMouse() {
  if (orbitState.mode !== "slingshot" || !orbitState.planet || !mouse.hasPosition) {
    return;
  }

  const planetScreen = worldToScreen(orbitState.planet.x, orbitState.planet.y);
  orbitDrag = {
    startX: planetScreen.x,
    startY: planetScreen.y,
    curX: mouse.x,
    curY: mouse.y,
  };
}

// =============================================================================
// SHOT FIRING
// =============================================================================

function fireShot() {
  if (orbitState.mode !== "slingshot" || !orbitDrag) return;
  const planet = orbitState.planet;
  if (!planet) return;

  const { startX, startY, curX, curY } = orbitDrag;
  const ddx = curX - startX;
  const ddy = curY - startY;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy);
  if (dist < 2) {
    breakOrbit(true);
    return;
  }

  const maxDrag = settings.settings.orbit.maxDrag;
  const clamped = Math.min(dist, maxDrag);
  const nx = ddx / dist; // drag direction unit vector
  const ny = ddy / dist;

  // dv proportional to aim distance, shot direction follows the mouse.
  const power = clamped / maxDrag;
  const dv = power * settings.settings.orbit.shotPower * 0.01;
  totalEnergySpent += power * settings.settings.orbit.shotPower;

  planet.vx += nx * dv;
  planet.vy += ny * dv;

  // Recoil to ship: opposite of planet impulse.
  const recoil = dv * settings.settings.orbit.recoilMult;
  if (ship) {
    ship.vx -= nx * recoil;
    ship.vy -= ny * recoil;
  }

  captureReleaseLockPlanetId = planet.id;
  captureCooldown = 0.25;

  // Spawn shockwave at planet position — large slow wave
  shockwaves.push({
    x: planet.x,
    y: planet.y,
    r: 0,
    maxR: planet.drawR * 300, // ~30 AU for Earth-sized planet — solar-system scale
    alpha: 1.0,
    duration: 3.5, // real-time seconds to fully expand
    age: 0,
    color: planet.color,
  });

  breakOrbit(false);
}

// =============================================================================
// BODY DESTRUCTION
// =============================================================================

function resolveBodyDestruction() {
  const sun = bodies.find((b) => b.id === "sun");
  for (let i = bodies.length - 1; i >= 0; i--) {
    const body = bodies[i];
    if (body.isFixed || body.id === "sun") continue;

    const bhDx = body.x - BLACK_HOLE.x;
    const bhDy = body.y - BLACK_HOLE.y;
    if (Math.sqrt(bhDx * bhDx + bhDy * bhDy) <= BLACK_HOLE.captureR) {
      consumeBodyInBlackHole(body, i);
      continue;
    }

    if (sun) {
      const sunDx = body.x - sun.x;
      const sunDy = body.y - sun.y;
      const sunCrashR = SUN_DESTRUCTION_R + body.drawR;
      if (Math.sqrt(sunDx * sunDx + sunDy * sunDy) <= sunCrashR) {
        destroyBodyInSun(body, i);
      }
    }
  }
}

function consumeBodyInBlackHole(body, index) {
  bodies.splice(index, 1);
  if (body.id === "ship") {
    ship = null;
    shipLoss = "BLACK HOLE";
    orbitState = { mode: "free", planet: null, shipOffset: null };
    orbitDrag = null;
    cam.focus = "sun";
  } else {
    blackHoleScore++;
    const def = SOLAR_BODIES.find((d) => d.id === body.id);
    blackHoleConsumed.push({
      name: body.name,
      color: body.color,
      physR: def ? def.physR : body.drawR * 0.01,
    });
  }
  updateFinalScoreState();
  if (orbitState.planet === body) breakOrbit(false);

  shockwaves.push({
    x: BLACK_HOLE.x,
    y: BLACK_HOLE.y,
    r: 0,
    maxR: BLACK_HOLE.captureR * 3.8,
    alpha: 0.9,
    duration: 1.2,
    age: 0,
    color: "#ff8c00",
  });
}

function destroyBodyInSun(body, index) {
  bodies.splice(index, 1);
  if (body.id === "ship") {
    ship = null;
    shipLoss = "SUN IMPACT";
    orbitState = { mode: "free", planet: null, shipOffset: null };
    orbitDrag = null;
    cam.focus = "sun";
  } else {
    sunPenalty++;
  }
  updateFinalScoreState();
  if (orbitState.planet === body) breakOrbit(false);
  spawnSunDebris(body);
}

function updateFinalScoreState() {
  finalScoreShown = blackHoleScore + sunPenalty >= TOTAL_PLANETS;
}

function spawnSunDebris(body) {
  const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
  const nx = speed > 1e-6 ? body.vx / speed : 1;
  const ny = speed > 1e-6 ? body.vy / speed : 0;
  const px = -ny;
  const py = nx;
  const [r, g, b] = hexToRgb(body.color);

  for (let i = 0; i < DEBRIS_COUNT; i++) {
    const offsetR = body.drawR * Math.sqrt(Math.random()) * 0.9;
    const offsetA = Math.random() * Math.PI * 2;
    const kick = speed * (0.06 + Math.random() * 0.2);
    const side = speed * (Math.random() - 0.5) * 0.22;
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
    });
  }
}

// =============================================================================
// SPACESHIP INPUT
// =============================================================================

function applyShipInput(dt_yr, realDt_s) {
  if (!ship) return;
  const thrust = settings.settings.ship.thrustAccel; // AU/yr²

  updateShipAimFromMouse();

  const state = getMouseThrustState();
  if (state.mode === "forward" && state.power > 0) {
    const fx = Math.cos(shipAngle);
    const fy = Math.sin(shipAngle);
    ship.vx += fx * thrust * state.power * dt_yr;
    ship.vy += fy * thrust * state.power * dt_yr;
    spawnThrustParticles(state.power, realDt_s, Math.atan2(fy, fx));
  } else if (state.mode === "brake") {
    applyBrakeThrust(thrust, dt_yr, realDt_s);
  }
}

function updateShipAimFromMouse() {
  if (!ship || !mouse.hasPosition) return;
  const target = screenToWorld(mouse.x, mouse.y);
  const dx = target.x - ship.x;
  const dy = target.y - ship.y;
  if (Math.sqrt(dx * dx + dy * dy) > 1e-7) {
    shipAngle = Math.atan2(dy, dx);
  }
}

function getMouseDistanceFromShip() {
  if (!ship || !mouse.hasPosition) return Infinity;
  const sp = worldToScreen(ship.x, ship.y);
  const dx = mouse.x - sp.x;
  const dy = mouse.y - sp.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getShipThrustDistances() {
  const shipSettings = settings.settings.ship;
  const brakeDistance = shipSettings.brakeDistance ?? shipSettings.deadZone ?? 28;
  const minGoDistance = Math.max(
    brakeDistance,
    shipSettings.minGoDistance ?? brakeDistance,
  );
  const maxDistance = Math.max(
    minGoDistance + 1,
    shipSettings.maxDistance ?? shipSettings.fullThrustDist ?? 220,
  );
  return { brakeDistance, minGoDistance, maxDistance };
}

function getMouseThrustState() {
  if (!ship || !mouse.hasPosition) return { mode: "coast", power: 0 };
  const dist = getMouseDistanceFromShip();
  const { brakeDistance, minGoDistance, maxDistance } = getShipThrustDistances();

  if (dist <= brakeDistance) return { mode: "brake", power: 1 };
  if (dist < minGoDistance) return { mode: "coast", power: 0 };

  return {
    mode: "forward",
    power: Math.max(
      0,
      Math.min(1, (dist - minGoDistance) / (maxDistance - minGoDistance)),
    ),
  };
}

function getMouseThrustPower() {
  const state = getMouseThrustState();
  return state.mode === "forward" ? state.power : 0;
}

function applyBrakeThrust(thrust, dt_yr, realDt_s) {
  if (!ship) return;
  const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
  if (speed <= 1e-6) return;

  const maxBrakeDv = thrust * dt_yr;
  if (maxBrakeDv <= 0) return;

  const brakeDv = Math.min(speed, maxBrakeDv);
  const brakePower = brakeDv / maxBrakeDv;
  const fx = -ship.vx / speed;
  const fy = -ship.vy / speed;
  ship.vx += fx * brakeDv;
  ship.vy += fy * brakeDv;
  spawnThrustParticles(brakePower, realDt_s, Math.atan2(fy, fx));
}

function spawnThrustParticles(power, realDt_s, forceAngle = shipAngle) {
  if (!ship || power <= 0) return;

  const count = Math.min(18, Math.ceil((8 + power * 12) * realDt_s * 60));
  const backX = -Math.cos(forceAngle);
  const backY = -Math.sin(forceAngle);
  const sideX = -backY;
  const sideY = backX;
  const s = Math.max(scale(), 1);
  const nozzleOffset = Math.max(SHIP_LENGTH_AU * 0.5, 10 / s);

  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * (0.035 + power * 0.045);
    const exhaustX = backX * Math.cos(spread) + sideX * Math.sin(spread);
    const exhaustY = backY * Math.cos(spread) + sideY * Math.sin(spread);
    const speed = 3.2 + power * 9 + (Math.random() - 0.5) * (0.5 + power * 1.4);
    const sideKick = (Math.random() - 0.5) * power * 0.18;
    const offset = (Math.random() - 0.5) * 1.8 / s;

    thrustParticles.push({
      x: ship.x + backX * nozzleOffset + sideX * offset,
      y: ship.y + backY * nozzleOffset + sideY * offset,
      vx: ship.vx + exhaustX * speed + sideX * sideKick,
      vy: ship.vy + exhaustY * speed + sideY * sideKick,
      size: 0.6 + power * 0.75 + Math.random() * 0.25,
      age: 0,
      duration: 0.3 + power * 0.28 + Math.random() * 0.08,
      phase: Math.random() * Math.PI * 2,
    });
  }

  if (thrustParticles.length > 700) {
    thrustParticles.splice(0, thrustParticles.length - 700);
  }
}

// =============================================================================
// PATH PREDICTION — ship (ghost simulation, no side effects)
// =============================================================================

function computePrediction() {
  if (!ship) return [];
  if (orbitState.mode !== "free") return [];
  if (shouldHidePredictionWhileBraking()) return [];

  return computeProjectedPath({
    targetId: "ship",
    targetBody: ship,
    gravityBoost: settings.settings.orbit.planetGravBoost,
  });
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
  }));
}

function computeProjectedPath({
  targetId,
  targetBody,
  applyInitialImpulse = null,
  gravityBoost = 1,
}) {
  const ghosts = makePredictionGhosts();
  const targetIdx = ghosts.findIndex((g) => g.id === targetId);
  if (targetIdx < 0) return [];

  if (applyInitialImpulse) applyInitialImpulse(ghosts[targetIdx]);

  const path = [{ x: ghosts[targetIdx].x, y: ghosts[targetIdx].y, t: 0 }];
  const targetWorldSegment = PRED_TARGET_SEGMENT_PX / Math.max(scale(), 0.0001);
  const ghostSun = ghosts.find((g) => g.id === "sun");
  const crashRadius = getPredictionCrashRadius(targetBody);
  let elapsed = 0;
  let step = 0;
  let lastX = ghosts[targetIdx].x;
  let lastY = ghosts[targetIdx].y;

  while (elapsed < PRED_HORIZON_YR && step < PRED_MAX_STEPS) {
    const target = ghosts[targetIdx];
    const speed = Math.sqrt(target.vx * target.vx + target.vy * target.vy);
    const speedDt = speed > 1e-6 ? targetWorldSegment / speed : PRED_BASE_DT_YR;
    const predDt = Math.min(
      PRED_BASE_DT_YR,
      speedDt,
      PRED_HORIZON_YR - elapsed,
    );

    applyBlackHoleGravityLocal(ghosts, predDt);
    applySolarGravityWell(ghosts, predDt);
    gravityStep(ghosts, predDt, gravityBoost);
    elapsed += predDt;

    const t = elapsed / PRED_HORIZON_YR;
    if (
      isPredictionInBlackHole(ghosts[targetIdx]) ||
      isPredictionInSun(ghosts[targetIdx], ghostSun, crashRadius)
    ) {
      path.push({ x: ghosts[targetIdx].x, y: ghosts[targetIdx].y, t });
      break;
    }

    const dx = ghosts[targetIdx].x - lastX;
    const dy = ghosts[targetIdx].y - lastY;
    if (Math.sqrt(dx * dx + dy * dy) >= targetWorldSegment * 0.6) {
      path.push({ x: ghosts[targetIdx].x, y: ghosts[targetIdx].y, t });
      lastX = ghosts[targetIdx].x;
      lastY = ghosts[targetIdx].y;
    }

    step++;
  }

  const tail = path[path.length - 1];
  const end = ghosts[targetIdx];
  if (!tail || tail.x !== end.x || tail.y !== end.y)
    path.push({ x: end.x, y: end.y, t: elapsed / PRED_HORIZON_YR });

  return path;
}

function isPredictionInBlackHole(predictedShip) {
  const bh = settings.settings.blackhole;
  if (!bh || bh.mass <= 0) return false;

  const dx = predictedShip.x - BLACK_HOLE.x;
  const dy = predictedShip.y - BLACK_HOLE.y;
  return Math.sqrt(dx * dx + dy * dy) <= BLACK_HOLE.captureR;
}

function isPredictionInSun(predictedBody, predictedSun, crashRadius) {
  if (!predictedSun) return false;

  const dx = predictedBody.x - predictedSun.x;
  const dy = predictedBody.y - predictedSun.y;
  return Math.sqrt(dx * dx + dy * dy) <= crashRadius;
}

function getPredictionCrashRadius(body) {
  return SUN_DESTRUCTION_R + (body?.drawR || 0);
}

function shouldHidePredictionWhileBraking() {
  if (!ship) return false;
  const state = getMouseThrustState();
  if (state.mode !== "brake") return false;

  const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
  return speed < 0.35;
}

// =============================================================================
// PLANET POST-SHOT PREDICTION
// =============================================================================

function computeShotPrediction(planet, nx, ny, dv) {
  if (!planet) return [];

  return computeProjectedPath({
    targetId: planet.id,
    targetBody: planet,
    applyInitialImpulse(target) {
      target.vx += nx * dv;
      target.vy += ny * dv;
    },
  });
}

// =============================================================================
// SCENE SETUP
// =============================================================================

function buildScene(w, h) {
  bodies = [];
  buildStarfield(w, h);
  shipAngle = -Math.PI / 2;
  shipPredPath = [];
  debris = [];
  thrustParticles = [];
  blackHoleScore = 0;
  blackHoleConsumed = [];
  sunPenalty = 0;
  totalEnergySpent = 0;
  finalScoreShown = false;
  shipLoss = null;
  orbitState = { mode: "free", planet: null, shipOffset: null };
  orbitDrag = null;
  captureCooldown = 0;
  captureReleaseLockPlanetId = null;
  camTargetZoom = cam.zoom;

  for (const bd of SOLAR_BODIES) {
    const r = bd.orbR;
    let x = 0,
      y = 0,
      vx = 0,
      vy = 0;

    if (!bd.isFixed && r > 0) {
      const a = bd.angle;
      const v = Math.sqrt((G_SIM * 1.0) / r);
      x = Math.cos(a) * r;
      y = Math.sin(a) * r;
      vx = -Math.sin(a) * v;
      vy = Math.cos(a) * v;
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
      isPlanet: !bd.isFixed && bd.id !== "ship",
      trail: makeTrail(bd.isFixed ? 0 : settings.settings.visuals.trailLength),
    });
  }

  // Ship: start just behind Mars with a slight catch-up velocity for capture testing.
  const marsDef = SOLAR_BODIES.find((b) => b.id === "mars");
  const shipR = marsDef.orbR;
  const shipA = marsDef.angle - 0.18;
  const shipOrb = Math.sqrt((G_SIM * 1.0) / shipR) * 1.025;
  ship = {
    id: "ship",
    name: "Ship",
    x: Math.cos(shipA) * shipR,
    y: Math.sin(shipA) * shipR,
    vx: -Math.sin(shipA) * shipOrb,
    vy: Math.cos(shipA) * shipOrb,
    mass: SHIP_MASS,
    drawR: SHIP_LENGTH_AU / 2,
    color: "#4fc3f7",
    isFixed: false,
    trail: makeTrail(settings.settings.visuals.trailLength),
  };
  bodies.push(ship);

  cam.panX = w / 2;
  cam.panY = h / 2;
  cam.focus = "ship";
  cam.zoom = 4;
  camTargetZoom = 4;
}

// =============================================================================
// CAMERA HELPERS
// =============================================================================

function scale() {
  return cam.zoom * PX_PER_AU;
}

function worldToScreen(wx, wy) {
  const s = scale();
  return { x: wx * s + cam.panX, y: wy * s + cam.panY };
}

function screenToWorld(sx, sy) {
  const s = scale();
  return { x: (sx - cam.panX) / s, y: (sy - cam.panY) / s };
}

function zoomAt(factor, mx, my) {
  const s0 = scale();
  const wx = (mx - cam.panX) / s0;
  const wy = (my - cam.panY) / s0;
  cam.zoom = Math.max(0.004, Math.min(200000, cam.zoom * factor));
  camTargetZoom = cam.zoom;
  const s1 = scale();
  cam.panX = mx - wx * s1;
  cam.panY = my - wy * s1;
}

function applyFocusMode(w, h) {
  // Animate zoom toward target
  cam.zoom += (camTargetZoom - cam.zoom) * 0.08;

  if (orbitState.mode === "free" && ship) cam.focus = "ship";

  if (cam.focus === "sun") {
    cam.panX = w / 2;
    cam.panY = h / 2;
  } else if (cam.focus === "ship" && ship) {
    const s = scale();
    cam.panX = w / 2 - ship.x * s;
    cam.panY = h / 2 - ship.y * s;
  } else if (cam.focus === "orbit" && orbitState.planet) {
    const s = scale();
    const p = orbitState.planet;
    cam.panX = w / 2 - p.x * s;
    cam.panY = h / 2 - p.y * s;
  }
}

// =============================================================================
// STARFIELD
// =============================================================================

function wrap(value, max) {
  return ((value % max) + max) % max;
}

function drawStarfield(ctx, w, h) {
  if (!starLayers.length) buildStarfield(w, h);

  const t = Date.now() / 1000;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#02040a";
  ctx.fillRect(0, 0, w, h);

  for (const layer of starLayers) {
    const zoomDrift =
      Math.log2(Math.max(cam.zoom, 0.004) / 0.33) * 18 * layer.depth;
    const ox = wrap(cam.panX * layer.depth + zoomDrift, layer.tw);
    const oy = wrap(cam.panY * layer.depth - zoomDrift * 0.6, layer.th);

    for (const star of layer.stars) {
      let x = wrap(star.x + ox, layer.tw);
      let y = wrap(star.y + oy, layer.th);
      if (x > w + 20) x -= layer.tw;
      if (y > h + 20) y -= layer.th;
      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;

      const twinkle = 0.78 + 0.22 * Math.sin(t * 0.9 + star.twinkle);
      const alpha = layer.alpha * twinkle;

      ctx.fillStyle = `rgba(${star.color},${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, star.r, 0, Math.PI * 2);
      ctx.fill();

      if (star.r > 1.4) {
        ctx.fillStyle = `rgba(${star.color},${alpha * 0.18})`;
        ctx.beginPath();
        ctx.arc(x, y, star.r * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

// =============================================================================
// ORBIT CIRCLES
// =============================================================================

function drawOrbits(ctx) {
  const s = scale();
  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 0.5 / s;

  for (const bd of SOLAR_BODIES) {
    if (bd.orbR === 0) continue;
    ctx.beginPath();
    ctx.arc(0, 0, bd.orbR, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// =============================================================================
// BLACK HOLE
// =============================================================================

function drawBlackHole(ctx) {
  const bh = settings.settings.blackhole;
  if (!bh || bh.mass <= 0) return;

  const s = scale();
  const influenceR = bh.influenceRadius;
  const coreR = BLACK_HOLE.drawR;
  const outerR = Math.max(influenceR, coreR * 1.25);

  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);

  if (influenceR > 0) {
    ctx.setLineDash([0.035, 0.035]);
    ctx.strokeStyle = "rgba(255,140,0,0.2)";
    ctx.lineWidth = 1 / s;
    ctx.beginPath();
    ctx.arc(BLACK_HOLE.x, BLACK_HOLE.y, influenceR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const ringCount = 12;
  for (let i = 1; i <= ringCount; i++) {
    const t = i / ringCount;
    const r = coreR + (outerR - coreR) * Math.pow(t, 1.8);
    const edgePulse =
      i === ringCount ? 0.08 + 0.04 * Math.sin(Date.now() / 300) : 0;
    ctx.strokeStyle = `rgba(255,140,0,${(0.22 * (1 - t * 0.78) + edgePulse).toFixed(3)})`;
    ctx.lineWidth = (i === ringCount ? 1.15 : 0.7) / s;
    ctx.beginPath();
    ctx.arc(BLACK_HOLE.x, BLACK_HOLE.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const spokeCount = 12;
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const grad = ctx.createLinearGradient(
      BLACK_HOLE.x + cos * coreR,
      BLACK_HOLE.y + sin * coreR,
      BLACK_HOLE.x + cos * outerR,
      BLACK_HOLE.y + sin * outerR,
    );
    grad.addColorStop(0, "rgba(255,140,0,0.12)");
    grad.addColorStop(0.72, "rgba(255,140,0,0.045)");
    grad.addColorStop(1, "rgba(255,140,0,0.16)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.7 / s;
    ctx.beginPath();
    ctx.moveTo(BLACK_HOLE.x + cos * coreR, BLACK_HOLE.y + sin * coreR);
    ctx.lineTo(BLACK_HOLE.x + cos * outerR, BLACK_HOLE.y + sin * outerR);
    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(
    BLACK_HOLE.x,
    BLACK_HOLE.y,
    coreR * 0.8,
    BLACK_HOLE.x,
    BLACK_HOLE.y,
    coreR * 3.4,
  );
  glow.addColorStop(0, "rgba(255,140,0,0.62)");
  glow.addColorStop(0.42, "rgba(180,60,0,0.28)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(BLACK_HOLE.x, BLACK_HOLE.y, coreR * 3.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#020202";
  ctx.strokeStyle = "rgba(255,180,80,0.35)";
  ctx.lineWidth = 1 / s;
  ctx.beginPath();
  ctx.arc(BLACK_HOLE.x, BLACK_HOLE.y, coreR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawSolarGravityWell(ctx) {
  const sun = bodies.find((b) => b.id === "sun");
  if (!sun) return;

  const s = scale();
  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);

  const ringCount = 5;
  for (let i = 1; i <= ringCount; i++) {
    const t = i / ringCount;
    const r =
      SUN_DESTRUCTION_R + (SUN_GRAVITY_WELL_R - SUN_DESTRUCTION_R) * t * t;
    ctx.strokeStyle = `rgba(255,210,80,${(0.16 * (1 - t * 0.7)).toFixed(3)})`;
    ctx.lineWidth = 0.8 / s;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,80,40,0.34)";
  ctx.lineWidth = 1.4 / s;
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, SUN_DESTRUCTION_R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// =============================================================================
// CAPTURE RINGS
// =============================================================================

function drawCaptureRings(ctx) {
  if (orbitState.mode === "slingshot") return;
  if (!ship) return;

  const s = scale();

  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);

  for (const body of bodies) {
    if (body.isFixed) continue;
    if (body.id === "sun") continue;
    if (body.id === "ship") continue;

    const { dist, distancePct, matchPct, captureRingR } =
      getApproachMatch(body);
    if (dist > captureRingR * 2.5) continue;

    const [r, g, b] = hexToRgb(body.color);
    const radius = captureRingR * 0.92;

    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + distancePct * 0.24})`;
    ctx.lineWidth = 3 / s;
    ctx.beginPath();
    ctx.arc(
      body.x,
      body.y,
      radius * 1.12,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * distancePct,
    );
    ctx.stroke();

    ctx.strokeStyle = `rgba(${r},${g},${b},${0.12 + matchPct * 0.42})`;
    ctx.lineWidth = 4 / s;
    ctx.beginPath();
    ctx.arc(
      body.x,
      body.y,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * matchPct,
    );
    ctx.stroke();
  }

  ctx.restore();
}

// =============================================================================
// CAPTURE TETHER
// =============================================================================

function getApproachMatch(body) {
  if (!ship || !body)
    return { dist: Infinity, distancePct: 0, matchPct: 0, captureRingR: 0 };

  const captureRingR = settings.settings.orbit.ringRadiusMult;
  const threshold = settings.settings.orbit.velMatchThreshold;
  const dx = ship.x - body.x;
  const dy = ship.y - body.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const relVx = ship.vx - body.vx;
  const relVy = ship.vy - body.vy;
  const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
  const planetSpeed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
  const denom = Math.max(planetSpeed * threshold, 1e-6);
  const matchPct = Math.max(
    0,
    Math.min(1, 1 - (relSpeed - denom) / (denom * 2)),
  );
  const distancePct = Math.max(
    0,
    Math.min(1, 1 - (dist - captureRingR) / (captureRingR * 1.5)),
  );

  return { dist, distancePct, matchPct, captureRingR };
}

function drawCaptureTether(ctx) {
  if (!ship) return;

  let planet =
    orbitState.mode === "slingshot" || orbitState.mode === "capturing"
      ? orbitState.planet
      : null;
  let rangeGlow =
    orbitState.mode === "slingshot"
      ? 1
      : orbitState.mode === "capturing"
        ? 0.85
        : 0;
  let lockGlow = rangeGlow;

  if (!planet) {
    for (const body of bodies) {
      if (body.isFixed || body.id === "sun" || body.id === "ship") continue;
      const { dist, distancePct, matchPct, captureRingR } =
        getApproachMatch(body);
      if (dist > captureRingR * 2.5) continue;
      const readiness =
        distancePct * 0.75 + Math.min(distancePct, matchPct) * 0.25;
      if (readiness > rangeGlow) {
        rangeGlow = distancePct;
        lockGlow = Math.min(distancePct, matchPct);
        planet = body;
      }
    }
  }

  if (!planet || rangeGlow <= 0) return;

  const s = scale();
  const [r, g, b] = hexToRgb(planet.color);
  const now = Date.now();
  const pulse =
    orbitState.mode === "slingshot"
      ? 0.9 + 0.1 * Math.sin(now / 180)
      : orbitState.mode === "capturing"
        ? 0.75 + 0.2 * Math.sin(now / 110)
        : rangeGlow * (0.82 + 0.18 * Math.sin(now / 150));
  const alpha = 0.04 + pulse * 0.58 + lockGlow * 0.18;

  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);
  ctx.lineCap = "round";

  const dx = planet.x - ship.x;
  const dy = planet.y - ship.y;
  const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6);
  const nx = dx / dist;
  const ny = dy / dist;
  const px = -ny;
  const py = nx;
  const startW = Math.max(2.2 / s, dist * 0.005);
  const endW = Math.min(dist * (0.04 + rangeGlow * 0.055), 0.075);
  const scan = Math.sin(now / 360);

  const grad = ctx.createLinearGradient(ship.x, ship.y, planet.x, planet.y);
  grad.addColorStop(0, `rgba(79,195,247,${alpha * 0.16})`);
  grad.addColorStop(0.35, `rgba(79,195,247,${alpha * 0.36})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},${alpha * 0.72})`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(ship.x + px * startW, ship.y + py * startW);
  ctx.lineTo(planet.x + px * endW, planet.y + py * endW);
  ctx.lineTo(planet.x - px * endW, planet.y - py * endW);
  ctx.lineTo(ship.x - px * startW, ship.y - py * startW);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = planet.color;
  ctx.shadowBlur = (4 + pulse * 18 + lockGlow * 10) / s;
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.1 + rangeGlow * 0.28 + lockGlow * 0.18})`;
  ctx.lineWidth = (0.7 + rangeGlow * 1.3 + lockGlow * 0.8) / s;
  ctx.beginPath();
  ctx.moveTo(ship.x + px * startW, ship.y + py * startW);
  ctx.lineTo(planet.x + px * endW, planet.y + py * endW);
  ctx.moveTo(ship.x - px * startW, ship.y - py * startW);
  ctx.lineTo(planet.x - px * endW, planet.y - py * endW);
  ctx.stroke();

  if (orbitState.mode === "free") {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,255,255,${0.16 + rangeGlow * 0.32 + lockGlow * 0.2})`;
    ctx.lineWidth = (0.8 + rangeGlow * 0.9) / s;
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    ctx.lineTo(planet.x + px * endW * scan, planet.y + py * endW * scan);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(255,255,255,${0.08 + pulse * 0.18 + lockGlow * 0.14})`;
  ctx.lineWidth = 0.7 / s;
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y);
  ctx.lineTo(planet.x, planet.y);
  ctx.stroke();

  ctx.restore();
}

// =============================================================================
// SLINGSHOT ORBIT GLOW RING
// =============================================================================

function drawSlingshotRing(ctx) {
  if (orbitState.mode !== "slingshot" || !orbitState.planet) return;
  const planet = orbitState.planet;
  const ringMult = settings.settings.orbit.ringRadiusMult;
  const captureRingR = ringMult;
  const s = scale();
  const [r, g, b] = hexToRgb(planet.color);

  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);

  // Pulsing glow ring — use sin of a timer
  const pulse = 0.4 + 0.25 * Math.sin(Date.now() / 400);

  ctx.strokeStyle = `rgba(${r},${g},${b},${pulse})`;
  ctx.lineWidth = 2 / s;
  ctx.shadowBlur = 8 / s;
  ctx.shadowColor = planet.color;
  ctx.beginPath();
  ctx.arc(planet.x, planet.y, captureRingR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// =============================================================================
// ORBIT CUE VISUALIZATION
// =============================================================================

function drawOrbitCue(ctx) {
  if (orbitState.mode !== "slingshot" || !orbitDrag) return;
  const planet = orbitState.planet;
  if (!planet) return;

  const { startX, startY, curX, curY } = orbitDrag;
  const ddx = curX - startX;
  const ddy = curY - startY;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy);
  if (dist < 2) return;

  const maxDrag = settings.settings.orbit.maxDrag;
  const clamped = Math.min(dist, maxDrag);
  const nx = ddx / dist;
  const ny = ddy / dist;
  const power = clamped / maxDrag; // 0..1

  const sp = worldToScreen(planet.x, planet.y);
  const s = scale();
  const pxR = planet.drawR * s; // planet radius in pixels

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Aim guide: extends from planet toward the shot direction.
  const cueStart = {
    x: sp.x + nx * (pxR + 4),
    y: sp.y + ny * (pxR + 4),
  };
  const cueEnd = {
    x: sp.x + nx * (clamped + pxR + 30),
    y: sp.y + ny * (clamped + pxR + 30),
  };

  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cueStart.x, cueStart.y);
  ctx.lineTo(cueEnd.x, cueEnd.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Shot direction arrow.
  const shotLen = clamped * 0.8;
  const arrowTip = {
    x: sp.x + nx * (shotLen + pxR),
    y: sp.y + ny * (shotLen + pxR),
  };
  const arrowBase = {
    x: sp.x + nx * pxR,
    y: sp.y + ny * pxR,
  };
  const perp = { x: -ny, y: nx };

  ctx.strokeStyle = "rgba(79,195,247,0.75)";
  ctx.fillStyle = "rgba(79,195,247,0.75)";
  ctx.lineWidth = 2;

  // Arrow shaft
  ctx.beginPath();
  ctx.moveTo(arrowBase.x, arrowBase.y);
  ctx.lineTo(arrowTip.x, arrowTip.y);
  ctx.stroke();

  // Arrow head
  const hw = 6;
  ctx.beginPath();
  ctx.moveTo(arrowTip.x, arrowTip.y);
  ctx.lineTo(
    arrowTip.x - nx * hw * 2 + perp.x * hw,
    arrowTip.y - ny * hw * 2 + perp.y * hw,
  );
  ctx.lineTo(
    arrowTip.x - nx * hw * 2 - perp.x * hw,
    arrowTip.y - ny * hw * 2 - perp.y * hw,
  );
  ctx.closePath();
  ctx.fill();

  // Power ring around planet
  ctx.strokeStyle = `rgba(79,195,247,${0.3 + power * 0.5})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(
    sp.x,
    sp.y,
    pxR + 6,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * power,
  );
  ctx.stroke();

  // Power percentage label
  ctx.font = "12px monospace";
  ctx.fillStyle = "rgba(79,195,247,0.9)";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(power * 100)}%`, sp.x, sp.y + pxR + 22);

  ctx.restore();

  // Planet post-shot prediction path
  const dv = (clamped / maxDrag) * settings.settings.orbit.shotPower * 0.01;
  const predPath = computeShotPrediction(planet, nx, ny, dv);
  if (predPath.length >= 2) {
    const [r, g, b] = hexToRgb(planet.color);
    drawProjectionCorridor(ctx, predPath, `${r},${g},${b}`, 0.34);
  }
}

// =============================================================================
// SHIP PREDICTION PATH
// =============================================================================

function drawPredictionPath(ctx) {
  if (shouldHidePredictionWhileBraking()) return;
  if (shipPredPath.length < 2) return;
  drawProjectionCorridor(ctx, shipPredPath, "79,195,247", 0.3);
}

function drawProjectionCorridor(ctx, path, color, maxAlpha) {
  if (path.length < 2) return;
  const s = scale();
  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = 1; i < path.length; i++) {
    const t = Math.max(0, Math.min(1, path[i].t ?? i / (path.length - 1)));
    const alpha = maxAlpha * Math.pow(1 - t, 1.35);
    if (alpha <= 0.003) continue;

    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len <= 1e-8) continue;

    const nx = -dy / len;
    const ny = dx / len;
    const prevT = Math.max(
      0,
      Math.min(1, path[i - 1].t ?? (i - 1) / (path.length - 1)),
    );
    const prevOffset = (Math.pow(prevT, 0.9) * 42) / s;
    const offset = (Math.pow(t, 0.9) * 42) / s;

    ctx.lineWidth = 1.4 / s;
    ctx.strokeStyle = `rgba(${color},${alpha})`;

    ctx.beginPath();
    ctx.moveTo(path[i - 1].x + nx * prevOffset, path[i - 1].y + ny * prevOffset);
    ctx.lineTo(path[i].x + nx * offset, path[i].y + ny * offset);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(path[i - 1].x - nx * prevOffset, path[i - 1].y - ny * prevOffset);
    ctx.lineTo(path[i].x - nx * offset, path[i].y - ny * offset);
    ctx.stroke();
  }

  ctx.restore();
}

// =============================================================================
// COLOR HELPERS
// =============================================================================

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lighten(hex, t) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`;
}
function darken(hex, t) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * (1 - t))},${Math.round(g * (1 - t))},${Math.round(b * (1 - t))})`;
}

// =============================================================================
// BODY RENDERING
// =============================================================================

function drawBody(ctx, body, w, h) {
  const s = scale();
  const screenR = body.drawR * s;

  // Trail
  const pts = body.trail?.points?.() || [];
  if (pts.length >= 2) {
    ctx.save();
    ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (body.id === "ship") {
      ctx.lineWidth = Math.max(3 / s, 0.00001);
      for (let i = 1; i < pts.length; i++) {
        const t = i / (pts.length - 1);
        ctx.strokeStyle = `rgba(255,132,38,${0.03 + t * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    } else {
      const [r, g, b] = hexToRgb(body.color);
      ctx.lineWidth = Math.max(1.35 / s, 0.00001);
      for (let i = 1; i < pts.length; i++) {
        const t = i / (pts.length - 1);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.02 + t * 0.22})`;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  if (body.id === "ship") {
    if (orbitState.mode === "slingshot") return;
    drawShip(ctx, body, screenR, w, h);
    return;
  }

  const sp = worldToScreen(body.x, body.y);
  if (sp.x < -60 || sp.x > w + 60 || sp.y < -60 || sp.y > h + 60) return;

  if (screenR >= MIN_PLANET_PX) {
    ctx.save();
    ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);

    if (body.id === "sun") {
      const g = ctx.createRadialGradient(
        body.x,
        body.y,
        body.drawR * 0.8,
        body.x,
        body.y,
        body.drawR * 5,
      );
      g.addColorStop(0, "rgba(255,220,80,0.5)");
      g.addColorStop(0.4, "rgba(255,140,0,0.15)");
      g.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(body.x, body.y, body.drawR * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sphere shading
    const ox = body.x - body.drawR * 0.3;
    const oy = body.y - body.drawR * 0.3;
    const sg = ctx.createRadialGradient(ox, oy, 0, body.x, body.y, body.drawR);
    sg.addColorStop(0, lighten(body.color, 0.5));
    sg.addColorStop(0.5, body.color);
    sg.addColorStop(1, darken(body.color, 0.55));
    ctx.beginPath();
    ctx.arc(body.x, body.y, body.drawR, 0, Math.PI * 2);
    ctx.fillStyle = sg;
    ctx.fill();

    // Saturn rings
    if (body.id === "saturn") {
      ctx.save();
      ctx.translate(body.x, body.y);
      ctx.scale(1, 0.28);
      ctx.strokeStyle = "rgba(232,213,160,0.5)";
      ctx.lineWidth = (body.drawR * 0.55) / 0.28;
      ctx.beginPath();
      ctx.arc(0, 0, body.drawR * 2.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  } else {
    // Icon mode
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (body.id === "sun") {
      const g = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, 22);
      g.addColorStop(0, "rgba(255,240,100,1)");
      g.addColorStop(0.3, "rgba(255,180,0,0.5)");
      g.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#FFE566";
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = body.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = body.color + "66";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.font = "10px monospace";
    ctx.fillStyle = body.color + "aa";
    ctx.textAlign = "center";
    ctx.fillText(body.name, sp.x, sp.y + 18);

    ctx.restore();
  }
}

function drawShip(ctx, body, screenLen, w, h) {
  const s = scale();
  const sp = worldToScreen(body.x, body.y);

  if (sp.x < -60 || sp.x > w + 60 || sp.y < -60 || sp.y > h + 60) return;

  if (screenLen >= MIN_SHIP_PX) {
    ctx.save();
    ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);
    ctx.translate(body.x, body.y);
    ctx.rotate(shipAngle);

    const L = SHIP_LENGTH_AU;
    const W = SHIP_WIDTH_AU;
    const hw = W / 2;

    // Hull
    ctx.fillStyle = "#2a3f5f";
    ctx.strokeStyle = "#4fc3f7";
    ctx.lineWidth = W * 0.3;
    ctx.beginPath();
    ctx.rect(-L * 0.6, -hw, L * 0.8, W);
    ctx.fill();
    ctx.stroke();

    // Nose cone
    ctx.fillStyle = "#4fc3f7";
    ctx.beginPath();
    ctx.moveTo(L * 0.2, 0);
    ctx.lineTo(-L * 0.1, -hw * 1.2);
    ctx.lineTo(-L * 0.1, hw * 1.2);
    ctx.closePath();
    ctx.fill();

    // Engine glow (thrust)
    if (getMouseThrustPower() > 0 && orbitState.mode === "free") {
      const eg = ctx.createRadialGradient(-L * 0.6, 0, 0, -L * 0.6, 0, W * 3);
      eg.addColorStop(0, "rgba(255,140,0,0.9)");
      eg.addColorStop(0.5, "rgba(255,60,0,0.4)");
      eg.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(-L * 0.6, 0, W * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  } else {
    // Icon in screen space
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(sp.x, sp.y);
    ctx.rotate(shipAngle);

    const sz = 12;
    const now = Date.now();

    // --- Forward main engine plume ---
    if (getMouseThrustPower() > 0 && orbitState.mode === "free") {
      // Animated flicker: vary length with noise
      const flicker =
        (0.7 + 0.3 * Math.sin(now / 40) + 0.15 * Math.sin(now / 17)) *
        getMouseThrustPower();
      const plumeLen = sz * 2.2 * flicker;
      const grad = ctx.createLinearGradient(-sz, 0, -sz - plumeLen, 0);
      grad.addColorStop(0, "rgba(255,200,80,0.95)");
      grad.addColorStop(0.3, "rgba(255,100,20,0.7)");
      grad.addColorStop(1, "rgba(255,40,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-sz, -sz * 0.35);
      ctx.lineTo(-sz - plumeLen, 0);
      ctx.lineTo(-sz, sz * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    // Ship body
    ctx.fillStyle = "#4fc3f7";
    ctx.strokeStyle = "rgba(79,195,247,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sz, 0);
    ctx.lineTo(-sz, sz * 0.5);
    ctx.lineTo(-sz * 0.6, 0);
    ctx.lineTo(-sz, -sz * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(79,195,247,0.6)";
    ctx.textAlign = "center";
    ctx.fillText("Ship", sp.x, sp.y + 20);
    ctx.restore();
  }
}

// =============================================================================
// APPROACH INDICATORS (bottom-center HUD while near a planet)
// =============================================================================

function drawVelocityMatchHUD(ctx, w, h) {
  if (!ship) return;
  if (orbitState.mode === "slingshot") return;

  let bestPlanet = orbitState.mode === "capturing" ? orbitState.planet : null;
  let best = bestPlanet
    ? { distancePct: 1, matchPct: 1, dist: 0, captureRingR: 1 }
    : null;
  let bestScore = bestPlanet ? 2 : -1;

  if (orbitState.mode === "free") {
    for (const body of bodies) {
      if (body.isFixed || body.id === "sun" || body.id === "ship") continue;

      const info = getApproachMatch(body);
      if (info.dist > info.captureRingR * 2.5) continue;

      const score = info.distancePct + info.matchPct;
      if (score > bestScore) {
        bestScore = score;
        bestPlanet = body;
        best = info;
      }
    }
  }

  if (!bestPlanet || !best) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const capturePct =
    orbitState.mode === "capturing" && orbitState.capture
      ? Math.min(1, orbitState.capture.age / orbitState.capture.duration)
      : Math.min(best.distancePct, best.matchPct);
  const title =
    orbitState.mode === "capturing"
      ? `CAPTURE PULL — ${bestPlanet.name.toUpperCase()}`
      : `APPROACH — ${bestPlanet.name.toUpperCase()}`;

  const panelW = 260;
  const panelH = 58;
  const panelX = w / 2 - panelW / 2;
  const panelY = h - 78;

  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.strokeStyle = `rgba(79,195,247,${0.18 + capturePct * 0.45})`;
  ctx.lineWidth = 1;
  roundRect(ctx, panelX, panelY, panelW, panelH, 5);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 11px monospace";
  ctx.fillStyle =
    orbitState.mode === "capturing"
      ? "rgba(127,232,232,0.95)"
      : "rgba(255,255,255,0.62)";
  ctx.textAlign = "center";
  ctx.fillText(title, w / 2, panelY + 15);

  function drawMeter(label, value, y, color) {
    const barX = panelX + 98;
    const barW = 132;
    const barH = 5;
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.textAlign = "right";
    ctx.fillText(label, barX - 8, y + 5);

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(barX, y, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(barX, y, barW * value, barH);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "left";
    ctx.fillText(`${Math.round(value * 100)}%`, barX + barW + 8, y + 5);
  }

  if (orbitState.mode === "capturing") {
    drawMeter("PULL", capturePct, panelY + 29, "rgba(127,232,232,0.9)");
    drawMeter(
      "ORBIT",
      easeInOutCubic(capturePct),
      panelY + 43,
      "rgba(79,195,247,0.9)",
    );
  } else {
    drawMeter("RANGE", best.distancePct, panelY + 29, "rgba(255,255,255,0.78)");
    drawMeter(
      "TRAJECTORY",
      best.matchPct,
      panelY + 43,
      `rgba(${Math.round(255 * (1 - best.matchPct))},${Math.round(220 * best.matchPct)},80,0.9)`,
    );
  }

  ctx.restore();
}

// =============================================================================
// HUD OVERLAY
// =============================================================================

function getTimeParts() {
  const totalMonths = Math.max(0, Math.floor(simYears * 12));
  const years = Math.floor(totalMonths / 12);
  const monthInYear = (totalMonths % 12) + 1;
  return { totalMonths, years, monthInYear };
}

function drawTimeScore(ctx, w) {
  const { totalMonths, years, monthInYear } = getTimeParts();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = "center";

  const x = w / 2;
  const y = 13;
  const panelW = 330;
  const panelH = 91;
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  roundRect(ctx, x - panelW / 2, y, panelW, panelH, 5);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 25px monospace";
  ctx.fillStyle = "rgba(255,232,150,0.96)";
  ctx.fillText(`MONTH ${totalMonths.toLocaleString()}`, x, y + 28);

  ctx.font = "bold 24px monospace";
  ctx.fillStyle = "rgba(127,232,232,0.92)";
  ctx.fillText(`YEAR ${years.toLocaleString()}`, x, y + 57);

  ctx.font = "10px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.fillText(`MONTH ${monthInYear} OF CURRENT YEAR`, x, y + 70);

  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(`ENERGY SPENT ${Math.round(totalEnergySpent).toLocaleString()}`, x, y + 84);
  ctx.restore();
}

function drawFinalScoreOverview(ctx, w, h) {
  if (!finalScoreShown) return;

  const { totalMonths, years, monthInYear } = getTimeParts();
  const score = blackHoleScore - sunPenalty;
  const perfect = blackHoleScore === TOTAL_PLANETS && sunPenalty === 0;
  const panelW = 390;
  const panelH = 188;
  const x = w / 2 - panelW / 2;
  const y = h / 2 - panelH / 2;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(2,4,10,0.84)";
  ctx.strokeStyle = perfect ? "rgba(255,232,150,0.75)" : "rgba(255,120,90,0.65)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, panelW, panelH, 7);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "bold 18px monospace";
  ctx.fillStyle = perfect ? "rgba(255,232,150,0.98)" : "rgba(255,180,130,0.98)";
  ctx.fillText(perfect ? "ALL PLANETS SCORED" : "RUN COMPLETE", w / 2, y + 28);

  ctx.font = "bold 24px monospace";
  ctx.fillStyle = "rgba(127,232,232,0.96)";
  ctx.fillText(`YEAR ${years.toLocaleString()}  MONTH ${monthInYear}`, w / 2, y + 62);

  ctx.font = "bold 18px monospace";
  ctx.fillStyle = "rgba(255,232,150,0.95)";
  ctx.fillText(`TOTAL MONTHS ${totalMonths.toLocaleString()}`, w / 2, y + 88);

  ctx.font = "14px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText(`ENERGY SPENT ${Math.round(totalEnergySpent).toLocaleString()}`, w / 2, y + 116);
  ctx.fillText(`BLACK HOLE ${blackHoleScore}/${TOTAL_PLANETS}  •  SUN PENALTY -${sunPenalty}`, w / 2, y + 140);

  ctx.font = "bold 16px monospace";
  ctx.fillStyle = score >= TOTAL_PLANETS ? "rgba(165,255,180,0.95)" : "rgba(255,210,120,0.92)";
  ctx.fillText(`PLANET SCORE ${score}`, w / 2, y + 166);

  ctx.restore();
}

// =============================================================================
// BLACK HOLE TROPHY ROW
// =============================================================================

function drawConsumedPlanets(ctx, h) {
  if (blackHoleConsumed.length === 0) return;

  // Find max physR to normalize sizes
  const maxPhysR = Math.max(...blackHoleConsumed.map((p) => p.physR));
  const MAX_DISPLAY_R = 22; // px for the largest planet
  const MIN_DISPLAY_R = 5;  // px floor

  const padding = 12;
  const labelH = 14;
  const iconAreaH = MAX_DISPLAY_R * 2 + 4;
  const itemW = MAX_DISPLAY_R * 2 + 16;
  const totalW = blackHoleConsumed.length * itemW + padding * 2;
  const panelH = iconAreaH + labelH + padding * 2;
  const panelX = padding;
  const panelY = h - panelH - padding;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Panel background
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.strokeStyle = "rgba(255,140,0,0.3)";
  ctx.lineWidth = 1;
  roundRect(ctx, panelX, panelY, totalW, panelH, 5);
  ctx.fill();
  ctx.stroke();

  // "INTO THE BLACK HOLE" label at top-left of panel
  ctx.font = "9px monospace";
  ctx.fillStyle = "rgba(255,140,0,0.55)";
  ctx.textAlign = "left";
  ctx.fillText("INTO THE BLACK HOLE", panelX + padding, panelY + 11);

  const centerY = panelY + padding + 10 + MAX_DISPLAY_R;

  for (let i = 0; i < blackHoleConsumed.length; i++) {
    const planet = blackHoleConsumed[i];
    const r = Math.max(MIN_DISPLAY_R, (planet.physR / maxPhysR) * MAX_DISPLAY_R);
    const cx = panelX + padding + i * itemW + MAX_DISPLAY_R + 8;

    const [rv, gv, bv] = hexToRgb(planet.color);

    // Glow halo
    const glow = ctx.createRadialGradient(cx, centerY, r * 0.5, cx, centerY, r * 2.2);
    glow.addColorStop(0, `rgba(${rv},${gv},${bv},0.28)`);
    glow.addColorStop(1, `rgba(${rv},${gv},${bv},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, centerY, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Sphere shading
    const ox = cx - r * 0.3;
    const oy = centerY - r * 0.3;
    const sg = ctx.createRadialGradient(ox, oy, 0, cx, centerY, r);
    sg.addColorStop(0, lighten(planet.color, 0.5));
    sg.addColorStop(0.5, planet.color);
    sg.addColorStop(1, darken(planet.color, 0.55));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(cx, centerY, r, 0, Math.PI * 2);
    ctx.fill();

    // Planet name label
    ctx.font = "9px monospace";
    ctx.fillStyle = `rgba(${rv},${gv},${bv},0.85)`;
    ctx.textAlign = "center";
    ctx.fillText(planet.name, cx, centerY + MAX_DISPLAY_R + labelH);
  }

  ctx.restore();
}

function drawHUD(ctx, w, h) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Focus buttons
  const baseButtons =
    orbitState.mode === "free"
      ? [{ label: "Focus: Ship", focus: "ship" }]
      : [
          { label: "Focus: Sun", focus: "sun" },
          { label: "Focus: Ship", focus: "ship" },
        ];
  const extraButtons =
    (orbitState.mode === "slingshot" || orbitState.mode === "capturing") &&
    orbitState.planet
      ? [{ label: `Focus: ${orbitState.planet.name}`, focus: "orbit" }]
      : [];
  const buttons = [...baseButtons, ...extraButtons];

  const bw = 110,
    bh = 22,
    gap = 6,
    startX = 12,
    startY = 12;

  buttons.forEach((btn, i) => {
    const bx = startX + i * (bw + gap);
    const active = cam.focus === btn.focus;
    ctx.fillStyle = active ? "rgba(79,195,247,0.25)" : "rgba(0,0,0,0.5)";
    ctx.strokeStyle = active ? "#4fc3f7" : "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    roundRect(ctx, bx, startY, bw, bh, 3);
    ctx.fill();
    ctx.stroke();

    ctx.font = "11px monospace";
    ctx.fillStyle = active ? "#4fc3f7" : "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.fillText(btn.label, bx + bw / 2, startY + bh / 2 + 4);
  });

  ctx.restore();
  drawTimeScore(ctx, w);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Slingshot mode status
  if (
    (orbitState.mode === "slingshot" || orbitState.mode === "capturing") &&
    orbitState.planet
  ) {
    const planet = orbitState.planet;
    const [r, g, b] = hexToRgb(planet.color);

    ctx.font = "bold 14px monospace";
    ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
    ctx.textAlign = "center";
    ctx.fillText(
      orbitState.mode === "capturing"
        ? `CAPTURED BY ${planet.name.toUpperCase()}`
        : `SLINGSHOT ORBIT: ${planet.name.toUpperCase()}`,
      w / 2,
      112,
    );

    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(
      orbitState.mode === "capturing"
        ? "AUTOPILOT CAPTURE IN PROGRESS"
        : "SHOT SYSTEM ARMED  •  Mouse to aim  •  Click to fire  •  [ESC] to break orbit",
      w / 2,
      130,
    );
  }

  if (shipLoss) {
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = "rgba(255,95,70,0.95)";
    ctx.textAlign = "center";
    ctx.fillText(`SHIP LOST: ${shipLoss}`, w / 2, 112);
  }

  // Speed / distance info (top-right)
  if (ship) {
    const speed_au_yr = Math.sqrt(ship.vx ** 2 + ship.vy ** 2);
    const speed_km_s = (speed_au_yr * AU_KM) / (365.25 * 24 * 3600);
    const sun = bodies.find((b) => b.id === "sun");
    const dist_au = sun
      ? Math.sqrt((ship.x - sun.x) ** 2 + (ship.y - sun.y) ** 2)
      : 0;

    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "right";
    ctx.fillText(`Planet score: ${blackHoleScore - sunPenalty}`, w - 12, h - 54);
    ctx.fillText(`Black hole score: ${blackHoleScore}`, w - 12, h - 40);
    ctx.fillText(`Speed: ${speed_km_s.toFixed(2)} km/s`, w - 12, h - 26);
    ctx.fillText(`Dist from Sun: ${dist_au.toFixed(4)} AU`, w - 12, h - 12);
  } else {
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "right";
    ctx.fillText(`Black hole score: ${blackHoleScore}`, w - 12, h - 26);
  }

  ctx.restore();
  drawFinalScoreOverview(ctx, w, h);

  // Velocity match / approach indicator
  drawVelocityMatchHUD(ctx, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// =============================================================================
// SHOCKWAVE ANIMATION
// =============================================================================

function tickShockwaves(realDt) {
  for (const sw of shockwaves) {
    sw.age += realDt;
    const t = Math.min(sw.age / sw.duration, 1);
    // Ease-out cubic: fast at start, decelerates
    const et = 1 - Math.pow(1 - t, 3);
    sw.r = sw.maxR * et;
    sw.alpha = 1 - t; // linear fade over full duration
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    if (shockwaves[i].age >= shockwaves[i].duration) shockwaves.splice(i, 1);
  }
}

function tickDebris(dt_yr, realDt) {
  for (const piece of debris) {
    piece.age += realDt;
    piece.x += piece.vx * dt_yr;
    piece.y += piece.vy * dt_yr;
    piece.angle += piece.spin * realDt;
    piece.vx *= Math.pow(0.72, realDt);
    piece.vy *= Math.pow(0.72, realDt);
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    if (debris[i].age >= debris[i].duration) debris.splice(i, 1);
  }
}

function drawDebris(ctx) {
  if (debris.length === 0) return;
  const s = scale();
  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);

  for (const piece of debris) {
    const t = Math.min(piece.age / piece.duration, 1);
    const alpha = Math.pow(1 - t, 1.1);
    const pxSize = piece.size / s;
    const heat = piece.heat * (1 - t);

    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.angle);
    ctx.fillStyle = `rgba(${piece.color},${alpha * 0.86})`;
    ctx.strokeStyle = `rgba(255,${Math.round(165 + heat * 80)},80,${alpha * 0.42})`;
    ctx.lineWidth = 0.7 / s;
    ctx.beginPath();
    ctx.moveTo(pxSize * 1.2, 0);
    ctx.lineTo(-pxSize * 0.65, pxSize * 0.72);
    ctx.lineTo(-pxSize * 0.38, -pxSize * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function tickThrustParticles(dt_yr, realDt) {
  for (const particle of thrustParticles) {
    particle.age += realDt;
    particle.x += particle.vx * dt_yr;
    particle.y += particle.vy * dt_yr;
    particle.vx *= Math.pow(0.9, realDt);
    particle.vy *= Math.pow(0.9, realDt);
  }
  for (let i = thrustParticles.length - 1; i >= 0; i--) {
    if (thrustParticles[i].age >= thrustParticles[i].duration) {
      thrustParticles.splice(i, 1);
    }
  }
}

function drawThrustParticles(ctx) {
  if (thrustParticles.length === 0) return;
  const s = scale();

  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);
  ctx.globalCompositeOperation = "lighter";

  for (const particle of thrustParticles) {
    const t = Math.min(1, particle.age / particle.duration);
    const alpha = Math.pow(1 - t, 1.7);
    const r = Math.max(0.55 / s, (particle.size * (1 - t * 0.15)) / s);
    const core = 0.65 + 0.35 * Math.sin(particle.phase + particle.age * 24);

    ctx.fillStyle = `rgba(${Math.round(130 + core * 90)},${Math.round(210 + core * 35)},255,${alpha * 0.72})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawIonPlumeCore(ctx) {
  if (!ship || orbitState.mode !== "free") return;

  const state = getMouseThrustState();
  let forceAngle = shipAngle;
  let power = 0;

  if (state.mode === "forward") {
    power = state.power;
  } else if (state.mode === "brake") {
    const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    if (speed > 1e-6) {
      forceAngle = Math.atan2(-ship.vy, -ship.vx);
      power = Math.min(1, speed / 2.5);
    }
  }
  if (power <= 0) return;

  const sp = worldToScreen(ship.x, ship.y);
  const backX = -Math.cos(forceAngle);
  const backY = -Math.sin(forceAngle);
  const start = 11;
  const len = 34 + power * 44;
  const width = 1.5 + power * 2.2;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  const grad = ctx.createLinearGradient(
    sp.x + backX * start,
    sp.y + backY * start,
    sp.x + backX * (start + len),
    sp.y + backY * (start + len),
  );
  grad.addColorStop(0, `rgba(210,245,255,${0.42 * power})`);
  grad.addColorStop(0.45, `rgba(99,202,255,${0.24 * power})`);
  grad.addColorStop(1, "rgba(52,130,255,0)");

  ctx.strokeStyle = grad;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(sp.x + backX * start, sp.y + backY * start);
  ctx.lineTo(sp.x + backX * (start + len), sp.y + backY * (start + len));
  ctx.stroke();

  ctx.restore();
}

function drawFlightRadii(ctx) {
  if (!ship || orbitState.mode !== "free") return;

  const sp = worldToScreen(ship.x, ship.y);
  const { brakeDistance, minGoDistance, maxDistance } =
    getShipThrustDistances();
  const state = getMouseThrustState();
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 260);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = "round";

  function ring(radius, color, alpha, dash = []) {
    if (radius <= 0) return;
    ctx.setLineDash(dash);
    ctx.strokeStyle = color.replace("ALPHA", alpha.toFixed(3));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ring(brakeDistance, "rgba(127,232,232,ALPHA)", 0.34 + pulse * 0.12);
  ring(minGoDistance, "rgba(255,255,255,ALPHA)", 0.18, [5, 8]);
  ring(maxDistance, "rgba(255,176,82,ALPHA)", 0.26, [2, 10]);

  if (state.mode === "forward" && state.power > 0) {
    const dx = mouse.x - sp.x;
    const dy = mouse.y - sp.y;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const ux = dx / dist;
    const uy = dy / dist;
    const fillEnd = minGoDistance + (maxDistance - minGoDistance) * state.power;
    const railStartX = sp.x + ux * minGoDistance;
    const railStartY = sp.y + uy * minGoDistance;
    const railEndX = sp.x + ux * maxDistance;
    const railEndY = sp.y + uy * maxDistance;
    const fillEndX = sp.x + ux * fillEnd;
    const fillEndY = sp.y + uy * fillEnd;
    const px = -uy;
    const py = ux;

    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(railStartX, railStartY);
    ctx.lineTo(railEndX, railEndY);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,176,82,${0.36 + state.power * 0.48})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(railStartX, railStartY);
    ctx.lineTo(fillEndX, fillEndY);
    ctx.stroke();

    ctx.fillStyle = `rgba(255,176,82,${0.5 + state.power * 0.42})`;
    const arrowSize = 5 + state.power * 5;
    ctx.beginPath();
    ctx.moveTo(fillEndX + ux * arrowSize, fillEndY + uy * arrowSize);
    ctx.lineTo(fillEndX - ux * arrowSize * 0.8 + px * arrowSize * 0.65, fillEndY - uy * arrowSize * 0.8 + py * arrowSize * 0.65);
    ctx.lineTo(fillEndX - ux * arrowSize * 0.8 - px * arrowSize * 0.65, fillEndY - uy * arrowSize * 0.8 - py * arrowSize * 0.65);
    ctx.closePath();
    ctx.fill();
  } else if (state.mode === "brake") {
    ctx.fillStyle = `rgba(127,232,232,${0.035 + pulse * 0.025})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, brakeDistance, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawMouseReticle(ctx) {
  if (!mouse.hasPosition) return;

  const state = getMouseThrustState();
  const color =
    state.mode === "brake"
      ? "127,232,232"
      : state.mode === "forward"
        ? "255,176,82"
        : "255,255,255";
  const alpha = state.mode === "coast" ? 0.52 : 0.88;
  const r = state.mode === "forward" ? 5 + state.power * 4 : 6;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(${color},${alpha})`;
  ctx.fillStyle = `rgba(${color},${alpha * 0.85})`;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(mouse.x - r - 6, mouse.y);
  ctx.lineTo(mouse.x - r - 2, mouse.y);
  ctx.moveTo(mouse.x + r + 2, mouse.y);
  ctx.lineTo(mouse.x + r + 6, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - r - 6);
  ctx.lineTo(mouse.x, mouse.y - r - 2);
  ctx.moveTo(mouse.x, mouse.y + r + 2);
  ctx.lineTo(mouse.x, mouse.y + r + 6);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawShockwaves(ctx) {
  if (shockwaves.length === 0) return;
  const s = scale();
  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);

  for (const sw of shockwaves) {
    if (sw.r <= 0) continue;
    const a = Math.max(0, sw.alpha);
    const t = sw.age / sw.duration;
    const [r, g, b] = hexToRgb(sw.color);

    // Leading bright white ring — thick at start, thins as it expands
    const ringW = Math.max(0.5, (1 - t) * 8 + 1);
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.95})`;
    ctx.lineWidth = ringW / s;
    ctx.stroke();

    // Colored glow halo just inside the leading ring
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r * 0.88, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.55})`;
    ctx.lineWidth = (ringW * 2.5) / s;
    ctx.stroke();

    // Soft inner fill — big radial glow at start
    if (t < 0.5) {
      const fillA = a * (0.5 - t) * 0.4;
      const grad = ctx.createRadialGradient(sw.x, sw.y, 0, sw.x, sw.y, sw.r);
      grad.addColorStop(0, `rgba(255,255,255,${fillA})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${fillA * 0.5})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  ctx.restore();
}

// =============================================================================
// MAIN RENDER
// =============================================================================

function render(ctx, w, h, realDt) {
  ctx.clearRect(0, 0, w, h);

  tickShockwaves(realDt);
  applyFocusMode(w, h);
  if (orbitState.mode === "free") updateShipAimFromMouse();
  updateOrbitAimFromMouse();

  drawStarfield(ctx, w, h);
  drawOrbits(ctx);
  drawSolarGravityWell(ctx);
  drawBlackHole(ctx);
  drawCaptureRings(ctx);
  drawPredictionPath(ctx);
  drawCaptureTether(ctx);

  drawIonPlumeCore(ctx);
  drawThrustParticles(ctx);

  for (const body of bodies) {
    drawBody(ctx, body, w, h);
  }

  drawShockwaves(ctx);
  drawDebris(ctx);
  drawSlingshotRing(ctx);
  drawOrbitCue(ctx);
  drawConsumedPlanets(ctx, h);
  drawFlightRadii(ctx);
  drawMouseReticle(ctx);
  drawHUD(ctx, w, h);
}

// =============================================================================
// MAIN LOOP
// =============================================================================

let rafId = null;
let lastTime = null;
let _w = 0,
  _h = 0;
let simYears = 0;

function initCanvas(canvas) {
  if (!canvas) return;
  let ctx = null;
  canvas.style.cursor = "none";

  // --- Keyboard ---
  function onKeyDown(e) {
    // Escape: break orbit/capture
    if (
      e.key === "Escape" &&
      (orbitState.mode === "slingshot" || orbitState.mode === "capturing")
    ) {
      breakOrbit(true);
      return;
    }
    if (e.key === "q" || e.key === "Q") {
      timeScale.value = Math.max(1, timeScale.value - 80000);
      return;
    }
    if (e.key === "e" || e.key === "E") {
      timeScale.value = Math.min(10000000, timeScale.value + 80000);
      return;
    }
  }
  window.addEventListener("keydown", onKeyDown);

  // --- Mouse ---
  function updateMouseFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.hasPosition = true;
  }

  function onMouseLeave(e) {
    mouse.hasPosition = false;
    if (orbitState.mode === "slingshot") orbitDrag = null;
  }

  function isHudFocusButtonAt(cx, cy) {
    const bw = 110,
      bh = 22,
      gap = 6,
      startX = 12,
      startY = 12;
    const count =
      orbitState.mode === "free"
        ? 1
        : (orbitState.mode === "slingshot" ||
              orbitState.mode === "capturing") &&
            orbitState.planet
          ? 3
          : 2;

    for (let i = 0; i < count; i++) {
      const bx = startX + i * (bw + gap);
      if (cx >= bx && cx <= bx + bw && cy >= startY && cy <= startY + bh) {
        return true;
      }
    }
    return false;
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    updateMouseFromEvent(e);

    if (orbitState.mode === "slingshot") {
      updateOrbitAimFromMouse();
      fireShot();
      orbitDrag = null;
      return;
    }

    if (orbitState.mode === "free" && !isHudFocusButtonAt(mouse.x, mouse.y)) {
      cam.focus = "ship";
    }
  }

  function onMouseMove(e) {
    updateMouseFromEvent(e);

    if (orbitState.mode === "slingshot") {
      updateOrbitAimFromMouse();
      return;
    }
  }

  function onMouseUp(e) {
    updateMouseFromEvent(e);

    if (orbitState.mode === "slingshot") return;
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = Math.pow(1.12, -e.deltaY / 100);
    zoomAt(factor, e.offsetX, e.offsetY);
  }

  // --- HUD button click ---
  function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const bw = 110,
      bh = 22,
      gap = 6,
      startX = 12,
      startY = 12;

    const focusModes = orbitState.mode === "free" ? ["ship"] : ["sun", "ship"];
    if (
      (orbitState.mode === "slingshot" || orbitState.mode === "capturing") &&
      orbitState.planet
    )
      focusModes.push("orbit");

    focusModes.forEach((fm, i) => {
      const bx = startX + i * (bw + gap);
      if (cx >= bx && cx <= bx + bw && cy >= startY && cy <= startY + bh) {
        cam.focus = fm;
      }
    });
  }

  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("mouseleave", onMouseLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("click", onCanvasClick);

  // --- Resize ---
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    _w = rect.width;
    _h = rect.height - 96;
    canvas.width = _w;
    canvas.height = _h;
    canvas.style.width = _w + "px";
    canvas.style.height = _h + "px";
    ctx = canvas.getContext("2d");
    buildScene(_w, _h);
  }

  const observer = new ResizeObserver(resizeCanvas);
  observer.observe(canvas.parentElement);
  resizeCanvas();

  // --- Animation loop ---
  function loop(ts) {
    let realDt = 0;
    if (lastTime !== null) {
      realDt = Math.min((ts - lastTime) / 1000, MAX_DT); // seconds
      const simScale = timeScale.value;
      const dt_yr = (realDt * simScale) / (365.25 * 24 * 3600); // yr per frame

      if (isPlaying.value) {
        simStep(dt_yr, realDt);
        tickDebris(dt_yr, realDt);
        tickThrustParticles(dt_yr, realDt);
        simYears += dt_yr;

        for (const body of bodies) {
          if (body.trail && body.trail.push) body.trail.push(body.x, body.y);
        }

        bodyCount.value = bodies.length;
        const { totalMonths, years, monthInYear } = getTimeParts();
        elapsedLabel.value = `Month ${totalMonths.toLocaleString()} • Year ${years.toLocaleString()} M${monthInYear}`;

        // Prediction (only in free mode)
        predCountdown--;
        if (predCountdown <= 0) {
          predCountdown = PRED_INTERVAL;
          shipPredPath = computePrediction();
        }
      }
    }
    lastTime = ts;
    if (ctx) render(ctx, _w, _h, realDt);
    if (!isPlaying.value && realDt > 0) tickThrustParticles(0, realDt);
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  onUnmounted(() => {
    cancelAnimationFrame(rafId);
    observer.disconnect();
    canvas.style.cursor = "";
    window.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("mouseleave", onMouseLeave);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("click", onCanvasClick);
  });
}

// =============================================================================
// CONTROLS
// =============================================================================

function togglePlay() {
  isPlaying.value = !isPlaying.value;
}
function setTimeScale(s) {
  timeScale.value = s;
}
function reset() {
  simYears = 0;
  shipPredPath = [];
  predCountdown = 0;
  lastTime = null;
  isPlaying.value = true;
  timeScale.value = settings.settings.sim.baseSpeed;
  buildScene(_w, _h);
}

watch(
  () => settings.settings.sim.baseSpeed,
  (v) => {
    timeScale.value = v;
  },
);
watch(
  () => settings.settings.visuals.trailLength,
  (v) => {
    for (const b of bodies) {
      if (b.trail) b.trail = makeTrail(v);
    }
  },
);
</script>
