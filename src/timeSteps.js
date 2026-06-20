// Canonical time-scale steps, shared by the game loop (Game.vue) and the speed
// control (GameShell.vue) so the two never drift apart.
//
// `value` is the simulation multiplier; `label` is what the speed control shows.
export const TIME_STEPS = [
  { value: 1, label: '1×' },
  { value: 100000, label: '100K×' },
  { value: 1000000, label: '1M×' },
  { value: 5000000, label: '5M×' },
]

// Just the numeric multipliers, for code that only needs the values.
export const TIME_STEP_VALUES = TIME_STEPS.map((s) => s.value)
