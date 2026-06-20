<template>
  <div class="section">
    <div class="section-title">{{ title }}</div>
    <div class="section-rows">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({ title: { type: String, default: '' } })
</script>

<style scoped>
.section-title {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #445;
  margin-bottom: 8px;
}

.section-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
