# Galaxy Pool

A 2D gravity sandbox / spaceship game. Fly a ship through a miniature solar
system, slingshot planets like pool balls into a black hole, and manage solar
energy — all on top of a real n-body gravity simulation rendered to canvas.

Built with **Vue 3** (Composition API, `<script setup>`) and **Vite**. No game
engine — the physics, prediction, and rendering are hand-written against the
Canvas 2D API.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm test` | Run the unit tests (Vitest) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint (`lint:fix` to auto-fix) |
| `npm run format` | Prettier (`format:check` to verify only) |

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Thrust — exact behaviour depends on the steering mode (see below) |
| `Space` | Full retrograde brake (every steering mode) |
| `Q` / `E` | Step time-scale down / up |
| `1`–`4` | Jump to time-scale 1× / 100K× / 1M× / 5M× |
| `Z` / `X` | Focus camera on the sun / the ship |
| `R` | Reset the run |
| Mouse drag | Aim and fire a slingshot shot while docked to a planet |
| Scroll | Zoom |

### Steering modes

Set in **⚙ Settings → Spaceship → Steering**:

- **Tank** — `A`/`D` rotate the ship, `W` thrusts along its heading, `S` brakes.
- **Screen** — `W`/`A`/`S`/`D` thrust up/down/left/right in absolute screen space.
- **Drift** (default) — thrust relative to your direction of travel: `W` prograde
  (speed up), `S` retrograde (brake), `A`/`D` thrust to port / starboard.

## Project layout

```
src/
  Game.vue              The game: state, main loop, input, and canvas rendering
  App.vue               App shell (header + the game)
  main.js               Entry point
  timeSteps.js          Shared time-scale steps (loop + speed control)
  engine/               Pure, framework-free, unit-tested simulation logic
    units.js              Physical constants (G, AU, softening, …)
    rng.js                Seeded PRNG
    trail.js              Fixed-capacity ring buffer for body trails
    vectors.js            Small 2D vector helpers
    steering.js           Tank / Screen / Drift thrust math
  components/           Vue UI (GameShell, Settings panel/section/row)
  composables/          useSettings (import/export + reactive store)
```

The `engine/` modules are plain JavaScript with **no Vue or DOM dependencies**,
so they can be unit-tested in isolation (`src/engine/*.test.js`). The intent is
that the physics and steering math stay testable and the Vue layer stays thin.

## Settings files

Each run's settings can be exported to / imported from a `.json` file via the
settings panel. Files are stamped with an `id` and a `settings` tree; importing
merges known keys and ignores the rest.
