<template>
  <div class="app">
    <header class="app-header">
      <router-link to="/" class="app-title">Galaxy Pool</router-link>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

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
  text-decoration: none;
  text-transform: uppercase;
}
.app-title:hover { color: #81d4fa; }

.app-main {
  flex: 1 1 auto;
  overflow: hidden;
}
</style>
