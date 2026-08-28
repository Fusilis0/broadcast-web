import { describe, expect, it } from 'vitest'
import { redactSrtUrl } from './srtCallerUrl.ts'
import {
  SRT_RELAY_HOST,
  SRT_RELAY_PORT,
  SRT_STREAM_CATALOG,
  normalizeSrtCatalogId,
  resolveSrtUrlForId,
} from './srtStreamCatalog.ts'

const ID_18_STREAMID = 'read:cam18:pub18:e8r4m3'
const ID_18_TOKEN = 'e8r4m3'

describe('resolveSrtUrlForId', () => {
  it('resolves every catalog id to caller URL on the locked host', () => {
    const keys = Object.keys(SRT_STREAM_CATALOG)
    expect(keys).toHaveLength(27)
    for (const id of keys) {
      const got = resolveSrtUrlForId(id)
      expect(got.ok).toBe(true)
      if (!got.ok) continue
      const parsed = new URL(got.href)
      expect(parsed.hostname).toBe(SRT_RELAY_HOST)
      expect(parsed.port).toBe(SRT_RELAY_PORT)
      expect(parsed.searchParams.get('mode')).toBe('caller')
      expect(parsed.searchParams.get('streamid')).toBe(SRT_STREAM_CATALOG[id])
      expect(SRT_STREAM_CATALOG[id]).toMatch(new RegExp(`^read:cam${id}:pub${id}:`))
      expect(parsed.pathname === '/' || parsed.pathname === '').toBe(true)
    }
  })

  it('id 18 is the locked fixture (query streamid, not path)', () => {
    const got = resolveSrtUrlForId('18')
    expect(got.ok).toBe(true)
    if (!got.ok) return
    const parsed = new URL(got.href)
    expect(parsed.hostname).toBe('49.13.20.49')
    expect(parsed.port).toBe('9000')
    expect(parsed.searchParams.get('streamid')).toBe(ID_18_STREAMID)
    expect(parsed.searchParams.get('mode')).toBe('caller')
    expect(parsed.pathname === '/' || parsed.pathname === '').toBe(true)
    expect(got.href).not.toMatch(/\/read:cam18/)
    expect(got.href).not.toContain('publish:')
    const redacted = redactSrtUrl(got.href)
    expect(redacted).not.toContain(ID_18_TOKEN)
    expect(new URL(redacted).searchParams.get('streamid')).toBe(
      'read:cam18:pub18:***',
    )
  })

  it('treats cam18 / CAM18 as 18', () => {
    expect(normalizeSrtCatalogId('cam18')).toBe('18')
    expect(normalizeSrtCatalogId('CAM18')).toBe('18')
    const a = resolveSrtUrlForId('cam18')
    const b = resolveSrtUrlForId('18')
    expect(a).toEqual(b)
    expect(a.ok).toBe(true)
  })

  it('does not treat 1 as cam10', () => {
    const one = resolveSrtUrlForId('1')
    expect(one.ok).toBe(true)
    if (!one.ok) return
    expect(new URL(one.href).searchParams.get('streamid')).toBe(
      'read:cam1:pub1:k3q9x7',
    )
    expect(one.href).toContain('streamid=read:cam1:pub1:k3q9x7')
    expect(one.href).not.toContain('%3A')
    expect(new URL(one.href).searchParams.get('streamid')).not.toMatch(/cam10/)
  })

  it('unknown id 30 does not invent a URL', () => {
    expect(resolveSrtUrlForId('30')).toEqual({
      ok: false,
      error: 'SRT id "30" is not in the catalog',
    })
    expect(resolveSrtUrlForId('cam30')).toMatchObject({ ok: false })
    expect(resolveSrtUrlForId('28')).toMatchObject({ ok: false })
  })

  it('empty id does not open', () => {
    expect(resolveSrtUrlForId('')).toEqual({
      ok: false,
      error: 'SRT id is empty',
    })
    expect(resolveSrtUrlForId('   ')).toMatchObject({ ok: false })
    expect(resolveSrtUrlForId(null)).toMatchObject({ ok: false })
  })
})
