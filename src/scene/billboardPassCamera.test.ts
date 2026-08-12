import { describe, expect, it } from 'vitest'
import { resolveBillboardCamera } from './billboardPassCamera.ts'

describe('resolveBillboardCamera', () => {
  const preview = { id: 'preview' }
  const air = { id: 'air' }

  it('uses preview camera for the on-screen pass', () => {
    expect(
      resolveBillboardCamera('preview', { preview, air }),
    ).toBe(preview)
  })

  it('uses air / active POV camera for the NDI pass', () => {
    expect(resolveBillboardCamera('air', { preview, air })).toBe(air)
  })

  it('returns the shared camera when preview follows air', () => {
    expect(
      resolveBillboardCamera('preview', { preview: air, air }),
    ).toBe(air)
    expect(resolveBillboardCamera('air', { preview: air, air })).toBe(air)
  })
})
