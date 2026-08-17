<template>
  <div class="sketch-view">
    <component :is="sketchComponent" v-if="sketchComponent" :key="route.params.id" />
    <div v-else class="not-found">
      <span>No sketch “{{ route.params.id }}”.</span>
      <RouterLink to="/">← Back to the lab</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { shallowRef, watch, defineAsyncComponent } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { loadSketch } from '../sketches/registry.js'

const route = useRoute()
const sketchComponent = shallowRef(null)

// `key` on the <component> forces a full unmount/remount when the id changes, so
// a sketch's rAF loop and listeners are torn down by its own onUnmounted hook
// before the next one starts.
function mount(id) {
  const loader = loadSketch(id)
  sketchComponent.value = loader ? defineAsyncComponent(loader) : null
}

mount(route.params.id)
watch(() => route.params.id, mount)
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
  gap: 12px;
  color: #556;
}
.not-found a {
  color: #4fc3f7;
}
</style>
