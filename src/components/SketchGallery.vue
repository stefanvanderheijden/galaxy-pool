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
  </div>
</template>

<script setup>
const sketches = [
  {
    id: '001',
    name: 'Basic Gravity',
    description: 'A black hole with orbiting planets. Watch them spiral in.',
  },
]
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
</style>
