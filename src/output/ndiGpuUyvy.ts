/**
 * GPU RGBA → UYVY pack (half-width RGBA8 = UYVY bytes).
 * Rec. 709 limited, Y flipped so PBO readback is top-down.
 * 3D uses this instead of the CPU pack loop.
 */

import {
  GLSL3,
  Mesh,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from 'three'
import { evenPackWidth } from './ndiUyvy.ts'

export function ndiGpuUyvySize(
  srcW: number,
  srcH: number,
): { width: number; height: number } {
  return {
    width: evenPackWidth(srcW) >> 1,
    height: Math.max(0, srcH | 0),
  }
}

const VERT = `#version 300 es
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 srcSize;
in vec2 vUv;
out vec4 outColor;

vec3 yuv709(vec3 rgb) {
  float y = 0.062745 + 0.182586 * rgb.r + 0.614118 * rgb.g + 0.062024 * rgb.b;
  float u = 0.501961 - 0.100706 * rgb.r - 0.338510 * rgb.g + 0.439216 * rgb.b;
  float v = 0.501961 + 0.439216 * rgb.r - 0.367800 * rgb.g - 0.071416 * rgb.b;
  return clamp(vec3(y, u, v), 0.0, 1.0);
}

void main() {
  float pair = floor(vUv.x * srcSize.x * 0.5);
  float yPx = floor(vUv.y * srcSize.y);
  vec2 texel = 1.0 / srcSize;
  vec3 a = texture(tDiffuse, vec2((pair * 2.0 + 0.5) * texel.x, (yPx + 0.5) * texel.y)).rgb;
  vec3 b = texture(tDiffuse, vec2((pair * 2.0 + 1.5) * texel.x, (yPx + 0.5) * texel.y)).rgb;
  vec3 ya = yuv709(a);
  vec3 yb = yuv709(b);
  outColor = vec4(
    (ya.y + yb.y) * 0.5,
    ya.x,
    (ya.z + yb.z) * 0.5,
    yb.x
  );
}
`

export type NdiGpuUyvyPack = {
  /** Pack `src` into a half-width target. Returns null if size is unusable. */
  pack(src: { texture: Texture }, srcW: number, srcH: number): WebGLRenderTarget | null
  dispose(): void
}

export function createNdiGpuUyvyPack(
  renderer: Pick<WebGLRenderer, 'setRenderTarget' | 'render' | 'getRenderTarget'>,
): NdiGpuUyvyPack {
  const protoRender =
    typeof WebGLRenderer === 'function'
      ? WebGLRenderer.prototype.render
      : undefined
  const rawRender = (
    typeof protoRender === 'function' ? protoRender : renderer.render
  ).bind(renderer)
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const scene = new Scene()
  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    uniforms: {
      tDiffuse: { value: null },
      srcSize: { value: new Vector2(1, 1) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
  const mesh = new Mesh(new PlaneGeometry(2, 2), material)
  scene.add(mesh)

  let target: WebGLRenderTarget | null = null
  let tw = 0
  let th = 0

  function ensureTarget(width: number, height: number): WebGLRenderTarget {
    if (target && tw === width && th === height) return target
    target?.dispose()
    target = new WebGLRenderTarget(width, height, {
      depthBuffer: false,
      stencilBuffer: false,
    })
    // Packed UYVY bytes — do not sRGB-encode the dest (that would gamma U/Y/V).
    target.texture.colorSpace = NoColorSpace
    tw = width
    th = height
    return target
  }

  return {
    pack(src, srcW, srcH) {
      const size = ndiGpuUyvySize(srcW, srcH)
      if (size.width < 1 || size.height < 1) return null
      const dest = ensureTarget(size.width, size.height)
      material.uniforms.tDiffuse!.value = src.texture
      material.uniforms.srcSize!.value.set(srcW, srcH)
      const prev = renderer.getRenderTarget()
      try {
        renderer.setRenderTarget(dest)
        rawRender(scene, camera)
      } finally {
        renderer.setRenderTarget(prev)
      }
      return dest
    },
    dispose() {
      target?.dispose()
      target = null
      material.dispose()
      mesh.geometry.dispose()
    },
  }
}
