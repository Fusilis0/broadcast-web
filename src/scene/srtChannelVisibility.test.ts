/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { isFeatureVisible3d, isBuoyMeshVisible, isBuoyTagVisible } from './features/featureVisibility.ts'
import {
  applyBuoyChannelLayers,
  createSrtChannelPresetStore,
  defaultSrtChannelPreset,
  isSrtLayerPresetPacket,
  resolveLayerVisible,
  SRT_CHANNEL_PRESET_DEFAULTS,
} from './srtChannelVisibility.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

describe('SRT channel preset defaults', () => {
  it('matches the locked §5 matrix (3D all on; AR tags + boards, no hulls/arrows)', () => {
    expect(SRT_CHANNEL_PRESET_DEFAULTS['3d']).toEqual({
      boatModel: true,
      boatTag: true,
      boatHeadingArrow: true,
      buoyModel: true,
      buoyTag: true,
      buoyRoundingArrows: true,
      sponsors: true,
      billboards: true,
      startFinish: true,
    })
    expect(SRT_CHANNEL_PRESET_DEFAULTS.ar).toEqual({
      boatModel: false,
      boatTag: true,
      boatHeadingArrow: false,
      buoyModel: false,
      buoyTag: true,
      buoyRoundingArrows: false,
      sponsors: true,
      billboards: true,
      startFinish: true,
    })
  })
})

describe('independent AR / 3D stores', () => {
  it('toggling 3D does not copy onto AR; switching focus only reads that channel', () => {
    const store = createSrtChannelPresetStore()
    const arBoot = store.get('ar')
    expect(arBoot.boatModel).toBe(false)
    expect(arBoot.boatTag).toBe(true)

    store.set('3d', { boatModel: false, boatTag: false, sponsors: false })
    expect(store.get('3d').boatModel).toBe(false)
    expect(store.get('3d').sponsors).toBe(false)

    const arAfter3d = store.get('ar')
    expect(arAfter3d).toEqual(defaultSrtChannelPreset('ar'))
    expect(arAfter3d.boatTag).toBe(true)
    expect(arAfter3d.boatModel).toBe(false)
    expect(arAfter3d.sponsors).toBe(true)

    // Local 3D → AR: bar would show AR defaults; 3D snapshot still the operator's 3D edits.
    const localFocus = 'ar' as const
    const shown = store.get(localFocus)
    expect(shown).toEqual(defaultSrtChannelPreset('ar'))
    expect(store.get('3d').boatModel).toBe(false)
    expect(store.snapshot()['3d'].boatTag).toBe(false)
  })
})

describe('authoring AND', () => {
  it('preset cannot force on a feature authored off', () => {
    expect(resolveLayerVisible(true, true)).toBe(true)
    expect(resolveLayerVisible(true, undefined)).toBe(true)
    expect(resolveLayerVisible(true, false)).toBe(false)
    expect(resolveLayerVisible(false, true)).toBe(false)
    expect(isFeatureVisible3d({ visible3d: false })).toBe(false)
    expect(
      resolveLayerVisible(true, isFeatureVisible3d({ visible3d: false })),
    ).toBe(false)
    expect(
      resolveLayerVisible(true, isBuoyMeshVisible({ visibleBuoyMesh: false })),
    ).toBe(false)
    expect(resolveLayerVisible(false, isBuoyTagVisible({}))).toBe(false)
  })
})

describe('applyBuoyChannelLayers', () => {
  it('hides mesh / tag / rounding independently', () => {
    const root = new THREE.Group()
    const mesh = new THREE.Mesh()
    mesh.name = 'buoyFloat'
    const tag = new THREE.Sprite()
    tag.name = 'buoyLabel'
    const arrows = new THREE.Group()
    arrows.name = 'roundingArrows'
    root.add(mesh, tag, arrows)

    applyBuoyChannelLayers(root, {
      buoyModel: false,
      buoyTag: true,
      buoyRoundingArrows: false,
    })
    expect(mesh.visible).toBe(false)
    expect(tag.visible).toBe(true)
    expect(arrows.visible).toBe(false)
  })
})

describe('isSrtLayerPresetPacket', () => {
  it('accepts a full packet and rejects junk', () => {
    expect(
      isSrtLayerPresetPacket({
        channel: 'ar',
        preset: defaultSrtChannelPreset('ar'),
      }),
    ).toBe(true)
    expect(
      isSrtLayerPresetPacket({
        channel: '3d',
        preset: defaultSrtChannelPreset('3d'),
      }),
    ).toBe(true)
    expect(isSrtLayerPresetPacket({ channel: '2d', preset: {} })).toBe(false)
    expect(isSrtLayerPresetPacket({ channel: 'ar' })).toBe(false)
  })
})

describe('wiring (source)', () => {
  it('does not change STUDIO_TICK_FPS', () => {
    const desktop = readFileSync(join(repoRoot, 'desktop/main.cjs'), 'utf8')
    expect(desktop).toMatch(/STUDIO_TICK_FPS\s*=\s*60/)
    expect(desktop).not.toMatch(/STUDIO_TICK_FPS\s*=\s*30/)
  })

  it('local 3D → AR does not send the 3D preset onto the AR plate', () => {
    const main = readFileSync(join(here, '../main.ts'), 'utf8')
    expect(main).toMatch(/createSrtChannelPresetStore/)
    expect(main).toMatch(/sendLayerPreset/)
    expect(main).toMatch(/startSrtProgramBar/)
    expect(main).toMatch(/channelLayerPreset:/)
    const applyFocus = main.slice(
      main.indexOf('function applyLocalChannelFocus'),
      main.indexOf('function applySrtPlateCameraLock'),
    )
    expect(applyFocus).toMatch(/srtLayerPresets\.get\(/)
    expect(applyFocus).not.toMatch(/sendLayerPreset/)
    expect(applyFocus).not.toMatch(/sendWorldLook/)

    const desktop = readFileSync(join(repoRoot, 'desktop/main.cjs'), 'utf8')
    const block = desktop.slice(
      desktop.indexOf("ipcMain.on('srtOut:layerPreset'"),
      desktop.indexOf('function parkWindow'),
    )
    expect(block).toMatch(/srtPlateWindows\.get\(packet\.channel\)/)
    expect(block).not.toMatch(/srtPlateWindows\.get\('3d'\)/)
  })

  it('bottom bar is not a side-rail section', () => {
    const bar = readFileSync(join(here, 'srtProgramBar.ts'), 'utf8')
    expect(bar).toMatch(/srt-program-bar/)
    expect(bar).not.toMatch(/ops-sidebar__section/)
    const css = readFileSync(join(here, '../style.css'), 'utf8')
    expect(css).toMatch(/\.srt-program-bar\s*\{/)
    expect(css).toMatch(/bottom:\s*8px/)
    expect(css).toMatch(/html\.srt-plate \.srt-program-bar/)
  })
})
