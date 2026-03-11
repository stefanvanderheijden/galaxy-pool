<template>
  <div class="sketch-view">
    <component :is="sketchComponent" v-if="sketchComponent" />
    <div v-else class="not-found">
      Sketch "{{ route.params.id }}" not found. <router-link to="/">← Gallery</router-link>
    </div>
  </div>
</template>

<script setup>
import { shallowRef, watch, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { resolveSketch } from '../router/index.js'

const route = useRoute()
const sketchComponent = shallowRef(null)

function loadSketch(id) {
  const loader = resolveSketch(id)
  if (!loader) {
    sketchComponent.value = null
    return
  }
  sketchComponent.value = defineAsyncComponent(loader)
}

loadSketch(route.params.id)
watch(() => route.params.id, loadSketch)
</script>

<style scoped>
.sketch-view {
  width: 100%;
  height: 100%;
}

.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #555;
  gap: 12px;
}
.not-found a { color: #4fc3f7; }
</style>
