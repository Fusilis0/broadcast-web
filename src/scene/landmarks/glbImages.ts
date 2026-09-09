/**
 * Count `images` in a GLB JSON chunk (no Three.js).
 * Used to confirm SKP re-export embedded textures.
 */

const GLB_MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a

export function glbJsonImageCount(bytes: Uint8Array): number {
  if (bytes.byteLength < 20) return 0
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (dv.getUint32(0, true) !== GLB_MAGIC) return 0
  const jsonLen = dv.getUint32(12, true)
  const jsonType = dv.getUint32(16, true)
  if (jsonType !== JSON_CHUNK) return 0
  const start = 20
  const end = start + jsonLen
  if (end > bytes.byteLength) return 0
  const text = new TextDecoder().decode(bytes.subarray(start, end))
  try {
    const parsed = JSON.parse(text) as { images?: unknown }
    return Array.isArray(parsed.images) ? parsed.images.length : 0
  } catch {
    return 0
  }
}
