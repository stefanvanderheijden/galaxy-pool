import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Manages a canvas element: 2D context, DPR scaling, and resize handling.
 * @param {import('vue').Ref<HTMLCanvasElement>} canvasRef - Template ref to a <canvas> element
 * @returns {{ ctx: Ref<CanvasRenderingContext2D|null>, width: Ref<number>, height: Ref<number> }}
 */
export function useCanvas(canvasRef) {
  const ctx = ref(null)
  const width = ref(0)
  const height = ref(0)

  function resize() {
    const canvas = canvasRef.value
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.parentElement.getBoundingClientRect()

    width.value = rect.width
    height.value = rect.height

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'

    const context = canvas.getContext('2d')
    context.scale(dpr, dpr)
    ctx.value = context
  }

  const observer = new ResizeObserver(resize)

  onMounted(() => {
    resize()
    if (canvasRef.value?.parentElement) {
      observer.observe(canvasRef.value.parentElement)
    }
  })

  onUnmounted(() => {
    observer.disconnect()
  })

  return { ctx, width, height }
}
