import { normalizeOutputMode } from './applyOutputMode.ts'
import { SUPPORTED_OUTPUT_MODES, type OutputMode } from './types.ts'

export type OutputModeControlOptions = {
  container: HTMLElement
  initialMode?: unknown
  /** Invoked when ops picks preview | chroma (not persisted). */
  onChange?: (mode: OutputMode) => void
}

export type OutputModeControlHandle = {
  setMode: (mode: unknown) => void
  getMode: () => OutputMode
  stop: () => void
}

/**
 * OUT-owned ops control: toggle `preview` / `chroma` at runtime.
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
    'preview (dark) | chroma (key green) — runtime only; config.json on reload'
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
  hint.textContent = mode === 'chroma' ? 'vMix key' : 'ops view'
  root.appendChild(hint)

  select.addEventListener('change', () => {
    mode = normalizeOutputMode(select.value)
    hint.textContent = mode === 'chroma' ? 'vMix key' : 'ops view'
    options.onChange?.(mode)
  })

  return {
    setMode(next): void {
      mode = normalizeOutputMode(next)
      select.value = mode
      hint.textContent = mode === 'chroma' ? 'vMix key' : 'ops view'
    },
    getMode: () => mode,
    stop(): void {
      root.remove()
    },
  }
}
