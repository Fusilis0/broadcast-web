import { describe, expect, it } from 'vitest'
import {
  buildSrtCallerUrl,
  compactSrtByPovId,
  formatSrtSituation,
  parseSrtByPovId,
  pickSrtRowError,
  promotePublishPathToStreamId,
  redactSrtTemplateForPack,
  redactSrtUrl,
  redactStreamIdParam,
  shouldUseSrtCatalog,
  srtDecodeStallHint,
} from './srtCallerUrl.ts'

const TEMPLATE =
  'srt://49.13.20.49:9000?mode=caller&streamid=read:cam{srtId}:pub{srtId}:TOKEN'

describe('buildSrtCallerUrl', () => {
  it('substitutes {srtId} in both streamid slots; telemetry id is unused', () => {
    const got = buildSrtCallerUrl(TEMPLATE, '30')
    expect(got.ok).toBe(true)
    if (!got.ok) return
    const parsed = new URL(got.href)
    expect(parsed.searchParams.get('streamid')).toBe('read:cam30:pub30:TOKEN')
    expect(parsed.searchParams.get('mode')).toBe('caller')
    expect(got.href).not.toContain('{srtId}')
    // Telemetry id "5" must not appear even if we pass srtId 30.
    expect(parsed.searchParams.get('streamid')).not.toMatch(/cam5|pub5/)
  })

  it('treats {id} as an alias for {srtId}', () => {
    const tmpl =
      'srt://49.13.20.49:9000?mode=caller&streamid=read:cam{id}:pub{id}:x'
    const got = buildSrtCallerUrl(tmpl, '7')
    expect(got.ok).toBe(true)
    if (!got.ok) return
    expect(new URL(got.href).searchParams.get('streamid')).toBe(
      'read:cam7:pub7:x',
    )
  })

  it('rejects empty SRT id (do not open)', () => {
    expect(buildSrtCallerUrl(TEMPLATE, '')).toEqual({
      ok: false,
      error: 'SRT id is empty',
    })
    expect(buildSrtCallerUrl(TEMPLATE, '   ')).toMatchObject({ ok: false })
    expect(buildSrtCallerUrl(TEMPLATE, null)).toMatchObject({ ok: false })
  })

  it('rejects a template with no {srtId} / {id} placeholder', () => {
    const got = buildSrtCallerUrl(
      'srt://49.13.20.49:9000?mode=caller&streamid=read:cam1:pub1:x',
      '30',
    )
    expect(got).toEqual({
      ok: false,
      error: 'SRT template missing {srtId} placeholder',
    })
  })

  it('escape hatch: empty template + full srt:// in srtId', () => {
    const got = buildSrtCallerUrl(
      '',
      'srt://10.0.0.8:8890?streamid=read:cam9:pub9:x',
    )
    expect(got.ok).toBe(true)
    if (!got.ok) return
    expect(got.href).toContain('10.0.0.8')
    expect(new URL(got.href).searchParams.get('mode')).toBe('caller')
  })

  it('rejects listener URLs (no host / mode=listener)', () => {
    expect(buildSrtCallerUrl('srt://:9000?mode=caller&streamid=x{srtId}', '30'))
      .toMatchObject({ ok: false })
    expect(
      buildSrtCallerUrl(
        'srt://49.13.20.49:9000?mode=listener&streamid=cam{srtId}',
        '30',
      ),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/caller/i) })
  })

  it('keeps mode=caller when already set; adds it when missing', () => {
    const withMode = buildSrtCallerUrl(
      'srt://h.example:9000?mode=caller&streamid=cam{srtId}',
      '1',
    )
    expect(withMode.ok).toBe(true)
    if (withMode.ok) {
      expect(new URL(withMode.href).searchParams.get('mode')).toBe('caller')
    }
    const noMode = buildSrtCallerUrl(
      'srt://h.example:9000?streamid=cam{srtId}',
      '1',
    )
    expect(noMode.ok).toBe(true)
    if (noMode.ok) {
      expect(new URL(noMode.href).searchParams.get('mode')).toBe('caller')
    }
  })
})

describe('redactSrtUrl / pack template', () => {
  it('redacts streamid token and passphrase, never the full secret', () => {
    const href =
      'srt://49.13.20.49:9000?mode=caller&streamid=read:cam30:pub30:super-secret&passphrase=pw'
    const redacted = redactSrtUrl(href)
    expect(redacted).not.toContain('super-secret')
    expect(redacted).not.toContain('pw')
    expect(new URL(redacted).searchParams.get('streamid')).toBe(
      'read:cam30:pub30:***',
    )
    expect(new URL(redacted).searchParams.get('passphrase')).toBe('***')
    expect(redactStreamIdParam('read:cam30:pub30:TOKEN')).toBe(
      'read:cam30:pub30:***',
    )
  })

  it('pack redact strips the token segment and passphrase, keeps {srtId}', () => {
    const packed = redactSrtTemplateForPack(TEMPLATE)
    expect(packed).not.toContain('TOKEN')
    expect(packed).toContain('{srtId}')
    const sid = new URL(packed).searchParams.get('streamid')
    expect(sid).toBe('read:cam{srtId}:pub{srtId}:')
    expect(new URL(packed).searchParams.get('passphrase')).toBeNull()
  })

  it('redacts last colon-segment of a pathname read:camN:pubN:token', () => {
    const href =
      'srt://49.13.20.49:9000/read:cam18:pub18:e8r4m3?mode=caller'
    const redacted = redactSrtUrl(href)
    expect(redacted).not.toContain('e8r4m3')
    expect(decodeURIComponent(new URL(redacted).pathname)).toBe(
      '/read:cam18:pub18:***',
    )
  })
})

describe('promotePublishPathToStreamId', () => {
  it('converts /read:camN:… path to query streamid', () => {
    const got = buildSrtCallerUrl(
      'srt://49.13.20.49:9000/read:cam{srtId}:pub{srtId}:tok',
      '18',
    )
    expect(got.ok).toBe(true)
    if (!got.ok) return
    const parsed = new URL(got.href)
    expect(parsed.searchParams.get('streamid')).toBe('read:cam18:pub18:tok')
    expect(parsed.searchParams.get('mode')).toBe('caller')
    expect(parsed.pathname === '/' || parsed.pathname === '').toBe(true)
    expect(
      promotePublishPathToStreamId(
        'srt://49.13.20.49:9000/read:cam18:pub18:e8r4m3',
      ),
    ).not.toMatch(/\/read:cam18/)
  })

  it('still converts legacy /publish:camN:… path to query streamid', () => {
    expect(
      promotePublishPathToStreamId(
        'srt://49.13.20.49:9000/publish:cam18:pub18:e8r4m3',
      ),
    ).not.toMatch(/\/publish:cam18/)
    const parsed = new URL(
      promotePublishPathToStreamId(
        'srt://49.13.20.49:9000/publish:cam18:pub18:e8r4m3',
      ),
    )
    expect(parsed.searchParams.get('streamid')).toBe('publish:cam18:pub18:e8r4m3')
  })
})

describe('shouldUseSrtCatalog', () => {
  it('uses the catalog for empty and dummy host templates', () => {
    expect(shouldUseSrtCatalog('')).toBe(true)
    expect(shouldUseSrtCatalog('   ')).toBe(true)
    expect(
      shouldUseSrtCatalog(
        'srt://host:9000?mode=caller&streamid=read:cam{id}',
      ),
    ).toBe(true)
    expect(
      shouldUseSrtCatalog(
        'srt://host:9000?mode=caller&streamid=read:cam{srtId}:pub{srtId}:',
      ),
    ).toBe(true)
    expect(
      shouldUseSrtCatalog(
        'srt://49.13.20.49:9000?mode=caller&streamid=read:cam{srtId}:pub{srtId}:tok',
      ),
    ).toBe(false)
  })
})

describe('formatSrtSituation', () => {
  it('names colour bars as a placeholder when video has no picture', () => {
    const text = formatSrtSituation({
      studio: true,
      arBackground: 'video',
      hasPicture: false,
      rows: [
        {
          povId: '1',
          srtId: '18',
          state: 'connecting',
          bitrateKbps: 0,
          lastError: null,
          redactedUrl: 'srt://49.13.20.49:9000?mode=caller&streamid=read:cam18:pub18:***',
          framesDecoded: 0,
          hasPicture: false,
        },
      ],
    })
    expect(text).toMatch(/colour bars = placeholder/)
    expect(text).toContain('pov 1 srt=18')
    expect(text).toContain('connecting')
    expect(text).not.toContain('e8r4m3')
  })

  it('shows codec, demux, and ffmpeg→h264 on a live stall row', () => {
    const text = formatSrtSituation({
      studio: true,
      arBackground: 'video',
      hasPicture: false,
      rows: [
        {
          povId: '1',
          srtId: '1',
          state: 'live',
          bitrateKbps: 3671,
          lastError: 'demux=40 WebCodecs produced 0 frames',
          redactedUrl: 'srt://49.13.20.49:9000?mode=caller&streamid=read:cam1:pub1:***',
          framesDecoded: 0,
          hasPicture: false,
          codec: 'hevc',
          accessUnits: 40,
          bytesPushed: 120000,
          waitingForKeyframe: true,
          transcoding: true,
        },
      ],
    })
    expect(text).toContain('codec=hevc')
    expect(text).toContain('demux=40')
    expect(text).toContain('120000B')
    expect(text).toContain('ffmpeg→h264')
    expect(text).toContain('waiting-key')
    expect(text).toContain('err=demux=40 WebCodecs produced 0 frames')
  })
})

describe('srtDecodeStallHint', () => {
  const live = {
    liveLongEnough: true,
    state: 'live',
    bitrateKbps: 3671,
    framesDecoded: 0,
    accessUnits: 0,
    bytesPushed: 0,
  }

  it('is silent until SRT has been live long enough', () => {
    expect(srtDecodeStallHint({ ...live, liveLongEnough: false })).toBeNull()
  })

  it('names a missing renderer slot vs demux vs WebCodecs', () => {
    expect(
      srtDecodeStallHint({ ...live, bytesPushed: null, accessUnits: null }),
    ).toMatch(/no demux slot/)
    expect(srtDecodeStallHint({ ...live, bytesPushed: 0 })).toMatch(/0 MPEG-TS bytes/)
    expect(
      srtDecodeStallHint({ ...live, bytesPushed: 8000, accessUnits: 0 }),
    ).toMatch(/0 access units/)
    expect(
      srtDecodeStallHint({
        ...live,
        bytesPushed: 8000,
        accessUnits: 12,
        waitingForKeyframe: true,
      }),
    ).toMatch(/waiting for a keyframe/)
    expect(
      srtDecodeStallHint({
        ...live,
        bytesPushed: 8000,
        accessUnits: 12,
        waitingForKeyframe: false,
      }),
    ).toMatch(/WebCodecs produced 0 frames/)
  })

  it('prefers decodeError over SRT lastError=null', () => {
    expect(
      pickSrtRowError({
        decodeError: 'Decoder error: failed',
        decodeNote: null,
        srtLastError: null,
        liveLongEnough: true,
        state: 'live',
        bitrateKbps: 3671,
        framesDecoded: 0,
        accessUnits: 12,
        bytesPushed: 8000,
      }),
    ).toBe('Decoder error: failed')
  })
})

describe('parseSrtByPovId', () => {
  it('soft-parses; drops junk; omits empty', () => {
    expect(
      parseSrtByPovId({ '5': '30', '6': ' 31 ', '': '9', x: 1, y: '' }),
    ).toEqual({ '5': '30', '6': '31' })
    expect(parseSrtByPovId({})).toBeUndefined()
    expect(parseSrtByPovId(null)).toBeUndefined()
    expect(compactSrtByPovId({ '5': '30', '6': '' })).toEqual({ '5': '30' })
  })
})
