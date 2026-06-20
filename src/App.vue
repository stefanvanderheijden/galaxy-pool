<template>
  <div class="app">
    <header class="app-header">
      <span class="app-title">Galaxy Pool</span>
    </header>
    <main class="app-main">
      <Game />
    </main>
  </div>
</template>

<script setup>
import Game from './Game.vue'
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
}

.app-title {
  font-size: 0.9rem;
  letter-spacing: 0.15em;
  color: #4fc3f7;
  text-transform: uppercase;
}

.app-main {
  flex: 1 1 auto;
  overflow: hidden;
}
</style>
