import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CINEMATIC_CATALOGUE, CINEMATIC_ENU_FAR_M, CINEMATIC_ENU_FOG_COLOR, CINEMATIC_ENU_FOG_FAR_M } from './constants.ts'
import { evaluateCinematicAt } from './evaluate.ts'
import { parseSequence } from './parseSequence.ts'
import { interpolateKeyframe, shotAtTime } from './spline.ts'
import {
  WARM_GLOBE_ERROR_TARGET_MIN,
  WARM_ISTANBUL_ERROR_TARGET,
  CINEMATIC_ENU_PLAY_ERROR_TARGET,
} from './warm.ts'
import type { CinematicKeyframe, CinematicSequence } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEQUENCE_PATH = resolve(
  __dirname,
  '../../../public/cinematics/intro-bosphorus.json',
)

const RUMELI_LAT = 41.0848
const RUMELI_LON = 29.0567
/** ~500 m — look-ats must not target the castle. */
const RUMELI_EPS_DEG = 0.005

const CIRAGAN_LOOK_LAT = 41.04342388464562
const CIRAGAN_LOOK_LON = 29.01532600006871

const COUNTRY_PINS = {
  usa: { lat: 39.83, lon: -98.58 },
  canada: { lat: 56.13, lon: -106.35 },
  uk: { lat: 54.0, lon: -2.5 },
  russia: { lat: 55.8, lon: 37.6 },
  bulgaria: { lat: 42.73, lon: 25.49 },
  turkey: { lat: 39.0, lon: 35.2 },
} as const

const ISTANBUL_PIN = { lat: 41.0082, lon: 28.9784 }

const CITY_LOOKS = [
  { name: 'chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'winnipeg', lat: 49.8951, lon: -97.1384 },
  { name: 'london', lat: 51.5074, lon: -0.1278 },
] as const

type RawKeyframe = {
  lat?: number
  lon?: number
  lookLat?: number
  lookLon?: number
  lookId?: unknown
}

function loadRaw(): unknown {
  return JSON.parse(readFileSync(SEQUENCE_PATH, 'utf8')) as unknown
}

function loadSequence(): CinematicSequence {
  const parsed = parseSequence(loadRaw())
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.sequence
}

function collectLookIds(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectLookIds(item, out)
    return
  }
  if (value === null || typeof value !== 'object') return
  const rec = value as Record<string, unknown>
  if (typeof rec.lookId === 'string') out.push(rec.lookId)
  for (const child of Object.values(rec)) collectLookIds(child, out)
}

function walkKeyframes(value: unknown, visit: (kf: RawKeyframe) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walkKeyframes(item, visit)
    return
  }
  if (value === null || typeof value !== 'object') return
  const rec = value as Record<string, unknown>
  if (
    typeof rec.lookLat === 'number' &&
    typeof rec.lookLon === 'number'
  ) {
    visit(rec as RawKeyframe)
  }
  for (const child of Object.values(rec)) walkKeyframes(child, visit)
}

function lonDeltaDeg(a: number, b: number): number {
  let d = b - a
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return Math.abs(d)
}

function poseClose(
  a: CinematicKeyframe,
  b: CinematicKeyframe,
  deg = 1e-4,
  altM = 1,
): void {
  expect(Math.abs(a.lat - b.lat)).toBeLessThan(deg)
  expect(lonDeltaDeg(a.lon, b.lon)).toBeLessThan(deg)
  expect(Math.abs(a.altMsl - b.altMsl)).toBeLessThan(altM)
  expect(Math.abs(a.lookLat - b.lookLat)).toBeLessThan(deg)
  expect(lonDeltaDeg(a.lookLon, b.lookLon)).toBeLessThan(deg)
  expect(Math.abs(a.lookAltMsl - b.lookAltMsl)).toBeLessThan(altM)
}

function lastKeyframe(shot: { keyframes: readonly CinematicKeyframe[] }): CinematicKeyframe {
  const keys = shot.keyframes.slice().sort((x, y) => x.t01 - y.t01)
  return keys[keys.length - 1]!
}

function firstKeyframe(shot: { keyframes: readonly CinematicKeyframe[] }): CinematicKeyframe {
  const keys = shot.keyframes.slice().sort((x, y) => x.t01 - y.t01)
  return keys[0]!
}

describe('intro-bosphorus sequence', () => {
  it('parses as 1920×1080 · 30 fps · duration 72', () => {
    const seq = loadSequence()
    expect(seq.id).toBe('intro-bosphorus')
    expect(seq.durationSec).toBe(72)
    expect(seq.width).toBe(1920)
    expect(seq.height).toBe(1080)
    expect(seq.fps).toBe(30)
    expect(seq.tileWarm.contentUrls).toEqual([])
  })

  it('parses country pins (Canada, UK, Russia, Turkey) plus USA and İstanbul', () => {
    const seq = loadSequence()
    const byId = new Map(seq.pins.map((p) => [p.id, p]))
    expect(byId.get('usa')).toMatchObject({
      label: 'USA',
      ...COUNTRY_PINS.usa,
    })
    expect(byId.get('canada')).toMatchObject({
      label: 'Canada',
      ...COUNTRY_PINS.canada,
    })
    expect(byId.get('bulgaria')).toMatchObject({
      label: 'Bulgaria',
      ...COUNTRY_PINS.bulgaria,
    })
    expect(byId.get('uk')).toMatchObject({
      label: 'UK',
      ...COUNTRY_PINS.uk,
    })
    expect(byId.get('russia')).toMatchObject({
      label: 'Russia',
      ...COUNTRY_PINS.russia,
    })
    expect(byId.get('turkey')).toMatchObject({
      label: 'Turkey',
      ...COUNTRY_PINS.turkey,
    })
    expect(byId.get('istanbul')).toMatchObject({
      label: 'İstanbul',
      ...ISTANBUL_PIN,
    })
    expect(byId.has('moscow')).toBe(false)
    for (const pin of seq.pins) {
      expect(pin.label.toLowerCase()).not.toBe('moscow')
      expect(pin.id.toLowerCase()).not.toBe('moscow')
    }
  })

  it('is in CINEMATIC_CATALOGUE', () => {
    const entry = CINEMATIC_CATALOGUE.find((e) => e.id === 'intro-bosphorus')
    expect(entry).toBeDefined()
    expect(entry?.url).toBe('/cinematics/intro-bosphorus.json')
  })

  it('has no rumeli in look-at ids or GPS', () => {
    const text = readFileSync(SEQUENCE_PATH, 'utf8')
    expect(text.toLowerCase()).not.toMatch(/rumeli/)
    const lookIds: string[] = []
    collectLookIds(loadRaw(), lookIds)
    expect(lookIds.length).toBeGreaterThan(0)
    for (const id of lookIds) {
      expect(id.toLowerCase()).not.toMatch(/rumeli/)
    }
    walkKeyframes(loadRaw(), (kf) => {
      const dLat = Math.abs((kf.lookLat ?? 0) - RUMELI_LAT)
      const dLon = Math.abs((kf.lookLon ?? 0) - RUMELI_LON)
      expect(dLat > RUMELI_EPS_DEG || dLon > RUMELI_EPS_DEG).toBe(true)
    })
  })

  it('JSON has no Moscow label or lookId', () => {
    const text = readFileSync(SEQUENCE_PATH, 'utf8')
    expect(text.toLowerCase()).not.toMatch(/moscow/)
    const lookIds: string[] = []
    collectLookIds(loadRaw(), lookIds)
    for (const id of lookIds) {
      expect(id.toLowerCase()).not.toBe('moscow')
    }
  })

  it('shot t-ranges cover [0, 72) without gaps', () => {
    const seq = loadSequence()
    expect(seq.shots.length).toBeGreaterThan(0)
    expect(seq.shots[0]?.t0).toBe(0)
    expect(seq.shots[seq.shots.length - 1]?.t1).toBe(72)
    for (let i = 0; i < seq.shots.length - 1; i++) {
      expect(seq.shots[i]?.t1).toBe(seq.shots[i + 1]?.t0)
    }
    for (const shot of seq.shots) {
      expect(shot.t1).toBeGreaterThan(shot.t0)
    }
  })

  it('west USA→Canada→UK then east Russia→Bulgaria→Turkey→İstanbul; one hold per country', () => {
    const seq = loadSequence()
    const holds: Array<{ t: number; pin: keyof typeof COUNTRY_PINS }> = [
      { t: 6.7, pin: 'usa' },
      { t: 10.5, pin: 'canada' },
      { t: 13.9, pin: 'uk' },
      { t: 17.5, pin: 'russia' },
      { t: 21.3, pin: 'bulgaria' },
      { t: 25.1, pin: 'turkey' },
    ]
    for (const hold of holds) {
      const sample = evaluateCinematicAt(seq, hold.t)
      const want = COUNTRY_PINS[hold.pin]
      expect(sample.domain).toBe('globe')
      expect(sample.keyframe.lookLat).toBeCloseTo(want.lat, 4)
      expect(sample.keyframe.lookLon).toBeCloseTo(want.lon, 4)
      expect(sample.keyframe.lookId).toBe(hold.pin)
    }

    const usa = shotAtTime(seq, 6.7)
    const canada = shotAtTime(seq, 10.5)
    const uk = shotAtTime(seq, 13.9)
    const russia = shotAtTime(seq, 17.5)
    const bulgaria = shotAtTime(seq, 21.3)
    const turkey = shotAtTime(seq, 25.1)
    expect(usa.t0).toBeLessThan(canada.t0)
    expect(canada.t0).toBeLessThan(uk.t0)
    expect(uk.t0).toBeLessThan(russia.t0)
    expect(russia.t0).toBeLessThan(bulgaria.t0)
    expect(bulgaria.t0).toBeLessThan(turkey.t0)
    expect(usa.t1 - usa.t0).toBeLessThanOrEqual(1.5)
    expect(canada.t1 - canada.t0).toBeLessThanOrEqual(1.5)
    expect(uk.t1 - uk.t0).toBeLessThanOrEqual(1.5)
    expect(turkey.t1 - turkey.t0).toBeLessThanOrEqual(1.5)
    expect(usa.keyframes.length).toBeLessThanOrEqual(2)
    expect(canada.keyframes.length).toBeLessThanOrEqual(2)
    expect(uk.keyframes.length).toBeLessThanOrEqual(2)
    expect(russia.keyframes.length).toBeLessThanOrEqual(2)
    expect(bulgaria.keyframes.length).toBeLessThanOrEqual(2)
    expect(turkey.keyframes.length).toBeLessThanOrEqual(2)

    const world = evaluateCinematicAt(seq, 2)
    expect(world.domain).toBe('globe')
    expect(world.keyframe.lookLat).not.toBeCloseTo(COUNTRY_PINS.russia.lat, 1)
    expect(lonDeltaDeg(world.keyframe.lookLon, COUNTRY_PINS.russia.lon)).toBeGreaterThan(
      10,
    )

    const pullBack = evaluateCinematicAt(seq, 12.2)
    expect(pullBack.keyframe.altMsl).toBeGreaterThan(10_000_000)

    const marmara = shotAtTime(seq, 27)
    expect(marmara.t0).toBe(25.8)
    const istanbulLook = lastKeyframe(marmara)
    expect(istanbulLook.lookLat).toBeCloseTo(ISTANBUL_PIN.lat, 4)
    expect(istanbulLook.lookLon).toBeCloseTo(ISTANBUL_PIN.lon, 4)

    const lookIds: string[] = []
    collectLookIds(loadRaw(), lookIds)
    for (const id of lookIds) {
      expect(id.toLowerCase()).not.toBe('chicago')
      expect(id.toLowerCase()).not.toBe('winnipeg')
      expect(id.toLowerCase()).not.toBe('london')
    }

    walkKeyframes(loadRaw(), (kf) => {
      for (const city of CITY_LOOKS) {
        const dLat = Math.abs((kf.lookLat ?? 0) - city.lat)
        const dLon = Math.abs((kf.lookLon ?? 0) - city.lon)
        expect(dLat > 0.05 || dLon > 0.05).toBe(true)
      }
    })
  })

  it('same-domain adjacent shots share boundary poses (globe and ENU)', () => {
    const seq = loadSequence()
    for (let i = 0; i < seq.shots.length - 1; i++) {
      const a = seq.shots[i]!
      const b = seq.shots[i + 1]!
      if (a.domain !== b.domain) continue
      poseClose(lastKeyframe(a), firstKeyframe(b))
    }
  })

  it('transits use easeInOut on the opening keyframe', () => {
    const seq = loadSequence()
    const usaFly = shotAtTime(seq, 4.5)
    const canadaFly = shotAtTime(seq, 8.5)
    const ukFly = shotAtTime(seq, 12.2)
    const russiaFly = shotAtTime(seq, 15.7)
    const bulgariaFly = shotAtTime(seq, 19.4)
    const turkeyFly = shotAtTime(seq, 23.2)
    for (const shot of [usaFly, canadaFly, ukFly, russiaFly, bulgariaFly, turkeyFly]) {
      expect(firstKeyframe(shot).ease).toBe('easeInOut')
    }
  })

  it('one high southbound Bosphorus pass; Maiden’s stays on the west side', () => {
    const seq = loadSequence()
    const reveal = shotAtTime(seq, 31)
    const pass = shotAtTime(seq, 38)
    const maidens = shotAtTime(seq, 46)
    expect(reveal.domain).toBe('enu')
    expect(reveal.fog).toBe(true)
    expect(reveal.t0).toBe(30)
    expect(reveal.t1).toBe(33)
    expect(pass.t0).toBe(33)
    expect(pass.t1).toBe(44)
    expect(maidens.t0).toBe(44)
    expect(maidens.t1).toBe(49)
    poseClose(lastKeyframe(reveal), firstKeyframe(pass))
    poseClose(lastKeyframe(pass), firstKeyframe(maidens))

    const start = firstKeyframe(reveal)
    expect(start.lookLat).toBeCloseTo(41.202, 4)
    expect(start.lookLon).toBeCloseTo(29.118, 4)
    expect(start.altMsl).toBeGreaterThan(700)
    expect(start.altMsl - start.lookAltMsl).toBeGreaterThan(600)

    const a = evaluateCinematicAt(seq, 34)
    const b = evaluateCinematicAt(seq, 43)
    expect(b.keyframe.lat).toBeLessThan(a.keyframe.lat)
    expect(b.keyframe.lookLat).toBeLessThan(a.keyframe.lookLat)
    expect(a.keyframe.altMsl).toBeGreaterThan(600)
    const midPass = evaluateCinematicAt(seq, 38)
    expect(midPass.keyframe.lookLat).toBeLessThan(41.12)
    expect(midPass.keyframe.lookLat).toBeGreaterThan(41.04)
    expect(midPass.keyframe.lookLon).toBeGreaterThan(29.03)
    expect(midPass.keyframe.lookLon).toBeLessThan(29.08)
    const endLook = lastKeyframe(pass)
    expect(endLook.lookLat).toBeCloseTo(41.045, 4)
    expect(endLook.lookLon).toBeCloseTo(29.034, 4)
    expect(endLook.lookId).toBe('bogazici-bridge')

    expect(seq.shots.filter((s) => s.t0 >= 30 && s.t1 <= 44).length).toBe(2)

    const towerKeys = maidens.keyframes.filter((kf) => kf.lookId === 'maidens-tower')
    expect(towerKeys.length).toBeGreaterThan(0)
    for (const kf of towerKeys) {
      expect(kf.lon).toBeLessThan(29.004)
    }
    const towerEnd = lastKeyframe(maidens)
    expect(towerEnd.lookLat).toBeCloseTo(41.0211, 4)
    expect(towerEnd.lookLon).toBeCloseTo(29.0041, 4)
    expect(towerEnd.altMsl).toBeLessThan(120)
    expect(towerEnd.lon).toBeGreaterThan(28.994)
  })

  it('ENU camera never stops; heroes are closer from above, looking down', () => {
    const seq = loadSequence()
    for (const shot of seq.shots) {
      if (shot.domain !== 'enu') continue
      const early = interpolateKeyframe(shot, 0.15)
      const late = interpolateKeyframe(shot, 0.85)
      expect(
        Math.abs(early.lat - late.lat) > 1e-4 ||
          lonDeltaDeg(early.lon, late.lon) > 1e-4 ||
          Math.abs(early.altMsl - late.altMsl) > 1,
      ).toBe(true)
      expect(firstKeyframe(shot).ease === 'linear' || firstKeyframe(shot).ease === undefined).toBe(
        true,
      )
      expect(shot.fog).toBe(true)
    }

    const peninsula = shotAtTime(seq, 58)
    expect(peninsula.t0).toBe(49)
    for (const kf of peninsula.keyframes) {
      if (!kf.lookId || kf.lookId === 'maidens-tower' || kf.t01 === 0) continue
      expect(kf.altMsl).toBeGreaterThan(130)
      expect(kf.altMsl).toBeGreaterThan(kf.lookAltMsl + 80)
    }

    const galataClose = evaluateCinematicAt(seq, 64.5)
    expect(galataClose.keyframe.altMsl).toBeLessThan(180)
    expect(galataClose.keyframe.altMsl).toBeGreaterThan(
      galataClose.keyframe.lookAltMsl + 70,
    )
  })

  it('Galata is closer and longer; peninsula visits hero buildings west→east', () => {
    const seq = loadSequence()
    const galata = shotAtTime(seq, 64)
    expect(galata.t1 - galata.t0).toBeGreaterThanOrEqual(4)
    expect(lastKeyframe(galata).lookId).toBe('galata-tower')
    const close = evaluateCinematicAt(seq, 65.2)
    expect(close.keyframe.lookLat).toBeCloseTo(41.0256, 3)
    expect(close.keyframe.lookLon).toBeCloseTo(28.9741, 3)
    expect(close.keyframe.altMsl).toBeLessThan(180)

    const peninsula = shotAtTime(seq, 58)
    const ids = (peninsula.keyframes as Array<{ lookId?: string }>).map(
      (kf) => kf.lookId,
    )
    expect(ids).not.toContain('suleymaniye')
    expect(ids).toContain('sultan-ahmed')
    expect(ids).toContain('hagia-sophia')
    expect(ids).toContain('aya-irini')
    expect(ids).toContain('topkapi')
    const ahmed = peninsula.keyframes.find((kf) => kf.lookId === 'sultan-ahmed')
    const irene = peninsula.keyframes.find((kf) => kf.lookId === 'aya-irini')
    const topkapi = peninsula.keyframes.find((kf) => kf.lookId === 'topkapi')
    expect(ahmed).toBeDefined()
    expect(irene).toBeDefined()
    expect(topkapi).toBeDefined()
    expect(ahmed!.t01).toBeLessThan(irene!.t01)
    expect(irene!.t01).toBeLessThan(topkapi!.t01)
  })

  it('Çırağan look stays on the operator GPS and keeps moving', () => {
    const seq = loadSequence()
    const ciragan = shotAtTime(seq, 70.5)
    expect(ciragan.t1).toBe(72)
    const onPalace = ciragan.keyframes.filter((kf) => (kf.t01 ?? 0) >= 0.35)
    expect(onPalace.length).toBeGreaterThan(0)
    for (const kf of onPalace) {
      expect(kf.lookLat).toBeCloseTo(CIRAGAN_LOOK_LAT, 7)
      expect(kf.lookLon).toBeCloseTo(CIRAGAN_LOOK_LON, 7)
    }
    const a = firstKeyframe(ciragan)
    const b = lastKeyframe(ciragan)
    expect(Math.abs(a.lat - b.lat) > 1e-4 || Math.abs(a.lon - b.lon) > 1e-4).toBe(
      true,
    )
    const sample = evaluateCinematicAt(seq, 71.9)
    expect(sample.keyframe.lookLat).toBeCloseTo(CIRAGAN_LOOK_LAT, 4)
    expect(sample.keyframe.lookLon).toBeCloseTo(CIRAGAN_LOOK_LON, 4)
  })

  it('Play/warm Aerial SSE is globe 8, warm ENU 3, play ENU 8 (not Google)', () => {
    expect(WARM_GLOBE_ERROR_TARGET_MIN).toBe(8)
    expect(WARM_ISTANBUL_ERROR_TARGET).toBe(3)
    expect(CINEMATIC_ENU_PLAY_ERROR_TARGET).toBe(8)
    expect(CINEMATIC_ENU_FAR_M).toBe(4_200)
    expect(CINEMATIC_ENU_FOG_FAR_M).toBeLessThan(CINEMATIC_ENU_FAR_M)
    expect(CINEMATIC_ENU_FOG_COLOR).toBe(0x2a4a52)
    const text = readFileSync(SEQUENCE_PATH, 'utf8')
    expect(text.toLowerCase()).not.toMatch(/photorealistic/)
    expect(text.toLowerCase()).not.toMatch(/maptiler/)
    expect(text.toLowerCase()).not.toMatch(/cesiumjs/)
  })

  it('Turkey hover last pose equals Marmara fly start; ENU reveal is Yavuz catalogue GPS', () => {
    const seq = loadSequence()
    const turkey = shotAtTime(seq, 25.1)
    const marmara = shotAtTime(seq, 27)
    expect(turkey.t0).toBe(24.4)
    expect(marmara.t0).toBe(25.8)
    poseClose(lastKeyframe(turkey), firstKeyframe(marmara))
    const flyStart = interpolateKeyframe(marmara, 0)
    const flyEnd = interpolateKeyframe(marmara, 1)
    expect(flyEnd.altMsl).toBeLessThan(flyStart.altMsl)
    expect(flyEnd.lookLat).toBeGreaterThan(40.5)

    const enuFirst = shotAtTime(seq, 30.2)
    expect(enuFirst.domain).toBe('enu')
    expect(enuFirst.t0).toBe(30)
    const kf0 = firstKeyframe(enuFirst)
    expect(kf0.lookLat).toBeCloseTo(41.202, 4)
    expect(kf0.lookLon).toBeCloseTo(29.118, 4)
    expect(kf0.altMsl).toBeGreaterThan(700)
  })

  it('lerps cloud 0→1 over 2 s into İstanbul, not a 4-frame pop', () => {
    const seq = loadSequence()
    const a = evaluateCinematicAt(seq, 28.2)
    const mid = evaluateCinematicAt(seq, 29.1)
    const b = evaluateCinematicAt(seq, 30 - 1e-6)
    expect(a.cloud01).toBeCloseTo(0, 2)
    expect(mid.cloud01).toBeGreaterThan(0.35)
    expect(mid.cloud01).toBeLessThan(0.65)
    expect(b.cloud01).toBeGreaterThan(0.95)
  })

  it('has country flags and ENU hero pins; İstanbul has no flag', () => {
    const seq = loadSequence()
    const istanbul = seq.pins.find((p) => p.id === 'istanbul')
    expect(istanbul?.flag).toBeUndefined()
    expect(istanbul?.kind).toBe('place')
    expect(seq.pins.filter((p) => p.id !== 'istanbul').every((p) => p.flag)).toBe(
      true,
    )
    const heroIds = seq.heroPins.map((p) => p.id)
    expect(heroIds).toContain('yavuz-selim-bridge')
    expect(heroIds).toContain('galata-tower')
    expect(heroIds).toContain('dolmabahce')
    expect(heroIds).toContain('hagia-sophia')
    expect(heroIds).toContain('aya-irini')
    expect(heroIds).not.toContain('rumeli-hisari')
    expect(heroIds).not.toContain('suleymaniye')
  })

  it('visits Dolmabahçe after Galata and before Çırağan', () => {
    const seq = loadSequence()
    const dolma = shotAtTime(seq, 67.5)
    expect(dolma.t0).toBe(66)
    expect(evaluateCinematicAt(seq, 67.5).keyframe.lookId).toBe('dolmabahce')
    const end = lastKeyframe(dolma)
    expect(end.lookLat).toBeCloseTo(41.03917, 4)
    expect(end.lookLon).toBeCloseTo(29.0007, 4)
  })
})
