/**
 * EGM96 geoid undulation (Unity EGM96Geoid port).
 * Grid: 181×360, 6-byte big-endian UInt16 header, Int16 cm / 100 → meters.
 * HAE = AMSL + N
 */

const ROWS = 181
const COLS = 360
const HEADER_SIZE = 6
const SCALE = 100
const EXPECTED_BYTES = HEADER_SIZE + ROWS * COLS * 2
const DEFAULT_URL = '/EGM96_1deg.bin'

let grid: Float32Array | null = null
let isLoaded = false
let loadPromise: Promise<boolean> | null = null

function readBigEndianUInt16(data: DataView, offset: number): number {
  return data.getUint16(offset, false)
}

function readBigEndianInt16(data: DataView, offset: number): number {
  return data.getInt16(offset, false)
}

function gridIndex(row: number, col: number): number {
  return row * COLS + col
}

/**
 * Parse an EGM96_1deg.bin ArrayBuffer into the in-memory grid.
 * Returns true on success.
 */
export function loadFromBuffer(buffer: ArrayBuffer): boolean {
  isLoaded = false
  grid = null

  if (buffer.byteLength < EXPECTED_BYTES) {
    console.error(
      `[EGM96Geoid] File too small: ${buffer.byteLength} bytes (need ≥ ${EXPECTED_BYTES})`,
    )
    return false
  }

  const view = new DataView(buffer)
  const readRows = readBigEndianUInt16(view, 0)
  const readCols = readBigEndianUInt16(view, 2)
  // scale field at offset 4 is present in the Unity header; values use SCALE=100

  if (readRows !== ROWS || readCols !== COLS) {
    console.error(
      `[EGM96Geoid] Unexpected grid size: ${readRows}x${readCols} (expected ${ROWS}x${COLS})`,
    )
    return false
  }

  const next = new Float32Array(ROWS * COLS)
  let offset = HEADER_SIZE
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const valCm = readBigEndianInt16(view, offset)
      next[gridIndex(r, c)] = valCm / SCALE
      offset += 2
    }
  }

  grid = next
  isLoaded = true
  return true
}

/**
 * Load grid via fetch (browser) or a custom URL.
 * On failure: undulation stays 0 (Unity fallback).
 */
export async function load(url: string = DEFAULT_URL): Promise<boolean> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[EGM96Geoid] Failed to fetch ${url}: HTTP ${res.status}`)
      return false
    }
    const buffer = await res.arrayBuffer()
    return loadFromBuffer(buffer)
  } catch (e) {
    console.error(`[EGM96Geoid] Load error: ${e instanceof Error ? e.message : String(e)}`)
    return false
  }
}

/** Idempotent async load; concurrent callers share one promise. */
export function ensureLoaded(url: string = DEFAULT_URL): Promise<boolean> {
  if (isLoaded) return Promise.resolve(true)
  if (!loadPromise) {
    loadPromise = load(url).finally(() => {
      // keep loadPromise so repeat ensureLoaded after failure does not retry forever
      // unless resetForTests() clears it
    })
  }
  return loadPromise
}

export function getIsLoaded(): boolean {
  return isLoaded
}

/**
 * Geoid undulation N in meters at (lat, lon).
 * Returns 0 if grid is not loaded (Unity behavior).
 */
export function getUndulation(lat: number, lon: number): number {
  // Browser callers should await ensureLoaded() before relying on N.
  // Match Unity: unloaded / failed load → 0.
  if (!isLoaded || !grid) {
    return 0
  }

  let lonN = lon
  while (lonN < 0) lonN += 360
  while (lonN >= 360) lonN -= 360

  const latC = Math.max(-90, Math.min(90, lat))

  const fRow = 90.0 - latC
  const fCol = lonN

  let r0 = Math.floor(fRow)
  let c0 = Math.floor(fCol)
  let r1 = r0 + 1
  let c1 = c0 + 1

  r0 = Math.max(0, Math.min(ROWS - 1, r0))
  r1 = Math.max(0, Math.min(ROWS - 1, r1))
  c0 = Math.max(0, Math.min(COLS - 1, c0))
  c1 = c1 % COLS

  const fr = fRow - Math.floor(fRow)
  const fc = fCol - Math.floor(fCol)

  const v00 = grid[gridIndex(r0, c0)]!
  const v01 = grid[gridIndex(r0, c1)]!
  const v10 = grid[gridIndex(r1, c0)]!
  const v11 = grid[gridIndex(r1, c1)]!

  return (
    v00 * (1 - fr) * (1 - fc) +
    v01 * (1 - fr) * fc +
    v10 * fr * (1 - fc) +
    v11 * fr * fc
  )
}

/** AMSL → HAE: HAE = AMSL + N */
export function amslToHae(lat: number, lon: number, altAMSL: number): number {
  return altAMSL + getUndulation(lat, lon)
}

/** HAE → AMSL: AMSL = HAE − N */
export function haeToAmsl(lat: number, lon: number, altHAE: number): number {
  return altHAE - getUndulation(lat, lon)
}

/** Relative takeoff altitude → HAE: AMSL = takeoffAMSL + relativeAlt; HAE = AMSL + N */
export function relativeToHae(
  lat: number,
  lon: number,
  relativeAlt: number,
  takeoffAMSL: number,
): number {
  const amsl = takeoffAMSL + relativeAlt
  return amsl + getUndulation(lat, lon)
}

/** Test helper: clear loaded state. */
export function resetForTests(): void {
  grid = null
  isLoaded = false
  loadPromise = null
}
