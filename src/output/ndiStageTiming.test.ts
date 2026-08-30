import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyNdiMainPerfSummary,
  beginStudioTickTiming,
  formatNdiStageDump,
  formatNdiStageHud,
  getNdiStageSnapshot,
  markNdiSyncReadback,
  markNdiSync2dCapture,
  noteNdiSkip,
  recordNdiCapture,
  recordNdiStage,
  resetNdiStageTiming,
} from './ndiStageTiming.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

afterEach(() => {
  resetNdiStageTiming()
})

describe('ndiStageTiming histograms', () => {
  it('records capture-interval ticks as a distribution, not a mean', () => {
    beginStudioTickTiming(0)
    recordNdiCapture('ar', 0)
    for (let i = 1; i <= 12; i++) {
      beginStudioTickTiming(i * 16.7)
      if (i % 2 === 0) recordNdiCapture('ar', i * 16.7)
      else if (i % 3 === 0) recordNdiCapture('ar', i * 16.7)
    }
    const dump = formatNdiStageDump()
    expect(dump).toMatch(/captureTicks ar\s+\d+:\d+/)
    expect(dump).toMatch(/2:/)
    expect(dump).not.toMatch(/captureTicks ar\s+\d+\.\d+\s*$/m)
    const snap = getNdiStageSnapshot()
    const buckets = Object.keys(snap.captureTicks.ar)
    expect(buckets.length).toBeGreaterThan(0)
    expect(buckets.every((k) => k === '6+' || /^\d+$/.test(k))).toBe(true)
  })

  it('separates skip causes by rateCap / stagger / busy', () => {
    noteNdiSkip('ar', 'rateCap')
    noteNdiSkip('ar', 'rateCap')
    noteNdiSkip('ar', 'stagger')
    noteNdiSkip('3d', 'busy')
    const dump = formatNdiStageDump()
    expect(dump).toMatch(/ar rateCap=2 stagger=1 busy=0/)
    expect(dump).toMatch(/3d rateCap=0 stagger=0 busy=1/)
  })

  it('reports tick-interval distribution including >20 ms count', () => {
    beginStudioTickTiming(0)
    beginStudioTickTiming(16.7)
    beginStudioTickTiming(33.4)
    beginStudioTickTiming(33.4 + 25)
    const dump = formatNdiStageDump()
    expect(dump).toMatch(/tickIntervalMs/)
    expect(dump).toMatch(/>20ms=/)
    const snap = getNdiStageSnapshot()
    expect(snap.tickInterval.over20ms).toBeGreaterThanOrEqual(1)
  })

  it('includes main-process rgbaToBgra / video / dropBusy in the same dump', () => {
    applyNdiMainPerfSummary({
      channels: {
        ar: {
          rgbaToBgra: { count: 10, sumMs: 80, maxMs: 12, meanMs: 8 },
          video: { count: 10, sumMs: 40, maxMs: 6, meanMs: 4 },
          dropBusy: 3,
        },
        '3d': {
          rgbaToBgra: { count: 0, sumMs: 0, maxMs: 0, meanMs: 0 },
          video: { count: 0, sumMs: 0, maxMs: 0, meanMs: 0 },
          dropBusy: 0,
        },
        '2d': {
          rgbaToBgra: { count: 0, sumMs: 0, maxMs: 0, meanMs: 0 },
          video: { count: 0, sumMs: 0, maxMs: 0, meanMs: 0 },
          dropBusy: 0,
        },
      },
    })
    const dump = formatNdiStageDump()
    expect(dump).toMatch(/rgbaToBgra/)
    expect(dump).toMatch(/dropBusy=3/)
    expect(formatNdiStageHud()).toMatch(/main ar/)
  })

  it('surfaces sync fallbacks in the dump while marked active', () => {
    markNdiSyncReadback()
    markNdiSync2dCapture()
    const dump = formatNdiStageDump()
    expect(dump).toMatch(/syncReadback=true/)
    expect(dump).toMatch(/sync2dCapture=true/)
  })

  it('records stage mean/max for named stages including totalTick', async () => {
    recordNdiStage('present', 1.5)
    recordNdiStage('present', 2.5)
    recordNdiStage('arFboRender', 5)
    beginStudioTickTiming(0)
    await Promise.resolve()
    const dump = formatNdiStageDump()
    expect(dump).toMatch(/present/)
    expect(dump).toMatch(/arFboRender/)
    expect(dump).toMatch(/totalTick/)
    expect(dump).toMatch(/instrument overhead/)
  })
})

describe('ndiStageTiming does not change caps (source)', () => {
  it('leaves STUDIO_TICK_FPS at 60 and NDI send caps at 30', () => {
    const desktop = readFileSync(join(repoRoot, 'desktop/main.cjs'), 'utf8')
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    const map = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    const stagger = readFileSync(join(here, 'ndiCaptureStagger.ts'), 'utf8')
    expect(desktop).toMatch(/STUDIO_TICK_FPS\s*=\s*60/)
    expect(desktop).not.toMatch(/STUDIO_TICK_FPS\s*=\s*30/)
    expect(ar).toMatch(/NDI_AR_DEFAULT_FPS\s*=\s*30/)
    expect(d3).toMatch(/NDI_3D_DEFAULT_FPS\s*=\s*30/)
    expect(map).toMatch(/STREAM_MAP_NDI_DEFAULT_FPS\s*=\s*30/)
    expect(stagger).toMatch(/NDI_HEAVY_STAGGER_MS\s*=\s*8/)
  })

  it('does not remove rgbaToBgra or the main-process busy drop', () => {
    const sender = readFileSync(join(repoRoot, 'desktop/ndiSender.cjs'), 'utf8')
    expect(sender).toMatch(/function rgbaToBgra/)
    expect(sender).toMatch(/state\.busy/)
    expect(sender).toMatch(/dropBusy/)
    expect(sender).toMatch(/rotatePerf/)
  })

  it('wires dump + fallback HUD on the NDI controller (DOM-only)', () => {
    const panel = readFileSync(join(here, 'ndiControllerPanel.ts'), 'utf8')
    expect(panel).toMatch(/ndi-perf-dump/)
    expect(panel).toMatch(/__perfDump|formatNdiStageDump/)
    expect(panel).toMatch(/ndi-sync-fallback/)
    expect(panel).not.toMatch(/readRenderTargetPixels/)
  })
})
