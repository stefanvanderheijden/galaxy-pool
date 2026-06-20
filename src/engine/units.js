// Unit system: AU (astronomical unit), Solar masses, Julian years.
//
// In these units gravity's constant G = 4π² — it falls straight out of Kepler's
// third law (T² = a³ for a one-solar-mass primary), which keeps planet periods
// and orbital velocities physically sensible without any fudge factor.
export const G_SIM = 4 * Math.PI * Math.PI // ~39.478 AU³ / (M☉ · yr²)

// Softening term added to r² in the gravity kernel so close passes don't blow up
// to infinite force (a standard n-body singularity guard).
export const SOFTENING = 1e-5 // AU²

// Conversion for display labels and deriving the ship's physical size.
export const AU_KM = 1.496e8 // km per AU

// Seconds in a Julian year — converts real frame time to simulation years.
export const SECONDS_PER_YEAR = 365.25 * 24 * 3600

// --- Rendering / loop tunables (not part of the physical unit system) ---

export const PX_PER_AU = 100 // pixels per AU at zoom = 1
export const MAX_DT = 0.05 // real-time seconds cap per frame
