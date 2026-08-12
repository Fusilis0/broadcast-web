import { describe, expect, it } from 'vitest'
import { authorizeWrite, parseBearerToken } from '../src/auth.ts'

describe('parseBearerToken', () => {
  it('extracts bearer value', () => {
    expect(parseBearerToken('Bearer abc')).toBe('abc')
    expect(parseBearerToken('bearer  xyz  ')).toBe('xyz')
  })

  it('returns undefined for missing/malformed', () => {
    expect(parseBearerToken(undefined)).toBeUndefined()
    expect(parseBearerToken('Basic abc')).toBeUndefined()
    expect(parseBearerToken('Bearer ')).toBeUndefined()
  })
})

describe('authorizeWrite', () => {
  it('allows open writes when no tokens configured', () => {
    expect(authorizeWrite(undefined, {})).toEqual({ ok: true, role: 'open' })
  })

  it('allows editor bearer', () => {
    expect(
      authorizeWrite('Bearer ed', { editorToken: 'ed', airToken: 'air' }),
    ).toEqual({ ok: true, role: 'editor' })
  })

  it('forbids air bearer on writes', () => {
    expect(
      authorizeWrite('Bearer air', { editorToken: 'ed', airToken: 'air' }),
    ).toEqual({ ok: false, status: 403, error: 'forbidden', role: 'air' })
  })

  it('unauthorized when token missing or unknown', () => {
    expect(authorizeWrite(undefined, { editorToken: 'ed' })).toEqual({
      ok: false,
      status: 401,
      error: 'unauthorized',
    })
    expect(authorizeWrite('Bearer nope', { editorToken: 'ed' })).toEqual({
      ok: false,
      status: 401,
      error: 'unauthorized',
    })
  })
})
