import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  getSrtBridge,
  idleSrtStatus,
  mergeSrtUrlOptions,
  normalizeSrtStatus,
  validatePovId,
  validateSrtUrl,
  type SrtBridge,
} from './srtBridge.ts'

const require = createRequire(import.meta.url)
const cjs = require('../../desktop/srtHelpers.cjs') as {
  validateSrtUrl: typeof validateSrtUrl
  validatePovId: typeof validatePovId
  mergeSrtUrlOptions: typeof mergeSrtUrlOptions
  normalizeSrtStatus: typeof normalizeSrtStatus
  idleSrtStatus: typeof idleSrtStatus
  buildFfmpegArgv: (
    inputUrl: string,
    opts?: { transcodeToH264?: boolean },
  ) => string[]
  redactSrtUrl: (href: string) => string
}

describe('validateSrtUrl', () => {
  it('accepts caller srt://host:port and trims', () => {
    const ok = validateSrtUrl('  srt://10.0.0.8:8890  ')
    expect(ok).toEqual({ ok: true, href: 'srt://10.0.0.8:8890' })
    expect(cjs.validateSrtUrl('  srt://10.0.0.8:8890  ')).toEqual(ok)
  })

  it('rejects empty, non-srt schemes, listener form, and missing port', () => {
    expect(validateSrtUrl('')).toMatchObject({ ok: false })
    expect(validateSrtUrl(null)).toMatchObject({ ok: false })
    expect(validateSrtUrl('https://example.com/whep')).toMatchObject({
      ok: false,
    })
    expect(validateSrtUrl('udp://10.0.0.8:5000')).toMatchObject({ ok: false })
    expect(validateSrtUrl('srt://:9000')).toMatchObject({ ok: false })
    expect(validateSrtUrl('srt://10.0.0.8')).toMatchObject({ ok: false })
    expect(cjs.validateSrtUrl('srt://:9000').ok).toBe(false)
    expect(cjs.validateSrtUrl('rtmp://10.0.0.8/live').ok).toBe(false)
  })
})

describe('validatePovId', () => {
  it('trims and reserves "all"', () => {
    expect(validatePovId('  cam-1  ')).toEqual({ ok: true, povId: 'cam-1' })
    expect(validatePovId('all')).toMatchObject({ ok: false })
    expect(validatePovId('')).toMatchObject({ ok: false })
    expect(cjs.validatePovId('ALL')).toMatchObject({ ok: false })
  })
})

describe('mergeSrtUrlOptions', () => {
  it('writes streamid, latency in microseconds, and passphrase', () => {
    const href = mergeSrtUrlOptions('srt://10.0.0.8:8890', {
      streamId: 'dji-a',
      latencyMs: 120,
      passphrase: 'secret',
    })
    const parsed = new URL(href)
    expect(parsed.searchParams.get('passphrase')).toBe('secret')
    expect(parsed.searchParams.get('timeout')).toBe('5000000')
    expect(parsed.searchParams.get('mode')).toBe('caller')
    expect(
      cjs.mergeSrtUrlOptions('srt://10.0.0.8:8890', {
        streamId: 'dji-a',
        latencyMs: 120,
        passphrase: 'secret',
      }),
    ).toBe(href)
  })

  it('omits empty options and rejects non-finite latencyMs', () => {
    expect(mergeSrtUrlOptions('srt://10.0.0.8:8890', {})).toBe(
      'srt://10.0.0.8:8890?timeout=5000000&mode=caller',
    )
    expect(() =>
      mergeSrtUrlOptions('srt://10.0.0.8:8890', { latencyMs: 'nope' }),
    ).toThrow(/finite/)
  })
})

describe('normalizeSrtStatus', () => {
  it('fills defaults and coerces lastError', () => {
    expect(normalizeSrtStatus(undefined, 'cam-1')).toEqual(
      idleSrtStatus('cam-1'),
    )
    expect(
      normalizeSrtStatus({
        povId: 'cam-1',
        state: 'bogus',
        bitrateKbps: -4,
        lastError: 7,
      }),
    ).toEqual({
      povId: 'cam-1',
      state: 'idle',
      bitrateKbps: 0,
      lastError: '7',
    })
    expect(
      normalizeSrtStatus({
        povId: 'cam-1',
        state: 'live',
        bitrateKbps: 8000,
        lastError: '',
      }),
    ).toEqual({
      povId: 'cam-1',
      state: 'live',
      bitrateKbps: 8000,
      lastError: null,
    })
    expect(cjs.normalizeSrtStatus({ state: 'error' }, 'x')).toEqual(
      normalizeSrtStatus({ state: 'error' }, 'x'),
    )
  })
})

describe('buildFfmpegArgv (main-process, PTS-safe)', () => {
  it('is bitstream copy with no restamp flags', () => {
    const argv = cjs.buildFfmpegArgv('srt://10.0.0.8:8890?latency=120000')
    const i = argv.indexOf('-i')
    expect(argv[i + 1]).toBe('srt://10.0.0.8:8890?latency=120000')
    expect(argv[i - 2]).toBe('-f')
    expect(argv[i - 1]).toBe('mpegts')
    expect(argv).toContain('-analyzeduration')
    expect(argv[argv.indexOf('-analyzeduration') + 1]).toBe('0')
    expect(argv).toContain('pipe:1')
    const c = argv.indexOf('-c')
    expect(argv[c + 1]).toBe('copy')
    expect(argv).toContain('-copyts')
    expect(argv[argv.indexOf('-mpegts_copyts') + 1]).toBe('1')
    expect(argv[argv.indexOf('-muxdelay') + 1]).toBe('0')
    expect(argv[argv.indexOf('-muxpreload') + 1]).toBe('0')
    expect(argv[argv.indexOf('-avoid_negative_ts') + 1]).toBe('disabled')
    expect(argv.join(' ')).not.toMatch(/libx264|libx265|genpts/)
    expect(argv).not.toContain('-streamid')
    expect(argv).not.toContain('-copytb')
    expect(argv).not.toContain('-enc_time_base')
    expect(argv.join(' ')).not.toMatch(/setpts|setts/)
  })

  it('transcodeToH264 uses libx264 copyts instead of bitstream copy', () => {
    const argv = cjs.buildFfmpegArgv('srt://10.0.0.8:8890', {
      transcodeToH264: true,
    })
    expect(argv).toContain('libx264')
    expect(argv).toContain('zerolatency')
    expect(argv).toContain('repeat-headers=1:bframes=0:keyint=30:min-keyint=30:scenecut=0')
    expect(argv).toContain('-copyts')
    expect(argv[argv.indexOf('-mpegts_copyts') + 1]).toBe('1')
    expect(argv[argv.indexOf('-muxdelay') + 1]).toBe('0')
    expect(argv[argv.indexOf('-copytb') + 1]).toBe('1')
    expect(argv[argv.indexOf('-enc_time_base') + 1]).toBe('1:90000')
    expect(argv[argv.indexOf('-fps_mode') + 1]).toBe('passthrough')
    expect(argv.join(' ')).not.toMatch(/(^| )-c copy( |$)/)
    expect(argv.join(' ')).not.toMatch(/genpts|start_at_zero|PTS-STARTPTS|nvenc|qsv|amf|fps=/)
  })

  it('serializes streamid colons without percent-encoding', () => {
    const href =
      'srt://49.13.20.49:9000?mode=caller&streamid=read:cam1:pub1:k3q9x7'
    const ok = validateSrtUrl(href)
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    expect(ok.href).toContain('streamid=read:cam1:pub1:k3q9x7')
    expect(ok.href).not.toContain('%3A')
    expect(cjs.validateSrtUrl(href).href).not.toContain('%3A')
    expect(
      cjs.redactSrtUrl(href),
    ).toBe(
      'srt://49.13.20.49:9000?mode=caller&streamid=read:cam1:pub1:***',
    )
  })

  it('redacts passphrase from logged URLs', () => {
    const redacted = cjs.redactSrtUrl(
      'srt://10.0.0.8:8890?passphrase=secret&streamid=a',
    )
    expect(redacted).toContain('passphrase=***')
    expect(redacted).not.toContain('secret')
  })
})

describe('getSrtBridge', () => {
  it('returns null when window / studio / srt is missing (plain browser)', () => {
    expect(getSrtBridge()).toBeNull()
    const g = globalThis as { window?: { broadcastStudio?: unknown } }
    const prev = g.window
    g.window = {}
    expect(getSrtBridge()).toBeNull()
    g.window = {
      broadcastStudio: { isStudio: true },
    }
    expect(getSrtBridge()).toBeNull()
    g.window = prev
  })

  it('returns the srt namespace when the studio preload is present', () => {
    const srt: SrtBridge = {
      open: async () => ({ ok: true, povId: 'cam-1' }),
      close: async () => {},
      getStatus: async () => ({}),
      onSrtData: () => () => {},
      onSrtStatus: () => () => {},
    }
    const g = globalThis as { window?: { broadcastStudio?: unknown } }
    const prev = g.window
    g.window = { broadcastStudio: { isStudio: true, srt } }
    expect(getSrtBridge()).toBe(srt)
    g.window = prev
    expect(getSrtBridge()).toBeNull()
  })
})
