/**
 * Shared plate colour + alpha 0–1 controls for sponsor / chain inspectors.
 */

import {
  hexToCss,
  parseOptionalAlpha,
  parseOptionalHexColor,
} from '../sponsors/boardCompose.ts'

export type PlateColourAlphaFieldsOptions = {
  parent: HTMLElement
  fieldClass: string
  inputClass: string
  colourLabel?: string
  alphaLabel?: string
  panelColor: number
  panelAlpha: number
  onColorChange: (color: number) => void
  onAlphaChange: (alpha: number) => void
}

/**
 * Colour picker + alpha range (0–1). Colour input stays `#rrggbb`.
 */
export function appendPlateColourAlphaFields(
  options: PlateColourAlphaFieldsOptions,
): void {
  const colourLabel = options.colourLabel ?? 'Plate colour'
  const alphaLabel = options.alphaLabel ?? 'Plate alpha'

  const colorRow = document.createElement('label')
  colorRow.className = options.fieldClass
  colorRow.appendChild(document.createTextNode(colourLabel))
  const colorInput = document.createElement('input')
  colorInput.type = 'color'
  colorInput.className = options.inputClass
  colorInput.value = hexToCss(options.panelColor)
  colorInput.addEventListener('change', () => {
    const parsed = parseOptionalHexColor(colorInput.value)
    if (parsed === undefined) return
    options.onColorChange(parsed)
  })
  colorRow.appendChild(colorInput)
  options.parent.appendChild(colorRow)

  const alphaRow = document.createElement('label')
  alphaRow.className = options.fieldClass
  alphaRow.appendChild(document.createTextNode(alphaLabel))
  const wrap = document.createElement('span')
  wrap.className = 'plate-alpha'
  const alphaInput = document.createElement('input')
  alphaInput.type = 'range'
  alphaInput.min = '0'
  alphaInput.max = '1'
  alphaInput.step = '0.01'
  alphaInput.className = options.inputClass
  alphaInput.value = String(options.panelAlpha)
  const alphaReadout = document.createElement('span')
  alphaReadout.className = 'plate-alpha__value'
  alphaReadout.textContent = options.panelAlpha.toFixed(2)
  const commitAlpha = (): void => {
    const parsed = parseOptionalAlpha(alphaInput.value)
    const a = parsed ?? 1
    alphaReadout.textContent = a.toFixed(2)
    options.onAlphaChange(a)
  }
  alphaInput.addEventListener('input', () => {
    const parsed = parseOptionalAlpha(alphaInput.value)
    alphaReadout.textContent = (parsed ?? 1).toFixed(2)
  })
  alphaInput.addEventListener('change', commitAlpha)
  wrap.append(alphaInput, alphaReadout)
  alphaRow.appendChild(wrap)
  options.parent.appendChild(alphaRow)
}
