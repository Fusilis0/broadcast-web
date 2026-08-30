import type { WebGLRenderer, WebGLRenderTarget } from 'three'
import { WebGLRenderTarget as ThreeWebGLRenderTarget } from 'three'
import { applyNdiCaptureColorSpace } from './ndiCaptureColorSpace.ts'

/**
 * Packed AR/3D NDI bytes after {@link createNdiCaptureFlip} are top-down.
 * Native RGBA send no longer row-reverses (`grandi` rejects a negative stride).
 */
export const NDI_CAPTURE_FLIPPED_BOTTOM_UP = false

export type NdiCaptureFlipBlitRect = {
  srcX0: number
  srcY0: number
  srcX1: number
  srcY1: number
  dstX0: number
  dstY0: number
  dstX1: number
  dstY1: number
}

/**
 * Dest Y is inverted so a later `readPixels` of the dest FBO is top-down.
 * WebGL origin is lower-left; native RGBA copies row 0 as the top of the
 * picture. 2D canvas grab is already top-down and must not use this helper.
 */
export function ndiCaptureFlipBlitRect(
  width: number,
  height: number,
): NdiCaptureFlipBlitRect {
  const w = Math.max(0, Math.floor(width))
  const h = Math.max(0, Math.floor(height))
  return {
    srcX0: 0,
    srcY0: 0,
    srcX1: w,
    srcY1: h,
    dstX0: 0,
    dstY0: h,
    dstX1: w,
    dstY1: 0,
  }
}

type GlBlitLike = {
  READ_FRAMEBUFFER: number
  DRAW_FRAMEBUFFER: number
  FRAMEBUFFER?: number
  FRAMEBUFFER_BINDING?: number
  COLOR_BUFFER_BIT: number
  NEAREST: number
  SCISSOR_TEST?: number
  blitFramebuffer: (
    srcX0: number,
    srcY0: number,
    srcX1: number,
    srcY1: number,
    dstX0: number,
    dstY0: number,
    dstX1: number,
    dstY1: number,
    mask: number,
    filter: number,
  ) => void
  bindFramebuffer: (target: number, framebuffer: unknown) => void
  getParameter: (pname: number) => unknown
  enable?: (cap: number) => void
  disable?: (cap: number) => void
  isEnabled?: (cap: number) => boolean
}

export type NdiCaptureFlipRenderer = Pick<
  WebGLRenderer,
  'getContext' | 'getRenderTarget' | 'setRenderTarget'
>

export type CreateNdiCaptureFlipOptions = {
  renderer: NdiCaptureFlipRenderer
  /** Test seam: override `renderer.getContext()`. */
  gl?: unknown
}

export type NdiCaptureFlip = {
  /**
   * GPU Y-flip `source` into an internal colour target of `width`×`height`.
   * Leaves that target bound so `readback.begin` packs top-down RGBA (alpha
   * included). Recreates the dest on create and resize.
   */
  blit(
    source: WebGLRenderTarget,
    width: number,
    height: number,
  ): WebGLRenderTarget
  dispose(): void
}

const FRAMEBUFFER_BINDING = 0x8ca6

/** Duck-type WebGL2 `blitFramebuffer` (inverted dest Y). */
export function probeNdiCaptureFlipBlit(gl: unknown): gl is GlBlitLike {
  if (!gl || typeof gl !== 'object') return false
  const g = gl as GlBlitLike
  return (
    typeof g.blitFramebuffer === 'function' &&
    typeof g.bindFramebuffer === 'function' &&
    typeof g.getParameter === 'function' &&
    typeof g.COLOR_BUFFER_BIT === 'number' &&
    typeof g.NEAREST === 'number' &&
    typeof g.READ_FRAMEBUFFER === 'number' &&
    typeof g.DRAW_FRAMEBUFFER === 'number'
  )
}

/**
 * Second colour FBO for the NDI capture flip. Same sRGB pin as the scene
 * target so the blit copies encoded RGBA (no second LinearTosRGB, alpha
 * untouched). No depth — colour blit only.
 */
export function createNdiFlipTarget(width: number, height: number): WebGLRenderTarget {
  const target = new ThreeWebGLRenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
  })
  applyNdiCaptureColorSpace(target)
  return target
}

/**
 * GPU Y-flip for AR/3D NDI capture. Call after the FBO scene pass and
 * **before** `readback.begin`. Do **not** use on the 2D canvas path.
 */
export function createNdiCaptureFlip(
  options: CreateNdiCaptureFlipOptions,
): NdiCaptureFlip {
  const { renderer } = options
  const glRaw = options.gl !== undefined ? options.gl : renderer.getContext()
  const gl = probeNdiCaptureFlipBlit(glRaw) ? glRaw : null

  let dest: WebGLRenderTarget | null = null
  let destW = 0
  let destH = 0
  let disposed = false

  function ensureDest(w: number, h: number): WebGLRenderTarget {
    if (!dest || destW !== w || destH !== h) {
      dest?.dispose()
      dest = createNdiFlipTarget(w, h)
      destW = w
      destH = h
    }
    return dest
  }

  function framebufferBinding(): unknown {
    if (!gl) return null
    const pname =
      typeof gl.FRAMEBUFFER_BINDING === 'number'
        ? gl.FRAMEBUFFER_BINDING
        : FRAMEBUFFER_BINDING
    return gl.getParameter(pname)
  }

  function gpuBlit(
    source: WebGLRenderTarget,
    destTarget: WebGLRenderTarget,
    w: number,
    h: number,
  ): void {
    if (!gl) return
    renderer.setRenderTarget(source)
    const srcFb = framebufferBinding()
    renderer.setRenderTarget(destTarget)
    const dstFb = framebufferBinding()

    const scissorOn =
      typeof gl.SCISSOR_TEST === 'number' &&
      typeof gl.isEnabled === 'function' &&
      gl.isEnabled(gl.SCISSOR_TEST)
    if (scissorOn && typeof gl.disable === 'function' && typeof gl.SCISSOR_TEST === 'number') {
      gl.disable(gl.SCISSOR_TEST)
    }

    const rect = ndiCaptureFlipBlitRect(w, h)
    try {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFb)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dstFb)
      // #region agent log
      const __blitT0 = performance.now()
      // #endregion
      gl.blitFramebuffer(
        rect.srcX0,
        rect.srcY0,
        rect.srcX1,
        rect.srcY1,
        rect.dstX0,
        rect.dstY0,
        rect.dstX1,
        rect.dstY1,
        gl.COLOR_BUFFER_BIT,
        gl.NEAREST,
      )
      // #region agent log
      const __blitMs = performance.now() - __blitT0
      if (!(globalThis as { __ndiFlipLogAt?: number }).__ndiFlipLogAt ||
        performance.now() - ((globalThis as { __ndiFlipLogAt?: number }).__ndiFlipLogAt ?? 0) > 1000) {
        ;(globalThis as { __ndiFlipLogAt?: number }).__ndiFlipLogAt = performance.now()
        fetch('http://127.0.0.1:7438/ingest/7196fb84-148e-4d0c-af68-4fcb53313232',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'173fbb'},body:JSON.stringify({sessionId:'173fbb',runId:'pre-fix',hypothesisId:'H1',location:'ndiCaptureFlip.ts:gpuBlit',message:'GPU flip blit issued',data:{w,h,rect,blitMs:__blitMs,glOk:true,srcFb:!!srcFb,dstFb:!!dstFb},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
    } finally {
      if (scissorOn && typeof gl.enable === 'function' && typeof gl.SCISSOR_TEST === 'number') {
        gl.enable(gl.SCISSOR_TEST)
      }
      renderer.setRenderTarget(destTarget)
    }
  }

  return {
    blit(source, width, height) {
      const w = Math.floor(width)
      const h = Math.floor(height)
      if (disposed || w < 1 || h < 1) return source
      // #region agent log
      if (!gl && (!(globalThis as { __ndiFlipNoGlAt?: number }).__ndiFlipNoGlAt ||
        performance.now() - ((globalThis as { __ndiFlipNoGlAt?: number }).__ndiFlipNoGlAt ?? 0) > 1000)) {
        ;(globalThis as { __ndiFlipNoGlAt?: number }).__ndiFlipNoGlAt = performance.now()
        fetch('http://127.0.0.1:7438/ingest/7196fb84-148e-4d0c-af68-4fcb53313232',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'173fbb'},body:JSON.stringify({sessionId:'173fbb',runId:'pre-fix',hypothesisId:'H1',location:'ndiCaptureFlip.ts:blit',message:'flip blit skipped — no blitFramebuffer',data:{w,h,glOk:false},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      const destTarget = ensureDest(w, h)
      gpuBlit(source, destTarget, w, h)
      renderer.setRenderTarget(destTarget)
      return destTarget
    },
    dispose() {
      if (disposed) return
      disposed = true
      dest?.dispose()
      dest = null
    },
  }
}
