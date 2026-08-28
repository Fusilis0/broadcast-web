import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveOpaqueClearSafeForVideo,
  videoForcesEnvironmentOff,
} from './videoEnvironmentGate.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('videoForcesEnvironmentOff (L8)', () => {
  it('video + local AR → env off', () => {
    expect(videoForcesEnvironmentOff('video', 'ar')).toBe(true)
    expect(
      resolveOpaqueClearSafeForVideo({
        arBackground: 'video',
        localFocus: 'ar',
        opaqueClearSafe: true,
      }),
    ).toBe(false)
  })

  it('video + AR plate (no localFocus) → env off', () => {
    expect(videoForcesEnvironmentOff('video')).toBe(true)
    expect(
      resolveOpaqueClearSafeForVideo({
        arBackground: 'video',
        opaqueClearSafe: true,
      }),
    ).toBe(false)
  })

  it('video + local 3D keeps env on (3D NDI opaque pass still mounts env)', () => {
    expect(videoForcesEnvironmentOff('video', '3d')).toBe(false)
    expect(
      resolveOpaqueClearSafeForVideo({
        arBackground: 'video',
        localFocus: '3d',
        opaqueClearSafe: true,
      }),
    ).toBe(true)
  })

  it('alpha never forces env off', () => {
    expect(videoForcesEnvironmentOff('alpha', 'ar')).toBe(false)
    expect(
      resolveOpaqueClearSafeForVideo({
        arBackground: 'alpha',
        localFocus: 'ar',
        opaqueClearSafe: true,
      }),
    ).toBe(true)
    expect(
      resolveOpaqueClearSafeForVideo({
        arBackground: 'alpha',
        localFocus: 'ar',
        opaqueClearSafe: false,
      }),
    ).toBe(false)
  })
})

describe('L8 gate wiring (source)', () => {
  it('applyLocalChannelFocus and AR plate clear use the video env gate', () => {
    const main = readFileSync(join(here, '../main.ts'), 'utf8')
    expect(main).toMatch(/resolveOpaqueClearSafeForVideo/)
    expect(main).toMatch(/applyLocalChannelFocus/)
    expect(main).toMatch(/getAirPlateClear/)
    expect(main).toMatch(/arBackgroundMode/)
  })

  it('does not edit environment modules', () => {
    const gate = readFileSync(join(here, 'videoEnvironmentGate.ts'), 'utf8')
    expect(gate).not.toMatch(/gerstnerOcean|realisticEnvironment|createTerrain/)
  })
})
