/**
 * Promise-based single-field prompt overlay.
 *
 * Electron unconditionally throws on `window.prompt()` (won't fix upstream).
 * Use this DOM modal everywhere a text prompt is needed — works in browser and
 * Electron without IPC. Cancel semantics match native `prompt`: resolve `null`.
 */

export type PromptModalOptions = {
  /** Host element (default: `document.body`). */
  parent?: HTMLElement
}

/**
 * Mimic `window.prompt(message, defaultValue)` with a non-blocking DOM modal.
 * Resolves with the input string on OK/Enter, or `null` on Cancel/Escape/backdrop.
 */
export function promptModal(
  message: string,
  defaultValue = '',
  options: PromptModalOptions = {},
): Promise<string | null> {
  const parent = options.parent ?? document.body

  return new Promise((resolve) => {
    let settled = false

    const root = document.createElement('div')
    root.className = 'prompt-modal'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-modal', 'true')

    const backdrop = document.createElement('div')
    backdrop.className = 'prompt-modal__backdrop'

    const card = document.createElement('div')
    card.className = 'prompt-modal__card'

    const form = document.createElement('form')
    form.className = 'prompt-modal__form'
    form.setAttribute('autocomplete', 'off')

    const msg = document.createElement('div')
    msg.className = 'prompt-modal__message'
    msg.textContent = message

    const input = document.createElement('input')
    input.className = 'prompt-modal__input'
    input.type = 'text'
    input.value = defaultValue
    input.setAttribute('aria-label', message.split('\n')[0] ?? 'Prompt')

    const actions = document.createElement('div')
    actions.className = 'prompt-modal__actions'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'prompt-modal__btn prompt-modal__btn--cancel'
    cancelBtn.textContent = 'Cancel'

    const okBtn = document.createElement('button')
    okBtn.type = 'submit'
    okBtn.className = 'prompt-modal__btn prompt-modal__btn--ok'
    okBtn.textContent = 'OK'

    actions.append(cancelBtn, okBtn)
    form.append(msg, input, actions)
    card.append(form)
    root.append(backdrop, card)

    const finish = (value: string | null): void => {
      if (settled) return
      settled = true
      window.removeEventListener('keydown', onWindowKeyDown, true)
      root.remove()
      resolve(value)
    }

    const onWindowKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key !== 'Escape') return
      ev.preventDefault()
      ev.stopImmediatePropagation()
      finish(null)
    }

    form.addEventListener('submit', (ev) => {
      ev.preventDefault()
      finish(input.value)
    })

    cancelBtn.addEventListener('click', () => finish(null))
    backdrop.addEventListener('click', () => finish(null))
    // Clicks on the card must not fall through to the map underneath.
    card.addEventListener('pointerdown', (ev) => ev.stopPropagation())

    window.addEventListener('keydown', onWindowKeyDown, true)
    parent.append(root)

    // Focus after paint so Electron/Chromium select the value reliably.
    requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
  })
}
