<template>
  <div class="sketch-wrapper">
    <canvas ref="canvasRef" class="sketch-canvas"></canvas>

    <!-- Settings panel lives here so it's available to every sketch -->
    <slot name="settings" />

    <div class="controls">
      <div class="controls-center">
        <label class="speed-control">
          <span class="speed-title">Speed</span>
          <input
            class="speed-slider"
            type="range"
            :min="timeScaleMin"
            :max="timeScaleMax"
            :step="timeScaleStep"
            :value="timeScale"
            @input="$emit('set-timescale', Number($event.target.value))"
          />
          <span class="speed-value">{{ timeScale }}x</span>
        </label>
      </div>

      <div class="controls-row">
        <div class="controls-left">
          <button class="ctrl-btn" @click="$emit('toggle-play')">
            {{ isPlaying ? '⏸' : '▶' }}
          </button>
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
  flex-direction: column;
  align-items: stretch;
  padding: 10px 18px 8px;
  background: linear-gradient(180deg, rgba(8, 10, 22, 0.72), rgba(5, 7, 14, 0.94));
  border-top: 1px solid rgba(79, 195, 247, 0.22);
  box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.35);
  font-size: 13px;
  gap: 8px;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
  gap: 12px;
}

.controls-left,
.controls-center,
.controls-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.controls-center {
  justify-content: center;
  width: 100%;
}
.controls-right {
  justify-content: flex-end;
  min-width: 0;
  overflow: hidden;
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
  min-width: 0;
}

input[type='range'] {
  accent-color: #4fc3f7;
  width: 100%;
  appearance: none;
  background: transparent;
}

.speed-control {
  width: 100%;
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr) 128px;
  align-items: center;
  gap: 16px;
  padding: 10px 18px;
  border: 1px solid rgba(79, 195, 247, 0.3);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(12, 24, 44, 0.92), rgba(7, 12, 24, 0.88)),
    rgba(9, 16, 30, 0.9);
  box-shadow:
    0 0 22px rgba(79, 195, 247, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}
.speed-title {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.speed-value {
  color: #4fc3f7;
  font-family: monospace;
  font-weight: 700;
  text-align: right;
  font-size: 14px;
}
.speed-slider {
  width: 100%;
  height: 32px;
  cursor: pointer;
  min-width: 0;
}
.speed-slider::-webkit-slider-runnable-track {
  height: 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.16);
  background:
    linear-gradient(90deg, rgba(79,195,247,0.8), rgba(255,232,150,0.95)),
    rgba(255,255,255,0.08);
  box-shadow: inset 0 0 10px rgba(0,0,0,0.35);
}
.speed-slider::-webkit-slider-thumb {
  appearance: none;
  width: 30px;
  height: 30px;
  margin-top: -10px;
  border-radius: 50%;
  border: 2px solid #dff7ff;
  background: #4fc3f7;
  box-shadow:
    0 0 18px rgba(79, 195, 247, 0.95),
    0 2px 8px rgba(0,0,0,0.45);
}
.speed-slider::-moz-range-track {
  height: 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.16);
  background:
    linear-gradient(90deg, rgba(79,195,247,0.8), rgba(255,232,150,0.95)),
    rgba(255,255,255,0.08);
}
.speed-slider::-moz-range-thumb {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid #dff7ff;
  background: #4fc3f7;
  box-shadow: 0 0 16px rgba(79, 195, 247, 0.8);
}

.info {
  color: #666;
}
</style>
