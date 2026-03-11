import { reactive, watch } from 'vue'

/**
 * Central settings store for a sketch.
 * Each sketch defines its own defaults; this composable handles
 * export/import and merges safely (unknown keys are ignored on import,
 * missing keys fall back to defaults).
 *
 * @param {string} prototypeId  - e.g. '001'
 * @param {object} defaults     - flat or sectioned object of default values
 * @returns {{ settings, exportJSON, importJSON }}
 */
export function useSettings(prototypeId, defaults) {
  const settings = reactive(deepClone(defaults))

  /**
   * Export current settings as a JSON string (triggers download).
   */
  function exportJSON() {
    const payload = {
      prototypeId,
      settings: deepClone(settings),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `galaxy-pool-${prototypeId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Apply settings from a parsed JSON object.
   * Unknown keys in the JSON are silently ignored.
   * Missing keys keep their current (default) value.
   * @param {object} parsed - the full JSON payload ({ prototypeId, settings })
   * @returns {string} the prototypeId found in the JSON (so caller can route)
   */
  function importJSON(parsed) {
    const incoming = parsed?.settings ?? {}
    mergeInto(settings, incoming)
    return parsed?.prototypeId ?? null
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
