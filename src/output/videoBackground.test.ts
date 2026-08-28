import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { normalizeArBackground } from './applyOutputMode.ts'
import {
  applyOpaque3dPassState,
  isOpaque3dPassActive,
  restoreClearPass,
} from './ndiOpaquePass.ts'
import {
  createVideoBackgroundTestPattern,
  normalizeTextureFit,
  opaque3dPassBlocksBackground,
  resolveTextureFit,
  resolveTextureSourceSize,
  shouldDrawVideoBackground,
  startVideoBackground,
} from './videoBackground.ts'

afterEach(() => {
  const writer = {
    setClearColor: () => {},
    setOpaqueClearSafe: () => {},
  }
  while (isOpaque3dPassActive()) {
    restoreClearPass(writer, {
      color: 0,
      alpha: 0,
      opaqueClearSafe: false,
    })
  }
})

function stubRenderer(options?: {
  width?: number
  height?: number
  renderTarget?: unknown
}): {
  renderer: THREE.WebGLRenderer
  calls: Array<{
    scene: THREE.Object3D
    camera: THREE.Camera
    autoClear: boolean
  }>
} {
  const calls: Array<{
    scene: THREE.Object3D
    camera: THREE.Camera
    autoClear: boolean
  }> = []
  const renderer = {
    autoClear: true,
    domElement: {
      width: options?.width ?? 1920,
      height: options?.height ?? 1080,
    },
    getPixelRatio: () => 1,
    getRenderTarget: () => options?.renderTarget ?? null,
    render: (scene: THREE.Object3D, camera: THREE.Camera) => {
      calls.push({ scene, camera, autoClear: renderer.autoClear })
    },
  }
  return {
    renderer: renderer as unknown as THREE.WebGLRenderer,
    calls,
  }
}

function colorBarTexture(): THREE.DataTexture {
  return createVideoBackgroundTestPattern(64, 36)
}

describe('normalizeArBackground', () => {
  it('keeps alpha and video', () => {
    expect(normalizeArBackground('alpha')).toBe('alpha')
    expect(normalizeArBackground('video')).toBe('video')
  })

  it('maps unknown / missing to alpha (today\'s plate)', () => {
    expect(normalizeArBackground(undefined)).toBe('alpha')
    expect(normalizeArBackground('')).toBe('alpha')
    expect(normalizeArBackground('whep')).toBe('alpha')
    expect(normalizeArBackground(1)).toBe('alpha')
  })
})

describe('normalizeTextureFit', () => {
  it('defaults to cover', () => {
    expect(normalizeTextureFit(undefined)).toBe('cover')
    expect(normalizeTextureFit('stretch')).toBe('cover')
    expect(normalizeTextureFit('cover')).toBe('cover')
  })

  it('keeps contain', () => {
    expect(normalizeTextureFit('contain')).toBe('contain')
  })
})

describe('resolveTextureFit', () => {
  it('is identity when source matches destination', () => {
    expect(
      resolveTextureFit(1920, 1080, 1920, 1080, 'cover'),
    ).toEqual({ width: 1920, height: 1080, x: 960, y: 540 })
    expect(
      resolveTextureFit(1920, 1080, 1920, 1080, 'contain'),
    ).toEqual({ width: 1920, height: 1080, x: 960, y: 540 })
  })

  it('cover on a square buffer crops the 16:9 sides', () => {
    const r = resolveTextureFit(1920, 1080, 1080, 1080, 'cover')
    expect(r.height).toBe(1080)
    expect(r.width).toBeCloseTo(1920)
    expect(r.x).toBe(540)
    expect(r.y).toBe(540)
  })

  it('contain on a square buffer letterboxes the 16:9 height', () => {
    const r = resolveTextureFit(1920, 1080, 1080, 1080, 'contain')
    expect(r.width).toBe(1080)
    expect(r.height).toBeCloseTo(607.5)
    expect(r.x).toBe(540)
    expect(r.y).toBe(540)
  })

  it('cover on a wide buffer crops the 1:1 top/bottom', () => {
    const r = resolveTextureFit(1080, 1080, 1920, 1080, 'cover')
    expect(r.width).toBe(1920)
    expect(r.height).toBeCloseTo(1920)
    expect(r.x).toBe(960)
    expect(r.y).toBe(540)
  })

  it('uses drawing-buffer size, not CSS (letterbox-safe)', () => {
    const r = resolveTextureFit(16, 9, 1920, 1080, 'cover')
    expect(r.width).toBe(1920)
    expect(r.height).toBe(1080)
  })
})

describe('resolveTextureSourceSize', () => {
  it('reads DataTexture image width/height', () => {
    const tex = colorBarTexture()
    expect(resolveTextureSourceSize(tex)).toEqual({ width: 64, height: 36 })
    tex.dispose()
  })

  it('prefers videoWidth/videoHeight (OUT-06 VideoTexture)', () => {
    const tex = new THREE.Texture()
    tex.image = { width: 2, height: 2, videoWidth: 1920, videoHeight: 1080 }
    expect(resolveTextureSourceSize(tex)).toEqual({
      width: 1920,
      height: 1080,
    })
  })

  it('returns null for empty / missing image', () => {
    expect(resolveTextureSourceSize(null)).toBeNull()
    const tex = new THREE.Texture()
    expect(resolveTextureSourceSize(tex)).toBeNull()
  })
})

describe('shouldDrawVideoBackground', () => {
  const videoFollowAr = {
    arBackground: 'video' as const,
    hasTexture: true,
    opaque3dPass: false,
    isScreenPass: true,
    localFocus: 'ar' as const,
    previewIsAirCamera: true,
  }

  it('draws on ops preview when video + AR focus + following POV', () => {
    expect(shouldDrawVideoBackground(videoFollowAr)).toBe(true)
  })

  it('alpha mode never draws (shipped air path)', () => {
    expect(
      shouldDrawVideoBackground({ ...videoFollowAr, arBackground: 'alpha' }),
    ).toBe(false)
    expect(
      shouldDrawVideoBackground({
        ...videoFollowAr,
        arBackground: undefined,
      }),
    ).toBe(false)
  })

  it('null texture never draws', () => {
    expect(
      shouldDrawVideoBackground({ ...videoFollowAr, hasTexture: false }),
    ).toBe(false)
  })

  it('suppresses ops free cam on screen; FBO (NDI) still draws', () => {
    expect(
      shouldDrawVideoBackground({
        ...videoFollowAr,
        previewIsAirCamera: false,
      }),
    ).toBe(false)
    expect(
      shouldDrawVideoBackground({
        ...videoFollowAr,
        isScreenPass: false,
        previewIsAirCamera: false,
      }),
    ).toBe(true)
  })

  it('suppresses local 3D / 2D preview; AR NDI FBO still draws', () => {
    expect(
      shouldDrawVideoBackground({ ...videoFollowAr, localFocus: '3d' }),
    ).toBe(false)
    expect(
      shouldDrawVideoBackground({ ...videoFollowAr, localFocus: '2d' }),
    ).toBe(false)
    expect(
      shouldDrawVideoBackground({
        ...videoFollowAr,
        localFocus: '3d',
        isScreenPass: false,
      }),
    ).toBe(true)
  })

  it('3D NDI opaque pass never draws', () => {
    expect(
      shouldDrawVideoBackground({
        ...videoFollowAr,
        isScreenPass: false,
        opaque3dPass: true,
      }),
    ).toBe(false)
  })
})

describe('3D pump suppression via ndiOpaquePass', () => {
  it('marks the opaque 3d pass so shouldDraw can refuse it', () => {
    const writer = {
      setClearColor: () => {},
      setOpaqueClearSafe: () => {},
    }
    expect(isOpaque3dPassActive()).toBe(false)
    applyOpaque3dPassState(writer)
    expect(isOpaque3dPassActive()).toBe(true)
    expect(opaque3dPassBlocksBackground()).toBe(true)
    expect(
      shouldDrawVideoBackground({
        arBackground: 'video',
        hasTexture: true,
        opaque3dPass: isOpaque3dPassActive(),
        isScreenPass: false,
        localFocus: 'ar',
        previewIsAirCamera: true,
      }),
    ).toBe(false)
    restoreClearPass(writer, {
      color: 0,
      alpha: 0,
      opaqueClearSafe: false,
    })
    expect(isOpaque3dPassActive()).toBe(false)
  })

  it('AR air-plate restoreClearPass without apply does not mark 3d', () => {
    restoreClearPass(
      { setClearColor: () => {}, setOpaqueClearSafe: () => {} },
      { color: 0, alpha: 0, opaqueClearSafe: false },
    )
    expect(isOpaque3dPassActive()).toBe(false)
  })
})

describe('startVideoBackground wrap', () => {
  it('draws the background scene before the caller scene', () => {
    const { renderer, calls } = stubRenderer()
    const tex = colorBarTexture()
    const handle = startVideoBackground({
      renderer,
      shouldDraw: () => true,
    })
    handle.setTexture(tex)
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera()
    renderer.render(scene, cam)
    expect(calls).toHaveLength(2)
    expect(calls[0]?.scene).not.toBe(scene)
    expect(calls[0]?.camera).toBeInstanceOf(THREE.OrthographicCamera)
    expect(calls[0]?.autoClear).toBe(true)
    expect(calls[1]?.scene).toBe(scene)
    expect(calls[1]?.camera).toBe(cam)
    expect(calls[1]?.autoClear).toBe(false)
    expect(renderer.autoClear).toBe(true)
    handle.stop()
    tex.dispose()
  })

  it('draws on the FBO path (non-null render target) — NDI readback', () => {
    const fbo = { isRenderTarget: true }
    const { renderer, calls } = stubRenderer({ renderTarget: fbo })
    const tex = colorBarTexture()
    const handle = startVideoBackground({
      renderer,
      shouldDraw: () =>
        shouldDrawVideoBackground({
          arBackground: 'video',
          hasTexture: true,
          opaque3dPass: false,
          isScreenPass: renderer.getRenderTarget() === null,
          localFocus: '3d',
          previewIsAirCamera: false,
        }),
    })
    handle.setTexture(tex)
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera()
    renderer.render(scene, cam)
    expect(calls).toHaveLength(2)
    expect(calls[1]?.scene).toBe(scene)
    handle.stop()
    tex.dispose()
  })

  it('pass-through when shouldDraw is false (alpha plate)', () => {
    const { renderer, calls } = stubRenderer()
    const tex = colorBarTexture()
    const handle = startVideoBackground({
      renderer,
      shouldDraw: () => false,
    })
    handle.setTexture(tex)
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera()
    renderer.autoClear = true
    renderer.render(scene, cam)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.scene).toBe(scene)
    expect(calls[0]?.camera).toBe(cam)
    expect(calls[0]?.autoClear).toBe(true)
    expect(renderer.autoClear).toBe(true)
    handle.stop()
    tex.dispose()
  })

  it('null texture does not draw even when shouldDraw is true', () => {
    const { renderer, calls } = stubRenderer()
    const handle = startVideoBackground({
      renderer,
      shouldDraw: () => true,
    })
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera()
    renderer.render(scene, cam)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.scene).toBe(scene)
    handle.stop()
  })

  it('skips ortho overlay cameras so timecode can draw on top', () => {
    const { renderer, calls } = stubRenderer()
    const tex = colorBarTexture()
    const handle = startVideoBackground({
      renderer,
      shouldDraw: () => true,
    })
    handle.setTexture(tex)
    const overlayScene = new THREE.Scene()
    const overlayCam = new THREE.OrthographicCamera(0, 1, 1, 0)
    renderer.render(overlayScene, overlayCam)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.scene).toBe(overlayScene)
    handle.stop()
    tex.dispose()
  })

  it('installs innermost: background, then scene, then a post overlay wrap', () => {
    const { renderer, calls } = stubRenderer()
    const tex = colorBarTexture()
    const bg = startVideoBackground({
      renderer,
      shouldDraw: () => true,
    })
    bg.setTexture(tex)

    const overlayScene = new THREE.Scene()
    const overlayCam = new THREE.OrthographicCamera(0, 1, 1, 0)
    const afterBg = renderer.render.bind(renderer)
    renderer.render = ((scene: THREE.Scene, camera: THREE.Camera) => {
      afterBg(scene, camera)
      if (scene === overlayScene) return
      const prev = renderer.autoClear
      renderer.autoClear = false
      try {
        afterBg(overlayScene, overlayCam)
      } finally {
        renderer.autoClear = prev
      }
    }) as typeof renderer.render

    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera()
    renderer.render(scene, cam)

    expect(calls.map((c) => c.scene)).toEqual([
      calls[0]?.scene,
      scene,
      overlayScene,
    ])
    expect(calls[0]?.camera).toBeInstanceOf(THREE.OrthographicCamera)
    expect(calls[0]?.camera).not.toBe(overlayCam)
    expect(calls[1]?.scene).toBe(scene)
    expect(calls[2]?.scene).toBe(overlayScene)

    renderer.render = afterBg as typeof renderer.render
    bg.stop()
    tex.dispose()
  })

  it('stop restores the original renderer.render; cycles do not stack', () => {
    const { renderer, calls } = stubRenderer()
    const tex = colorBarTexture()
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera()

    const first = startVideoBackground({
      renderer,
      shouldDraw: () => true,
    })
    first.setTexture(tex)
    first.stop()
    renderer.render(scene, cam)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.scene).toBe(scene)
    calls.length = 0

    const second = startVideoBackground({
      renderer,
      shouldDraw: () => true,
    })
    second.setTexture(tex)
    renderer.render(scene, cam)
    expect(calls).toHaveLength(2)
    expect(calls[1]?.scene).toBe(scene)
    calls.length = 0
    second.stop()
    second.stop()
    renderer.render(scene, cam)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.scene).toBe(scene)
    tex.dispose()
  })

  it('sets SRGBColorSpace on setTexture', () => {
    const { renderer } = stubRenderer()
    const handle = startVideoBackground({
      renderer,
      shouldDraw: () => false,
    })
    const tex = new THREE.DataTexture(new Uint8Array(16), 2, 2)
    tex.colorSpace = THREE.NoColorSpace
    handle.setTexture(tex)
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace)
    handle.setTexture(null)
    expect(handle.getTexture()).toBeNull()
    handle.stop()
    tex.dispose()
  })

  it('createVideoBackgroundTestPattern is 16:9 sRGB', () => {
    const tex = createVideoBackgroundTestPattern()
    expect(tex.image.width).toBe(320)
    expect(tex.image.height).toBe(180)
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace)
    tex.dispose()
  })
})
