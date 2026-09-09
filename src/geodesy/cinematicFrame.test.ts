import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  ECEF_LOOK_AT_EPSILON_M,
  ecefLookAt,
  ellipsoidUpEcef,
  enuKeyframeToScene,
  geodeticToEcefMeters,
  type EcefMeters,
} from './cinematicFrame.ts'
import { amslToHae, getUndulation, loadFromBuffer } from './egm96.ts'
import * as GeoOrigin from './geoOrigin.ts'
import { gpsToEnuAmsl } from './geoUtils.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BIN_PATH = resolve(__dirname, '../../public/EGM96_1deg.bin')

/** Independent WGS84 (a, f=1/298.257223563) — not the GeoOrigin E_SQ constant. */
function publishedEcefHae(
  latDeg: number,
  lonDeg: number,
  altHae: number,
): EcefMeters {
  const a = 6378137
  const f = 1 / 298.257223563
  const e2 = f * (2 - f)
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat)
  return {
    x: (N + altHae) * cosLat * Math.cos(lon),
    y: (N + altHae) * cosLat * Math.sin(lon),
    z: (N * (1 - e2) + altHae) * sinLat,
  }
}

function dist(a: EcefMeters, b: EcefMeters): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function dot(a: EcefMeters, b: EcefMeters): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function hypot3(v: EcefMeters): number {
  return Math.hypot(v.x, v.y, v.z)
}

function normalize(v: EcefMeters): EcefMeters {
  const len = hypot3(v)
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function cross(a: EcefMeters, b: EcefMeters): EcefMeters {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

beforeAll(() => {
  const bytes = readFileSync(BIN_PATH)
  const ok = loadFromBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
  expect(ok).toBe(true)
})

afterEach(() => {
  GeoOrigin.resetForTests()
})

describe('geodeticToEcefMeters', () => {
  it('equator (0,0) HAE 0 matches published WGS84 ECEF within a few metres', () => {
    const n = getUndulation(0, 0)
    const p = geodeticToEcefMeters(0, 0, -n)
    const published = publishedEcefHae(0, 0, 0)
    expect(dist(p, published)).toBeLessThan(2)
    expect(p.x).toBeCloseTo(6378137, 0)
    expect(p.y).toBeCloseTo(0, 0)
    expect(p.z).toBeCloseTo(0, 0)
  })

  it('Istanbul (41, 29) HAE 0 matches published WGS84 ECEF within a few metres', () => {
    const lat = 41
    const lon = 29
    const n = getUndulation(lat, lon)
    const p = geodeticToEcefMeters(lat, lon, -n)
    const published = publishedEcefHae(lat, lon, 0)
    expect(dist(p, published)).toBeLessThan(2)
  })

  it('AMSL vs ellipsoid-only uses amslToHae (Istanbul geoid ~+36 m)', () => {
    const lat = 41
    const lon = 29
    const n = getUndulation(lat, lon)
    expect(n).toBeGreaterThan(20)
    expect(n).toBeLessThan(50)
    expect(amslToHae(lat, lon, 0)).toBeCloseTo(n, 6)

    const withGeoid = geodeticToEcefMeters(lat, lon, 0)
    const ellipsoidOnly = geodeticToEcefMeters(lat, lon, -n)
    const delta = {
      x: withGeoid.x - ellipsoidOnly.x,
      y: withGeoid.y - ellipsoidOnly.y,
      z: withGeoid.z - ellipsoidOnly.z,
    }
    expect(hypot3(delta)).toBeCloseTo(n, 1)
    const up = ellipsoidUpEcef(lat, lon)
    expect(dot(normalize(delta), up)).toBeCloseTo(1, 5)
  })
})

describe('ellipsoidUpEcef', () => {
  it('is unit length and roughly radial', () => {
    const lat = 41
    const lon = 29
    const n = getUndulation(lat, lon)
    const up = ellipsoidUpEcef(lat, lon)
    expect(hypot3(up)).toBeCloseTo(1, 12)

    const p = geodeticToEcefMeters(lat, lon, 0)
    const radial = normalize(p)
    expect(dot(up, radial)).toBeGreaterThan(0.99)

    const surface = geodeticToEcefMeters(lat, lon, -n)
    expect(dot(up, normalize(surface))).toBeGreaterThan(0.99)
  })

  it('at equator (0,0) is +X', () => {
    const up = ellipsoidUpEcef(0, 0)
    expect(up.x).toBeCloseTo(1, 12)
    expect(up.y).toBeCloseTo(0, 12)
    expect(up.z).toBeCloseTo(0, 12)
  })
})

describe('ecefLookAt', () => {
  it('forward points at target; triad is right-handed orthonormal', () => {
    const n = getUndulation(41, 29)
    const eye = geodeticToEcefMeters(41, 29, 200_000 - n)
    const target = geodeticToEcefMeters(41.2, 29.1, -n)
    const look = ecefLookAt(eye, target)

    const toTarget = {
      x: target.x - eye.x,
      y: target.y - eye.y,
      z: target.z - eye.z,
    }
    expect(dot(look.forward, normalize(toTarget))).toBeCloseTo(1, 8)
    expect(hypot3(look.forward)).toBeCloseTo(1, 10)
    expect(hypot3(look.up)).toBeCloseTo(1, 10)
    expect(hypot3(look.right)).toBeCloseTo(1, 10)
    expect(dot(look.forward, look.up)).toBeCloseTo(0, 8)
    expect(dot(look.forward, look.right)).toBeCloseTo(0, 8)
    expect(dot(look.up, look.right)).toBeCloseTo(0, 8)

    const rh = cross(look.right, look.up)
    expect(dot(rh, look.forward)).toBeCloseTo(1, 8)

    const ellUp = ellipsoidUpEcef(41, 29)
    expect(dot(look.up, ellUp)).toBeGreaterThan(0)
  })

  it('degenerate look (eye≈target) falls back to nadir without throwing', () => {
    const eye = geodeticToEcefMeters(41, 29, 0)
    const look = ecefLookAt(eye, {
      x: eye.x + ECEF_LOOK_AT_EPSILON_M * 0.1,
      y: eye.y,
      z: eye.z,
    })
    const nadir = {
      x: -ellipsoidUpEcef(41, 29).x,
      y: -ellipsoidUpEcef(41, 29).y,
      z: -ellipsoidUpEcef(41, 29).z,
    }
    expect(dot(look.forward, nadir)).toBeCloseTo(1, 5)
    expect(hypot3(look.right)).toBeCloseTo(1, 8)
    expect(hypot3(look.up)).toBeCloseTo(1, 8)
    expect(dot(cross(look.right, look.up), look.forward)).toBeCloseTo(1, 8)
  })
})

describe('enuKeyframeToScene', () => {
  it('is gpsToEnuAmsl (same geoid, race tangent plane)', () => {
    const lat = 41.08673822819249
    const lon = 29.061803205100848
    GeoOrigin.setOriginAMSL(lat, lon, 0)
    const wrapped = enuKeyframeToScene(lat, lon, 0)
    const direct = gpsToEnuAmsl(lat, lon, 0)
    expect(wrapped.x).toBeCloseTo(direct.x, 9)
    expect(wrapped.y).toBeCloseTo(direct.y, 9)
    expect(wrapped.z).toBeCloseTo(direct.z, 9)
    expect(wrapped.x).toBeCloseTo(0, 4)
    expect(wrapped.y).toBeCloseTo(0, 4)
    expect(wrapped.z).toBeCloseTo(0, 4)
  })
})
