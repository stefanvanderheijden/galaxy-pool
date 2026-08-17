<template>
  <div class="app">
    <header class="app-header">
      <RouterLink to="/" class="app-title">Galaxy Pool</RouterLink>
      <span v-if="current" class="app-crumb">
        <span class="sep">/</span>
        <span class="crumb-id">{{ current.id }}</span>
        <span class="crumb-name">{{ current.name }}</span>
      </span>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { sketchById } from './sketches/registry.js'

const route = useRoute()
const current = computed(() =>
  route.name === 'sketch' ? sketchById(String(route.params.id)) : null,
)
</script>

<style>
.app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.app-header {
  flex: 0 0 auto;
  padding: 8px 16px;
  border-bottom: 1px solid #1a1a2e;
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-title {
  font-size: 0.9rem;
  letter-spacing: 0.15em;
  color: #4fc3f7;
  text-decoration: none;
  text-transform: uppercase;
}
.app-title:hover {
  color: #81d4fa;
}

.app-crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
}
.app-crumb .sep {
  color: #2c3550;
}
.crumb-id {
  color: #445;
}
.crumb-name {
  color: #8aa;
  text-transform: uppercase;
}

.app-main {
  flex: 1 1 auto;
  overflow: hidden;
}
</style>
