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
  />
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import SketchWrapper from '../components/SketchWrapper.vue'
import { Simulation } from '../engine/Simulation.js'
import { Sun } from '../engine/Sun.js'
import { Planet } from '../engine/Planet.js'

const isPlaying = ref(true)
const timeScale = ref(1)
const bodyCount = ref(0)
const elapsed = ref(0)

const sim = new Simulation({ gravitationalConstant: 0.5, timeScale: 1 })

const TRAIL_LENGTH = 8000

function buildScene(w, h) {
  sim.bodies = []
  sim.elapsed = 0
  sim.state = 'running'

  const cx = w / 2
  const cy = h / 2
  const G = sim.G
  const M = 8000 // sun mass — used for orbital velocity calculation

  // Central sun: mass and radius set independently
  sim.addBody(new Sun({
    id: 'sun',
    position: { x: cx, y: cy },
    mass: M,
    radius: 28, // visual size, unrelated to mass
  }))

  // Planets: v = sqrt(G * M / r) gives a circular orbit around dominant central mass.
  // Each planet's own mass is small enough not to disturb this significantly.
  const planets = [
    { id: 'p1', r: 110, angle: 0.3,          color: '#e8a87c', mass: 80,  radius: 5  },
    { id: 'p2', r: 170, angle: 1.8,          color: '#4fc3f7', mass: 150, radius: 7  },
    { id: 'p3', r: 245, angle: 3.5,          color: '#a5d6a7', mass: 120, radius: 6  },
    { id: 'p4', r: 320, angle: 0.9,          color: '#ffcc80', mass: 200, radius: 9  },
    { id: 'p5', r: 400, angle: 2.4,          color: '#cf94da', mass: 100, radius: 5  },
  ]

  for (const p of planets) {
    const speed = Math.sqrt(G * M / p.r)
    const planet = new Planet({
      id: p.id,
      position: {
        x: cx + Math.cos(p.angle) * p.r,
        y: cy + Math.sin(p.angle) * p.r,
      },
      velocity: {
        x: -Math.sin(p.angle) * speed,
        y:  Math.cos(p.angle) * speed,
      },
      mass: p.mass,     // gravitational mass
      radius: p.radius, // visual radius, independent of mass
      color: p.color,
    })
    planet.trailLength = TRAIL_LENGTH
    sim.addBody(planet)
  }
}

function render(ctx, w, h) {
  ctx.clearRect(0, 0, w, h)
  for (const body of sim.bodies) {
    body.recordTrail()
    body.draw(ctx)
  }
}

let rafId = null
let lastTime = null
const MAX_DT = 0.05
let _w = 0, _h = 0

function initCanvas(canvas) {
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  let ctx = null

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect()
    _w = rect.width
    _h = rect.height - 36
    canvas.width = _w * dpr
    canvas.height = _h * dpr
    canvas.style.width = _w + 'px'
    canvas.style.height = _h + 'px'
    ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    buildScene(_w, _h)
  }

  const observer = new ResizeObserver(resizeCanvas)
  observer.observe(canvas.parentElement)
  resizeCanvas()

  function loop(ts) {
    if (lastTime !== null) {
      const dt = Math.min((ts - lastTime) / 1000, MAX_DT)
      sim.step(dt)
      bodyCount.value = sim.bodies.length
      elapsed.value = sim.elapsed
    }
    lastTime = ts
    if (ctx) render(ctx, _w, _h)
    rafId = requestAnimationFrame(loop)
  }

  rafId = requestAnimationFrame(loop)
  onUnmounted(() => { cancelAnimationFrame(rafId); observer.disconnect() })
}

function togglePlay() {
  if (sim.state === 'running') { sim.pause(); isPlaying.value = false }
  else { sim.play(); isPlaying.value = true }
}

function setTimeScale(scale) {
  timeScale.value = scale
  sim.setTimeScale(scale)
}

function reset() {
  buildScene(_w, _h)
  isPlaying.value = true
  timeScale.value = 1
  sim.setTimeScale(1)
}
</script>
