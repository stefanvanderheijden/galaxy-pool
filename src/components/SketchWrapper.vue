<template>
  <div class="sketch-wrapper">
    <canvas ref="canvasRef" class="sketch-canvas"></canvas>

    <!-- Settings panel lives here so it's available to every sketch -->
    <slot name="settings" />

    <div class="controls">
      <div class="controls-left">
        <button class="ctrl-btn" @click="$emit('toggle-play')">
          {{ isPlaying ? '⏸' : '▶' }}
        </button>
        <label class="ctrl-label">
          Speed
          <input
            class="speed-slider"
            type="range"
            :min="timeScaleMin"
            :max="timeScaleMax"
            :step="timeScaleStep"
            :value="timeScale"
            @input="$emit('set-timescale', Number($event.target.value))"
          />
          {{ timeScale }}x
        </label>
        <button class="ctrl-btn" @click="$emit('reset')">↺ Reset</button>
      </div>

      <div class="controls-right">
        <span class="info">bodies: {{ bodyCount }}</span>
        <span class="info" v-if="elapsedLabel">{{ elapsedLabel }}</span>
        <span class="info" v-else>t: {{ elapsed.toFixed(1) }}s</span>
        <slot name="controls" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

defineProps({
  isPlaying:     { type: Boolean, default: true },
  timeScale:     { type: Number,  default: 1 },
  timeScaleMin:  { type: Number,  default: 0.25 },
  timeScaleMax:  { type: Number,  default: 20 },
  timeScaleStep: { type: Number,  default: 0.25 },
  bodyCount:     { type: Number,  default: 0 },
  elapsed:       { type: Number,  default: 0 },
  elapsedLabel:  { type: String,  default: '' },
})

const emit = defineEmits(['toggle-play', 'set-timescale', 'reset', 'canvas-ready'])

const canvasRef = ref(null)
defineExpose({ canvasRef })

onMounted(() => emit('canvas-ready', canvasRef.value))
</script>

<style scoped>
.sketch-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  background: #0a0a0f;
  overflow: hidden;
}

.sketch-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: rgba(10, 10, 20, 0.85);
  border-top: 1px solid #222;
  font-size: 13px;
  gap: 12px;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 10px;
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
.ctrl-btn:hover { background: #2a2a4e; }

.ctrl-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #aaa;
}

input[type='range'] {
  accent-color: #4fc3f7;
  width: 80px;
}

.speed-slider {
  width: 480px;
}

.info {
  color: #666;
}
</style>
