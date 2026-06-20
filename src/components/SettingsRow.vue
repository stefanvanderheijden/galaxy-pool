<template>
  <div class="row">
    <div class="row-header">
      <span class="row-label">
        {{ label }}
        <button v-if="tooltip" class="info-btn" title="More info" @click.stop="modalOpen = true">
          i
        </button>
      </span>
      <span class="row-value">{{ displayValue }}</span>
    </div>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="$emit('update:modelValue', Number($event.target.value))"
    />

    <!-- Modal: rendered inline, positioned fixed so it escapes the panel -->
    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
      <div class="modal-box">
        <div class="modal-title">{{ label }}</div>
        <div class="modal-body">{{ tooltip }}</div>
        <button class="modal-close" @click="modalOpen = false">Close</button>
      </div>
    </div>
  </div>
</template>

<script>
export default { inheritAttrs: false }
</script>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 1 },
  step: { type: Number, default: 0.01 },
  decimals: { type: Number, default: 2 },
  tooltip: { type: String, default: '' },
})

defineEmits(['update:modelValue'])

const modalOpen = ref(false)
const displayValue = computed(() => props.modelValue.toFixed(props.decimals))
</script>

<style scoped>
.row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.row-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.row-label {
  color: #99a;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.row-value {
  color: #4fc3f7;
  font-size: 11px;
  min-width: 36px;
  text-align: right;
}

.info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #4a5a6a;
  background: #151530;
  color: #7bafd6;
  font-size: 9px;
  font-style: italic;
  font-family: serif;
  font-weight: bold;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}
.info-btn:hover {
  border-color: #4fc3f7;
  color: #4fc3f7;
  background: #0d1a2a;
}

input[type='range'] {
  width: 100%;
  accent-color: #4fc3f7;
  cursor: pointer;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-box {
  background: #0d0d1e;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 20px 24px;
  max-width: 320px;
  width: 90%;
  font-family: monospace;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7);
}

.modal-title {
  font-size: 13px;
  color: #4fc3f7;
  margin-bottom: 10px;
  letter-spacing: 0.05em;
}

.modal-body {
  font-size: 12px;
  color: #aab;
  line-height: 1.6;
  margin-bottom: 16px;
}

.modal-close {
  display: block;
  width: 100%;
  padding: 6px;
  background: #111128;
  border: 1px solid #333;
  border-radius: 4px;
  color: #aaa;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
}
.modal-close:hover {
  background: #1a1a40;
  color: #e0e0e0;
}
</style>
