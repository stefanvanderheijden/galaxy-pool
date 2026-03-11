import { createRouter, createWebHistory } from 'vue-router'
import SketchGallery from '../components/SketchGallery.vue'

/**
 * Glob all sketch files. Vite resolves these at build time.
 * Keys look like: '../sketches/001-basic-gravity.vue'
 */
const sketchModules = import.meta.glob('../sketches/*.vue')

/**
 * Given a sketch id like '001', find and return the dynamic import function.
 * @param {string} id
 * @returns {function|null}
 */
function resolveSketch(id) {
  const key = Object.keys(sketchModules).find(k => {
    const filename = k.split('/').pop()
    return filename.startsWith(id + '-') || filename === id + '.vue'
  })
  return key ? sketchModules[key] : null
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: SketchGallery,
    },
    {
      path: '/sketch/:id',
      component: () => import('../views/SketchView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export { resolveSketch }
export default router
