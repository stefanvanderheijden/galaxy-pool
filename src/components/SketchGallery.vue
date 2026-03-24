<template>
  <div class="gallery">
    <h1 class="title">Galaxy Pool</h1>
    <p class="subtitle">Physics prototyping lab</p>

    <ul class="sketch-list">
      <li v-for="sketch in sketches" :key="sketch.id">
        <router-link :to="`/sketch/${sketch.id}`" class="sketch-link">
          <span class="sketch-id">{{ sketch.id }}</span>
          <span class="sketch-name">{{ sketch.name }}</span>
          <span class="sketch-desc">{{ sketch.description }}</span>
        </router-link>
      </li>
    </ul>

    <div class="import-area">
      <label class="import-btn">
        ↑ Load settings file
        <input type="file" accept=".json" class="file-input" @change="onFileChange" />
      </label>
      <p v-if="importError" class="import-error">{{ importError }}</p>
    </div>

    <div class="json-guide">
      <h2 class="guide-title">Settings files</h2>
      <p class="guide-text">
        Each prototype can export its current settings as a <code>.json</code> file via the
        <strong>⚙ Settings → ↓ Export settings</strong> button inside the sketch.
        Save these files to recreate interesting configurations later.
      </p>
      <p class="guide-text">
        To load a saved file: use <strong>↑ Load settings file</strong> above to be redirected
        straight to the matching prototype, or use <strong>↑ Import settings</strong> inside the
        prototype's own settings panel while the sketch is already open.
      </p>
      <p class="guide-text">
        Each file is tied to a specific prototype via its <code>prototypeId</code> field —
        a file exported from <code>002</code> can only be imported into <code>002</code>.
      </p>
      <details class="guide-example">
        <summary>Example file structure</summary>
        <pre class="guide-pre">{{ exampleJson }}</pre>
      </details>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const importError = ref(null)

const sketches = [
  {
    id: '001',
    name: 'Basic Gravity',
    description: 'Sun at center with orbiting planets.',
  },
  {
    id: '002',
    name: 'Black Hole',
    description: 'Sun and black hole with influence region. Watch planets get captured.',
  },
  {
    id: '003',
    name: 'Spaceship',
    description: 'Fly a ship through the solar system. Arrow keys to thrust and rotate.',
  },
  {
    id: '004',
    name: 'Pool',
    description: 'Drag and release planets like pool balls. Gravity does the rest.',
  },
  {
    id: '005',
    name: 'Solar System',
    description: 'Real-scale solar system. Arrow keys to fly. Scroll to zoom, drag to pan.',
  },
  {
    id: '006',
    name: 'Orbit Shot',
    description: 'Fly into a planet\'s orbit ring to dock, then drag to aim and launch the planet like a pool shot.',
  },
]

const exampleJson = `{
  "prototypeId": "002",
  "settings": {
    "sim":       { "baseSpeed": 1.5 },
    "sun":       { "mass": 10000 },
    "blackhole": { "mass": 12000, "influenceRadius": 350, "captureRadius": 40 },
    "physics":   { "gravity": 0.5, "restitution": 0.9 },
    "visuals":   { "trailLength": 300 }
  }
}`

function onFileChange(e) {
  importError.value = null
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result)
      const id = parsed?.prototypeId
      if (!id) {
        importError.value = 'Invalid file: missing prototypeId.'
        return
      }
      const exists = sketches.find(s => s.id === id)
      if (!exists) {
        importError.value = `No prototype found for id "${id}".`
        return
      }
      // Pass settings as route state so the sketch can pick them up on mount
      router.push({ path: `/sketch/${id}`, state: { importedSettings: parsed } })
    } catch {
      importError.value = 'Could not parse JSON file.'
    }
    e.target.value = ''
  }
  reader.readAsText(file)
}
</script>

<style scoped>
.gallery {
  max-width: 640px;
  margin: 60px auto;
  padding: 0 24px;
}

.title {
  font-size: 2rem;
  font-weight: normal;
  letter-spacing: 0.1em;
  color: #e0e0e0;
  margin-bottom: 4px;
}

.subtitle {
  color: #555;
  margin-bottom: 48px;
  font-size: 0.9rem;
}

.sketch-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 48px;
}

.sketch-link {
  display: grid;
  grid-template-columns: 3rem 12rem 1fr;
  gap: 12px;
  align-items: baseline;
  padding: 10px 12px;
  border-radius: 4px;
  text-decoration: none;
  color: #e0e0e0;
  transition: background 0.15s;
}
.sketch-link:hover { background: #111122; }

.sketch-id   { color: #444; font-size: 0.85rem; }
.sketch-name { color: #4fc3f7; }
.sketch-desc { color: #666; font-size: 0.85rem; }

.import-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 48px;
}

.import-btn {
  display: inline-block;
  padding: 7px 16px;
  border: 1px solid #2a3a4a;
  border-radius: 4px;
  color: #7bafd6;
  background: #0a0a18;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
  transition: background 0.15s, color 0.15s;
}
.import-btn:hover { background: #0f1a28; color: #4fc3f7; }

.file-input { display: none; }

.import-error {
  color: #e57373;
  font-size: 12px;
}

.json-guide {
  border-top: 1px solid #1a1a2e;
  padding-top: 32px;
}

.guide-title {
  font-size: 0.85rem;
  font-weight: normal;
  letter-spacing: 0.08em;
  color: #555;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.guide-text {
  font-size: 0.85rem;
  color: #556;
  line-height: 1.7;
  margin-bottom: 12px;
}

.guide-text code {
  font-family: monospace;
  color: #4fc3f7;
  background: #0a0a18;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.9em;
}

.guide-text strong {
  color: #778;
}

.guide-example {
  margin-top: 16px;
}

.guide-example summary {
  font-size: 0.8rem;
  color: #445;
  cursor: pointer;
  user-select: none;
  font-family: monospace;
}
.guide-example summary:hover { color: #667; }

.guide-pre {
  margin-top: 10px;
  background: #080810;
  border: 1px solid #1a1a2e;
  border-radius: 4px;
  padding: 12px 14px;
  font-family: monospace;
  font-size: 11px;
  color: #556;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
}
</style>
