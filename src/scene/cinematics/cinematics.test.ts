import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { parseSequence } from './parseSequence.ts'
import {
  applyEase,
  interpolateKeyframe,
  lerpLonDeg,
  shotAtTime,
} from './spline.ts'
import {
  createCinematicClock,
  quantizeCinematicTime,
} from './clock.ts'
import { evaluateCinematicAt, type CinematicGeo } from './evaluate.ts'
import { hideRaceFlags, raceChromeVisible } from './hideRace.ts'
import { createCinematicPlayer } from './createPlayer.ts'
import { CINEMATIC_FPS } from './constants.ts'
import type { CinematicSequence } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = resolve(
  __dirname,
  '../../../public/cinematics/_empty.json',
)

function loadFixture(): CinematicSequence {
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as unknown
  const parsed = parseSequence(raw)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.sequence
}

function mockGeo(): CinematicGeo & {
  geodeticToEcefMeters: ReturnType<typeof vi.fn>
  ecefLookAt: ReturnType<typeof vi.fn>
  enuKeyframeToScene: ReturnType<typeof vi.fn>
} {
  const geodeticToEcefMeters = vi.fn(
    (lat: number, lon: number, altMsl: number) => ({
      x: lat,
      y: lon,
      z: altMsl,
    }),
  )
  const ecefLookAt = vi.fn(
    (eye: { x: number; y: number; z: number }, _target: unknown) => ({
      eye: { ...eye },
      forward: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 },
      right: { x: 1, y: 0, z: 0 },
    }),
  )
  const enuKeyframeToScene = vi.fn(
    (lat: number, lon: number, altMsl: number) => ({
      x: lon,
      y: altMsl,
      z: -lat,
    }),
  )
  return { geodeticToEcefMeters, ecefLookAt, enuKeyframeToScene }
}

describe('parseSequence', () => {
  it('accepts the shipped _empty fixture (2 shots, dummy lat/lon)', () => {
    const seq = loadFixture()
    expect(seq.id).toBe('_empty')
    expect(seq.width).toBe(1920)
    expect(seq.height).toBe(1080)
    expect(seq.fps).toBe(30)
    expect(seq.durationSec).toBe(2)
    expect(seq.shots).toHaveLength(2)
    expect(seq.shots[0]?.domain).toBe('globe')
    expect(seq.shots[1]?.domain).toBe('enu')
    expect(seq.pins).toEqual([])
    expect(seq.heroPins).toEqual([])
    expect(seq.tileWarm).toEqual({ contentUrls: [] })
    expect(seq.id).not.toBe('intro-bosphorus')
  })

  it('accepts optional tileWarm.contentUrls on the sequence', () => {
    const baseShot = {
      t0: 0,
      t1: 1,
      domain: 'globe',
      fog: false,
      ocean: false,
      buildings: false,
      imagery: 'aerial',
      cloud01: 0,
      keyframes: [
        {
          lat: 0,
          lon: 0,
          altMsl: 1,
          lookLat: 0,
          lookLon: 0,
          lookAltMsl: 0,
          t01: 0,
        },
      ],
    }
    const raster = { width: 1920, height: 1080, fps: 30, durationSec: 1 }
    const ok = parseSequence({
      id: 'x',
      ...raster,
      shots: [baseShot],
      tileWarm: {
        contentUrls: ['https://assets.ion.cesium.com/1/layer.json?v=1'],
      },
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.sequence.tileWarm.contentUrls).toEqual([
        'https://assets.ion.cesium.com/1/layer.json?v=1',
      ])
    }
    expect(
      parseSequence({
        id: 'x',
        ...raster,
        shots: [baseShot],
        tileWarm: { contentUrls: [1] },
      }).ok,
    ).toBe(false)
  })

  it('rejects bad pins and accepts a valid pin list', () => {
    const baseShot = {
      t0: 0,
      t1: 1,
      domain: 'globe',
      fog: false,
      ocean: false,
      buildings: false,
      imagery: 'aerial',
      cloud01: 0,
      keyframes: [
        {
          lat: 0,
          lon: 0,
          altMsl: 1,
          lookLat: 0,
          lookLon: 0,
          lookAltMsl: 0,
          t01: 0,
        },
      ],
    }
    const raster = { width: 1920, height: 1080, fps: 30, durationSec: 1 }
    expect(
      parseSequence({
        id: 'x',
        ...raster,
        shots: [baseShot],
        pins: { id: 'usa' },
      }).ok,
    ).toBe(false)
    expect(
      parseSequence({
        id: 'x',
        ...raster,
        shots: [baseShot],
        pins: [{ id: '', label: 'USA', lat: 1, lon: 2 }],
      }).ok,
    ).toBe(false)
    const ok = parseSequence({
      id: 'x',
      ...raster,
      shots: [baseShot],
      pins: [{ id: 'usa', label: 'USA', lat: 39.83, lon: -98.58 }],
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.sequence.pins).toEqual([
        { id: 'usa', label: 'USA', lat: 39.83, lon: -98.58 },
      ])
      expect(ok.sequence.heroPins).toEqual([])
    }
  })

  it('rejects missing shots and wrong raster', () => {
    expect(parseSequence({ id: 'x', durationSec: 1 }).ok).toBe(false)
    expect(
      parseSequence({
        id: 'x',
        durationSec: 1,
        width: 1280,
        height: 720,
        fps: 30,
        shots: [],
      }).ok,
    ).toBe(false)
    expect(
      parseSequence({
        id: 'x',
        durationSec: 1,
        width: 1920,
        height: 1080,
        fps: 60,
        shots: [
          {
            t0: 0,
            t1: 1,
            domain: 'globe',
            fog: false,
            ocean: false,
            buildings: false,
            imagery: 'aerial',
            cloud01: 0,
            keyframes: [
              {
                lat: 0,
                lon: 0,
                altMsl: 1,
                lookLat: 0,
                lookLon: 0,
                lookAltMsl: 0,
                t01: 0,
              },
            ],
          },
        ],
      }).ok,
    ).toBe(false)
  })
})

describe('30 Hz clock + seek', () => {
  it('seek t=0 and t=duration are exact and deterministic', () => {
    const seq = loadFixture()
    const clock = createCinematicClock(CINEMATIC_FPS)
    clock.setDuration(seq.durationSec)
    clock.seek(0)
    expect(clock.sync(0)).toBe(0)
    expect(clock.sync(0)).toBe(0)
    clock.seek(seq.durationSec)
    expect(clock.sync(0)).toBe(seq.durationSec)
    expect(quantizeCinematicTime(0, seq.durationSec)).toBe(0)
    expect(quantizeCinematicTime(seq.durationSec, seq.durationSec)).toBe(
      seq.durationSec,
    )
  })

  it('does not advance from rAF dt — wall clock only', () => {
    const clock = createCinematicClock(30)
    clock.setDuration(2)
    clock.play(1000)
    expect(clock.sync(1000)).toBe(0)
    expect(clock.sync(1000 + 1000 / 30)).toBeCloseTo(1 / 30, 8)
    clock.pause()
    const frozen = clock.getTimeSec()
    expect(clock.sync(1000 + 5000)).toBe(
      quantizeCinematicTime(frozen, 2),
    )
  })

  it('quantizes in-between times onto the 30 Hz grid', () => {
    expect(quantizeCinematicTime(0.001, 2, 30)).toBe(0)
    expect(quantizeCinematicTime(1 / 30, 2, 30)).toBeCloseTo(1 / 30, 10)
  })
})

describe('hide-race', () => {
  it('hides race chrome while cinematicActive', () => {
    expect(raceChromeVisible(false)).toBe(true)
    expect(raceChromeVisible(true)).toBe(false)
    const hidden = hideRaceFlags(true)
    expect(hidden.boats).toBe(false)
    expect(hidden.course).toBe(false)
    expect(hidden.sponsors).toBe(false)
    expect(hidden.flags).toBe(false)
    expect(hidden.map).toBe(false)
    expect(hidden.hud).toBe(false)
    expect(hidden.credits).toBe(false)
    expect(hidden.calibration).toBe(false)
    const shown = hideRaceFlags(false)
    expect(shown.boats).toBe(true)
    expect(shown.credits).toBe(true)
  })
})

describe('globe vs ENU converters (mock GEO)', () => {
  it('calls ECEF converters on globe shots and enuKeyframeToScene on ENU', () => {
    const seq = loadFixture()
    const geo = mockGeo()
    const globe = evaluateCinematicAt(seq, 0, geo)
    expect(globe.domain).toBe('globe')
    expect(geo.geodeticToEcefMeters).toHaveBeenCalled()
    expect(geo.ecefLookAt).toHaveBeenCalled()
    expect(geo.enuKeyframeToScene).not.toHaveBeenCalled()

    geo.geodeticToEcefMeters.mockClear()
    geo.ecefLookAt.mockClear()
    geo.enuKeyframeToScene.mockClear()

    const enu = evaluateCinematicAt(seq, seq.durationSec, geo)
    expect(enu.domain).toBe('enu')
    expect(enu.ocean).toBe(true)
    expect(enu.cloud01).toBe(1)
    expect(geo.enuKeyframeToScene).toHaveBeenCalled()
    expect(geo.geodeticToEcefMeters).not.toHaveBeenCalled()
    expect(geo.ecefLookAt).not.toHaveBeenCalled()
  })

  it('same t yields the same pose (deterministic scrub)', () => {
    const seq = loadFixture()
    const geo = mockGeo()
    const a = evaluateCinematicAt(seq, 0.5, geo)
    const b = evaluateCinematicAt(seq, 0.5, geo)
    expect(a.pose).toEqual(b.pose)
    expect(a.domain).toBe(b.domain)
  })
})

describe('player', () => {
  it('play/pause/seek keep hide-race active until stop', () => {
    const seq = loadFixture()
    const geo = mockGeo()
    const player = createCinematicPlayer({ geo })
    expect(player.isActive()).toBe(false)
    player.load(seq)
    player.play(0)
    expect(player.isActive()).toBe(true)
    expect(player.isPlaying()).toBe(true)
    const at0 = player.sync(0)
    expect(at0?.tSec).toBe(0)
    player.pause()
    expect(player.isPlaying()).toBe(false)
    expect(player.isActive()).toBe(true)
    player.seek(seq.durationSec)
    const end = player.sampleAt(seq.durationSec)
    expect(end?.tSec).toBe(seq.durationSec)
    player.stop()
    expect(player.isActive()).toBe(false)
    expect(player.sync(0)).toBeNull()
  })
})

describe('spline helpers', () => {
  it('eases and wraps longitude the short way', () => {
    expect(applyEase(0.5, 'linear')).toBe(0.5)
    expect(applyEase(0.5, 'easeInOut')).toBe(0.5)
    expect(applyEase(0.25, 'easeInOut')).toBeLessThan(0.2)
    expect(applyEase(0.75, 'easeInOut')).toBeGreaterThan(0.8)
    expect(lerpLonDeg(170, -170, 0.5)).toBeCloseTo(180, 5)
    const seq = loadFixture()
    const shot = shotAtTime(seq, 0)
    const kf = interpolateKeyframe(shot, 0)
    expect(kf.lat).toBe(shot.keyframes[0]?.lat)
  })
})
