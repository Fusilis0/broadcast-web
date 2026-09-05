import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startDualFrameClock } from './previewFrameClock.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

type RafCb = FrameRequestCallback

function createFakeRaf(): {
  raf: (cb: RafCb) => number
  caf: (id: number) => void
  flush: (now: number) => void
} {
  let nextId = 1
  const pending = new Map<number, RafCb>()
  return {
    raf(cb) {
      const id = nextId++
      pending.set(id, cb)
      return id
    },
    caf(id) {
      pending.delete(id)
    },
    flush(now) {
      const batch = [...pending.entries()]
      pending.clear()
      for (const [, cb] of batch) cb(now)
    },
  }
}

describe('startDualFrameClock', () => {
  const studioSubs: Array<() => void> = []
  const fakeRaf = createFakeRaf()
  let hidden = false
  let now = 0
  let clock: ReturnType<typeof startDualFrameClock> | null = null

  function start() {
    clock = startDualFrameClock({
      subscribeStudioTick: (cb) => {
        studioSubs.push(cb)
        return () => {
          const i = studioSubs.indexOf(cb)
          if (i >= 0) studioSubs.splice(i, 1)
        }
      },
      isHidden: () => hidden,
      raf: fakeRaf.raf,
      caf: fakeRaf.caf,
      nowMs: () => now,
      fpsWindowMs: 1000,
    })
    return clock
  }

  function fireStudio(): void {
    for (const cb of [...studioSubs]) cb()
  }

  afterEach(() => {
    clock?.stop()
    clock = null
    studioSubs.length = 0
    hidden = false
    now = 0
  })

  it('preview subscriber is not the NDI subscriber when visible', () => {
    const dual = start()
    const preview: number[] = []
    const ndi: number[] = []
    dual.subscribePreview(() => preview.push(now))
    dual.subscribeNdi(() => ndi.push(now))

    now = 16
    fakeRaf.flush(now)
    expect(preview).toEqual([16])
    expect(ndi).toEqual([])

    now = 33
    fireStudio()
    expect(preview).toEqual([16])
    expect(ndi).toEqual([33])
  })

  it('hidden: studio tick still fires NDI and drives preview (no rAF)', () => {
    hidden = true
    const dual = start()
    const preview: number[] = []
    const ndi: number[] = []
    dual.subscribePreview(() => preview.push(now))
    dual.subscribeNdi(() => ndi.push(now))

    now = 16
    fakeRaf.flush(now)
    expect(preview).toEqual([])
    expect(ndi).toEqual([])

    now = 33
    fireStudio()
    expect(preview).toEqual([33])
    expect(ndi).toEqual([33])
  })

  it('visible → hidden switches preview from rAF to studio tick', () => {
    const dual = start()
    const preview: string[] = []
    dual.subscribePreview(() => preview.push(hidden ? 'studio' : 'raf'))

    now = 16
    fakeRaf.flush(now)
    hidden = true
    now = 33
    fireStudio()
    now = 48
    fakeRaf.flush(now)

    expect(preview).toEqual(['raf', 'studio'])
  })

  it('smoothes preview fps over a 1 s window', () => {
    const dual = start()
    dual.subscribePreview(() => {})
    expect(dual.getPreviewFps()).toBe(0)

    for (let i = 1; i <= 60; i++) {
      now = i * (1000 / 60)
      fakeRaf.flush(now)
    }
    const fps = dual.getPreviewFps()
    expect(fps).toBeGreaterThan(55)
    expect(fps).toBeLessThan(65)
    expect(dual.getHitchCounts()).toEqual({ over33: 0, over50: 0 })
  })

  it('counts preview hitches over 33 ms and 50 ms in a 1 s window', () => {
    const dual = start()
    dual.subscribePreview(() => {})
    expect(dual.getHitchCounts()).toEqual({ over33: 0, over50: 0 })

    now = 16
    fakeRaf.flush(now)
    expect(dual.getHitchCounts()).toEqual({ over33: 0, over50: 0 })

    now = 32
    fakeRaf.flush(now)
    expect(dual.getHitchCounts()).toEqual({ over33: 0, over50: 0 })

    now = 72
    fakeRaf.flush(now)
    expect(dual.getHitchCounts()).toEqual({ over33: 1, over50: 0 })

    now = 132
    fakeRaf.flush(now)
    expect(dual.getHitchCounts()).toEqual({ over33: 2, over50: 1 })

    now = 1133
    fakeRaf.flush(now)
    // 1001 ms gap is itself a hitch; stamps at 72 / 132 fall outside the window.
    expect(dual.getHitchCounts()).toEqual({ over33: 1, over50: 1 })
  })
})

describe('dual-clock wiring (source)', () => {
  it('sets STUDIO_TICK_FPS to 60 for NDI stagger; preview is not this clock', () => {
    const src = readFileSync(join(repoRoot, 'desktop/main.cjs'), 'utf8')
    expect(src).toMatch(/STUDIO_TICK_FPS\s*=\s*60/)
    expect(src).toMatch(/NDI stagger clock only/)
    expect(src).toMatch(/Ops preview stays rAF/)
    expect(src).not.toMatch(/STUDIO_TICK_FPS\s*=\s*30/)
  })

  it('main wires subscribePreview for the scene and leaves NDI on studio tick', () => {
    const main = readFileSync(join(repoRoot, 'src/main.ts'), 'utf8')
    expect(main).toMatch(/startDualFrameClock/)
    expect(main).toMatch(/subscribePreview/)
    expect(main).toMatch(/onStudioTick/)
    expect(main).toMatch(/setHitchCounts/)
    expect(main).toMatch(/readWebGlGpuInfo/)
    expect(main).toMatch(/\[perf\] WebGL renderer/)
  })

  it('AR pump captures on studio tick, not by patching renderer.render', () => {
    const pump = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    expect(pump).toMatch(/onStudioTick/)
    expect(pump).toMatch(/NDI_AR_DEFAULT_FPS\s*=\s*30/)
    expect(pump).not.toMatch(/renderer\.render\s*=/)
  })

  it('NDI defaults are AR/3D/2D 30 with 2D on; tick 60 is NDI-only', () => {
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    const map = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    const main = readFileSync(join(repoRoot, 'src/main.ts'), 'utf8')
    const desktop = readFileSync(join(repoRoot, 'desktop/main.cjs'), 'utf8')
    expect(d3).toMatch(/NDI_3D_DEFAULT_FPS\s*=\s*30/)
    expect(map).toMatch(/STREAM_MAP_NDI_DEFAULT_FPS\s*=\s*30/)
    expect(main).toMatch(/ndiChannelWanted/)
    expect(main).toMatch(/loadNdiChannelWanted/)
    expect(main).toMatch(/enabled:\s*ndiChannelWanted/)
    expect(main).toMatch(/fps:\s*30/)
    expect(main).not.toMatch(/NDI_3D_DEFAULT_FPS\s*=\s*10/)
    expect(desktop).toMatch(/STUDIO_TICK_FPS\s*=\s*60/)
  })

  it('ops HUD exposes a preview fps readout', () => {
    const hud = readFileSync(join(repoRoot, 'src/scene/stubHud.ts'), 'utf8')
    expect(hud).toMatch(/setAttribute\(\s*['"]data-ops['"]\s*,\s*['"]preview-fps['"]/)
    expect(hud).toMatch(/setPreviewFps/)
    expect(hud).toMatch(/setAttribute\(\s*['"]data-ops['"]\s*,\s*['"]gpu-renderer['"]/)
    expect(hud).toMatch(/setGpuLabel/)
    expect(hud).toMatch(/setAttribute\(\s*['"]data-ops['"]\s*,\s*['"]preview-hitch['"]/)
    expect(hud).toMatch(/setHitchCounts/)
  })

  it('WebGLRenderer requests high-performance GPU (cost-only)', () => {
    const scene = readFileSync(join(repoRoot, 'src/scene/createScene.ts'), 'utf8')
    expect(scene).toMatch(/powerPreference:\s*['"]high-performance['"]/)
  })
})
