import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { NdiFramePumpHandle } from './ndiFramePump.ts'
import {
  resolveNdiAirIndicator,
  STREAM_MAP_NDI_BRIDGE_SUPPORTED,
} from './ndiControllerPanel.ts'

const here = dirname(fileURLToPath(import.meta.url))

function fakePump(
  partial: Partial<{
    sourceName: string | null
    sdkVersion: string | null
    error: string | null
  }> = {},
): NdiFramePumpHandle {
  return {
    getSourceName: () => partial.sourceName ?? null,
    getSdkVersion: () => partial.sdkVersion ?? null,
    getError: () => partial.error ?? null,
    stop: () => {},
  }
}

describe('resolveNdiAirIndicator', () => {
  it('reports unavailable without studio bridge', () => {
    expect(
      resolveNdiAirIndicator({
        studioBridgePresent: false,
        pump: fakePump({ sourceName: 'x' }),
      }),
    ).toBe('unavailable')
  })

  it('reports stopped when bridge present but no pump', () => {
    expect(
      resolveNdiAirIndicator({
        studioBridgePresent: true,
        pump: null,
      }),
    ).toBe('stopped')
  })

  it('reports starting / live / error from pump handle', () => {
    expect(
      resolveNdiAirIndicator({
        studioBridgePresent: true,
        pump: fakePump({}),
      }),
    ).toBe('starting')
    expect(
      resolveNdiAirIndicator({
        studioBridgePresent: true,
        pump: fakePump({ sourceName: 'HOST (broadcast-web)', sdkVersion: '6' }),
      }),
    ).toBe('live')
    expect(
      resolveNdiAirIndicator({
        studioBridgePresent: true,
        pump: fakePump({ error: 'NDI start failed' }),
      }),
    ).toBe('error')
  })
})

describe('STREAM_MAP_NDI_BRIDGE_SUPPORTED', () => {
  it('is false until desktop multi-sender lands', () => {
    expect(STREAM_MAP_NDI_BRIDGE_SUPPORTED).toBe(false)
  })
})

describe('NDI controller / capture invariant (source)', () => {
  it('controller panel never calls WebGL readback APIs', () => {
    const src = readFileSync(join(here, 'ndiControllerPanel.ts'), 'utf8')
    expect(src).toMatch(/DOM-only/)
    expect(src).not.toMatch(/readRenderTargetPixels/)
    expect(src).not.toMatch(/getContext\(/)
    expect(src).not.toMatch(/WebGLRenderer/)
    expect(src).not.toMatch(/scene\/sidebar/)
    expect(src).not.toMatch(/ndi\.sendFrame/)
  })

  it('ndiFramePump stays free of controller / sidebar imports', () => {
    const pumpSrc = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    expect(pumpSrc).toMatch(/readRenderTargetPixels/)
    expect(pumpSrc).toMatch(/Sidebar invariant/)
    expect(pumpSrc).not.toMatch(/ndiControllerPanel/)
    expect(pumpSrc).not.toMatch(/scene\/sidebar/)
    expect(pumpSrc).not.toMatch(/document\./)
    expect(pumpSrc).toMatch(/getStudioBridge/)
    expect(pumpSrc).toMatch(/planNdiCapture/)
  })

  it('exports startNdiControllerPanel from output index', () => {
    const idx = readFileSync(join(here, 'index.ts'), 'utf8')
    expect(idx).toMatch(/startNdiControllerPanel/)
    expect(idx).toMatch(/STREAM_MAP_NDI_BRIDGE_SUPPORTED/)
  })
})
