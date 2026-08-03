import { normalizeOutputMode } from './applyOutputMode.ts'
import { SUPPORTED_OUTPUT_MODES, type OutputMode } from './types.ts'

export type OutputModeControlOptions = {
  container: HTMLElement
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
 */
export function startOutputModeControl(
  options: OutputModeControlOptions,
): OutputModeControlHandle {
  let mode = normalizeOutputMode(options.initialMode)

  const root = document.createElement('div')
  root.className = 'output-mode-control'
  options.container.appendChild(root)

  const label = document.createElement('label')
  label.className = 'output-mode-control__label'
  label.htmlFor = 'ops-output-mode'
  label.textContent = 'output'
  root.appendChild(label)

  const select = document.createElement('select')
  select.id = 'ops-output-mode'
  select.className = 'output-mode-control__select'
  select.title =
    'preview (dark) | chroma (key green) | transparent (NDI alpha = active POV) — runtime only; config.json on reload'
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
