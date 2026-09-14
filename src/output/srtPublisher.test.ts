/**
 * @vitest-environment happy-dom
 */
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getSrtOutBridge,
  isSrtWorldLook,
  parseSrtPlateQuery,
  SRT_OUT_DEFAULT_URLS,
  SRT_OUT_TITLES,
  type SrtOutBridge,
} from './srtPublisher.ts'
import { startSrtPublisherPanel } from './srtPublisherPanel.ts'
import { startNdiControllerPanel } from './ndiControllerPanel.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')
const require = createRequire(import.meta.url)
const cjs = require('../../desktop/srtPublisher.cjs') as {
  SRT_OUT_TITLES: typeof SRT_OUT_TITLES
  SRT_OUT_DEFAULT_URLS: typeof SRT_OUT_DEFAULT_URLS
  pickPublishEncoder: (text: string) => string | null
  buildSrtPublishArgv: (opts: {
    title: string
    url: string
    encoder: 'h264_amf' | 'h264_nvenc' | 'libx264'
    grab?: {
      kind?: 'pipe' | 'gdi' | 'dda'
      title?: string
      outputIdx?: number
      x?: number
      y?: number
      width?: number
      height?: number
      attach?: (stdin: unknown) => () => void
    }
  }) => string[]
  parseFfmpegFps: (chunk: string) => number | null
  resolvePublishUrl: (
    url: string,
  ) => { ok: true; href: string } | { ok: false; error: string }
  fitSrtPlateInWorkArea: (
    work: { x: number; y: number; width: number; height: number },
    index?: number,
  ) => { x: number; y: number; width: number; height: number }
  pickSrtPlateDisplay: (
    displays: Array<{
      bounds: { x: number; y: number; width: number; height: number }
      workArea: { x: number; y: number; width: number; height: number }
    }>,
    studioBounds: { x: number; y: number; width: number; height: number },
  ) => unknown
  createSrtPublisher: (deps?: Record<string, unknown>) => {
    start: (opts: {
      channel: string
      url?: string
    }) => Promise<{ ok: boolean; error?: string; channel?: string }>
    stop: (
      channel: string,
      opts?: { keepWindow?: boolean },
    ) => { ok: boolean }
    getStatusAll: () => Record<
      string,
      { state: string; encoder: string | null; encoderFps: number | null }
    >
    shutdown: () => void
  }
}

describe('nativeImageToSrtBgra', () => {
  const capture = require('../../desktop/srtPlateCapture.cjs') as {
    nativeImageToSrtBgra: (
      image: unknown,
      width?: number,
      height?: number,
    ) => Buffer | null
    inferBgraSize: (
      buf: Buffer,
      reported?: { width: number; height: number },
    ) => { width: number; height: number } | null
  }

  it('resizes and clips to 1920×1080 BGRA', () => {
    const out = capture.nativeImageToSrtBgra({
      isEmpty: () => false,
      getSize: () => ({ width: 16, height: 9 }),
      resize: () => ({
        getSize: () => ({ width: 1920, height: 1080 }),
        toBitmap: () => Buffer.alloc(1920 * 1080 * 4, 3),
      }),
      toBitmap: () => Buffer.alloc(16 * 9 * 4, 7),
    })
    expect(out).toBeInstanceOf(Buffer)
    expect(out?.length).toBe(1920 * 1080 * 4)
  })

  it('scales a HiDPI 2K bitmap instead of cropping the top 1080p', () => {
    const srcW = 2880
    const srcH = 1620
    const src = Buffer.alloc(srcW * srcH * 4)
    for (let i = 0; i < src.length; i++) src[i] = i & 255
    const out = capture.nativeImageToSrtBgra({
      isEmpty: () => false,
      getSize: () => ({ width: 1920, height: 1080 }),
      toBitmap: () => src,
    })
    expect(out?.length).toBe(1920 * 1080 * 4)
    expect(out?.equals(src.subarray(0, 1920 * 1080 * 4))).toBe(false)
  })

  it('infers physical pixels when getSize is DIP and bitmap is 1.5×', () => {
    const buf = Buffer.alloc(2880 * 1620 * 4)
    expect(capture.inferBgraSize(buf, { width: 1920, height: 1080 })).toEqual({
      width: 2880,
      height: 1620,
    })
  })

  it('returns null for empty images', () => {
    expect(capture.nativeImageToSrtBgra({ isEmpty: () => true })).toBeNull()
  })
})

describe('parseSrtPlateQuery', () => {
  it('reads ar / 3d / 2d and rejects junk', () => {
    expect(parseSrtPlateQuery('?race=demo&srtPlate=ar')).toBe('ar')
    expect(parseSrtPlateQuery('srtPlate=3d')).toBe('3d')
    expect(parseSrtPlateQuery('?srtPlate=2d')).toBe('2d')
    expect(parseSrtPlateQuery('?srtPlate=ndi')).toBeNull()
    expect(parseSrtPlateQuery('')).toBeNull()
  })
})

describe('isSrtWorldLook', () => {
  const look = {
    environmentMode: 'realistic' as const,
    seaQuality: 'high' as const,
    terrainEnabled: true,
    buildingsEnabled: true,
    heroesEnabled: true,
    terrainOverlay: 'aerial' as const,
    terrainTilesLocked: false,
    terrainAltitudeNudgeM: 0,
    terrainWaterDiscardYM: 0,
    seaHeightYM: 0,
  }

  it('accepts a full studio look and rejects junk', () => {
    expect(isSrtWorldLook(look)).toBe(true)
    expect(isSrtWorldLook({ ...look, environmentMode: 'simple' })).toBe(true)
    expect(isSrtWorldLook({ ...look, terrainEnabled: false })).toBe(true)
    expect(isSrtWorldLook({ ...look, environmentMode: 'orbit' })).toBe(false)
    expect(isSrtWorldLook({ terrainEnabled: true })).toBe(false)
  })
})

describe('buildSrtPublishArgv', () => {
  it('uses gdigrab titles, SRT caller URLs, no NDI FourCC, no ingest copy pipe', () => {
    for (const channel of ['ar', '3d', '2d'] as const) {
      const argv = cjs.buildSrtPublishArgv({
        title: cjs.SRT_OUT_TITLES[channel],
        url: cjs.SRT_OUT_DEFAULT_URLS[channel],
        encoder: 'h264_amf',
      })
      const joined = argv.join(' ')
      expect(argv).toContain('gdigrab')
      expect(argv).toContain(`title=${cjs.SRT_OUT_TITLES[channel]}`)
      expect(argv.at(-1)).toBe(cjs.SRT_OUT_DEFAULT_URLS[channel])
      expect(argv.at(-1)).toMatch(/mode=caller/)
      expect(argv.at(-1)).toMatch(/latency=60000/)
      expect(argv).toContain('-an')
      expect(argv).toContain('yuv420p')
      expect(argv).toContain('h264_amf')
      expect(argv).toContain('1920x1080')
      expect(joined).not.toMatch(/(^| )-c copy( |$)/)
      expect(argv).toContain('-progress')
      expect(argv).toContain('pipe:1')
      expect(joined).not.toMatch(/UYVY|UYVA|FourCC|grandi|ndiUyvy|ndiDeferredSend/)
    }
    expect(cjs.SRT_OUT_TITLES).toEqual(SRT_OUT_TITLES)
    expect(cjs.SRT_OUT_DEFAULT_URLS).toEqual(SRT_OUT_DEFAULT_URLS)
  })

  it('pipes compositor BGRA frames (window buffer), not DXGI screen copy', () => {
    const argv = cjs.buildSrtPublishArgv({
      title: cjs.SRT_OUT_TITLES['3d'],
      url: cjs.SRT_OUT_DEFAULT_URLS['3d'],
      encoder: 'h264_amf',
      grab: { kind: 'pipe' },
    })
    const joined = argv.join(' ')
    expect(argv).toContain('rawvideo')
    expect(argv).toContain('bgra')
    expect(argv).toContain('pipe:0')
    expect(argv).not.toContain('-nostdin')
    expect(joined).not.toMatch(/ddagrab/)
    expect(joined).not.toMatch(/gdigrab/)
    expect(argv.at(-1)).toMatch(/mode=caller/)
  })

  it('prefers AMF, then NVENC, then libx264', () => {
    expect(
      cjs.pickPublishEncoder(' V....D h264_amf\n V....D h264_nvenc\n V....D libx264'),
    ).toBe('h264_amf')
    expect(cjs.pickPublishEncoder(' V....D h264_nvenc\n V....D libx264')).toBe(
      'h264_nvenc',
    )
    expect(cjs.pickPublishEncoder(' V....D libx264')).toBe('libx264')
    expect(cjs.pickPublishEncoder('')).toBeNull()
  })

  it('dials any host from the URL field; forces caller; rejects 0.0.0.0', () => {
    const lan = cjs.resolvePublishUrl(
      'srt://192.168.1.50:9202?mode=listener&latency=60000',
    )
    expect(lan.ok).toBe(true)
    if (lan.ok) {
      expect(lan.href).toContain('192.168.1.50')
      expect(lan.href).toContain(':9202')
      expect(lan.href).toMatch(/mode=caller/)
      expect(lan.href).not.toMatch(/mode=listener/)
    }
    const vps = cjs.resolvePublishUrl('srt://srt.example.net:9000')
    expect(vps.ok).toBe(true)
    if (vps.ok) {
      expect(vps.href).toContain('srt.example.net')
      expect(vps.href).toMatch(/mode=caller/)
      expect(vps.href).toMatch(/latency=60000/)
    }
    const loop = cjs.resolvePublishUrl(SRT_OUT_DEFAULT_URLS['3d'])
    expect(loop.ok).toBe(true)
    if (loop.ok) expect(loop.href).toContain('127.0.0.1:9202')
    const bind = cjs.resolvePublishUrl(
      'srt://0.0.0.0:9201?mode=listener&latency=60000',
    )
    expect(bind.ok).toBe(false)
    if (!bind.ok) expect(bind.error).toMatch(/0\.0\.0\.0/)
  })

  it('parses encoder fps from ffmpeg stderr and -progress', () => {
    expect(
      cjs.parseFfmpegFps(
        'frame=  120 fps= 30 q=16.0 size=    1024kB time=00:00:04.00',
      ),
    ).toBe(30)
    expect(cjs.parseFfmpegFps('fps=30.00\nprogress=continue')).toBe(30)
    expect(cjs.parseFfmpegFps('not stats')).toBeNull()
  })

  it('emits -progress pipe:1 so ops can show encoder fps', () => {
    const argv = cjs.buildSrtPublishArgv({
      title: cjs.SRT_OUT_TITLES['3d'],
      url: cjs.SRT_OUT_DEFAULT_URLS['3d'],
      encoder: 'h264_amf',
    })
    expect(argv).toContain('-progress')
    expect(argv).toContain('pipe:1')
  })

  it('fits 16:9 plates inside a portrait work area without overflow', () => {
    const b = cjs.fitSrtPlateInWorkArea(
      { x: 1920, y: 0, width: 1080, height: 1920 },
      0,
    )
    expect(b.x).toBe(1920)
    expect(b.x + b.width).toBeLessThanOrEqual(1920 + 1080)
    expect(b.y + b.height).toBeLessThanOrEqual(1920)
    expect(b.width / b.height).toBeCloseTo(16 / 9, 1)
  })

  it('picks the landscape studio display over a portrait second monitor', () => {
    const studio = {
      bounds: { x: 0, y: 0, width: 2560, height: 1440 },
      workArea: { x: 0, y: 0, width: 2560, height: 1400 },
    }
    const portrait = {
      bounds: { x: 2560, y: 0, width: 1080, height: 1920 },
      workArea: { x: 2560, y: 0, width: 1080, height: 1920 },
    }
    const picked = cjs.pickSrtPlateDisplay([studio, portrait], {
      x: 100,
      y: 100,
      width: 800,
      height: 600,
    })
    expect(picked).toBe(studio)
  })
})

describe('createSrtPublisher children', () => {
  it('stop kills that child only; three channels stay independent', async () => {
    const children: { pid: number; killed: boolean; kill: () => void }[] = []
    const spawn = (
      cmd: string,
      args: string[],
    ): EventEmitter & {
      pid: number
      killed: boolean
      kill: () => void
      stderr: EventEmitter
      stdout: EventEmitter
      unref?: () => void
    } => {
      const child = new EventEmitter() as EventEmitter & {
        pid: number
        killed: boolean
        kill: () => void
        stderr: EventEmitter
        stdout: EventEmitter
        unref?: () => void
      }
      child.pid = cmd === 'taskkill' ? 1 : 4000 + children.length
      child.killed = false
      child.stderr = new EventEmitter()
      child.stdout = new EventEmitter()
      child.kill = () => {
        child.killed = true
      }
      child.unref = () => {}
      if (cmd !== 'taskkill') {
        children.push(child)
        expect(args.join(' ')).not.toMatch(/(^| )-c copy( |$)/)
        expect(args).toContain('gdigrab')
      }
      return child
    }
    const pub = cjs.createSrtPublisher({
      spawn,
      resolveFfmpegPath: () => 'ffmpeg',
      listEncoders: () => ' V....D h264_amf ',
      ensureWindow: async () => {},
      closeWindow: () => {},
    })
    await pub.start({ channel: 'ar' })
    await pub.start({ channel: '3d' })
    await pub.start({ channel: '2d' })
    expect(children).toHaveLength(3)
    const arChild = children[0]
    const d3Child = children[1]
    const mapChild = children[2]
    pub.stop('ar')
    expect(arChild.killed).toBe(true)
    expect(d3Child.killed).toBe(false)
    expect(mapChild.killed).toBe(false)
    expect(pub.getStatusAll().ar.state).toBe('idle')
    expect(pub.getStatusAll()['3d'].state).toBe('connecting')
    expect(pub.getStatusAll()['2d'].state).toBe('connecting')
    pub.stop('3d')
    expect(d3Child.killed).toBe(true)
    expect(mapChild.killed).toBe(false)
    pub.shutdown()
    expect(mapChild.killed).toBe(true)
  })

  it('attaches compositor frames to ffmpeg stdin and detaches on stop', async () => {
    let attached: unknown = null
    let detached = false
    const spawn = (
      cmd: string,
      args: string[],
    ): EventEmitter & {
      pid: number
      killed: boolean
      kill: () => void
      stderr: EventEmitter
      stdout: EventEmitter
      stdin: { write: () => boolean; on: () => void; end: () => void }
      unref?: () => void
    } => {
      const child = new EventEmitter() as EventEmitter & {
        pid: number
        killed: boolean
        kill: () => void
        stderr: EventEmitter
        stdout: EventEmitter
        stdin: { write: () => boolean; on: () => void; end: () => void }
        unref?: () => void
      }
      child.pid = cmd === 'taskkill' ? 1 : 6000
      child.killed = false
      child.stderr = new EventEmitter()
      child.stdout = new EventEmitter()
      child.stdin = { write: () => true, on: () => {}, end: () => {} }
      child.kill = () => {
        child.killed = true
      }
      child.unref = () => {}
      if (cmd !== 'taskkill') {
        expect(args).toContain('rawvideo')
        expect(args).toContain('pipe:0')
        expect(args.join(' ')).not.toMatch(/ddagrab/)
      }
      return child
    }
    const pub = cjs.createSrtPublisher({
      spawn,
      resolveFfmpegPath: () => 'ffmpeg',
      listEncoders: () => ' V....D h264_amf ',
      ensureWindow: async () => ({
        kind: 'pipe',
        attach(stdin: unknown) {
          attached = stdin
          return () => {
            detached = true
          }
        },
      }),
      closeWindow: () => {},
    })
    await pub.start({ channel: '3d' })
    expect(attached).toBeTruthy()
    pub.stop('3d')
    expect(detached).toBe(true)
    pub.shutdown()
  })

  it('reads encoder fps from ffmpeg -progress stdout', async () => {
    const children: Array<EventEmitter & { stdout: EventEmitter }> = []
    const spawn = (
      cmd: string,
    ): EventEmitter & {
      pid: number
      killed: boolean
      kill: () => void
      stderr: EventEmitter
      stdout: EventEmitter
      unref?: () => void
    } => {
      const child = new EventEmitter() as EventEmitter & {
        pid: number
        killed: boolean
        kill: () => void
        stderr: EventEmitter
        stdout: EventEmitter
        unref?: () => void
      }
      child.pid = cmd === 'taskkill' ? 1 : 5000
      child.killed = false
      child.stderr = new EventEmitter()
      child.stdout = new EventEmitter()
      child.kill = () => {
        child.killed = true
      }
      child.unref = () => {}
      if (cmd !== 'taskkill') children.push(child)
      return child
    }
    const pub = cjs.createSrtPublisher({
      spawn,
      resolveFfmpegPath: () => 'ffmpeg',
      listEncoders: () => ' V....D h264_amf ',
      ensureWindow: async () => {},
      closeWindow: () => {},
    })
    await pub.start({ channel: '3d' })
    children[0].stdout.emit('data', Buffer.from('fps=30.00\nprogress=continue\n'))
    expect(pub.getStatusAll()['3d'].encoderFps).toBe(30)
    expect(pub.getStatusAll()['3d'].state).toBe('live')
    pub.shutdown()
  })
})

describe('getSrtOutBridge', () => {
  afterEach(() => {
    const g = window as unknown as { broadcastStudio?: unknown }
    delete g.broadcastStudio
  })

  it('returns null without studio srtOut (plain browser / ingest-only)', () => {
    expect(getSrtOutBridge()).toBeNull()
    const g = window as unknown as { broadcastStudio?: unknown }
    g.broadcastStudio = { isStudio: true }
    expect(getSrtOutBridge()).toBeNull()
  })

  it('returns the srtOut namespace when preload is present', () => {
    const srtOut: SrtOutBridge = {
      start: async () => ({ ok: true, channel: 'ar' }),
      stop: async () => ({ ok: true }),
      getStatus: async () => ({
        ar: {
          channel: 'ar',
          state: 'idle',
          encoder: null,
          encoderFps: null,
          url: SRT_OUT_DEFAULT_URLS.ar,
          lastError: null,
          fallbackNote: null,
        },
        '3d': {
          channel: '3d',
          state: 'idle',
          encoder: null,
          encoderFps: null,
          url: SRT_OUT_DEFAULT_URLS['3d'],
          lastError: null,
          fallbackNote: null,
        },
        '2d': {
          channel: '2d',
          state: 'idle',
          encoder: null,
          encoderFps: null,
          url: SRT_OUT_DEFAULT_URLS['2d'],
          lastError: null,
          fallbackNote: null,
        },
      }),
      onStatus: () => () => {},
    }
    const g = window as unknown as { broadcastStudio?: unknown }
    g.broadcastStudio = { isStudio: true, srtOut }
    expect(getSrtOutBridge()).toBe(srtOut)
  })
})

describe('SRT out panel / NDI hide', () => {
  it('mounts SRT AR / 3D / 2D toggles', () => {
    const container = document.createElement('div')
    const panel = startSrtPublisherPanel({ container, pollMs: 60_000 })
    expect(container.querySelector('[data-ops="srt-out"]')).toBeTruthy()
    expect(container.querySelector('[data-ops="srt-out-toggle-ar"]')).toBeTruthy()
    expect(
      container.querySelector('[data-ops="srt-out-toggle-3d"]'),
    ).toBeTruthy()
    expect(
      container.querySelector('[data-ops="srt-out-toggle-2d"]'),
    ).toBeTruthy()
    expect(panel.root.textContent).toMatch(/SRT AR/)
    panel.dispose()
  })

  it('URL row is an editable text field and start() uses the typed destination', async () => {
    const started: Array<{ channel: string; url?: string }> = []
    const idle = (channel: 'ar' | '3d' | '2d') => ({
      channel,
      state: 'idle' as const,
      encoder: null,
      encoderFps: null,
      url: SRT_OUT_DEFAULT_URLS[channel],
      lastError: null,
      fallbackNote: null,
    })
    const srtOut: SrtOutBridge = {
      start: async (opts) => {
        started.push(opts)
        return { ok: true, channel: opts.channel }
      },
      stop: async () => ({ ok: true }),
      getStatus: async () => ({
        ar: idle('ar'),
        '3d': idle('3d'),
        '2d': idle('2d'),
      }),
      onStatus: () => () => {},
    }
    const g = window as unknown as { broadcastStudio?: unknown }
    g.broadcastStudio = { isStudio: true, srtOut }
    const container = document.createElement('div')
    const panel = startSrtPublisherPanel({ container, pollMs: 60_000 })
    const urlInput = container.querySelector(
      '[data-ops="srt-out-url-3d"]',
    ) as HTMLInputElement
    expect(urlInput).toBeInstanceOf(HTMLInputElement)
    expect(urlInput.type).toBe('text')
    expect(urlInput.readOnly).toBe(false)
    urlInput.value = 'srt://10.0.0.8:9202?mode=caller&latency=60000'
    const toggle = container.querySelector(
      '[data-ops="srt-out-toggle-3d"]',
    ) as HTMLInputElement
    toggle.checked = true
    toggle.dispatchEvent(new Event('change'))
    await Promise.resolve()
    await Promise.resolve()
    expect(started).toEqual([
      {
        channel: '3d',
        url: 'srt://10.0.0.8:9202?mode=caller&latency=60000',
      },
    ])
    panel.dispose()
    delete g.broadcastStudio
  })

  it('does not show the NDI Send panel by default (legacy fold closed)', () => {
    const container = document.createElement('div')
    const ndi = startNdiControllerPanel({
      container,
      getPump: () => null,
      getActivePovId: () => null,
      pollMs: 60_000,
    })
    const details = container.querySelector('[data-ops="ndi-legacy"]')
    expect(details).toBeInstanceOf(HTMLDetailsElement)
    expect((details as HTMLDetailsElement).open).toBe(false)
    expect(container.querySelector('[data-ops="ndi-legacy-summary"]')?.textContent).toMatch(
      /Legacy NDI/,
    )
    ndi.dispose()
  })
})

describe('publish modules stay off the NDI pack path (source)', () => {
  it('does not import NDI pack / grandi / ingest copy pipe', () => {
    const pub = readFileSync(join(repoRoot, 'desktop/srtPublisher.cjs'), 'utf8')
    const helpers = readFileSync(
      join(repoRoot, 'desktop/srtPublisherHelpers.cjs'),
      'utf8',
    )
    const capture = readFileSync(
      join(repoRoot, 'desktop/srtPlateCapture.cjs'),
      'utf8',
    )
    const renderer = readFileSync(join(here, 'srtPublisher.ts'), 'utf8')
    const panel = readFileSync(join(here, 'srtPublisherPanel.ts'), 'utf8')
    for (const src of [pub, helpers, capture, renderer, panel]) {
      expect(src).not.toMatch(/require\([^)]*ndiUyvy/)
      expect(src).not.toMatch(/require\([^)]*ndiDeferredSend/)
      expect(src).not.toMatch(/require\([^)]*grandi/)
      expect(src).not.toMatch(/require\([^)]*ndiSender/)
      expect(src).not.toMatch(/from ['"][^'"]*ndiUyvy/)
    }
    expect(helpers).toMatch(/gdigrab/)
    expect(helpers).toMatch(/rawvideo/)
    expect(helpers).toMatch(/pipe:0/)
    expect(helpers).not.toMatch(/ddagrab/)
    expect(helpers).toMatch(/h264_amf/)
    expect(helpers).toMatch(/mode=caller/)
    expect(helpers).not.toMatch(/-c copy/)
    expect(pub).toMatch(/createSrtPublisher/)
    expect(pub).not.toMatch(/srtReader\.open/)
    expect(capture).toMatch(/capturePage/)
    expect(capture).not.toMatch(/ddagrab/)
  })

  it('exports SRT out from output index', () => {
    const idx = readFileSync(join(here, 'index.ts'), 'utf8')
    expect(idx).toMatch(/startSrtPublisherPanel/)
    expect(idx).toMatch(/getSrtOutBridge/)
    expect(idx).toMatch(/parseSrtPlateQuery/)
    expect(idx).toMatch(/isSrtWorldLook/)
  })
})
