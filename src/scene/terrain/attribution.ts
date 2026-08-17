/**
 * Cesium ion / Bing credits as a **DOM** overlay — never drawn into the WebGL
 * framebuffer (NDI AR is `readPixels` of that buffer). Show on the 3D local
 * channel; keep off the AR plate.
 */

export type TerrainAttributionHandle = {
  el: HTMLElement
  setVisible: (visible: boolean) => void
  setLines: (lines: readonly string[]) => void
  dispose: () => void
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&copy;/gi, '©')
    .replace(/\s+/g, ' ')
    .trim()
}

export function creditsToLines(
  attributions: ReadonlyArray<{ type: string; value: unknown }>,
): string[] {
  const out: string[] = []
  for (const att of attributions) {
    if (typeof att.value !== 'string') continue
    const text =
      att.type === 'html' ? htmlToPlainText(att.value) : att.value.trim()
    if (text !== '' && !out.includes(text)) out.push(text)
  }
  return out
}

export function createTerrainAttributionOverlay(): TerrainAttributionHandle {
  const el = document.createElement('div')
  el.className = 'terrain-attribution'
  el.setAttribute('data-ops', 'terrain-attribution')
  el.hidden = true

  return {
    el,
    setVisible(visible: boolean): void {
      el.hidden = !visible
      el.classList.toggle('terrain-attribution--visible', visible)
    },
    setLines(lines: readonly string[]): void {
      el.textContent = lines.join(' · ')
    },
    dispose(): void {
      el.remove()
    },
  }
}
