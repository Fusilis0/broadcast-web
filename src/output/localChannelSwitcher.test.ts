/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { NDI_3D_OPAQUE_CLEAR_COLOR } from './ndiOpaquePass.ts'
import { PREVIEW_CLEAR_COLOR, TRANSPARENT_CLEAR_COLOR } from './types.ts'
import {
  DEFAULT_LOCAL_CHANNEL_FOCUS,
  LOCAL_CHANNEL_FOCI,
  localFocusNdiInvariant,
  normalizeLocalChannelFocus,
  resolveLocalFocusPresentation,
  resolveScreenClearAppearance,
  startLocalChannelSwitcher,
} from './localChannelSwitcher.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('normalizeLocalChannelFocus', () => {
  it('keeps 2d / 3d / ar', () => {
    expect(normalizeLocalChannelFocus('2d')).toBe('2d')
    expect(normalizeLocalChannelFocus('3d')).toBe('3d')
    expect(normalizeLocalChannelFocus('ar')).toBe('ar')
  })

  it('defaults unknown to ar', () => {
    expect(normalizeLocalChannelFocus(undefined)).toBe(
      DEFAULT_LOCAL_CHANNEL_FOCUS,
    )
    expect(normalizeLocalChannelFocus('preview')).toBe('ar')
    expect(normalizeLocalChannelFocus(1)).toBe('ar')
  })
})

describe('resolveLocalFocusPresentation', () => {
  it('AR + transparent → alpha-safe screen, no forced air target', () => {
    const p = resolveLocalFocusPresentation('ar', 'transparent')
    expect(p).toMatchObject({
      focus: 'ar',
      showWebgl: true,
      streamMapPrimary: false,
      screenClear: 'ar-output-mode',
      opaqueClearSafe: false,
      forceArAirTarget: false,
    })
    expect(resolveScreenClearAppearance(p, 'transparent')).toEqual({
      color: TRANSPARENT_CLEAR_COLOR,
      alpha: 0,
    })
  })

  it('AR + preview → opaque-safe screen for env', () => {
    const p = resolveLocalFocusPresentation('ar', 'preview')
    expect(p.opaqueClearSafe).toBe(true)
    expect(resolveScreenClearAppearance(p, 'preview')).toEqual({
      color: PREVIEW_CLEAR_COLOR,
      alpha: 1,
    })
  })

  it('3D → opaque screen + force AR air-target (NDI alpha stays clean)', () => {
    const p = resolveLocalFocusPresentation('3d', 'transparent')
    expect(p).toMatchObject({
      focus: '3d',
      showWebgl: true,
      streamMapPrimary: false,
      screenClear: 'opaque-3d',
      opaqueClearSafe: true,
      forceArAirTarget: true,
    })
    expect(resolveScreenClearAppearance(p, 'transparent')).toEqual({
      color: NDI_3D_OPAQUE_CLEAR_COLOR,
      alpha: 1,
    })
  })

  it('2D → stream map primary; WebGL may hide; AR clear path retained', () => {
    const p = resolveLocalFocusPresentation('2d', 'transparent')
    expect(p).toMatchObject({
      focus: '2d',
      showWebgl: false,
      streamMapPrimary: true,
      screenClear: 'ar-output-mode',
      forceArAirTarget: false,
    })
  })
})

describe('localFocusNdiInvariant', () => {
  it('never lists NDI stop channels when switching focus', () => {
    for (const from of LOCAL_CHANNEL_FOCI) {
      for (const to of LOCAL_CHANNEL_FOCI) {
        const inv = localFocusNdiInvariant(from, to)
        expect(inv.ndiStopChannels).toEqual([])
      }
    }
  })
})

describe('startLocalChannelSwitcher', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('renders three buttons with pressed state and fires onChange', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const seen: string[] = []
    const handle = startLocalChannelSwitcher({
      container: host,
      initialFocus: 'ar',
      onChange: (f) => {
        seen.push(f)
      },
    })

    const root = host.querySelector('.local-channel-switcher')
    expect(root).toBeTruthy()
    const btns = host.querySelectorAll('.local-channel-switcher__btn')
    expect(btns).toHaveLength(3)

    const ar = host.querySelector(
      '.local-channel-switcher__btn[data-channel="ar"]',
    ) as HTMLButtonElement
    expect(ar.getAttribute('aria-pressed')).toBe('true')
    expect(ar.classList.contains('local-channel-switcher__btn--active')).toBe(
      true,
    )

    const d3 = host.querySelector(
      '.local-channel-switcher__btn[data-channel="3d"]',
    ) as HTMLButtonElement
    d3.click()
    expect(handle.getFocus()).toBe('3d')
    expect(seen).toEqual(['3d'])
    expect(d3.getAttribute('aria-pressed')).toBe('true')
    expect(ar.getAttribute('aria-pressed')).toBe('false')

    handle.setFocus('2d')
    expect(handle.getFocus()).toBe('2d')
    const d2 = host.querySelector(
      '.local-channel-switcher__btn[data-channel="2d"]',
    ) as HTMLButtonElement
    expect(d2.classList.contains('local-channel-switcher__btn--active')).toBe(
      true,
    )

    handle.stop()
    expect(host.querySelector('.local-channel-switcher')).toBeNull()
  })
})

describe('switcher does not stop NDI (source invariant)', () => {
  it('localChannelSwitcher source never calls studio NDI stop APIs', () => {
    const src = readFileSync(join(here, 'localChannelSwitcher.ts'), 'utf8')
    expect(src).not.toMatch(/ndi\.stop\s*\(/)
    expect(src).not.toMatch(/\.stop\(\{\s*channel/)
    expect(src).not.toMatch(
      /startNdiFramePump|startNdi3dChannelPump|startStreamMapNdiPump/,
    )
    expect(src).not.toMatch(/getStudioBridge/)
  })
})
