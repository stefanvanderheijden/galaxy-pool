<template>
  <div class="settings-panel">
    <!-- Toggle button -->
    <button class="settings-toggle" :class="{ active: open }" @click="open = !open">
      ⚙ Settings
    </button>

    <!-- Panel -->
    <div v-if="open" class="panel">
      <div class="panel-inner">

        <slot />

        <div class="panel-footer">
          <button class="footer-btn export-btn" @click="$emit('export')">
            ↓ Export settings
          </button>
          <label class="footer-btn import-btn">
            ↑ Import settings
            <input type="file" accept=".json" class="file-input" @change="onFileChange" />
          </label>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['export', 'import'])

const open = ref(false)

function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result)
      emit('import', parsed)
    } catch {
      console.warn('Invalid settings JSON')
    }
    // Reset input so the same file can be re-imported
    e.target.value = ''
  }
  reader.readAsText(file)
}
</script>

<style scoped>
.settings-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
  font-family: monospace;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.settings-toggle {
  background: rgba(15, 15, 30, 0.9);
  color: #aaa;
  border: 1px solid #2a2a4a;
  border-radius: 4px;
  padding: 5px 12px;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
  letter-spacing: 0.05em;
}
.settings-toggle:hover,
.settings-toggle.active {
  background: rgba(26, 26, 60, 0.95);
  color: #e0e0e0;
  border-color: #4fc3f7;
}

.panel {
  margin-top: 4px;
  background: rgba(10, 10, 22, 0.96);
  border: 1px solid #2a2a4a;
  border-radius: 6px;
  width: 260px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
}

.panel-inner {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #2a2a4a transparent;
}

.panel-footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid #1e1e3a;
}

.footer-btn {
  display: block;
  width: 100%;
  padding: 6px 10px;
  text-align: center;
  border-radius: 4px;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
  border: 1px solid #333;
  background: #111128;
  color: #aaa;
  transition: background 0.15s, color 0.15s;
}
.footer-btn:hover { background: #1a1a40; color: #e0e0e0; }

.export-btn { border-color: #2a4a2a; color: #7bc87b; }
.export-btn:hover { background: #0f2010; color: #a5d6a7; }

.import-btn { border-color: #2a3a4a; color: #7bafd6; }
.import-btn:hover { background: #0f1a28; color: #4fc3f7; }

.file-input {
  display: none;
}
</style>
