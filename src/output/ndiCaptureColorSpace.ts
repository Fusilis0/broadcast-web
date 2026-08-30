import { SRGBColorSpace, type WebGLRenderTarget } from 'three'

/**
 * Pin an NDI capture FBO so `readPixels` bytes match the preview canvas.
 *
 * three applies output colour-space conversion from the **destination**: the
 * default framebuffer uses `renderer.outputColorSpace` (sRGB); a bound render
 * target uses `target.texture.colorSpace`, which defaults to no conversion
 * (linear-light). Without this pin, AR/3D NDI hands OBS linear RGBA8 and the
 * picture looks dark. The encode is RGB-only — three's LinearTosRGB leaves
 * alpha untouched (AR plate contract, `ndi-alpha-electron.md` §2).
 *
 * Apply on every AR/3D target create **and** resize/recreate. Do **not** apply
 * to the 2D channel: that path is already a 2D-canvas sRGB bitmap; a second
 * encode would go bright.
 */
export function applyNdiCaptureColorSpace(target: WebGLRenderTarget): void {
  target.texture.colorSpace = SRGBColorSpace
}
