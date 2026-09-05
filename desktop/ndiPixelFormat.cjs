/**
 * NDI packed-format sizes. Kept free of `grandi` so tests can load it
 * without the native addon. Sender FourCC must match these byte counts.
 *
 * UYVY = 2 bytes/px (U Y0 V Y1). UYVA = UYVY + 8-bit alpha plane (3 bytes/px).
 * Line stride for both is width * 2 (alpha is a second plane after UYVY).
 */

/** @typedef {'rgba' | 'uyvy' | 'uyva'} NdiPixelFormat */

/**
 * @param {unknown} raw
 * @param {number} byteLength
 * @param {number} width
 * @param {number} height
 * @returns {NdiPixelFormat}
 */
function resolvePixelFormat(raw, byteLength, width, height) {
  const id = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (id === 'uyvy' || id === 'uyva' || id === 'rgba') return id
  const rgba = width * height * 4
  const uyva = width * height * 3
  const uyvy = width * height * 2
  if (byteLength >= rgba) return 'rgba'
  if (byteLength >= uyva) return 'uyva'
  if (byteLength >= uyvy) return 'uyvy'
  return 'rgba'
}

/**
 * @param {NdiPixelFormat} format
 * @param {number} width
 * @param {number} height
 */
function pixelBytes(format, width, height) {
  if (format === 'uyvy') return width * height * 2
  if (format === 'uyva') return width * height * 3
  return width * height * 4
}

/**
 * NDI `line_stride_in_bytes` for the first plane.
 * @param {NdiPixelFormat} format
 * @param {number} width
 */
function lineStrideBytes(format, width) {
  if (format === 'rgba') return width * 4
  return width * 2
}

/**
 * Packed UYVY/UYVA must never be advertised as RGBA/BGRA (OBS stripes).
 * @param {NdiPixelFormat} format
 * @param {{ uyvy?: boolean, uyva?: boolean, rgba?: boolean }} native
 * @returns {'UYVY' | 'UYVA' | 'RGBA' | 'BGRA' | null}
 */
function resolveFourccLabel(format, native) {
  if (format === 'uyvy') return native.uyvy ? 'UYVY' : null
  if (format === 'uyva') return native.uyva ? 'UYVA' : null
  return native.rgba ? 'RGBA' : 'BGRA'
}

module.exports = {
  resolvePixelFormat,
  pixelBytes,
  lineStrideBytes,
  resolveFourccLabel,
}
