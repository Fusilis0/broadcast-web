import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_LOCK_MIN_VISIBLE,
  cinematicTilesReadyToLock,
} from './tileLock.ts'

describe('cinematicTilesReadyToLock', () => {
  it('does not lock while the tileset is empty even if download is idle', () => {
    expect(
      cinematicTilesReadyToLock({
        visibleTerrain: 0,
        downloadIdle: true,
        cacheIdle: true,
        idleFrames: 20,
      }),
    ).toBe(false)
  })

  it('does not lock on a handful of root tiles', () => {
    expect(
      cinematicTilesReadyToLock({
        visibleTerrain: 4,
        downloadIdle: true,
        cacheIdle: true,
        idleFrames: 20,
      }),
    ).toBe(false)
  })

  it('locks after enough visible tiles stay idle for min frames', () => {
    expect(
      cinematicTilesReadyToLock({
        visibleTerrain: CINEMATIC_LOCK_MIN_VISIBLE,
        downloadIdle: true,
        cacheIdle: true,
        idleFrames: 10,
      }),
    ).toBe(true)
    expect(
      cinematicTilesReadyToLock({
        visibleTerrain: CINEMATIC_LOCK_MIN_VISIBLE,
        downloadIdle: true,
        cacheIdle: true,
        idleFrames: 2,
      }),
    ).toBe(false)
  })
})
