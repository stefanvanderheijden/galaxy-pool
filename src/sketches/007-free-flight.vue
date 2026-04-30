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
            label="Max thrust"
            v-model="settings.settings.ship.thrustAccel"
            :min="10"
            :max="2000"
            :step="10"
            :decimals="0"
            tooltip="Max thrust acceleration AU/yr² at full mouse distance."
          />
          <SettingsRow
            label="Dead zone (px)"
            v-model="settings.settings.ship.deadZone"
            :min="5"
            :max="80"
            :step="5"
            :decimals="0"
            tooltip="Screen-pixel radius with no thrust around the ship."
          />
          <SettingsRow
            label="Full thrust (px)"
            v-model="settings.settings.ship.fullThrustDist"
            :min="50"
            :max="500"
            :step="10"
            :decimals="0"
            tooltip="Screen-pixel distance at which thrust reaches maximum."
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
            :max="2000"
            :step="50"
            :decimals="0"
            tooltip="Number of past positions in the spaceship trail."
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

// Mouse-thrust config
const THRUST_MIN_DIST_PX = 20;  // dead-zone — no thrust inside this screen radius
const THRUST_MAX_DIST_PX = 220; // full thrust at this screen distance
const THRUST_MAX_ACCEL = 400;   // AU/yr² at full distance

// Prediction config
const PRED_HORIZON_YR = 2.4;
const PRED_BASE_DT_YR = 0.001;
const PRED_TARGET_SEGMENT_PX = 7;
const PRED_MAX_STEPS = 3000;
const PRED_INTERVAL = 20;
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
    thrustAccel: THRUST_MAX_ACCEL,
    deadZone: THRUST_MIN_DIST_PX,
    fullThrustDist: THRUST_MAX_DIST_PX,
  },
  orbit: { planetGravBoost: 500 },
  blackhole: {
    mass: 0.8,
    influenceRadius: 0.45,
  },
  visuals: { trailLength: 800 },
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

// Camera — always centered on ship, zoom only
const cam = {
  zoom: 1.2,
};
let camTargetZoom = 1.2;

// Spaceship angle (faces mouse)
let shipAngle = 0; // radians

// Mouse state
const mouse = {
  x: 0,  // screen px
  y: 0,
  down: false,
};

// Prediction path
let shipPredPath = [];
let predCountdown = 0;

// Thrust particles — each: { x, y, vx, vy, age, duration, size, alpha, color }  world AU
let thrustParticles = [];

// Shockwaves / debris (kept for destruction effects)
let shockwaves = [];
let debris = [];
let blackHoleScore = 0;
let blackHoleConsumed = [];
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


function simStep(dt_yr, realDt_s, w, h) {
  const boost = settings.settings.orbit.planetGravBoost;
  applyShipInput(dt_yr, realDt_s, w, h);
  applyBlackHoleGravityLocal(bodies, dt_yr);
  applySolarGravityWell(bodies, dt_yr);
  gravityStep(bodies, dt_yr, boost);
  resolveBodyDestruction();
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
  } else {
    sunPenalty++;
  }
  updateFinalScoreState();
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

function getMouseThrust(w, h) {
  const sh = settings.settings.ship;
  const deadZone = sh.deadZone ?? THRUST_MIN_DIST_PX;
  const fullDist = sh.fullThrustDist ?? THRUST_MAX_DIST_PX;
  const cx = w / 2;
  const cy = h / 2;
  const dx = mouse.x - cx;
  const dy = mouse.y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const power = Math.max(0, Math.min(1, (dist - deadZone) / (fullDist - deadZone)));
  const angle = Math.atan2(dy, dx);
  return { power, angle, dist, deadZone, fullDist };
}

function applyShipInput(dt_yr, realDt_s, w, h) {
  if (!ship) return;

  const { power, angle } = getMouseThrust(w, h);
  shipAngle = angle;

  if (mouse.down && power > 0) {
    const accel = power * (settings.settings.ship.thrustAccel ?? THRUST_MAX_ACCEL);
    ship.vx += Math.cos(angle) * accel * dt_yr;
    ship.vy += Math.sin(angle) * accel * dt_yr;
    spawnThrustParticles(power, angle, realDt_s);
  }
}

function spawnThrustParticles(power, angle, realDt_s) {
  if (!ship) return;
  const s = scale();

  // Number of particles proportional to thrust power, bursting harder at high power
  const count = Math.round((1 + power * power * 14) * realDt_s * 60);
  const spread = 0.35 + power * 0.55; // cone half-angle in radians
  const speed_au_s = (0.4 + power * 2.2) / s * PX_PER_AU * 0.001; // world AU/s

  for (let i = 0; i < count; i++) {
    const a = angle + Math.PI + (Math.random() - 0.5) * 2 * spread;
    const spd = speed_au_s * (0.4 + Math.random() * 0.6);
    const size = (1.5 + power * 4 * Math.random()) / s;
    // Color: white core at high power, orange-to-red at low
    const hot = Math.random() < power * 0.7;
    const color = hot
      ? `255,${Math.round(200 + 55 * (1 - power))},${Math.round(80 * (1 - power))}`
      : `255,${Math.round(100 + 80 * Math.random())},20`;

    thrustParticles.push({
      x: ship.x,
      y: ship.y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      age: 0,
      duration: 0.12 + power * 0.28 + Math.random() * 0.15,
      size,
      color,
    });
  }
}

// =============================================================================
// PATH PREDICTION — ship (ghost simulation, no side effects)
// =============================================================================

function computePrediction() {
  if (!ship) return [];

  const ghosts = bodies.map((b) => ({
    id: b.id,
    x: b.x,
    y: b.y,
    vx: b.vx,
    vy: b.vy,
    mass: b.mass,
    isFixed: b.isFixed,
    isPlanet: b.isPlanet,
  }));

  const shipIdx = ghosts.findIndex((g) => g.id === "ship");
  if (shipIdx < 0) return [];

  const path = [{ x: ghosts[shipIdx].x, y: ghosts[shipIdx].y }];
  const targetWorldSegment = PRED_TARGET_SEGMENT_PX / Math.max(scale(), 0.0001);

  const boost = settings.settings.orbit.planetGravBoost;
  let elapsed = 0;
  let step = 0;
  let lastX = ghosts[shipIdx].x;
  let lastY = ghosts[shipIdx].y;

  while (elapsed < PRED_HORIZON_YR && step < PRED_MAX_STEPS) {
    const ghostShip = ghosts[shipIdx];
    const speed = Math.sqrt(
      ghostShip.vx * ghostShip.vx + ghostShip.vy * ghostShip.vy,
    );
    const speedDt = speed > 1e-6 ? targetWorldSegment / speed : PRED_BASE_DT_YR;
    const predDt = Math.min(
      PRED_BASE_DT_YR,
      speedDt,
      PRED_HORIZON_YR - elapsed,
    );

    applyBlackHoleGravityLocal(ghosts, predDt);
    applySolarGravityWell(ghosts, predDt);
    gravityStep(ghosts, predDt, boost);

    const dx = ghosts[shipIdx].x - lastX;
    const dy = ghosts[shipIdx].y - lastY;
    if (Math.sqrt(dx * dx + dy * dy) >= targetWorldSegment * 0.6) {
      path.push({ x: ghosts[shipIdx].x, y: ghosts[shipIdx].y });
      lastX = ghosts[shipIdx].x;
      lastY = ghosts[shipIdx].y;
    }

    elapsed += predDt;
    step++;
  }

  const tail = path[path.length - 1];
  const end = ghosts[shipIdx];
  if (!tail || tail.x !== end.x || tail.y !== end.y)
    path.push({ x: end.x, y: end.y });

  return path;
}

// =============================================================================
// SCENE SETUP
// =============================================================================

function buildScene(w, h) {
  bodies = [];
  buildStarfield(w, h);
  shipAngle = -Math.PI / 2;
  shipAngVel = 0;
  shipPredPath = [];
  debris = [];
  blackHoleScore = 0;
  blackHoleConsumed = [];
  sunPenalty = 0;
  totalEnergySpent = 0;
  finalScoreShown = false;
  shipLoss = null;
  thrustParticles = [];
  mouse.down = false;
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

  cam.zoom = 1.2;
  camTargetZoom = 1.2;
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

function zoomAt(factor) {
  cam.zoom = Math.max(0.004, Math.min(200000, cam.zoom * factor));
  camTargetZoom = cam.zoom;
}

function applyFocusMode(w, h) {
  // Always track ship — pan is derived, not stored
  cam.zoom += (camTargetZoom - cam.zoom) * 0.08;
  if (ship) {
    const s = scale();
    cam.panX = w / 2 - ship.x * s;
    cam.panY = h / 2 - ship.y * s;
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
// THRUST PARTICLES
// =============================================================================

function tickThrustParticles(realDt) {
  for (const p of thrustParticles) {
    p.age += realDt;
    p.x += p.vx * realDt;
    p.y += p.vy * realDt;
    // Slow down quickly — exhaust decelerates
    p.vx *= Math.pow(0.12, realDt);
    p.vy *= Math.pow(0.12, realDt);
  }
  for (let i = thrustParticles.length - 1; i >= 0; i--) {
    if (thrustParticles[i].age >= thrustParticles[i].duration) thrustParticles.splice(i, 1);
  }
}

function drawThrustParticles(ctx) {
  if (thrustParticles.length === 0) return;
  const s = scale();
  ctx.save();
  ctx.setTransform(s, 0, 0, s, cam.panX, cam.panY);

  for (const p of thrustParticles) {
    const t = p.age / p.duration;
    const alpha = Math.pow(1 - t, 1.4);
    const r = p.size * (1 - t * 0.5); // shrink slightly as they age
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.color},${alpha.toFixed(3)})`;
    ctx.fill();
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
// MOUSE AIM INDICATOR
// =============================================================================

function drawMouseAimIndicator(ctx, w, h) {
  if (!ship) return;
  const { power, deadZone, fullDist } = getMouseThrust(w, h);
  const cx = w / 2;
  const cy = h / 2;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Dead-zone ring
  ctx.beginPath();
  ctx.arc(cx, cy, deadZone, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Full-power ring
  ctx.beginPath();
  ctx.arc(cx, cy, fullDist, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Power arc at current distance
  if (power > 0 && mouse.down) {
    ctx.beginPath();
    ctx.arc(cx, cy, deadZone + (fullDist - deadZone) * power, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,${Math.round(80 + power * 120)},20,${0.35 + power * 0.45})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Cursor dot
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = power > 0
    ? `rgba(255,${Math.round(100 + power * 120)},30,0.9)`
    : "rgba(255,255,255,0.35)";
  ctx.fill();

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

  ctx.restore();
  drawTimeScore(ctx, w);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (shipLoss) {
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = "rgba(255,95,70,0.95)";
    ctx.textAlign = "center";
    ctx.fillText(`SHIP LOST: ${shipLoss}`, w / 2, 112);
  }

  if (ship) {
    const speed_au_yr = Math.sqrt(ship.vx ** 2 + ship.vy ** 2);
    const speed_km_s = (speed_au_yr * AU_KM) / (365.25 * 24 * 3600);
    const sun = bodies.find((b) => b.id === "sun");
    const dist_au = sun
      ? Math.sqrt((ship.x - sun.x) ** 2 + (ship.y - sun.y) ** 2)
      : 0;
    const { power } = getMouseThrust(w, h);

    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "right";
    ctx.fillText(`Thrust: ${Math.round(power * 100)}%`, w - 12, h - 40);
    ctx.fillText(`Speed: ${speed_km_s.toFixed(2)} km/s`, w - 12, h - 26);
    ctx.fillText(`Dist from Sun: ${dist_au.toFixed(4)} AU`, w - 12, h - 12);
  }

  ctx.restore();
  drawFinalScoreOverview(ctx, w, h);
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

  drawStarfield(ctx, w, h);
  drawOrbits(ctx);
  drawSolarGravityWell(ctx);
  drawBlackHole(ctx);
  drawThrustParticles(ctx);
  drawPredictionPath(ctx);

  for (const body of bodies) {
    drawBody(ctx, body, w, h);
  }

  drawShockwaves(ctx);
  drawDebris(ctx);
  drawMouseAimIndicator(ctx, w, h);
  drawConsumedPlanets(ctx, h);
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

  // --- Mouse ---
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }
  function onMouseDown(e) {
    if (e.button === 0) mouse.down = true;
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }
  function onWheel(e) {
    e.preventDefault();
    const factor = Math.pow(1.12, -e.deltaY / 100);
    zoomAt(factor);
  }

  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("mouseleave", onMouseUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

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
        simStep(dt_yr, realDt, _w, _h);
        tickDebris(dt_yr, realDt);
        tickThrustParticles(realDt);
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
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  onUnmounted(() => {
    cancelAnimationFrame(rafId);
    observer.disconnect();
    canvas.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("mouseleave", onMouseUp);
    canvas.removeEventListener("wheel", onWheel);
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
