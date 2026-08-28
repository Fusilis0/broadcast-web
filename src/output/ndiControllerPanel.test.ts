import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { NdiFramePumpHandle } from './ndiFramePump.ts'
import {
  resolveNdiAirIndicator,
  resolveNdiChannelIndicator,
  STREAM_MAP_NDI_BRIDGE_SUPPORTED,
} from './ndiControllerPanel.ts'
import type { StreamMapNdiPumpHandle } from './streamMapNdiPump.ts'
import {
  DEFAULT_NDI_CHANNEL,
  NDI_CHANNEL_IDS,
  type StudioNdiStatus,
} from './studioBridge.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

function fakePump(
  partial: Partial<{
    sourceName: string | null
    sdkVersion: string | null
    error: string | null
    delayMs: number
    sendFps: number
  }> = {},
): NdiFramePumpHandle {
  let delayMs = partial.delayMs ?? 0
  return {
    getSourceName: () => partial.sourceName ?? null,
    getSdkVersion: () => partial.sdkVersion ?? null,
    getError: () => partial.error ?? null,
    getDelayMs: () => delayMs,
    setDelayMs: (ms) => {
      delayMs = ms
      return delayMs
    },
    getSendFps: () => partial.sendFps ?? 0,
    stop: () => {},
  }
}

function status(
  partial: Partial<StudioNdiStatus> & { channel: StudioNdiStatus['channel'] },
): StudioNdiStatus {
  return {
    active: false,
    sourceName: null,
    sdkVersion: null,
    error: null,
    ...partial,
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

describe('resolveNdiChannelIndicator', () => {
  it('marks idle 3d/2d when no sender started (not an error)', () => {
    expect(
      resolveNdiChannelIndicator({
        studioBridgePresent: true,
        channel: '3d',
        status: status({ channel: '3d' }),
      }),
    ).toBe('idle')
    expect(
      resolveNdiChannelIndicator({
        studioBridgePresent: true,
        channel: '2d',
        status: null,
      }),
    ).toBe('idle')
  })

  it('marks live when bridge reports active sender', () => {
    expect(
      resolveNdiChannelIndicator({
        studioBridgePresent: true,
        channel: '3d',
        status: status({
          channel: '3d',
          active: true,
          sourceName: 'HOST (broadcast-web-3d)',
        }),
      }),
    ).toBe('live')
  })

  it('uses AR pump for starting/live; idle when pump stopped and inactive', () => {
    expect(
      resolveNdiChannelIndicator({
        studioBridgePresent: true,
        channel: 'ar',
        status: status({ channel: 'ar' }),
        pump: fakePump({}),
      }),
    ).toBe('starting')
    expect(
      resolveNdiChannelIndicator({
        studioBridgePresent: true,
        channel: 'ar',
        status: status({ channel: 'ar' }),
        pump: null,
      }),
    ).toBe('idle')
  })

  it('uses 3d pump for starting/live (opaque channel)', () => {
    expect(
      resolveNdiChannelIndicator({
        studioBridgePresent: true,
        channel: '3d',
        status: status({ channel: '3d' }),
        pump: fakePump({}),
      }),
    ).toBe('starting')
    expect(
      resolveNdiChannelIndicator({
        studioBridgePresent: true,
        channel: '3d',
        status: status({ channel: '3d' }),
        pump: fakePump({ sourceName: 'HOST (broadcast-web-3d)' }),
      }),
    ).toBe('live')
  })
})

describe('STREAM_MAP_NDI_BRIDGE_SUPPORTED', () => {
  it('is true when 2D stream-map pump is wired (13.4)', () => {
    expect(STREAM_MAP_NDI_BRIDGE_SUPPORTED).toBe(true)
  })
})

describe('resolveNdiChannelIndicator (2d pump)', () => {
  it('reports idle when stream-map pump disabled; starting/live when enabled', () => {
    const disabled: StreamMapNdiPumpHandle = {
      getSourceName: () => null,
      getSdkVersion: () => null,
      getError: () => null,
      getDelayMs: () => 0,
      setDelayMs: (ms) => ms,
      getSendFps: () => 0,
      isEnabled: () => false,
      setEnabled: () => {},
      stop: () => {},
    }
    expect(
      resolveNdiChannelIndicator({
        studioBridgePresent: true,
        channel: '2d',
        status: status({ channel: '2d' }),
        streamMapPump: disabled,
      }),
    ).toBe('idle')

    expect(
      resolveNdiChannelIndicator({
        studioBridgePresent: true,
        channel: '2d',
        status: status({ channel: '2d' }),
        streamMapPump: {
          ...disabled,
          isEnabled: () => true,
          getSourceName: () => null,
        },
      }),
    ).toBe('starting')

    expect(
      resolveNdiChannelIndicator({
        studioBridgePresent: true,
        channel: '2d',
        status: status({ channel: '2d' }),
        streamMapPump: {
          ...disabled,
          isEnabled: () => true,
          getSourceName: () => 'HOST (broadcast-web-2d)',
          getSdkVersion: () => '6',
        },
      }),
    ).toBe('live')
  })
})

describe('NDI multi-channel contract (source)', () => {
  it('SPA defaults to channel ar and documents 3d/2d', () => {
    expect(DEFAULT_NDI_CHANNEL).toBe('ar')
    expect([...NDI_CHANNEL_IDS]).toEqual(['ar', '3d', '2d'])
  })

  it('frame pump passes channel ar explicitly', () => {
    const pumpSrc = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    expect(pumpSrc).toMatch(/channel:\s*NdiChannelId/)
    expect(pumpSrc).toMatch(/DEFAULT_NDI_CHANNEL/)
    expect(pumpSrc).toMatch(/channel,\s*\r?\n\s*width/)
    expect(pumpSrc).toMatch(/\.start\(\{\s*channel,\s*name:/)
  })

  it('3d channel pump tags channel 3d and restores opaque clear', () => {
    const pumpSrc = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    expect(pumpSrc).toMatch(/channel:\s*CHANNEL/)
    expect(pumpSrc).toMatch(/'3d'/)
    expect(pumpSrc).toMatch(/broadcast-web-3d/)
    expect(pumpSrc).toMatch(/withOpaque3dPass|applyOpaque3dPassState/)
    expect(pumpSrc).toMatch(/restoreClearPass/)
    expect(pumpSrc).toMatch(/setEnvironmentOpaqueClearSafe/)
    expect(pumpSrc).toMatch(/onStudioTick/)
    expect(pumpSrc).toMatch(/NdiDelayBuffer/)
    expect(pumpSrc).toMatch(/NDI_3D_DEFAULT_FPS\s*=\s*30/)
    expect(pumpSrc).toMatch(/tryClaimNdiHeavyCapture/)
    expect(pumpSrc).toMatch(/blocking:\s*readback\.mode === ['"]sync['"]/)
    expect(pumpSrc).toMatch(/getSendFps/)
    expect(pumpSrc).toMatch(/createSendFpsCounter/)
    expect(pumpSrc).toMatch(/createNdiAsyncReadback/)
    expect(pumpSrc).not.toMatch(/ndiControllerPanel/)
    expect(pumpSrc).not.toMatch(/scene\/sidebar/)
  })

  it('AR pump defaults 30 fps, studio-tick capture, one FBO per stagger window', () => {
    const pumpSrc = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    expect(pumpSrc).toMatch(/NDI_AR_DEFAULT_FPS\s*=\s*30/)
    expect(pumpSrc).toMatch(/tryClaimNdiHeavyCapture/)
    expect(pumpSrc).toMatch(/blocking:\s*readback\.mode === ['"]sync['"]/)
    expect(pumpSrc).toMatch(/onStudioTick/)
    expect(pumpSrc).toMatch(/getSendFps/)
  })

  it('exports startNdi3dChannelPump from output index', () => {
    const idx = readFileSync(join(here, 'index.ts'), 'utf8')
    expect(idx).toMatch(/startNdi3dChannelPump/)
    expect(idx).toMatch(/ndiOpaquePass/)
    expect(idx).toMatch(/NDI_3D_DEFAULT_FPS/)
    expect(idx).toMatch(/tryClaimNdiHeavyCapture/)
    expect(idx).toMatch(/startDualFrameClock/)
    expect(idx).toMatch(/createSendFpsCounter/)
    expect(idx).toMatch(/readWebGlGpuInfo/)
    expect(idx).toMatch(/createNdiAsyncReadback/)
    expect(idx).toMatch(/createNdi2dAsyncCapture/)
  })

  it('desktop ndiSender is a Map of channel → sender', () => {
    const src = readFileSync(join(repoRoot, 'desktop/ndiSender.cjs'), 'utf8')
    expect(src).toMatch(/const channels = new Map/)
    expect(src).toMatch(/CHANNEL_IDS/)
    expect(src).toMatch(/DEFAULT_CHANNEL/)
    expect(src).toMatch(/getStatusAll/)
    expect(src).toMatch(/'ar' \| '3d' \| '2d'/)
    expect(src).toMatch(/broadcast-web-3d/)
    expect(src).toMatch(/broadcast-web-2d/)
    // AR keeps legacy default name (not renamed to broadcast-web-ar).
    expect(src).toMatch(/ar:\s*'broadcast-web'/)
  })

  it('preload exposes per-channel NDI API', () => {
    const src = readFileSync(join(repoRoot, 'desktop/preload.cjs'), 'utf8')
    expect(src).toMatch(/getStatusAll/)
    expect(src).toMatch(/ndi:statusAll/)
    expect(src).toMatch(/Omitting `channel` defaults/)
    expect(src).toMatch(/'ar'/)
    // Parallel PLT DSP owns races:* — do not regress that block.
    expect(src).toMatch(/races:\s*\{/)
    expect(src).toMatch(/races:save/)
  })
})

describe('NDI controller / capture invariant (source)', () => {
  it('controller panel never calls WebGL readback APIs', () => {
    const src = readFileSync(join(here, 'ndiControllerPanel.ts'), 'utf8')
    expect(src).toMatch(/DOM-only/)
    expect(src).toMatch(/ndi-delay|Delay|clampNdiDelayMs/)
    expect(src).toMatch(/high memory/)
    expect(src).toMatch(/ndi-send-fps-|Send/)
    expect(src).toMatch(/formatNdiSendFps|getSendFps/)
    expect(src).toMatch(/mapToggle\.checked = true/)
    expect(src).not.toMatch(/readRenderTargetPixels/)
    expect(src).not.toMatch(/getContext\(/)
    expect(src).not.toMatch(/WebGLRenderer/)
    expect(src).not.toMatch(/scene\/sidebar/)
    expect(src).not.toMatch(/ndi\.sendFrame/)
  })

  it('ndiFramePump stays free of controller / sidebar imports', () => {
    const pumpSrc = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    expect(pumpSrc).toMatch(/createNdiAsyncReadback/)
    expect(pumpSrc).toMatch(/Sidebar invariant/)
    expect(pumpSrc).toMatch(/NdiDelayBuffer/)
    expect(pumpSrc).toMatch(/getSendFps/)
    expect(pumpSrc).toMatch(/createSendFpsCounter/)
    expect(pumpSrc).not.toMatch(/ndiControllerPanel/)
    expect(pumpSrc).not.toMatch(/scene\/sidebar/)
    expect(pumpSrc).not.toMatch(/document\./)
    expect(pumpSrc).toMatch(/getStudioBridge/)
    expect(pumpSrc).toMatch(/onStudioTick/)
    expect(pumpSrc).not.toMatch(/renderer\.render\s*=/)
  })

  it('exports startNdiControllerPanel from output index', () => {
    const idx = readFileSync(join(here, 'index.ts'), 'utf8')
    expect(idx).toMatch(/startNdiControllerPanel/)
    expect(idx).toMatch(/STREAM_MAP_NDI_BRIDGE_SUPPORTED/)
    expect(idx).toMatch(/resolveNdiChannelIndicator/)
    expect(idx).toMatch(/NDI_CHANNEL_IDS/)
    expect(idx).toMatch(/startStreamMapNdiPump/)
    expect(idx).toMatch(/letterboxRect/)
    expect(idx).toMatch(/ndiDelayBuffer|NdiDelayBuffer|normalizeOutputDelayMs/)
  })

  it('streamMapNdiPump stays free of controller / sidebar imports', () => {
    const pumpSrc = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    expect(pumpSrc).not.toMatch(/ndiControllerPanel/)
    expect(pumpSrc).not.toMatch(/scene\/sidebar/)
    expect(pumpSrc).not.toMatch(/stubHud/)
    expect(pumpSrc).toMatch(/getStudioBridge/)
    expect(pumpSrc).toMatch(/channel/)
    expect(pumpSrc).toMatch(/getSendFps/)
  })
})
