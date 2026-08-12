/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { promptModal } from './promptModal.ts'

afterEach(() => {
  document.body.replaceChildren()
})

describe('promptModal', () => {
  it('resolves with input value on OK', async () => {
    const p = promptModal('Boat id', '21')
    const input = document.querySelector(
      '.prompt-modal__input',
    ) as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('21')
    input.value = ' boat-7 '
    const ok = document.querySelector(
      '.prompt-modal__btn--ok',
    ) as HTMLButtonElement
    ok.click()
    await expect(p).resolves.toBe(' boat-7 ')
    expect(document.querySelector('.prompt-modal')).toBeNull()
  })

  it('resolves null on Cancel', async () => {
    const p = promptModal('x')
    ;(
      document.querySelector('.prompt-modal__btn--cancel') as HTMLButtonElement
    ).click()
    await expect(p).resolves.toBeNull()
  })

  it('resolves null on Escape (capture)', async () => {
    const p = promptModal('x', 'a')
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await expect(p).resolves.toBeNull()
  })

  it('resolves null on backdrop click', async () => {
    const p = promptModal('x')
    ;(
      document.querySelector('.prompt-modal__backdrop') as HTMLElement
    ).click()
    await expect(p).resolves.toBeNull()
  })

  it('submits on form Enter / submit', async () => {
    const p = promptModal('Spacing', '12')
    const form = document.querySelector(
      '.prompt-modal__form',
    ) as HTMLFormElement
    const input = document.querySelector(
      '.prompt-modal__input',
    ) as HTMLInputElement
    input.value = '8.5'
    form.requestSubmit()
    await expect(p).resolves.toBe('8.5')
  })

  it('preserves multi-line message text', () => {
    void promptModal('Line1\nLine2\nLine3', '')
    const msg = document.querySelector('.prompt-modal__message') as HTMLElement
    expect(msg.textContent).toBe('Line1\nLine2\nLine3')
  })
})
