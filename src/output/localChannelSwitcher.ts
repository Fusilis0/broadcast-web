import {
  NDI_3D_OPAQUE_CLEAR_COLOR,
} from './ndiOpaquePass.ts'
import {
  normalizeOutputMode,
  resolveClearAppearance,
} from './applyOutputMode.ts'
import type { ApplyOutputModeOptions } from './types.ts'

/**
 * Local preview focus — which always-on channel fills the operator window.
 * Independent of `outputMode` (AR clear) and of NDI start/stop.
 *
 * @see docs/architecture/multi-output-streaming.md §5
 */
export type LocalChannelFocus = '2d' | '3d' | 'ar'

export const LOCAL_CHANNEL_FOCI: readonly LocalChannelFocus[] = [
  '2d',
  '3d',
  'ar',
] as const

export const DEFAULT_LOCAL_CHANNEL_FOCUS: LocalChannelFocus = 'ar'

/** Labels for the three big switcher buttons (Ops strip). */
export const LOCAL_CHANNEL_LABELS: Record<LocalChannelFocus, string> = {
  '2d': '2D',
  '3d': '3D',
  ar: 'AR',
}

export function isLocalChannelFocus(raw: unknown): raw is LocalChannelFocus {
  return raw === '2d' || raw === '3d' || raw === 'ar'
}

/** Unknown → `ar` (today's default local view). */
export function normalizeLocalChannelFocus(raw: unknown): LocalChannelFocus {
  return isLocalChannelFocus(raw) ? raw : DEFAULT_LOCAL_CHANNEL_FOCUS
}

/**
 * Pure screen-presentation plan for a focus + stored AR `outputMode`.
 * Does **not** start/stop NDI — only describes local window chrome/clear.
 */
export type LocalFocusPresentation = {
  focus: LocalChannelFocus
  /** Show WebGL canvas as the primary local picture. */
  showWebgl: boolean
  /** Stream map as large primary local view (not PiP-only). */
  streamMapPrimary: boolean
  /**
   * Screen WebGL clear path:
   * - `ar-output-mode` — apply `outputMode` clear (preview/chroma/transparent)
   * - `opaque-3d` — match 3D NDI opaque plate for the local screen pass
   */
  screenClear: 'ar-output-mode' | 'opaque-3d'
  /** SCN sea/sky gate for the **screen** pass. */
  opaqueClearSafe: boolean
  /**
   * When true, AR NDI must not sample the screen framebuffer (local clear
   * differs from the AR plate). Force air-target + AR clear for capture.
   */
  forceArAirTarget: boolean
}

/**
 * Resolve local presentation. `arOutputMode` is the Ops clear control value
 * (still governs AR plate / NDI alpha even when focus is 3D or 2D).
 */
export function resolveLocalFocusPresentation(
  focusRaw: unknown,
  arOutputModeRaw: unknown,
  options?: ApplyOutputModeOptions,
): LocalFocusPresentation {
  const focus = normalizeLocalChannelFocus(focusRaw)
  const arMode = normalizeOutputMode(arOutputModeRaw)
  const arClear = resolveClearAppearance(arMode, options)

  if (focus === '2d') {
    return {
      focus,
      showWebgl: false,
      streamMapPrimary: true,
      screenClear: 'ar-output-mode',
      opaqueClearSafe: arClear.alpha >= 1,
      forceArAirTarget: false,
    }
  }

  if (focus === '3d') {
    return {
      focus,
      showWebgl: true,
      streamMapPrimary: false,
      screenClear: 'opaque-3d',
      opaqueClearSafe: true,
      forceArAirTarget: true,
    }
  }

  // AR — restore normal outputMode clear path
  return {
    focus: 'ar',
    showWebgl: true,
    streamMapPrimary: false,
    screenClear: 'ar-output-mode',
    opaqueClearSafe: arClear.alpha >= 1,
    forceArAirTarget: false,
  }
}

/** Clear color/alpha to apply to the local WebGL screen for a presentation. */
export function resolveScreenClearAppearance(
  presentation: LocalFocusPresentation,
  arOutputModeRaw: unknown,
  options?: ApplyOutputModeOptions,
): { color: number; alpha: number } {
  if (presentation.screenClear === 'opaque-3d') {
    return { color: NDI_3D_OPAQUE_CLEAR_COLOR, alpha: 1 }
  }
  return resolveClearAppearance(arOutputModeRaw, options)
}

/**
 * Invariant helper for tests / docs: switching local focus must never imply
 * stopping NDI pumps. Returns actions that are allowed (presentation only).
 */
export type LocalFocusNdiInvariant = {
  /** Always empty — switcher never requests pump stop. */
  ndiStopChannels: readonly string[]
  mayChangeScreenClear: boolean
  mayToggleStreamMapPrimary: boolean
}

export function localFocusNdiInvariant(
  _from: LocalChannelFocus,
  _to: LocalChannelFocus,
): LocalFocusNdiInvariant {
  return {
    ndiStopChannels: [],
    mayChangeScreenClear: true,
    mayToggleStreamMapPrimary: true,
  }
}

export type LocalChannelSwitcherOptions = {
  container: HTMLElement
  /** Insert at start of container (Ops section) or append. Default `start`. */
  mountAt?: 'start' | 'end'
  initialFocus?: unknown
  /**
   * Called when the operator picks a channel. Must not call `ndi.stop`.
   * Parent applies presentation (clear / map / chrome).
   */
  onChange?: (focus: LocalChannelFocus) => void
}

export type LocalChannelSwitcherHandle = {
  setFocus: (next: unknown) => void
  getFocus: () => LocalChannelFocus
  stop: () => void
}

/**
 * Prominent three-button local focus control (`2D` | `3D` | `AR`).
 * DOM-only — never touches NDI pumps. Compose with `startOutputModeControl`
 * (`outputMode` = AR clear; this = which channel fills the window).
 */
export function startLocalChannelSwitcher(
  options: LocalChannelSwitcherOptions,
): LocalChannelSwitcherHandle {
  let focus = normalizeLocalChannelFocus(options.initialFocus)

  const root = document.createElement('div')
  root.className = 'local-channel-switcher'
  root.setAttribute('data-local-focus', focus)
  root.setAttribute(
    'title',
    'Local preview only — AR / 3D / 2D NDI keep running. outputMode still sets AR clear.',
  )

  const heading = document.createElement('div')
  heading.className = 'local-channel-switcher__label'
  heading.textContent = 'local view'
  root.appendChild(heading)

  const group = document.createElement('div')
  group.className = 'local-channel-switcher__buttons'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', 'Local channel focus')
  root.appendChild(group)

  const buttons = new Map<LocalChannelFocus, HTMLButtonElement>()

  function syncPressed(): void {
    root.setAttribute('data-local-focus', focus)
    for (const id of LOCAL_CHANNEL_FOCI) {
      const btn = buttons.get(id)
      if (!btn) continue
      const on = id === focus
      btn.classList.toggle('local-channel-switcher__btn--active', on)
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
  }

  for (const id of LOCAL_CHANNEL_FOCI) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'local-channel-switcher__btn'
    btn.dataset.channel = id
    btn.textContent = LOCAL_CHANNEL_LABELS[id]
    btn.addEventListener('click', () => {
      if (id === focus) return
      focus = id
      syncPressed()
      options.onChange?.(focus)
    })
    buttons.set(id, btn)
    group.appendChild(btn)
  }

  const hint = document.createElement('span')
  hint.className = 'local-channel-switcher__hint'
  hint.textContent = 'NDI stays on'
  root.appendChild(hint)

  syncPressed()

  if (options.mountAt === 'end') {
    options.container.appendChild(root)
  } else {
    options.container.insertBefore(root, options.container.firstChild)
  }

  return {
    setFocus(next): void {
      focus = normalizeLocalChannelFocus(next)
      syncPressed()
    },
    getFocus: () => focus,
    stop(): void {
      root.remove()
    },
  }
}
