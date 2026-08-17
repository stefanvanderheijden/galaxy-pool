<template>
  <div class="gallery">
    <header class="head">
      <h1 class="title">Galaxy Pool</h1>
      <p class="subtitle">Physics prototyping lab — one gravity sim, several game modes.</p>
    </header>

    <ul class="sketch-list">
      <li v-for="sketch in SKETCHES" :key="sketch.id">
        <RouterLink :to="`/sketch/${sketch.id}`" class="card">
          <span class="card-id">{{ sketch.id }}</span>
          <div class="card-body">
            <span class="card-name">{{ sketch.name }}</span>
            <span class="card-tagline">{{ sketch.tagline }}</span>
            <span class="card-desc">{{ sketch.description }}</span>
            <span class="card-tags">
              <span v-for="tag in sketch.tags" :key="tag" class="tag">{{ tag }}</span>
            </span>
          </div>
          <span class="card-go">play →</span>
        </RouterLink>
      </li>
    </ul>

    <section class="shared">
      <h2 class="shared-title">Shared between sketches</h2>
      <p class="shared-text">
        Every mode is a thin sketch on top of one common layer, so a prototype only has to implement
        what makes it different:
      </p>
      <ul class="shared-list">
        <li v-for="part in SHARED_PARTS" :key="part.path">
          <code>{{ part.path }}</code>
          <span>{{ part.what }}</span>
        </li>
      </ul>
      <p class="shared-text">
        Adding a mode: drop <code>src/sketches/NNN-name.vue</code> next to the others and add an
        entry to <code>src/sketches/registry.js</code> — the homepage and the router both read that
        list.
      </p>
    </section>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { SKETCHES } from '../sketches/registry.js'

const SHARED_PARTS = [
  { path: 'components/GameShell.vue', what: 'canvas + play/reset + the time-scale control' },
  { path: 'components/Settings*.vue', what: 'the settings panel, sections and sliders' },
  { path: 'composables/useCanvasLoop.js', what: 'canvas sizing, resize handling, the rAF loop' },
  { path: 'engine/camera.js', what: 'world↔screen, cursor-anchored zoom, framing' },
  { path: 'engine/starfield.js', what: 'the parallax sky (stars, nebula, backdrop)' },
  { path: 'engine/units.js', what: 'AU / solar masses / years, G = 4π²' },
  { path: 'engine/planets.js', what: 'mass → drawn radius, shot → Δv' },
  { path: 'engine/trail.js', what: 'fixed-capacity motion trails' },
]
</script>

<style scoped>
.gallery {
  max-width: 760px;
  margin: 0 auto;
  padding: 56px 24px 80px;
  height: 100%;
  overflow-y: auto;
}

.head {
  margin-bottom: 44px;
}

.title {
  font-size: 2rem;
  font-weight: normal;
  letter-spacing: 0.1em;
  color: #e0e0e0;
  margin-bottom: 6px;
}

.subtitle {
  color: #556;
  font-size: 0.9rem;
}

.sketch-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 56px;
}

.card {
  display: grid;
  grid-template-columns: 3.5rem 1fr auto;
  gap: 16px;
  align-items: start;
  padding: 18px 18px 16px;
  border: 1px solid #1a1a2e;
  border-radius: 6px;
  background: rgba(10, 12, 24, 0.6);
  text-decoration: none;
  color: #e0e0e0;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.card:hover {
  border-color: rgba(79, 195, 247, 0.5);
  background: rgba(14, 22, 40, 0.8);
}

.card-id {
  font-size: 1.5rem;
  color: #2c3550;
  line-height: 1;
  padding-top: 2px;
}
.card:hover .card-id {
  color: #4fc3f7;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.card-name {
  color: #4fc3f7;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
}

.card-tagline {
  color: #b9c2d0;
  font-size: 0.85rem;
}

.card-desc {
  color: #667;
  font-size: 0.8rem;
  line-height: 1.65;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.tag {
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6a7ba0;
  border: 1px solid #22283e;
  border-radius: 999px;
  padding: 2px 9px;
}

.card-go {
  color: #2c3550;
  font-size: 0.8rem;
  padding-top: 6px;
  white-space: nowrap;
}
.card:hover .card-go {
  color: #4fc3f7;
}

.shared {
  border-top: 1px solid #1a1a2e;
  padding-top: 32px;
}

.shared-title {
  font-size: 0.8rem;
  font-weight: normal;
  letter-spacing: 0.12em;
  color: #556;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.shared-text {
  font-size: 0.82rem;
  color: #667;
  line-height: 1.75;
  margin-bottom: 14px;
}

.shared-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.shared-list li {
  display: grid;
  grid-template-columns: 15rem 1fr;
  gap: 12px;
  font-size: 0.78rem;
  color: #556;
}

code {
  font-family: monospace;
  color: #7bafd6;
}
</style>
