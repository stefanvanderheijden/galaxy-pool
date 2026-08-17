# Galaxy Pool

A physics prototyping lab: one hand-written gravity simulation, several game
modes ("sketches") built on top of it. Planets are pool balls, a black hole is
the pocket, and every mode explores a different way of taking the shot.

Built with **Vue 3** (Composition API, `<script setup>`) and **Vite**. No game
engine — the physics, prediction, and rendering are hand-written against the
Canvas 2D API.

The homepage (`/`) lists the sketches; each one lives at `/sketch/<id>`.

## The sketches

| id    | Sketch          | What it explores                                                                                                                                                                                           |
| ----- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001` | **Ship Pool**   | Fly a ship, dock a planet, shoot it into the black hole. Solar energy, fog of war, radar, first-contact scans, level editor.                                                                               |
| `002` | **Planet Pool** | No ship — drag any planet directly. Energy comes _only_ from pocketing planets; mass is drawn as radius, and each planet's energy yield is drawn as a segmented ring that has nothing to do with its mass. |

Adding one: drop `src/sketches/NNN-name.vue` next to the others and add an entry
to `src/sketches/registry.js`. The homepage and the router both read that list.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script               | What it does                             |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start the Vite dev server                |
| `npm run build`      | Production build to `dist/`              |
| `npm run preview`    | Preview the production build             |
| `npm test`           | Run the unit tests (Vitest)              |
| `npm run test:watch` | Vitest in watch mode                     |
| `npm run lint`       | ESLint (`lint:fix` to auto-fix)          |
| `npm run format`     | Prettier (`format:check` to verify only) |

## Controls — 001 Ship Pool

| Key             | Action                                                            |
| --------------- | ----------------------------------------------------------------- |
| `W` `A` `S` `D` | Thrust — exact behaviour depends on the steering mode (see below) |
| `Space`         | Full retrograde brake (every steering mode)                       |
| `Q` / `E`       | Step time-scale down / up                                         |
| `1`–`4`         | Jump to time-scale 1× / 100K× / 1M× / 5M×                         |
| `Z` / `X`       | Focus camera on the sun / the ship                                |
| `R`             | Reset the run                                                     |
| Mouse drag      | Aim and fire a slingshot shot while docked to a planet            |
| Scroll          | Zoom                                                              |

## Controls — 002 Planet Pool

| Input                   | Action                                       |
| ----------------------- | -------------------------------------------- |
| Left-drag a planet      | Pull back and release to fire it, pool-style |
| `Esc`                   | Cancel the shot in progress                  |
| Right-drag              | Pan the view                                 |
| Click empty space / `Z` | Re-centre on the sun                         |
| `F`                     | Fit the whole system on screen               |
| Scroll                  | Zoom                                         |
| `Q` / `E`, `1`–`4`      | Time-scale                                   |
| `R`                     | Reset the run                                |

The level opens with a scan that expands out from the sun until the whole system
is revealed; after that the fog is gone for good.

## Level editor

The **✎ Editor** button (bottom control bar) opens a level editor: place planets
(auto-set into stable orbits), the ship, the black hole (drag to aim its gravity
cone), and a gas cloud (drag a line between two points). Edit masses and the
black-hole direction, then **Test Play** the level and **Stop** to keep editing.
**Save / Load** levels as `.json`. An _Advanced_ mode allows free initial
velocities (elliptical / unstable orbits) with a live projected-path preview.

See [DEVLOG.md](DEVLOG.md) for the full design notes and status.

### Steering modes

Set in **⚙ Settings → Spaceship → Steering**:

- **Tank** — `A`/`D` rotate the ship, `W` thrusts along its heading, `S` brakes.
- **Screen** — `W`/`A`/`S`/`D` thrust up/down/left/right in absolute screen space.
- **Drift** (default) — thrust relative to your direction of travel: `W` prograde
  (speed up), `S` retrograde (brake), `A`/`D` thrust to port / starboard.

## Project layout

```
src/
  App.vue               App shell (header + router view)
  main.js               Entry point
  router/index.js       Routes: / (gallery) and /sketch/:id
  timeSteps.js          Shared time-scale steps (loop + speed control)
  sketches/             One file per game mode
    registry.js           The list the gallery and the router both read
    001-ship-pool.vue     Ship + docking + solar energy + fog of war + editor
    002-planet-pool.vue   Direct planet dragging + yield economy
  views/SketchView.vue  Resolves :id to a sketch and mounts it
  engine/               Pure, framework-free, unit-tested logic
    units.js              Physical constants (G, AU, softening, …)
    camera.js             World↔screen, cursor-anchored zoom, framing
    starfield.js          The parallax sky (stars, nebula, photo backdrop)
    planets.js            mass → drawn radius, shot → Δv
    rng.js                Seeded PRNG
    trail.js              Fixed-capacity ring buffer for body trails
    steering.js           Tank / Screen / Drift thrust math
  components/           Vue UI (GameShell, SketchGallery, Settings panel/…)
  composables/
    useSettings.js        Reactive settings store + import/export
    useCanvasLoop.js      Canvas sizing, resize handling, the rAF loop
```

The `engine/` modules are plain JavaScript with **no Vue or DOM dependencies**,
so they can be unit-tested in isolation (`src/engine/*.test.js`). The intent is
that the physics and steering math stay testable and the Vue layer stays thin.

### What sketches share

A sketch should only contain what makes it different. Everything else already
exists: `GameShell` (canvas, play/reset, time-scale control), the settings panel,
`useCanvasLoop` (sizing + rAF), `engine/camera`, `engine/starfield`,
`engine/units`, `engine/planets`, `engine/trail`. Reach for those first, and when
a second sketch needs something a first one already has, extract it into
`engine/` or `composables/` rather than copying it.

## Deploying

Cloudflare Pages builds `npm run build` → `dist/`. `public/_redirects` ships the
SPA fallback (`/* /index.html 200`) so `/sketch/002` survives a refresh or a
shared deep link.

## Settings files

Each run's settings can be exported to / imported from a `.json` file via the
settings panel. Files are stamped with an `id` and a `settings` tree; importing
merges known keys and ignores the rest.

## Hyperwarp feel rig

The hyperwarp branch prototype lives at [/hyperwarp.html](public/hyperwarp.html):
a standalone canvas rig, no build step, served verbatim from `public/`. The master
copy is `Reference/mockups/hyperwarp.html` in the Unity repo; this one is the
published mirror and is overwritten from there.
