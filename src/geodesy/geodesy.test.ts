import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Vector3 } from 'three'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  amslToHae,
  getUndulation,
  loadFromBuffer,
  relativeToHae,
  resetForTests as resetEgm96,
} from './egm96.ts'
import { applyConfigOrigin } from './applyConfigOrigin.ts'
import * as GeoOrigin from './geoOrigin.ts'
import { gpsToEnu, gpsToEnuAmsl, gpsToEnuRelative } from './geoUtils.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BIN_PATH = resolve(__dirname, '../../public/EGM96_1deg.bin')

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

describe('EGM96Geoid', () => {
  it('Istanbul-area undulation at (41, 29) is finite and non-zero', () => {
    const n = getUndulation(41.0, 29.0)
    expect(Number.isFinite(n)).toBe(true)
    expect(n).not.toBe(0)
    // Smoke value logged for GEO report-back
    console.log(`[test] Istanbul EGM96 N ≈ ${n.toFixed(2)} m`)
    expect(Math.abs(n)).toBeGreaterThan(1)
  })

  it('AMSL ↔ HAE uses undulation consistently', () => {
    const lat = 41.0
    const lon = 29.0
    const amsl = 100
    const n = getUndulation(lat, lon)
    expect(amslToHae(lat, lon, amsl)).toBeCloseTo(amsl + n, 6)
  })

  it('relative altitude path: takeoffAMSL + relativeAlt + N', () => {
    const lat = 41.0
    const lon = 29.0
    const takeoffAMSL = 50
    const relativeAlt = 12
    const n = getUndulation(lat, lon)
    expect(relativeToHae(lat, lon, relativeAlt, takeoffAMSL)).toBeCloseTo(
      takeoffAMSL + relativeAlt + n,
      6,
    )
  })

  it('returns 0 undulation when grid not loaded', () => {
    resetEgm96()
    expect(getUndulation(41, 29)).toBe(0)
    // reload for other suites sharing this file
    const bytes = readFileSync(BIN_PATH)
    loadFromBuffer(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    )
  })
})

describe('GeoOrigin + GeoUtils ENU', () => {
  it('point at origin ≈ (0,0,0)', () => {
    GeoOrigin.setOriginHAE(41.0, 29.0, 100)
    const p = gpsToEnu(41.0, 29.0, 100)
    expect(p.x).toBeCloseTo(0, 5)
    expect(p.y).toBeCloseTo(0, 5)
    expect(p.z).toBeCloseTo(0, 5)
  })

  it('small east offset → +x; small north offset → +z; up → +y', () => {
    const lat0 = 41.0
    const lon0 = 29.0
    const alt = 100
    GeoOrigin.setOriginHAE(lat0, lon0, alt)

    const east = gpsToEnu(lat0, lon0 + 0.001, alt)
    expect(east.x).toBeGreaterThan(50)
    expect(Math.abs(east.z)).toBeLessThan(5)

    const north = gpsToEnu(lat0 + 0.001, lon0, alt)
    expect(north.z).toBeGreaterThan(50)
    expect(Math.abs(north.x)).toBeLessThan(5)

    const up = gpsToEnu(lat0, lon0, alt + 10)
    expect(up.y).toBeCloseTo(10, 1)
  })

  it('unset origin returns zero and does not throw', () => {
    const p = gpsToEnu(41, 29, 0)
    expect(p.equals(new Vector3(0, 0, 0))).toBe(true)
  })

  it('setOriginAMSL and gpsToEnuAmsl agree via EGM96', () => {
    const lat = 41.0
    const lon = 29.0
    const amsl = 80
    GeoOrigin.setOriginAMSL(lat, lon, amsl)
    const p = gpsToEnuAmsl(lat, lon, amsl)
    expect(p.x).toBeCloseTo(0, 4)
    expect(p.y).toBeCloseTo(0, 4)
    expect(p.z).toBeCloseTo(0, 4)
    expect(GeoOrigin.altitudeHAE).toBeCloseTo(amslToHae(lat, lon, amsl), 6)
  })

  it('gpsToEnuRelative uses takeoffAMSL + relative + N', () => {
    const lat = 41.0
    const lon = 29.0
    const takeoff = 40
    const rel = 25
    const hae = relativeToHae(lat, lon, rel, takeoff)
    GeoOrigin.setOriginHAE(lat, lon, hae)
    const p = gpsToEnuRelative(lat, lon, rel, takeoff)
    expect(p.x).toBeCloseTo(0, 4)
    expect(p.y).toBeCloseTo(0, 4)
    expect(p.z).toBeCloseTo(0, 4)
  })

  it('applyConfigOrigin uses altMsl as AMSL', () => {
    applyConfigOrigin({ lat: 41, lon: 29, altMsl: 10 })
    expect(GeoOrigin.isValid).toBe(true)
    expect(GeoOrigin.altitudeHAE).toBeCloseTo(amslToHae(41, 29, 10), 6)
  })
})
