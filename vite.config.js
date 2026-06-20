import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    // Pure engine modules are plain JS with no DOM, so the node environment is
    // enough and faster than jsdom.
    environment: 'node',
    include: ['src/**/*.{test,spec}.js'],
  },
})
