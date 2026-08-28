import { normalizeArBackground, normalizeOutputMode } from './applyOutputMode.ts'
import {
  SUPPORTED_AR_BACKGROUNDS,
  SUPPORTED_OUTPUT_MODES,
  type ArBackgroundMode,
  type OutputMode,
} from './types.ts'

export type OutputModeControlOptions = {
  container: HTMLElement
  /**
   * Where to insert in `container`. Use `start` when mounting into the Ops
   * sidebar so the control sits above mode/POV (design §A).
   */
  mountAt?: 'start' | 'end'
  initialMode?: unknown
  /** Invoked when ops picks a clear mode (not persisted). */
  onChange?: (mode: OutputMode) => void
}

export type OutputModeControlHandle = {
  setMode: (mode: unknown) => void
  getMode: () => OutputMode
  stop: () => void
}

function hintForMode(mode: OutputMode): string {
  if (mode === 'chroma') return 'vMix key'
  if (mode === 'transparent') return 'NDI=active POV'
  return 'ops view'
}

/**
 * OUT-owned ops control: toggle preview / chroma / transparent at runtime.
 * Does not persist — `config.json` remains source of truth on reload.
 *
 * Compose with `startLocalChannelSwitcher`: this control sets **AR clear**
 * (preview / chroma / transparent); the switcher picks which channel fills
 * the local window. Neither starts/stops NDI.
 */
export function startOutputModeControl(
  options: OutputModeControlOptions,
): OutputModeControlHandle {
  let mode = normalizeOutputMode(options.initialMode)

  const root = document.createElement('div')
  root.className = 'output-mode-control'
  if (options.mountAt === 'start') {
    options.container.insertBefore(root, options.container.firstChild)
  } else {
    options.container.appendChild(root)
  }

  const label = document.createElement('label')
  label.className = 'output-mode-control__label'
  label.htmlFor = 'ops-output-mode'
  label.textContent = 'output'
  root.appendChild(label)

  const select = document.createElement('select')
  select.id = 'ops-output-mode'
  select.className = 'output-mode-control__select'
  select.title =
    'AR clear: preview (dark) | chroma (key green) | transparent (NDI alpha). Independent of local 2D/3D/AR view switcher. Runtime only; config.json on reload'
  for (const m of SUPPORTED_OUTPUT_MODES) {
    const opt = document.createElement('option')
    opt.value = m
    opt.textContent = m
    select.appendChild(opt)
  }
  select.value = mode
  root.appendChild(select)

  const hint = document.createElement('span')
  hint.className = 'output-mode-control__hint'
  hint.textContent = hintForMode(mode)
  root.appendChild(hint)

  select.addEventListener('change', () => {
    mode = normalizeOutputMode(select.value)
    hint.textContent = hintForMode(mode)
    options.onChange?.(mode)
  })

  return {
    setMode(next): void {
      mode = normalizeOutputMode(next)
      select.value = mode
      hint.textContent = hintForMode(mode)
    },
    getMode: () => mode,
    stop(): void {
      root.remove()
    },
  }
}

export type ArBackgroundControlOptions = {
  container: HTMLElement
  mountAt?: 'start' | 'end'
  initialMode?: unknown
  onChange?: (mode: ArBackgroundMode) => void
}

export type ArBackgroundControlHandle = {
  setMode: (mode: unknown) => void
  getMode: () => ArBackgroundMode
  stop: () => void
}

function hintForArBackground(mode: ArBackgroundMode): string {
  return mode === 'video' ? 'in-WebGL underlay' : 'alpha plate'
}

/**
 * OUT-owned ops control: toggle AR `alpha` / `video` background at runtime.
 * Does not persist — `config.json` remains source of truth on reload.
 * Sibling of `startOutputModeControl` (same Output section).
 */
export function startArBackgroundControl(
  options: ArBackgroundControlOptions,
): ArBackgroundControlHandle {
  let mode = normalizeArBackground(options.initialMode)

  const root = document.createElement('div')
  root.className = 'output-mode-control'
  root.setAttribute('data-ops-ar-background', '')
  if (options.mountAt === 'start') {
    options.container.insertBefore(root, options.container.firstChild)
  } else {
    options.container.appendChild(root)
  }

  const label = document.createElement('label')
  label.className = 'output-mode-control__label'
  label.htmlFor = 'ops-ar-background'
  label.textContent = 'AR bg'
  root.appendChild(label)

  const select = document.createElement('select')
  select.id = 'ops-ar-background'
  select.className = 'output-mode-control__select'
  select.title =
    'AR background: alpha (transparent plate, default / fallback) | video (fullscreen texture behind the scene, visible in AR NDI). Runtime only; config.json on reload'
  for (const m of SUPPORTED_AR_BACKGROUNDS) {
    const opt = document.createElement('option')
    opt.value = m
    opt.textContent = m
    select.appendChild(opt)
  }
  select.value = mode
  root.appendChild(select)

  const hint = document.createElement('span')
  hint.className = 'output-mode-control__hint'
  hint.textContent = hintForArBackground(mode)
  root.appendChild(hint)

  select.addEventListener('change', () => {
    mode = normalizeArBackground(select.value)
    hint.textContent = hintForArBackground(mode)
    options.onChange?.(mode)
  })

  return {
    setMode(next): void {
      mode = normalizeArBackground(next)
      select.value = mode
      hint.textContent = hintForArBackground(mode)
    },
    getMode: () => mode,
    stop(): void {
      root.remove()
    },
  }
}
