import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ColorManagement, SRGBColorSpace, SRGBTransfer } from 'three'
import { parseNdiUploadProbe } from './diagVideoUploadProbe.ts'
import {
  VIDEO_FRAME_TEXIMAGE_GL_INTERNAL_FORMAT,
  applyVideoFrameTexImage2DUpload,
  createLegacyTexSubImageVideoStreamTexture,
  createVideoStreamTexture,
  resolveVideoFrameTexImageInternalFormat,
} from './videoStreamManager.ts'

const here = dirname(fileURLToPath(import.meta.url))
const threeRoot = join(here, '../../node_modules/three/src')

describe('parseNdiUploadProbe', () => {
  it('is off on the default auto-connect URL (production texImage2D)', () => {
    expect(
      parseNdiUploadProbe(
        '?race=demo-istanbul&outputMode=transparent&arBackground=video&autoConnectLive=1&livePov=1&autoConnectSrt=1&srtPov=1',
      ),
    ).toBe('off')
  })

  it('accepts texImage (same as default) and texSubImage killswitch', () => {
    expect(parseNdiUploadProbe('?ndiUploadProbe=texImage')).toBe('texImage')
    expect(parseNdiUploadProbe('?ndiUploadProbe=texSubImage')).toBe('texSubImage')
    expect(parseNdiUploadProbe('?ndiUploadProbe=legacy')).toBe('texSubImage')
  })

  it('ignores unknown values', () => {
    expect(parseNdiUploadProbe('?ndiUploadProbe=1')).toBe('off')
    expect(parseNdiUploadProbe('?ndiUploadProbe=imageBitmap')).toBe('off')
  })
})

describe('VideoFrame texImage2D colour contract', () => {
  it('uses RGBA8 + SRGBColorSpace, not SRGB8_ALPHA8 storage', () => {
    const tex = createVideoStreamTexture()
    expect(tex.colorSpace).toBe(SRGBColorSpace)
    expect(tex.internalFormat).toBeNull()
    expect((tex as { isVideoTexture?: boolean }).isVideoTexture).toBe(true)
    expect(typeof (tex as { update?: () => void }).update).toBe('function')
    expect(resolveVideoFrameTexImageInternalFormat(tex)).toBe(
      VIDEO_FRAME_TEXIMAGE_GL_INTERNAL_FORMAT,
    )
    expect(VIDEO_FRAME_TEXIMAGE_GL_INTERNAL_FORMAT).toBe('RGBA8')
    expect(ColorManagement.getTransfer(tex.colorSpace)).toBe(SRGBTransfer)
    tex.dispose()
  })

  it('legacy killswitch keeps SRGB8_ALPHA8 texStorage path', () => {
    const tex = createLegacyTexSubImageVideoStreamTexture()
    expect(tex.colorSpace).toBe(SRGBColorSpace)
    expect((tex as { isVideoTexture?: boolean }).isVideoTexture).not.toBe(true)
    expect(resolveVideoFrameTexImageInternalFormat(tex)).toBe('SRGB8_ALPHA8')
    tex.dispose()
  })

  it('does not pin SRGB8_ALPHA8 on the texImage2D path (would double EOTF)', () => {
    const tex = createVideoStreamTexture()
    expect(tex.internalFormat).not.toBe('SRGB8_ALPHA8')
    expect(resolveVideoFrameTexImageInternalFormat(tex)).not.toBe('SRGB8_ALPHA8')
    tex.dispose()
  })

  it('shader decodeVideoTexture applies the same sRGB EOTF as SRGB8_ALPHA8 sampling', () => {
    const mapFrag = readFileSync(
      join(threeRoot, 'renderers/shaders/ShaderChunk/map_fragment.glsl.js'),
      'utf8',
    )
    const programs = readFileSync(
      join(threeRoot, 'renderers/webgl/WebGLPrograms.js'),
      'utf8',
    )
    const textures = readFileSync(
      join(threeRoot, 'renderers/webgl/WebGLTextures.js'),
      'utf8',
    )
    expect(mapFrag).toMatch(/DECODE_VIDEO_TEXTURE/)
    expect(mapFrag).toMatch(/sRGBTransferEOTF/)
    expect(mapFrag).toMatch(/#26516/)
    expect(programs).toMatch(
      /decodeVideoTexture:\s*HAS_MAP && \( material\.map\.isVideoTexture === true \) && \( ColorManagement\.getTransfer\( material\.map\.colorSpace \) === SRGBTransfer \)/,
    )
    expect(textures).toMatch(
      /const useTexStorage = \( texture\.isVideoTexture !== true \)/,
    )
    expect(textures).toMatch(
      /getInternalFormat\( texture\.internalFormat, glFormat, glType, texture\.colorSpace, texture\.isVideoTexture \)/,
    )
  })

  it('sampled mid-grey matches IEC sRGB EOTF used by both GL SRGB8_ALPHA8 and DECODE_VIDEO_TEXTURE', () => {
    const pars = readFileSync(
      join(threeRoot, 'renderers/shaders/ShaderChunk/colorspace_pars_fragment.glsl.js'),
      'utf8',
    )
    expect(pars).toMatch(/value\.rgb \* 0\.9478672986 \+ vec3\( 0\.0521327014 \)/)
    expect(pars).toMatch(/value\.rgb \* 0\.0773993808/)
    expect(pars).toMatch(/2\.4/)
    expect(pars).toMatch(/0\.04045/)
    const eotf = (c: number): number =>
      c <= 0.04045
        ? c * 0.0773993808
        : (c * 0.9478672986 + 0.0521327014) ** 2.4
    // Same transfer as hardware sRGB texel fetch — 8-bit 128 → ~0.216 linear.
    expect(eotf(128 / 255)).toBeCloseTo(0.2158605001, 6)
    expect(eotf(0)).toBe(0)
    expect(eotf(1)).toBeCloseTo(1, 5)
  })
})

describe('ndiUploadProbe wiring (source)', () => {
  it('main only swaps createTexture for the texSubImage killswitch', () => {
    const main = readFileSync(join(here, '../main.ts'), 'utf8')
    expect(main).toMatch(/parseNdiUploadProbe/)
    expect(main).toMatch(/createLegacyTexSubImageVideoStreamTexture/)
    expect(main).toMatch(
      /ndiUploadProbe === 'texSubImage'[\s\S]*createLegacyTexSubImageVideoStreamTexture/,
    )
    expect(main).not.toMatch(/createDiagTexImageVideoStreamTexture/)
  })

  it('production createVideoStreamTexture sets isVideoTexture', () => {
    const src = readFileSync(join(here, 'videoStreamManager.ts'), 'utf8')
    expect(src).toMatch(/export function createVideoStreamTexture/)
    expect(src).toMatch(/applyVideoFrameTexImage2DUpload/)
    expect(src).toMatch(/isVideoTexture = true/)
  })
})

describe('applyVideoFrameTexImage2DUpload', () => {
  it('is idempotent on colorSpace after videoBackground re-pin', () => {
    const tex = createLegacyTexSubImageVideoStreamTexture()
    applyVideoFrameTexImage2DUpload(tex)
    tex.colorSpace = SRGBColorSpace
    expect(resolveVideoFrameTexImageInternalFormat(tex)).toBe('RGBA8')
    tex.dispose()
  })
})
