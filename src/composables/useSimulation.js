import { ref, onUnmounted } from 'vue'

/**
 * Drives the requestAnimationFrame loop for a Simulation instance.
 * @param {import('../engine/Simulation.js').Simulation} simulation
 * @param {function(ctx: CanvasRenderingContext2D): void} renderFn - Called each frame to draw
 * @returns {{ start: function, stop: function, isRunning: Ref<boolean> }}
 */
export function useSimulation(simulation, renderFn) {
  const isRunning = ref(false)
  let rafId = null
  let lastTime = null
  const MAX_DT = 0.05 // cap at 50ms to prevent spiral of death

  function loop(timestamp) {
    if (!isRunning.value) return

    if (lastTime !== null) {
      const dt = Math.min((timestamp - lastTime) / 1000, MAX_DT)
      simulation.step(dt)
    }
    lastTime = timestamp

    renderFn()
    rafId = requestAnimationFrame(loop)
  }

  function start() {
    if (isRunning.value) return
    isRunning.value = true
    lastTime = null
    rafId = requestAnimationFrame(loop)
  }

  function stop() {
    isRunning.value = false
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onUnmounted(stop)

  return { start, stop, isRunning }
}
