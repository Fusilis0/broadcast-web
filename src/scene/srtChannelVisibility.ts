/**
 * Per-SRT-channel layer presets (Phase 22.4c).
 * AR and 3D keep independent copies so both plates can publish at once
 * (3D meshes + AR tags). Authoring visible3d / mesh / tag still AND.
 */

import type { Object3D } from 'three'

export type SrtVisibilityChannel = 'ar' | '3d'

export const SRT_CHANNEL_LAYER_KEYS = [
  'boatModel',
  'boatTag',
  'boatHeadingArrow',
  'buoyModel',
  'buoyTag',
  'buoyRoundingArrows',
  'sponsors',
  'billboards',
  'startFinish',
] as const

export type SrtChannelLayerKey = (typeof SRT_CHANNEL_LAYER_KEYS)[number]

export type SrtChannelLayerPreset = {
  boatModel: boolean
  boatTag: boolean
  boatHeadingArrow: boolean
  buoyModel: boolean
  buoyTag: boolean
  buoyRoundingArrows: boolean
  sponsors: boolean
  billboards: boolean
  startFinish: boolean
}

export const SRT_CHANNEL_LAYER_LABELS: Record<SrtChannelLayerKey, string> = {
  boatModel: 'Boat model',
  boatTag: 'Boat tag',
  boatHeadingArrow: 'Heading arrow',
  buoyModel: 'Buoy model',
  buoyTag: 'Buoy tag',
  buoyRoundingArrows: 'Rounding arrows',
  sponsors: 'Sponsors',
  billboards: 'Billboards',
  startFinish: 'Start/Finish',
}

const ALL_ON: SrtChannelLayerPreset = {
  boatModel: true,
  boatTag: true,
  boatHeadingArrow: true,
  buoyModel: true,
  buoyTag: true,
  buoyRoundingArrows: true,
  sponsors: true,
  billboards: true,
  startFinish: true,
}

/** Locked defaults — `docs/architecture/srt-program-cameras.md` §5. */
export const SRT_CHANNEL_PRESET_DEFAULTS: Record<
  SrtVisibilityChannel,
  SrtChannelLayerPreset
> = {
  '3d': { ...ALL_ON },
  ar: {
    boatModel: false,
    boatTag: true,
    boatHeadingArrow: false,
    buoyModel: false,
    buoyTag: true,
    buoyRoundingArrows: false,
    sponsors: true,
    billboards: true,
    startFinish: true,
  },
}

const BUOY_MESH_NAMES = new Set([
  'buoyFloat',
  'buoyBand',
  'buoyStem',
  'buoyCap',
])

export function isSrtVisibilityChannel(
  raw: unknown,
): raw is SrtVisibilityChannel {
  return raw === 'ar' || raw === '3d'
}

export function isSrtChannelLayerKey(raw: unknown): raw is SrtChannelLayerKey {
  return (
    typeof raw === 'string' &&
    (SRT_CHANNEL_LAYER_KEYS as readonly string[]).includes(raw)
  )
}

export function cloneSrtChannelPreset(
  preset: SrtChannelLayerPreset,
): SrtChannelLayerPreset {
  return {
    boatModel: preset.boatModel === true,
    boatTag: preset.boatTag === true,
    boatHeadingArrow: preset.boatHeadingArrow === true,
    buoyModel: preset.buoyModel === true,
    buoyTag: preset.buoyTag === true,
    buoyRoundingArrows: preset.buoyRoundingArrows === true,
    sponsors: preset.sponsors === true,
    billboards: preset.billboards === true,
    startFinish: preset.startFinish === true,
  }
}

export function defaultSrtChannelPreset(
  channel: SrtVisibilityChannel,
): SrtChannelLayerPreset {
  return cloneSrtChannelPreset(SRT_CHANNEL_PRESET_DEFAULTS[channel])
}

/**
 * Preset cannot force on a feature authored off (`visible3d` / mesh / tag).
 * Omit / undefined authored → on (old packs).
 */
export function resolveLayerVisible(
  presetOn: boolean,
  authoredOn?: boolean,
): boolean {
  return presetOn === true && authoredOn !== false
}

export function normalizeSrtChannelPreset(
  raw: unknown,
  fallback: SrtChannelLayerPreset,
): SrtChannelLayerPreset {
  const base = cloneSrtChannelPreset(fallback)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const o = raw as Record<string, unknown>
  const next = { ...base }
  for (const key of SRT_CHANNEL_LAYER_KEYS) {
    if (typeof o[key] === 'boolean') next[key] = o[key]
  }
  return next
}

export type SrtChannelPresetStore = {
  get: (channel: SrtVisibilityChannel) => SrtChannelLayerPreset
  set: (
    channel: SrtVisibilityChannel,
    patch: Partial<SrtChannelLayerPreset>,
  ) => SrtChannelLayerPreset
  snapshot: () => Record<SrtVisibilityChannel, SrtChannelLayerPreset>
}

/**
 * Two independent presets. Local AR/3D switch only *reads* the matching
 * copy — it must not copy 3D onto AR.
 */
export function createSrtChannelPresetStore(
  initial?: Partial<Record<SrtVisibilityChannel, SrtChannelLayerPreset>>,
): SrtChannelPresetStore {
  const ar = cloneSrtChannelPreset(initial?.ar ?? SRT_CHANNEL_PRESET_DEFAULTS.ar)
  const d3 = cloneSrtChannelPreset(
    initial?.['3d'] ?? SRT_CHANNEL_PRESET_DEFAULTS['3d'],
  )
  const byChannel: Record<SrtVisibilityChannel, SrtChannelLayerPreset> = {
    ar,
    '3d': d3,
  }
  return {
    get(channel) {
      return cloneSrtChannelPreset(byChannel[channel])
    },
    set(channel, patch) {
      byChannel[channel] = cloneSrtChannelPreset({
        ...byChannel[channel],
        ...patch,
      })
      return cloneSrtChannelPreset(byChannel[channel])
    },
    snapshot() {
      return {
        ar: cloneSrtChannelPreset(byChannel.ar),
        '3d': cloneSrtChannelPreset(byChannel['3d']),
      }
    },
  }
}

export type SrtLayerPresetPacket = {
  channel: SrtVisibilityChannel
  preset: SrtChannelLayerPreset
}

export function isSrtLayerPresetPacket(
  raw: unknown,
): raw is SrtLayerPresetPacket {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  if (!isSrtVisibilityChannel(o.channel)) return false
  if (!o.preset || typeof o.preset !== 'object') return false
  const p = o.preset as Record<string, unknown>
  return SRT_CHANNEL_LAYER_KEYS.every((key) => typeof p[key] === 'boolean')
}

/** Runtime hide of buoy mesh / tag / rounding — AND with objects that exist. */
export function applyBuoyChannelLayers(
  root: Object3D,
  preset: Pick<
    SrtChannelLayerPreset,
    'buoyModel' | 'buoyTag' | 'buoyRoundingArrows'
  >,
): void {
  root.traverse((obj) => {
    if (BUOY_MESH_NAMES.has(obj.name)) {
      obj.visible = preset.buoyModel
      return
    }
    if (obj.name === 'buoyLabel') {
      obj.visible = preset.buoyTag
      return
    }
    if (obj.name === 'roundingArrows') {
      obj.visible = preset.buoyRoundingArrows
    }
  })
}
