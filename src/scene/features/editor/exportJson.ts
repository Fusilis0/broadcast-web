import type { WorldFeature } from '../types.ts'

/** Download wrapper for V1 authoring (not RaceProject / GeoJSON). */
export type WorldFeaturesExport = {
  features: WorldFeature[]
}

/** Serialize current WorldFeature list for download. */
export function serializeWorldFeaturesExport(
  features: readonly WorldFeature[],
): string {
  const body: WorldFeaturesExport = {
    features: features.map((f) => ({
      ...f,
      points: f.points.map((p) => ({ ...p })),
    })),
  }
  return `${JSON.stringify(body, null, 2)}\n`
}

/** Trigger browser download of `world-features.json`. */
export function downloadWorldFeaturesJson(
  features: readonly WorldFeature[],
  filename = 'world-features.json',
): void {
  const text = serializeWorldFeaturesExport(features)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
