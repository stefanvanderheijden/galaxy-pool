import { createRouter, createWebHistory } from 'vue-router'
import SketchGallery from '../components/SketchGallery.vue'

// Deep links like /sketch/002 are served by the SPA fallback in public/_redirects
// (Cloudflare Pages); the Vite dev server and `vite preview` do it themselves.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'gallery', component: SketchGallery },
    {
      path: '/sketch/:id',
      name: 'sketch',
      component: () => import('../views/SketchView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
