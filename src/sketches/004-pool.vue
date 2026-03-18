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
          <SettingsRow label="Base speed"       v-model="settings.settings.sim.baseSpeed"         :min="0.25" :max="20"    :step="0.25"  :decimals="2" tooltip="Simulation speed after releasing a shot." />
        </SettingsSection>
        <SettingsSection title="Cue">
          <SettingsRow label="Power"            v-model="settings.settings.cue.power"             :min="1"    :max="50"    :step="0.5"   :decimals="1" tooltip="Multiplier on the drag distance to compute impulse. Higher = more powerful shots." />
          <SettingsRow label="Max drag"         v-model="settings.settings.cue.maxDrag"           :min="50"   :max="400"   :step="10"    :decimals="0" tooltip="Maximum drag distance in pixels. Limits the maximum shot power." />
          <SettingsRow label="Charge rate"      v-model="settings.settings.cue.chargeRate"        :min="1"    :max="30"    :step="1"     :decimals="0" tooltip="Charge gained per second of simulation time." />
          <SettingsRow label="Max charge"       v-model="settings.settings.cue.maxCharge"         :min="20"   :max="500"   :step="10"    :decimals="0" tooltip="Maximum charge level. Limits pull distance until fully charged." />
        </SettingsSection>
        <SettingsSection title="Sun">
          <SettingsRow label="Mass"             v-model="settings.settings.sun.mass"              :min="1000" :max="30000" :step="100"   :decimals="0" tooltip="Mass of the central star." />
        </SettingsSection>
        <SettingsSection title="Black hole">
          <SettingsRow label="Mass"             v-model="settings.settings.blackhole.mass"            :min="500"  :max="30000" :step="100"   :decimals="0" tooltip="Mass of the black hole." />
          <SettingsRow label="Influence radius" v-model="settings.settings.blackhole.influenceRadius"  :min="0"    :max="600"   :step="10"    :decimals="0" tooltip="Radius of the gravitational influence region." />
          <SettingsRow label="Capture radius"   v-model="settings.settings.blackhole.captureRadius"    :min="10"   :max="100"   :step="5"     :decimals="0" tooltip="Bodies crossing this distance are consumed." />
        </SettingsSection>
        <SettingsSection title="Physics">
          <SettingsRow label="Gravity"          v-model="settings.settings.physics.gravity"       :min="0.01" :max="5"     :step="0.01"  :decimals="2" tooltip="Gravitational constant (G)." />
          <SettingsRow label="Bounce dampening" v-model="settings.settings.physics.restitution"   :min="0"    :max="1"     :step="0.01"  :decimals="2" tooltip="Energy preserved on collision. 1.0 = perfectly elastic." />
        </SettingsSection>
        <SettingsSection title="Visuals">
          <SettingsRow label="Trail length"     v-model="settings.settings.visuals.trailLength"   :min="0"    :max="1000"  :step="10"    :decimals="0" tooltip="Trail history length per planet." />
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

const PROTOTYPE_ID = '004'
const settings = useSettings(PROTOTYPE_ID, {
  sim:       { baseSpeed: 1 },
  cue:       { power: 10, maxDrag: 200, chargeRate: 5, maxCharge: 200 },
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

const isPlaying = ref(false)  // starts paused — player takes first shot
const timeScale = ref(settings.settings.sim.baseSpeed)
const bodyCount = ref(0)
const elapsed   = ref(0)

const sim = new Simulation({ gravitationalConstant: settings.settings.physics.gravity })
sim.pause()

watch(() => settings.settings.physics.gravity,     (v) => { sim.G = v })
watch(() => settings.settings.physics.restitution, (v) => { sim.restitution = v })
watch(() => settings.settings.visuals.trailLength, (v) => {
  for (const body of sim.bodies) { if (body.trailLength > 0) body.trailLength = v }
})
watch(() => settings.settings.sun.mass,                  () => reset())
watch(() => settings.settings.blackhole.mass,            () => reset())
watch(() => settings.settings.blackhole.influenceRadius, () => reset())
watch(() => settings.settings.blackhole.captureRadius,   () => reset())

// --- Charge & cue drag state ---
let charge = 0       // current charge level (pixels of allowed pull)
let prevElapsed = 0  // track sim time for charge accumulation
let drag = null      // { body, startX, startY, curX, curY }

function buildScene(w, h) {
  sim.bodies = []
  sim.elapsed = 0
  sim.state = 'paused'
  sim.G = settings.settings.physics.gravity
  sim.restitution = settings.settings.physics.restitution
  sim.setTimeScale(settings.settings.sim.baseSpeed)

  const cx = w / 2
  const cy = h / 2
  const G  = sim.G
  const M  = settings.settings.sun.mass

  sim.addBody(new Sun({ id: 'sun', position: { x: cx, y: cy }, mass: M, radius: 28 }))

  const bh = settings.settings.blackhole
  sim.addBody(new BlackHole({
    id: 'bh',
    position: { x: cx + 320, y: cy - 80 },
    mass:            bh.mass,
    captureRadius:   bh.captureRadius,
    influenceRadius: bh.influenceRadius,
  }))

  const planets = [
    { id: 'p1', r: 110, angle: 0.3,  color: '#e8a87c', mass: 80,  radius: 7  },
    { id: 'p2', r: 175, angle: 1.8,  color: '#4fc3f7', mass: 150, radius: 9  },
    { id: 'p3', r: 250, angle: 3.5,  color: '#a5d6a7', mass: 120, radius: 8  },
    { id: 'p4', r: 330, angle: 0.9,  color: '#ffcc80', mass: 200, radius: 11 },
    { id: 'p5', r: 410, angle: 2.4,  color: '#cf94da', mass: 100, radius: 7  },
    { id: 'p6', r: 160, angle: 4.2,  color: '#f48fb1', mass: 90,  radius: 6  },
    { id: 'p7', r: 290, angle: 5.1,  color: '#80cbc4', mass: 130, radius: 8  },
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

function drawCue(ctx) {
  if (!drag) return

  const { body, startX, startY, curX, curY } = drag
  const bx = body.position.x
  const by = body.position.y

  // Drag vector (from planet to mouse = pull direction)
  const dx = curX - bx
  const dy = curY - by
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 2) return

  const maxDrag = Math.min(settings.settings.cue.maxDrag, charge)
  const clamped = Math.min(dist, maxDrag)
  const nx = dx / dist  // unit vector toward mouse
  const ny = dy / dist

  // Cue stick: drawn from behind the planet extending outward from drag
  const cueStart = { x: bx + nx * (body.radius + 4), y: by + ny * (body.radius + 4) }
  const cueEnd   = { x: bx + nx * (clamped + body.radius + 30), y: by + ny * (clamped + body.radius + 30) }

  // Cue stick line
  ctx.save()
  ctx.setLineDash([6, 4])
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cueStart.x, cueStart.y)
  ctx.lineTo(cueEnd.x, cueEnd.y)
  ctx.stroke()
  ctx.setLineDash([])

  // Shot direction arrow (opposite — where the planet will go)
  const shotLen = clamped * 0.8
  const arrowTip = { x: bx - nx * (shotLen + body.radius), y: by - ny * (shotLen + body.radius) }

  ctx.strokeStyle = 'rgba(79, 195, 247, 0.7)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(bx - nx * body.radius, by - ny * body.radius)
  ctx.lineTo(arrowTip.x, arrowTip.y)
  ctx.stroke()

  // Arrowhead
  const headLen = 10
  const angle = Math.atan2(-ny, -nx)
  ctx.fillStyle = 'rgba(79, 195, 247, 0.8)'
  ctx.beginPath()
  ctx.moveTo(arrowTip.x, arrowTip.y)
  ctx.lineTo(arrowTip.x - headLen * Math.cos(angle - 0.4), arrowTip.y - headLen * Math.sin(angle - 0.4))
  ctx.lineTo(arrowTip.x - headLen * Math.cos(angle + 0.4), arrowTip.y - headLen * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()

  // Power indicator ring around planet
  const power = clamped / maxDrag  // 0–1
  const r = body.radius + 4
  ctx.strokeStyle = `rgba(${Math.round(255 * power)}, ${Math.round(255 * (1 - power))}, 80, 0.7)`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(bx, by, r, 0, Math.PI * 2 * power)
  ctx.stroke()

  ctx.restore()
}

function drawChargeBar(ctx, w, h) {
  const maxCharge = settings.settings.cue.maxCharge
  const pct = Math.min(charge / maxCharge, 1)

  const barW = 18
  const barH = h * 0.55
  const x = 22
  const y = (h - barH) / 2

  ctx.save()

  // Outer glow
  ctx.shadowColor = `rgba(${Math.round(255 * (1 - pct))}, ${Math.round(255 * pct)}, 80, 0.4)`
  ctx.shadowBlur = 16

  // Background track
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'
  ctx.beginPath()
  ctx.roundRect(x, y, barW, barH, 9)
  ctx.fill()

  // Compute drag cost if dragging
  let costPct = 0
  if (drag) {
    const bx = drag.body.position.x, by = drag.body.position.y
    const dx = drag.curX - bx, dy = drag.curY - by
    const dist = Math.sqrt(dx * dx + dy * dy)
    const effectiveMax = Math.min(settings.settings.cue.maxDrag, charge)
    costPct = Math.min(dist, effectiveMax) / maxCharge
  }

  // Fill — grows upward from bottom
  ctx.shadowBlur = 0
  const fillH = barH * pct
  const fillY = y + barH - fillH
  const r = Math.round(255 * (1 - pct))
  const g = Math.round(255 * pct)

  if (pct > 0.01) {
    const grad = ctx.createLinearGradient(0, y + barH, 0, y)
    grad.addColorStop(0, `rgba(${r}, ${g}, 80, 0.5)`)
    grad.addColorStop(1, `rgba(${r}, ${g}, 120, 0.95)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(x, fillY, barW, fillH, 9)
    ctx.fill()

    // Inner bright edge
    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + pct * 0.15})`
    ctx.beginPath()
    ctx.roundRect(x + 3, fillY + 2, 4, Math.max(fillH - 4, 0), 2)
    ctx.fill()
  }

  // Cost overlay — pulsing red zone showing what the shot will drain
  if (costPct > 0.005) {
    const costH = barH * costPct
    const costY = fillY  // cost eats from the top of the fill
    const pulse = 0.55 + 0.25 * Math.sin(Date.now() / 150)
    ctx.fillStyle = `rgba(255, 60, 60, ${pulse})`
    ctx.beginPath()
    ctx.roundRect(x, costY, barW, Math.min(costH, fillH), 9)
    ctx.fill()

    // Cost marker line
    const markerY = costY + Math.min(costH, fillH)
    ctx.strokeStyle = `rgba(255, 100, 100, ${pulse + 0.2})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x - 4, markerY)
    ctx.lineTo(x + barW + 4, markerY)
    ctx.stroke()

    // Cost label next to the bar
    ctx.fillStyle = `rgba(255, 100, 100, ${pulse + 0.15})`
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`-${Math.round(costPct * 100)}%`, x + barW + 8, markerY + 4)
    ctx.textAlign = 'start'
  }

  // Border
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 + pct * 0.2})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(x, y, barW, barH, 9)
  ctx.stroke()

  // Percentage label
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + pct * 0.4})`
  ctx.font = 'bold 13px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.round(pct * 100)}%`, x + barW / 2, y + barH + 20)

  // "CHARGE" label rotated vertically
  ctx.font = '10px monospace'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.translate(x + barW + 14, y + barH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('CHARGE', 0, 0)

  ctx.restore()
}

function render(ctx, w, h, record = true) {
  ctx.clearRect(0, 0, w, h)
  for (const body of sim.bodies) {
    if (record) body.recordTrail()
    body.draw(ctx)
  }
  drawCue(ctx)
  drawChargeBar(ctx, w, h)
}

let rafId = null, lastTime = null
const MAX_DT = 0.05
let _w = 0, _h = 0
let _canvas = null
let _ctx = null

function getCanvasPos(e) {
  const rect = _canvas.getBoundingClientRect()
  const dpr  = window.devicePixelRatio || 1
  // getBoundingClientRect is in CSS px, canvas coords are CSS px (we scale ctx not coords)
  return {
    x: (e.clientX - rect.left),
    y: (e.clientY - rect.top),
  }
}

function hitTest(x, y) {
  for (const body of sim.bodies) {
    if (body.isFixed) continue
    const dx = body.position.x - x
    const dy = body.position.y - y
    if (dx * dx + dy * dy <= (body.radius + 6) ** 2) return body
  }
  return null
}

function initCanvas(canvas) {
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  _canvas = canvas
  let ctx = null

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect()
    _w = rect.width; _h = rect.height - 36
    canvas.width = _w * dpr; canvas.height = _h * dpr
    canvas.style.width = _w + 'px'; canvas.style.height = _h + 'px'
    ctx = canvas.getContext('2d')
    _ctx = ctx
    ctx.scale(dpr, dpr)
    buildScene(_w, _h)
  }

  const observer = new ResizeObserver(resizeCanvas)
  observer.observe(canvas.parentElement)
  resizeCanvas()

  // --- Mouse handlers ---
  function onMouseDown(e) {
    const { x, y } = getCanvasPos(e)
    const body = hitTest(x, y)
    if (!body) return
    sim.pause()
    isPlaying.value = false
    drag = { body, startX: x, startY: y, curX: x, curY: y }
  }

  function onMouseMove(e) {
    if (!drag) return
    const { x, y } = getCanvasPos(e)
    drag.curX = x
    drag.curY = y
  }

  function onMouseUp(e) {
    if (!drag) return
    const { body, curX, curY } = drag
    const bx = body.position.x
    const by = body.position.y

    const dx = curX - bx
    const dy = curY - by
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 2) {
      const maxDrag = Math.min(settings.settings.cue.maxDrag, charge)
      const clamped = Math.min(dist, maxDrag)
      const power   = settings.settings.cue.power
      const nx = dx / dist
      const ny = dy / dist
      // Impulse fires opposite to drag direction
      body.velocity.x += -nx * clamped * power / body.mass
      body.velocity.y += -ny * clamped * power / body.mass
      // Deplete charge proportionally to how much pull was used
      charge = Math.max(0, charge - clamped)
    }

    drag = null
    sim.play()
    isPlaying.value = true
  }

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup',   onMouseUp)
  canvas.addEventListener('mouseleave', onMouseUp)

  function loop(ts) {
    let didStep = false
    if (lastTime !== null) {
      const dt = Math.min((ts - lastTime) / 1000, MAX_DT)
      sim.step(dt)
      didStep = sim.state === 'running'
      bodyCount.value = sim.bodies.length
      elapsed.value   = sim.elapsed

      // Accumulate charge from sim time that passed
      const simDelta = sim.elapsed - prevElapsed
      if (simDelta > 0) {
        charge = Math.min(charge + simDelta * settings.settings.cue.chargeRate, settings.settings.cue.maxCharge)
      }
      prevElapsed = sim.elapsed
    }
    lastTime = ts
    if (ctx) render(ctx, _w, _h, didStep)
    rafId = requestAnimationFrame(loop)
  }

  rafId = requestAnimationFrame(loop)
  onUnmounted(() => {
    cancelAnimationFrame(rafId)
    observer.disconnect()
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mouseup',   onMouseUp)
    canvas.removeEventListener('mouseleave', onMouseUp)
  })
}

function togglePlay() {
  if (sim.state === 'running') { sim.pause(); isPlaying.value = false }
  else { sim.play(); isPlaying.value = true }
}
function setTimeScale(scale) { timeScale.value = scale; sim.setTimeScale(scale) }
function reset() {
  drag = null
  charge = 0
  prevElapsed = 0
  buildScene(_w, _h)
  isPlaying.value = false
  timeScale.value = settings.settings.sim.baseSpeed
  sim.setTimeScale(settings.settings.sim.baseSpeed)
}
</script>
