<template>
  <SketchWrapper
    :is-playing="isPlaying"
    :time-scale="timeScale"
    :body-count="bodyCount"
    :elapsed="elapsed"
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
            :min="0.25"
            :max="20"
            :step="0.25"
            :decimals="2"
            tooltip="The default simulation speed when the sketch loads or resets. Matches the range of the speed slider (0.25–20x)."
          />
        </SettingsSection>
        <SettingsSection title="Sun">
          <SettingsRow
            label="Mass"
            v-model="settings.settings.sun.mass"
            :min="1000"
            :max="30000"
            :step="100"
            :decimals="0"
            tooltip="Mass of the central star. Higher mass increases gravitational pull on all bodies."
          />
        </SettingsSection>
        <SettingsSection title="Black hole">
          <SettingsRow
            label="Mass"
            v-model="settings.settings.blackhole.mass"
            :min="500"
            :max="30000"
            :step="100"
            :decimals="0"
            tooltip="Mass of the black hole. Determines how strongly it pulls bodies within its influence region."
          />
          <SettingsRow
            label="Influence radius"
            v-model="settings.settings.blackhole.influenceRadius"
            :min="0"
            :max="600"
            :step="10"
            :decimals="0"
            tooltip="Radius of the gravitational influence region (shown as dashed circle). Gravity ramps up linearly from zero at the edge to full strength at the center. Set to 0 for unlimited reach."
          />
          <SettingsRow
            label="Capture radius"
            v-model="settings.settings.blackhole.captureRadius"
            :min="10"
            :max="100"
            :step="5"
            :decimals="0"
            tooltip="Any body crossing this distance from the black hole is consumed. Also defines the visible size of the black hole."
          />
        </SettingsSection>
        <SettingsSection title="Spaceship">
          <SettingsRow
            label="Thrust force"
            v-model="settings.settings.ship.thrustForce"
            :min="1"
            :max="500"
            :step="1"
            :decimals="0"
            tooltip="Forward thrust force applied while holding ArrowUp. Higher values accelerate faster but are harder to control near gravity wells."
          />
          <SettingsRow
            label="Rotate speed"
            v-model="settings.settings.ship.rotateSpeed"
            :min="0.05"
            :max="4"
            :step="0.05"
            :decimals="1"
            tooltip="Rotation speed in radians per second when holding ArrowLeft/Right."
          />
        </SettingsSection>
        <SettingsSection title="Blast">
          <SettingsRow
            label="Wave length"
            v-model="settings.settings.blast.width"
            :min="10"
            :max="300"
            :step="5"
            :decimals="0"
            tooltip="Radial thickness of the shockwave (px). Larger values mean a wider wave that stays in contact with bodies longer."
          />
          <SettingsRow
            label="Cone angle"
            v-model="settings.settings.blast.halfAngleDeg"
            :min="5"
            :max="180"
            :step="5"
            :decimals="0"
            tooltip="Half-width of the blast cone in degrees. 90° covers a full hemisphere, 180° is omnidirectional."
          />
          <SettingsRow
            label="Force"
            v-model="settings.settings.blast.force"
            :min="100"
            :max="10000"
            :step="100"
            :decimals="0"
            tooltip="Peak outward force applied to bodies caught in the blast wave."
          />
          <SettingsRow
            label="Max range"
            v-model="settings.settings.blast.maxR"
            :min="50"
            :max="800"
            :step="25"
            :decimals="0"
            tooltip="Maximum radius the blast travels before disappearing."
          />
        </SettingsSection>
        <SettingsSection title="Physics">
          <SettingsRow
            label="Gravity"
            v-model="settings.settings.physics.gravity"
            :min="0.01"
            :max="5"
            :step="0.01"
            :decimals="2"
            tooltip="Gravitational constant (G). Scales the strength of gravity between all bodies."
          />
        </SettingsSection>
        <SettingsSection title="Visuals">
          <SettingsRow
            label="Trail length"
            v-model="settings.settings.visuals.trailLength"
            :min="50"
            :max="1000"
            :step="10"
            :decimals="0"
            tooltip="Number of past positions recorded per body for trail rendering."
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
import { Simulation } from "../engine/Simulation.js";
import { Sun } from "../engine/Sun.js";
import { Planet } from "../engine/Planet.js";
import { BlackHole } from "../engine/BlackHole.js";
import { Spaceship } from "../engine/Spaceship.js";
import { Blast } from "../engine/Blast.js";

const PROTOTYPE_ID = "003";
const settings = useSettings(PROTOTYPE_ID, {
  sim: { baseSpeed: 1 },
  sun: { mass: 8000 },
  blackhole: { mass: 8000, influenceRadius: 280, captureRadius: 30 },
  ship: { thrustForce: 500, rotateSpeed: 0.65 },
  blast: { width: 40, halfAngleDeg: 25, force: 800, maxR: 350 },
  physics: { gravity: 0.5 },
  visuals: { trailLength: 300 },
});

function onImport(parsed) {
  settings.importJSON(parsed);
  reset();
}

onMounted(() => {
  const imported = history.state?.importedSettings;
  if (imported) settings.importJSON(imported);
});

const isPlaying = ref(true);
const timeScale = ref(settings.settings.sim.baseSpeed);
const bodyCount = ref(0);
const elapsed = ref(0);

const sim = new Simulation({
  gravitationalConstant: settings.settings.physics.gravity,
});

// Live key state — shared with the Spaceship instance
const keys = {};
let ship = null;
const blasts = [];

watch(
  () => settings.settings.physics.gravity,
  (v) => {
    sim.G = v;
  },
);
watch(
  () => settings.settings.visuals.trailLength,
  (v) => {
    for (const body of sim.bodies) {
      if (body.trailLength > 0) body.trailLength = v;
    }
  },
);
watch(
  () => settings.settings.ship.thrustForce,
  (v) => {
    if (ship) ship.thrustForce = v;
  },
);
watch(
  () => settings.settings.ship.rotateSpeed,
  (v) => {
    if (ship) ship.rotateSpeed = v;
  },
);
// Structural changes require rebuild
watch(
  () => settings.settings.sun.mass,
  () => reset(),
);
watch(
  () => settings.settings.blackhole.mass,
  () => reset(),
);
watch(
  () => settings.settings.blackhole.influenceRadius,
  () => reset(),
);
watch(
  () => settings.settings.blackhole.captureRadius,
  () => reset(),
);

function buildScene(w, h) {
  sim.bodies = [];
  sim.elapsed = 0;
  sim.state = "running";
  sim.G = settings.settings.physics.gravity;
  sim.restitution = 0.5;
  sim.setTimeScale(settings.settings.sim.baseSpeed);

  const cx = w / 2;
  const cy = h / 2;
  const G = sim.G;
  const M = settings.settings.sun.mass;
  const bh = settings.settings.blackhole;

  // Sun at center
  sim.addBody(
    new Sun({ id: "sun", position: { x: cx, y: cy }, mass: M, radius: 28 }),
  );

  // Black hole offset from center
  sim.addBody(
    new BlackHole({
      id: "bh",
      position: { x: cx + 320, y: cy - 80 },
      mass: bh.mass,
      captureRadius: bh.captureRadius,
      influenceRadius: bh.influenceRadius,
    }),
  );

  // Planets
  const planets = [
    { id: "p1", r: 110, angle: 0.3, color: "#e8a87c", mass: 80, radius: 5 },
    { id: "p2", r: 170, angle: 1.8, color: "#4fc3f7", mass: 150, radius: 7 },
    { id: "p3", r: 245, angle: 3.5, color: "#a5d6a7", mass: 120, radius: 6 },
    { id: "p4", r: 320, angle: 0.9, color: "#ffcc80", mass: 200, radius: 9 },
  ];
  for (const p of planets) {
    const speed = Math.sqrt((G * M) / p.r);
    const planet = new Planet({
      id: p.id,
      position: {
        x: cx + Math.cos(p.angle) * p.r,
        y: cy + Math.sin(p.angle) * p.r,
      },
      velocity: { x: -Math.sin(p.angle) * speed, y: Math.cos(p.angle) * speed },
      mass: p.mass,
      radius: p.radius,
      color: p.color,
    });
    planet.trailLength = settings.settings.visuals.trailLength;
    sim.addBody(planet);
  }

  // Spaceship: spawn at a stable orbit radius, moving tangentially
  const shipR = 150;
  const shipAngle = Math.PI; // start on the left side
  const shipSpeed = Math.sqrt((G * M) / shipR);
  ship = new Spaceship({
    id: "ship",
    position: {
      x: cx + Math.cos(shipAngle) * shipR,
      y: cy + Math.sin(shipAngle) * shipR,
    },
    velocity: {
      x: -Math.sin(shipAngle) * shipSpeed,
      y: Math.cos(shipAngle) * shipSpeed,
    },
    thrustForce: settings.settings.ship.thrustForce,
    rotateSpeed: settings.settings.ship.rotateSpeed,
    angle: Math.atan2(Math.cos(shipAngle), -Math.sin(shipAngle)) + Math.PI, // face velocity direction
  });
  ship.trailLength = settings.settings.visuals.trailLength;
  ship.setKeys(keys);
  sim.addBody(ship);
}

function render(ctx, w, h, record = true) {
  ctx.clearRect(0, 0, w, h);
  for (const blast of blasts) blast.draw(ctx);
  for (const body of sim.bodies) {
    if (record) body.recordTrail();
    body.draw(ctx);
  }
}

let rafId = null,
  lastTime = null;
const MAX_DT = 0.05;
let _w = 0,
  _h = 0;

function initCanvas(canvas) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  let ctx = null;

  // Keyboard input — attach to window so it works without canvas focus
  function onKeyDown(e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      keys[e.key] = true;
    }
    if (e.key === "b" || e.key === "B") {
      if (ship && sim.state === "running") {
        const b = settings.settings.blast;
        blasts.push(
          ship.fireBlast({
            width: b.width,
            halfAngle: (b.halfAngleDeg * Math.PI) / 180,
            force: b.force,
            maxR: b.maxR,
          }),
        );
      }
    }
  }
  function onKeyUp(e) {
    keys[e.key] = false;
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    _w = rect.width;
    _h = rect.height - 36;
    canvas.width = _w * dpr;
    canvas.height = _h * dpr;
    canvas.style.width = _w + "px";
    canvas.style.height = _h + "px";
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    buildScene(_w, _h);
  }

  const observer = new ResizeObserver(resizeCanvas);
  observer.observe(canvas.parentElement);
  resizeCanvas();

  function loop(ts) {
    let didStep = false;
    if (lastTime !== null) {
      const dt = Math.min((ts - lastTime) / 1000, MAX_DT);
      const scaledDt = dt * sim.timeScale;
      // Apply ship input before the physics step
      if (ship && sim.state === "running") ship.applyInput(scaledDt);
      // Update blasts and apply forces to bodies
      if (sim.state === "running") {
        for (const blast of blasts) blast.update(sim.bodies, scaledDt);
        blasts.splice(0, blasts.length, ...blasts.filter((b) => !b.done));
      }
      sim.step(dt);
      didStep = sim.state === "running";
      bodyCount.value = sim.bodies.length;
      elapsed.value = sim.elapsed;
      // Re-acquire ship ref if it was somehow replaced
      if (!sim.bodies.find((b) => b.id === "ship")) ship = null;
    }
    lastTime = ts;
    if (ctx) render(ctx, _w, _h, didStep);
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);
  onUnmounted(() => {
    cancelAnimationFrame(rafId);
    observer.disconnect();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  });
}

function togglePlay() {
  if (sim.state === "running") {
    sim.pause();
    isPlaying.value = false;
  } else {
    sim.play();
    isPlaying.value = true;
  }
}
function setTimeScale(scale) {
  timeScale.value = scale;
  sim.setTimeScale(scale);
}
function reset() {
  blasts.splice(0);
  buildScene(_w, _h);
  isPlaying.value = true;
  timeScale.value = settings.settings.sim.baseSpeed;
  sim.setTimeScale(settings.settings.sim.baseSpeed);
}
</script>
