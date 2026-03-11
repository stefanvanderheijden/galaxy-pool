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
          <SettingsRow label="Base speed"            v-model="settings.settings.sim.baseSpeed"              :min="0.25" :max="20"    :step="0.25"  :decimals="2" tooltip="The default simulation speed when the sketch loads or resets. Matches the range of the speed slider (0.25–20x)." />
        </SettingsSection>
        <SettingsSection title="Sun">
          <SettingsRow label="Mass"                  v-model="settings.settings.sun.mass"                   :min="1000" :max="30000" :step="100"   :decimals="0" tooltip="Mass of the central star. Higher mass increases gravitational pull on all planets, causing them to orbit faster and closer." />
        </SettingsSection>
        <SettingsSection title="Black hole">
          <SettingsRow label="Mass"                  v-model="settings.settings.blackhole.mass"             :min="500"  :max="30000" :step="100"   :decimals="0" tooltip="Mass of the black hole. Determines how strongly it pulls planets within its influence region." />
          <SettingsRow label="Influence radius"      v-model="settings.settings.blackhole.influenceRadius"  :min="0"    :max="600"   :step="10"    :decimals="0" tooltip="Radius of the gravitational influence region (shown as a dashed circle). Outside this radius the black hole exerts no gravity. Gravity ramps up linearly from zero at the edge to full strength at the center. Set to 0 for unlimited reach." />
          <SettingsRow label="Capture radius"        v-model="settings.settings.blackhole.captureRadius"    :min="10"   :max="100"   :step="5"     :decimals="0" tooltip="Any planet that crosses this distance from the black hole is consumed and removed. This also defines the visible size of the black hole." />
        </SettingsSection>
        <SettingsSection title="Physics">
          <SettingsRow label="Gravity"               v-model="settings.settings.physics.gravity"            :min="0.01" :max="5"     :step="0.01"  :decimals="2" tooltip="Gravitational constant (G). Scales the strength of gravity between all bodies. Higher values make orbits tighter and faster." />
          <SettingsRow label="Bounce dampening"      v-model="settings.settings.physics.restitution"        :min="0"    :max="1"     :step="0.01"  :decimals="2" tooltip="How much energy is preserved when bodies collide. 1.0 = perfectly elastic (no energy lost). 0.0 = perfectly inelastic (bodies stick together)." />
        </SettingsSection>
        <SettingsSection title="Visuals">
          <SettingsRow label="Trail length"          v-model="settings.settings.visuals.trailLength"        :min="50"   :max="1000"  :step="10"    :decimals="0" tooltip="Number of past positions recorded per planet to draw its trail. Higher values show a longer history but use slightly more memory." />
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
import { Simulation } from '../engine/Simulation.js'
import { Sun } from '../engine/Sun.js'
import { Planet } from '../engine/Planet.js'
import { BlackHole } from '../engine/BlackHole.js'

const PROTOTYPE_ID = '002'
const settings = useSettings(PROTOTYPE_ID, {
  sim:       { baseSpeed: 1 },
  sun:       { mass: 8000 },
  blackhole: { mass: 8000, influenceRadius: 280, captureRadius: 30 },
  physics:   { gravity: 0.5, restitution: 0.9 },
  visuals:   { trailLength: 300 },
})

function onImport(parsed) { settings.importJSON(parsed); reset() }

onMounted(() => {
  const imported = history.state?.importedSettings
  if (imported) settings.importJSON(imported)
})

const isPlaying = ref(true)
const timeScale = ref(settings.settings.sim.baseSpeed)
const bodyCount = ref(0)
const elapsed   = ref(0)

const sim = new Simulation({ gravitationalConstant: settings.settings.physics.gravity })

watch(() => settings.settings.physics.gravity,     (v) => { sim.G = v })
watch(() => settings.settings.physics.restitution, (v) => { sim.restitution = v })
watch(() => settings.settings.visuals.trailLength, (v) => {
  for (const body of sim.bodies) { if (body.trailLength > 0) body.trailLength = v }
})
// Structural changes require a scene rebuild
watch(() => settings.settings.sun.mass,                  () => reset())
watch(() => settings.settings.blackhole.mass,            () => reset())
watch(() => settings.settings.blackhole.influenceRadius, () => reset())
watch(() => settings.settings.blackhole.captureRadius,   () => reset())

function buildScene(w, h) {
  sim.bodies = []
  sim.elapsed = 0
  sim.state = 'running'
  sim.G = settings.settings.physics.gravity
  sim.restitution = settings.settings.physics.restitution
  sim.setTimeScale(settings.settings.sim.baseSpeed)

  const cx = w / 2
  const cy = h / 2
  const G  = sim.G
  const M  = settings.settings.sun.mass
  const bh = settings.settings.blackhole

  // Sun at center
  sim.addBody(new Sun({ id: 'sun', position: { x: cx, y: cy }, mass: M, radius: 28 }))

  // Black hole offset from center
  sim.addBody(new BlackHole({
    id: 'bh',
    position: { x: cx + 320, y: cy - 80 },
    mass:            bh.mass,
    radius:          22,
    captureRadius:   bh.captureRadius,
    influenceRadius: bh.influenceRadius,
  }))

  // Planets in circular orbits around the sun
  const planets = [
    { id: 'p1', r: 110, angle: 0.3, color: '#e8a87c', mass: 80,  radius: 5 },
    { id: 'p2', r: 170, angle: 1.8, color: '#4fc3f7', mass: 150, radius: 7 },
    { id: 'p3', r: 245, angle: 3.5, color: '#a5d6a7', mass: 120, radius: 6 },
    { id: 'p4', r: 320, angle: 0.9, color: '#ffcc80', mass: 200, radius: 9 },
    { id: 'p5', r: 400, angle: 2.4, color: '#cf94da', mass: 100, radius: 5 },
  ]
  for (const p of planets) {
    const speed = Math.sqrt(G * M / p.r)
    const planet = new Planet({
      id: p.id,
      position: { x: cx + Math.cos(p.angle) * p.r, y: cy + Math.sin(p.angle) * p.r },
      velocity: { x: -Math.sin(p.angle) * speed,   y:  Math.cos(p.angle) * speed },
      mass: p.mass, radius: p.radius, color: p.color,
    })
    planet.trailLength = settings.settings.visuals.trailLength
    sim.addBody(planet)
  }
}

function render(ctx, w, h, record = true) {
  ctx.clearRect(0, 0, w, h)
  for (const body of sim.bodies) {
    if (record) body.recordTrail()
    body.draw(ctx)
  }
}

let rafId = null, lastTime = null
const MAX_DT = 0.05
let _w = 0, _h = 0

function initCanvas(canvas) {
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  let ctx = null

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect()
    _w = rect.width; _h = rect.height - 36
    canvas.width = _w * dpr; canvas.height = _h * dpr
    canvas.style.width = _w + 'px'; canvas.style.height = _h + 'px'
    ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    buildScene(_w, _h)
  }

  const observer = new ResizeObserver(resizeCanvas)
  observer.observe(canvas.parentElement)
  resizeCanvas()

  function loop(ts) {
    let didStep = false
    if (lastTime !== null) {
      const dt = Math.min((ts - lastTime) / 1000, MAX_DT)
      sim.step(dt)
      didStep = sim.state === 'running'
      bodyCount.value = sim.bodies.length
      elapsed.value   = sim.elapsed
    }
    lastTime = ts
    if (ctx) render(ctx, _w, _h, didStep)
    rafId = requestAnimationFrame(loop)
  }

  rafId = requestAnimationFrame(loop)
  onUnmounted(() => { cancelAnimationFrame(rafId); observer.disconnect() })
}

function togglePlay() {
  if (sim.state === 'running') { sim.pause(); isPlaying.value = false }
  else { sim.play(); isPlaying.value = true }
}
function setTimeScale(scale) { timeScale.value = scale; sim.setTimeScale(scale) }
function reset() {
  buildScene(_w, _h)
  isPlaying.value = true
  timeScale.value = settings.settings.sim.baseSpeed
  sim.setTimeScale(settings.settings.sim.baseSpeed)
}
</script>
