# Galaxy Pool — Development Log

A running record of what's been built and what's in progress. The game itself is
described in [readme.md](readme.md); this file is the "what we did / what we're
building" notebook for continuing work.

---

## What this is

Cosmic pool, prototyped several ways. One hand-written n-body gravity sim on
Canvas 2D, Vue 3 `<script setup>` + Vite, and a set of **sketches** — separate
game modes sharing one engine. The homepage lists them; each lives at
`/sketch/<id>`.

- **001 Ship Pool** — the original mode: fly a ship, dock a planet, shoot it into
  the black hole (each = +1; losing one to the sun = −1).
- **002 Planet Pool** — no ship: drag planets directly, and pocketing is the only
  income.

Pure math lives in unit-tested modules under `src/engine/`; each sketch's Vue
file holds its state, input and canvas draw functions.

---

## Built so far (this work stream)

### Steering

- **Drift steering** points the nose along the **direction of travel**, not the
  thrust vector (lateral thrust comes from side thrusters), while the plume still
  vents along the actual thrust direction.

### Gas cloud

- Reworked from a point into a **line/capsule**: a spine between two endpoints
  with a width radius; drag/density is distance-to-segment. Stronger drag, more
  cloud-like (puffs strung along the spine).

### Fog of war (grid model)

- Sparse **grid of cells in absolute sim space**. The ship's **vision** circle
  permanently flips overlapped cells to "seen"; unseen cells render solid black
  over the world. Cells stay revealed forever.
- A translucent **Hubble backdrop** (with pronounced parallax) sits over the black
  base so "seen" space reads differently from fog.
- Trails and bodies are drawn normally; the fog grid is painted **on top**, so it
  hides exactly the unexplored parts.

### Radar (separate, sim-time)

- A rotating **scan line** (advances in sim time, calibrated to look right at
  1,000,000× speed — so it speeds up / slows / freezes with the sim). When it
  crosses a body, that body is **detected** and tracked through the fog as a dot.
- **Blink** on every sweep hit: a double-blink on first acquisition, a single
  ping after.
- Planets, the **sun**, and the **black hole** are all radar contacts.

### First-contact observation

- Approaching a new body runs a **4-second (@1Mx) "Observing Unknown Celestial
  Body"** scan animation before its identity unlocks. Only when it completes does
  the name + detail readout appear — and only then can you dock it. Leaving range
  mid-scan resets the counter.

### Three-layer rendering model

- **Vision layer** = a plain planet dot + its trail (clipped by fog).
- **Radar layer** = a contact dot/name + the ship's and the targeted planet's
  projected paths, drawn **above** the fog (digital "onboard computer" data).
- A planet's **name/colour** is appended to the radar layer only once it's been
  **scanned** (detail HUD shown).

### HUD (retro cockpit aesthetic)

- A physical "screen" bezel (double border, corner brackets, CRT scanlines).
- The **captain HUD** (bottom-right) is a fixed screen with folded-in telemetry
  (scores, speed, sun distance); dark "NO CONTACT" when idle.
- A **minimal energy HUD** (left): thin energy bar + small solar dial, with a live
  **shot power-draw preview** that caps at stored energy.
- A **Help** modal (the `? Help` button) with a full how-to-play walkthrough.

### Scene placement

- Black hole + gas cloud relocated to be clear of all planet orbits and start
  positions. The black hole has a directional **gravity cone**; a planet is only
  consumed if it enters from the cone's open side, otherwise it bounces.

---

## In progress — Level Editor (the big feature)

Goal: create, save, **test-play**, and load levels from `.json`. **Status: core is
built and verified** (placement, auto-orbit, save/load, test-play/stop, free
velocity, projected paths). Polishing.

### Architecture (single source of truth)

- A level is a plain data object, `levelData` (now a Vue `reactive` so editor
  sliders update live). Both editing and gameplay build from it.
- `buildScene()` was refactored to build the scene from `levelData` instead of the
  hardcoded `SOLAR_BODIES`. The hardcoded solar system is now just the **default
  level** (`levelFromSolarBodies()`), so the game boots byte-for-byte as before.
- `BLACK_HOLE` and `GAS_CLOUD` (module consts read in ~30 places) are **mutated in
  place** from `levelData` on every build via `applyLevelHazards()`, so no read
  site needed changes.
- Reassigning `levelData` goes through `setLevel()` (replace contents in place) to
  preserve the reactive proxy.

### Level schema (v1)

`{ version, name, sun{mass,color,drawR}, planets[], ship{...}, blackhole{...},
gascloud{...} }`. Planets/ship store **orbit params** (`orbR`, `angle`) so their
stable circular velocity is **derived** on build (survives mass edits). Planets
may opt into **free** placement (`free:true` + `x,y,vx,vy`) for elliptical/unstable
orbits. `validateLevel()` normalizes + clamps everything and migrates by version.

### Orbit math

- `stableOrbitVelocity(orbR, angle, sunMass)` — `v = sqrt(G_SIM · M_sun / r)`,
  CCW, matching the existing planets exactly (speed depends on the **sun's** mass,
  not the body's; `MIN_ORB_R = 0.05` clamp avoids blow-up near the sun).
- `predictSunOrbit(...)` — cheap **sun-only** trajectory integrator for the editor
  path preview (a circle for stable orbits, ellipse/escape for free ones).

### Editor UX

- Toggle from the bottom control bar (**✎ Editor / ✕ Exit Editor**).
- Tools: **Select / Planet / Ship / Black hole / Gas cloud** (keys V/P/B/C).
  - Planet: click → drops into a stable orbit automatically.
  - Ship: click → sets its start orbit.
  - Black hole: click to place, **drag to aim** its gravity cone.
  - Gas cloud: click + drag to draw its line between two points.
  - Select: drag handles to move; right-drag pans, wheel zooms.
- **Advanced (free velocity)** checkbox → planets get an explicit velocity. A
  **Drag: Move / Drag: Velocity** sub-toggle chooses whether Select-dragging a
  free body repositions it or sets its launch velocity.
- Properties panel (context-sensitive): planet mass + draw radius, black-hole
  direction/half-angle/mass/influence, gas radius, sun mass — all live.
- **New / Solar (reset to default system) / Save .json / Load .json / Delete /
  ▶ Test Play.** During test-play a red **■ Stop** returns to editing.
- Editor overlay draws orbit rings, **projected paths**, velocity arrows, the BH
  cone-direction arrow, the gas line, and selection handles — over the real
  bodies, so it's WYSIWYG.

### Edit ⇄ Test lifecycle

- **Test Play** snapshots `levelData` (deep clone), then `reset()` → full gameplay
  build (fog/radar/scoring all live).
- **Stop** restores the snapshot and rebuilds a fresh, frozen editable scene — so
  test-play never corrupts the design.
- In **edit** mode the sim is frozen (`isPlaying=false`); gameplay input is fully
  suppressed (mouse/keys routed to the editor); fog/radar/gameplay-HUD draws are
  skipped in favour of the editor overlay; the editor owns the camera (per-edit
  rebuilds no longer snap the view).

### Fixed during review

- Camera no longer jumps to the sun when placing a planet (buildScene skips its
  camera reset in editor edit mode).
- Advanced mode: added the Move-vs-Velocity drag toggle (drag used to always move
  position).
- Slider value labels now update live (`levelData` made reactive).
- **Editor/loaded planets are now observable.** Bug: `scanInfoDef()` only looked
  up `info` from the hardcoded `SOLAR_BODIES`, so a custom-id planet (e.g.
  `planet1`) returned no def → `getScannedPlanet()` returned null → it could never
  be observed, named, or docked. Fix: `scanInfoDef()` falls back to a synthesized
  `genericBodyInfo(body)` (classification "Unknown world", diameter/gravity derived
  from the body's own `drawR`/`mass`) for any body without a static def, so every
  custom world is scannable. Built-in planets still use their rich static info.

---

## Sketches restored (multi-mode lab)

The single-game fork was collapsed back into a gallery, on purpose this time: the
point of the repo is prototyping several game modes against one sim.

- `src/sketches/registry.js` is the single source of truth — id, name, tagline,
  description, tags, and the file to load. The homepage (`SketchGallery.vue`) and
  the router both read it, so adding a mode is one file plus one entry.
- Routing is `vue-router` with `createWebHistory`; `public/_redirects` gives
  Cloudflare Pages the SPA fallback so `/sketch/002` survives a refresh.
- `SketchView` keys the mounted component on the route id, so switching sketches
  fully unmounts the previous one (its `onUnmounted` stops the rAF loop and drops
  its listeners).

### Extracted to the shared layer

Driven by what 002 needed that 001 already had:

- **`engine/starfield.js`** — the whole parallax sky (star layers, nebula clouds,
  Hubble backdrop). `createStarfield()` per sketch; `buildStarfieldData()` is pure
  and tested for determinism.
- **`engine/camera.js`** — `createCamera()`: world↔screen, cursor-anchored
  `zoomAt`, eased `tickZoom`, `centerOn`, `panBy`, `worldCenter`, `fitPoints`.
  001 keeps thin free-function aliases (`scale()`, `worldToScreen()`, …) so its
  hundreds of call sites were untouched.
- **`composables/useCanvasLoop.js`** — canvas sizing to the container (minus the
  control bar), `ResizeObserver`, the rAF loop with a clamped real delta, and one
  teardown. A sketch supplies `onResize` and `onFrame` and nothing else.
- **`engine/planets.js`** — `radiusFromMass()` and `deltaVFromShot()`, the two
  bits of math 002 is actually about.

## 002 Planet Pool — design notes

The mode exists to make two independent properties **legible on the field**:

- **Mass → radius.** `radiusFromMass()` defaults to the constant-density cube
  root, so the big planets really are the heavy ones.
- **Yield → segmented ring.** Twelve slots around each planet; a 100-yield planet
  lights them all. Deliberately uncorrelated with mass — Ferrum is the heaviest
  and pays 20, Hollow is the lightest and pays 95 — so size can't be used as a
  proxy for value. Same colour ramp on the ring, the roster and the payout text.

Other decisions:

- **Δv is not `J/m`.** True impulse across a 10× mass spread is unplayable (the
  lightest body rockets away on a pull that barely moves the heaviest), so
  `deltaVFromShot` takes a `massExponent`, default `0.5`. `1` = real physics,
  `0` = classic pool. It's a setting.
- **Energy has one source.** No solar recharge; sinking a planet is the only
  income, and every shot costs from the same bar, capped at what's stored. Zero
  energy with planets left is a real dead end — the hint line says so.
- **Fog is presentation only.** An opening scan expands from the sun in _real_
  time until the level is revealed, then stops being drawn at all. It never hides
  anything from the physics; it only gates grabbing a planet you can't see yet.
- **Camera.** Right-drag pans, wheel zooms, a click on empty space (with a 4px
  slop guard so a stray drag doesn't count) or `Z` re-centres on the sun, `F`
  fits the system.
- Planets don't pull on each other — at these masses it's invisible, and keeping
  them independent means a shot lands where the prediction said it would.

---

## Next / TODO

- Level **name** field in the editor UI (schema already stores `name`; used for the
  save filename).
- Optional: a small in-app **level browser** / built-in sample levels.
- Consider snapping / grid guides while placing.
- Decide whether to surface the editor in the Help modal.
- A couple of unit tests for the pure level functions (`stableOrbitVelocity`,
  `validateLevel`, `predictSunOrbit`) would be cheap and worthwhile — they're
  framework-free and fit the `src/engine/*.test.js` pattern (would need extracting
  to an engine module first).
- 002: planet↔planet collisions would make it much more like real pool (combos,
  cannons). Currently they pass straight through each other.
- 002: the level (planet set, masses, yields, pocket position) is hardcoded in the
  sketch. Worth moving to a level object like 001's, so the editor could target it.
- Extract 001's HUD/bezel/`roundRect` drawing helpers into a shared `engine/hud.js`
  — 002 already re-implements `roundRect` and the colour helpers.

## House rules

- Keep `npm test`, `npm run lint`, and `npm run build` green.
- Pure sim/level math is testable and belongs (eventually) in `src/engine/`; the
  Vue layer stays thin.
- **Share by default.** A sketch should only hold what makes it a different game.
  When a second sketch needs something the first already has, extract it into
  `engine/` or `composables/` instead of copying it.
