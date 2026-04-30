<template>
  <div class="sketch-wrapper">
    <canvas ref="canvasRef" class="sketch-canvas"></canvas>

    <!-- Settings panel lives here so it's available to every sketch -->
    <slot name="settings" />

    <div class="controls">
      <div class="controls-center">
        <div class="speed-display">
          <span class="speed-label">SPEED</span>
          <div class="speed-track-wrap">
            <div class="speed-track">
              <div
                class="speed-fill"
                :style="{ width: fillPct + '%' }"
              ></div>
              <div
                class="speed-thumb"
                :style="{ left: fillPct + '%' }"
              ></div>
              <div
                v-for="(step, i) in STEPS"
                :key="i"
                class="speed-node"
                :class="{ active: isActiveStep(i) }"
                :style="{ left: stepPct(i) + '%' }"
              ></div>
            </div>
            <div class="speed-labels">
              <span
                v-for="(step, i) in STEPS"
                :key="i"
                class="speed-step-label"
                :class="{ active: isActiveStep(i) }"
                :style="{ left: stepPct(i) + '%' }"
              >{{ step.label }}</span>
            </div>
          </div>
          <span class="speed-value">{{ formatSpeed(timeScale) }}</span>
        </div>
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
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  isPlaying:     { type: Boolean, default: true },
  timeScale:     { type: Number,  default: 1 },
  timeScaleMin:  { type: Number,  default: 0 },
  timeScaleMax:  { type: Number,  default: 5000000 },
  timeScaleStep: { type: Number,  default: 1 },
  bodyCount:     { type: Number,  default: 0 },
  elapsed:       { type: Number,  default: 0 },
  elapsedLabel:  { type: String,  default: '' },
})

const emit = defineEmits(['toggle-play', 'set-timescale', 'reset', 'canvas-ready'])

const canvasRef = ref(null)
defineExpose({ canvasRef })

onMounted(() => emit('canvas-ready', canvasRef.value))

// The four fixed steps — mirrors TIME_STEPS in the sketch
const STEPS = [
  { value: 1,       label: '1×'    },
  { value: 100000,  label: '100K×' },
  { value: 1000000, label: '1M×'   },
  { value: 5000000, label: '5M×'   },
]

// All four steps use log scale across the full track width
function stepPct(i) {
  const logMin = Math.log(STEPS[0].value)
  const logMax = Math.log(STEPS[STEPS.length - 1].value)
  return (Math.log(STEPS[i].value) - logMin) / (logMax - logMin) * 100
}

// Current animated timescale mapped to track position (log scale).
const fillPct = computed(() => {
  const ts = Math.max(1, props.timeScale)
  const logMin = Math.log(STEPS[0].value)
  const logMax = Math.log(STEPS[STEPS.length - 1].value)
  const t = (Math.log(Math.min(ts, STEPS[STEPS.length - 1].value)) - logMin) / (logMax - logMin)
  return t * 100
})

function isActiveStep(i) {
  const ratio = props.timeScale / STEPS[i].value
  return ratio > 0.85 && ratio < 1.15
}

function formatSpeed(ts) {
  if (ts <= 1) return '1×'
  if (ts >= 1e6) return (ts / 1e6).toFixed(ts >= 1e7 ? 0 : 1) + 'M×'
  if (ts >= 1e3) return Math.round(ts / 1e3) + 'K×'
  return Math.round(ts) + '×'
}
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

.info {
  color: #666;
}

/* ── Speed display ── */
.speed-display {
  width: 100%;
  display: grid;
  grid-template-columns: 56px 1fr 88px;
  align-items: center;
  gap: 18px;
  padding: 10px 18px;
  border: 1px solid rgba(79, 195, 247, 0.22);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(12, 24, 44, 0.92), rgba(7, 12, 24, 0.88));
  box-shadow:
    0 0 22px rgba(79, 195, 247, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.speed-label {
  color: rgba(255, 255, 255, 0.45);
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.speed-value {
  color: #4fc3f7;
  font-family: monospace;
  font-weight: 700;
  text-align: right;
  font-size: 14px;
  letter-spacing: 0.04em;
}

/* Track wrapper + labels below */
.speed-track-wrap {
  position: relative;
  padding-bottom: 18px; /* space for labels */
}

.speed-track {
  position: relative;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.speed-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(79, 195, 247, 0.5), rgba(79, 195, 247, 0.9));
  transition: width 0.05s linear;
  pointer-events: none;
}

/* Animated glowing thumb */
.speed-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #4fc3f7;
  border: 2px solid #dff7ff;
  box-shadow:
    0 0 10px rgba(79, 195, 247, 0.9),
    0 0 24px rgba(79, 195, 247, 0.5);
  transition: left 0.05s linear;
  pointer-events: none;
}

/* Step nodes — small diamond ticks */
.speed-node {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%) rotate(45deg);
  width: 7px;
  height: 7px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.25);
  transition: background 0.2s, box-shadow 0.2s;
  pointer-events: none;
}
.speed-node.active {
  background: #4fc3f7;
  border-color: #dff7ff;
  box-shadow: 0 0 8px rgba(79, 195, 247, 0.8);
}

/* Step labels */
.speed-labels {
  position: absolute;
  top: 14px;
  left: 0;
  right: 0;
  height: 16px;
}
.speed-step-label {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  font-family: monospace;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
  transition: color 0.2s;
  pointer-events: none;
  user-select: none;
}
.speed-step-label.active {
  color: #4fc3f7;
}
</style>
