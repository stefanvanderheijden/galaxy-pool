import { reactive } from 'vue'

/**
 * Central settings store for the game.
 * The caller defines defaults; this composable handles export/import and
 * merges safely (unknown keys are ignored on import, missing keys fall back
 * to defaults).
 *
 * @param {string} id        - identifier stamped into exported files (e.g. 'galaxy-pool')
 * @param {object} defaults  - flat or sectioned object of default values
 * @returns {{ settings, exportJSON, importJSON }}
 */
export function useSettings(id, defaults) {
  const settings = reactive(deepClone(defaults))

  /**
   * Export current settings as a JSON file (triggers download).
   */
  function exportJSON() {
    const payload = {
      id,
      settings: deepClone(settings),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Apply settings from a parsed JSON object.
   * Unknown keys in the JSON are silently ignored.
   * Missing keys keep their current (default) value.
   * @param {object} parsed - the full JSON payload ({ id, settings })
   */
  function importJSON(parsed) {
    const incoming = parsed?.settings ?? {}
    mergeInto(settings, incoming)
  }

  return { settings, exportJSON, importJSON }
}

// --- helpers ---

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Recursively merge `src` into `dst`, touching only keys that exist in `dst`.
 * Values in `src` that don't exist in `dst` are ignored.
 */
function mergeInto(dst, src) {
  for (const key of Object.keys(dst)) {
    if (!(key in src)) continue
    if (typeof dst[key] === 'object' && dst[key] !== null && !Array.isArray(dst[key])) {
      mergeInto(dst[key], src[key])
    } else {
      dst[key] = src[key]
    }
  }
}
