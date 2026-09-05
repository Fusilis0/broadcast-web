/**
 * @vitest-environment happy-dom
 */
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  chainBoardCanvasSize,
  chainRibbonCanvasSize,
  chainRibbonPeriodUrls,
  DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR,
  mountBillboardChains,
  pickChainTextureUrl,
  planBillboardChainMount,
  planChainRibbon,
  polylineLengthM,
  recordChainRibbonDraws,
  resolveChainLogos,
  resolveChainPanelColor,
  weightedFairInterleave,
} from './billboardChain.ts'
import { hexToCss, planSponsorBoard } from './sponsors/boardCompose.ts'
import { SPONSOR_WATER_Y } from './sponsors/sponsorLayout.ts'
import type { WorldFeature } from './features/types.ts'
import { createBillboardChainFeature } from './features/editor/featureFactory.ts'

describe('weightedFairInterleave', () => {
  it('maps [3, 2] to AABAB indices 0,0,1,0,1', () => {
    expect(weightedFairInterleave([3, 2])).toEqual([0, 0, 1, 0, 1])
  })

  it('is deterministic and not clustered AAA BB', () => {
    expect(weightedFairInterleave([3, 2]).join('')).not.toBe('00011')
    expect(weightedFairInterleave([2, 2])).toEqual([0, 1, 0, 1])
  })

  it('repeats the period for chain sample indices', () => {
    const logos = [
      { url: 'A', weight: 3 },
      { url: 'B', weight: 2 },
    ]
    const seq = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) =>
      pickChainTextureUrl(logos, i),
    )
    expect(seq).toEqual(['A', 'A', 'B', 'A', 'B', 'A', 'A', 'B', 'A', 'B'])
  })

  it('returns [] for empty or zero weights', () => {
    expect(weightedFairInterleave([])).toEqual([])
    expect(weightedFairInterleave([0, 0])).toEqual([])
  })
})

describe('chain plate defaults', () => {
  it('omitted panelColor is bluish #2A6FA6; sponsors keep their own default', () => {
    expect(resolveChainPanelColor(undefined)).toBe(
      DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR,
    )
    expect(hexToCss(DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR)).toBe('#2a6fa6')
    expect(resolveChainPanelColor(0xff0000)).toBe(0xff0000)
  })

  it('empty logos compose a solid frameless ribbon with no label or vertical bars', () => {
    const calls = recordChainRibbonDraws({
      panelColor: DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR,
      spacingM: 12,
      heightM: 8,
      slots: [null],
    })
    expect(calls[0]).toMatchObject({
      op: 'fillRect',
      fill: '#2a6fa6',
    })
    expect(calls.some((c) => c.op === 'fillText')).toBe(false)
    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
    // Hairline top/bottom only — no framed strokeRect around slots.
    expect(calls.some((c) => c.op === 'strokeRect')).toBe(false)
  })

  it('applies panelAlpha to the ribbon plate fill', () => {
    const calls = recordChainRibbonDraws({
      panelColor: DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR,
      panelAlpha: 0.5,
      spacingM: 12,
      heightM: 8,
      slots: [null],
    })
    expect(calls[0]).toMatchObject({
      op: 'fillRect',
      fill: hexToCss(DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR, 0.5),
    })
  })

  it('omitted logos + omitted textureUrl is an empty list', () => {
    expect(resolveChainLogos({})).toEqual([])
    expect(resolveChainLogos({ logos: [] })).toEqual([])
    expect(resolveChainLogos({ textureUrl: '/x.png' })).toEqual([
      { url: '/x.png', weight: 1 },
    ])
  })

  it('createBillboardChainFeature omits panelColor so mount applies the bluish default', () => {
    const chain = createBillboardChainFeature(
      [
        { east: 0, north: 0 },
        { east: 10, north: 0 },
      ],
      (east, _up, north) => ({ lat: north, lon: east, alt: 0 }),
      { n: 0 },
    )
    expect(chain?.panelColor).toBeUndefined()
    expect(chain?.logos).toBeUndefined()
  })
})

describe('chain ribbon compose', () => {
  it('places logos along U with no vertical frame bars; AABAB period urls', () => {
    const logos = [
      { url: 'A', weight: 3 },
      { url: 'B', weight: 2 },
    ]
    expect(chainRibbonPeriodUrls(logos)).toEqual(['A', 'A', 'B', 'A', 'B'])

    const plan = planChainRibbon({
      panelColor: DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR,
      spacingM: 12,
      heightM: 8,
      slots: [
        { width: 400, height: 100 },
        { width: 400, height: 100 },
        { width: 200, height: 200 },
        { width: 400, height: 100 },
        { width: 200, height: 200 },
      ],
    })
    expect(plan.logoDests.filter(Boolean)).toHaveLength(5)
    for (let i = 0; i < plan.logoDests.length; i++) {
      const d = plan.logoDests[i]!
      expect(d.dx).toBeGreaterThanOrEqual(i * plan.slotW)
      expect(d.dx + d.dw).toBeLessThanOrEqual((i + 1) * plan.slotW + 1e-6)
    }
    const calls = recordChainRibbonDraws({
      panelColor: DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR,
      spacingM: 12,
      heightM: 8,
      slots: [
        { width: 400, height: 100 },
        { width: 400, height: 100 },
        { width: 200, height: 200 },
        { width: 400, height: 100 },
        { width: 200, height: 200 },
      ],
    })
    expect(calls.filter((c) => c.op === 'drawImage')).toHaveLength(5)
    expect(calls.some((c) => c.op === 'strokeRect')).toBe(false)
  })

  it('spacingM is logo pitch: strip has no width < spacing hole', () => {
    const spacingM = 12
    const heightM = 8
    const size = chainRibbonCanvasSize(spacingM, heightM, 1)
    expect(size.canvasW / size.canvasH).toBeCloseTo(spacingM / heightM, 2)
    expect(size.canvasW).toBe(size.slotW)
  })
})

describe('chain heightM is vertical only', () => {
  it('canvas width stays fixed while height follows heightM; logo ratio locked', () => {
    const short = chainBoardCanvasSize(12, 8)
    const tall = chainBoardCanvasSize(12, 16)
    expect(short.canvasW).toBe(tall.canvasW)
    expect(tall.canvasH / short.canvasH).toBeCloseTo(2, 2)

    const logo = { width: 400, height: 100 }
    const planShort = planChainRibbon({
      spacingM: 12,
      heightM: 8,
      slots: [logo],
    })
    const planTall = planChainRibbon({
      spacingM: 12,
      heightM: 16,
      slots: [logo],
    })
    expect(planShort.logoDests[0]).not.toBeNull()
    expect(planTall.logoDests[0]).not.toBeNull()
    expect(
      planShort.logoDests[0]!.dw / planShort.logoDests[0]!.dh,
    ).toBeCloseTo(4)
    expect(planTall.logoDests[0]!.dw / planTall.logoDests[0]!.dh).toBeCloseTo(4)

    const framed = planSponsorBoard({
      label: '',
      logo,
      canvasW: 1024,
      canvasH: 512,
    })
    expect(framed.logoDest).not.toBeNull()
  })
})

describe('polyline ribbon length', () => {
  it('polyline length equals sum of abutting strip segments', () => {
    const pts = [
      { x: 0, z: 0 },
      { x: 30, z: 0 },
      { x: 30, z: 40 },
    ]
    expect(polylineLengthM(pts)).toBeCloseTo(70)
  })
})

describe('mountBillboardChains', () => {
  it('mounts a continuous upright ribbon (no discrete 6 m panels in 12 m gaps)', async () => {
    const features: WorldFeature[] = [
      {
        id: 'chain:1',
        name: 'chain',
        type: 'billboardChain',
        points: [
          { lat: 0, lon: 0, altMsl: 0 },
          { lat: 0, lon: 50, altMsl: 0 },
        ],
        heightM: 8,
        spacingM: 12,
        label: 'Chain',
      },
    ]
    const scene = new THREE.Scene()
    const handle = await mountBillboardChains(scene, features, (_lat, lon) => ({
      x: lon,
      y: 0,
      z: 0,
    }))
    expect(handle).not.toBeNull()
    try {
      expect(handle!.root.children.length).toBe(1)
      expect(handle!.stats.instanceCount).toBe(1)
      expect(handle!.stats.uniqueBoardKeyCount).toBe(0)
      const mesh = handle!.root.children[0] as THREE.Mesh
      const geo = mesh.geometry as THREE.PlaneGeometry
      expect(geo.parameters.width).toBeCloseTo(50)
      expect(geo.parameters.height).toBeCloseTo(8)
      expect(geo.parameters.width).toBeGreaterThan(12)
      expect(mesh.position.y).toBeCloseTo(SPONSOR_WATER_Y + 4)
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion)
      expect(localUp.y).toBeCloseTo(1)
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion)
      expect(Math.abs(normal.y)).toBeLessThan(1e-6)
      const mat = mesh.material as THREE.MeshBasicMaterial
      expect(mat.transparent).toBe(false)
      expect(mat.depthWrite).toBe(true)
      expect(mat.map).toBeNull()
      expect(mat.color.getHex()).toBe(DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR)
    } finally {
      handle!.dispose()
    }
  })

  it('abutting multi-segment ribbons sum to polyline length', async () => {
    const features: WorldFeature[] = [
      {
        id: 'chain:2',
        name: 'chain',
        type: 'billboardChain',
        points: [
          { lat: 0, lon: 0, altMsl: 0 },
          { lat: 0, lon: 30, altMsl: 0 },
          { lat: 40, lon: 30, altMsl: 0 },
        ],
        heightM: 8,
        spacingM: 12,
      },
    ]
    const scene = new THREE.Scene()
    const handle = await mountBillboardChains(
      scene,
      features,
      (lat, lon) => ({ x: lon, y: 0, z: lat }),
    )
    expect(handle).not.toBeNull()
    try {
      expect(handle!.root.children.length).toBe(2)
      expect(handle!.stats.instanceCount).toBe(2)
      let strip = 0
      for (const child of handle!.root.children) {
        const mesh = child as THREE.Mesh
        strip += (mesh.geometry as THREE.PlaneGeometry).parameters.width
      }
      expect(strip).toBeCloseTo(70)
    } finally {
      handle!.dispose()
    }
  })

  it('returns null for empty features so remount([]) has no chain to keep', async () => {
    const scene = new THREE.Scene()
    const handle = await mountBillboardChains(scene, [])
    expect(handle).toBeNull()
    expect(scene.getObjectByName('billboardChains')).toBeUndefined()
  })

  it('dispose removes the chain group from the scene', async () => {
    const features: WorldFeature[] = [
      {
        id: 'chain:1',
        name: 'chain',
        type: 'billboardChain',
        points: [
          { lat: 0, lon: 0, altMsl: 0 },
          { lat: 0, lon: 50, altMsl: 0 },
        ],
        heightM: 8,
        spacingM: 100,
      },
    ]
    const scene = new THREE.Scene()
    const handle = await mountBillboardChains(scene, features, (_lat, lon) => ({
      x: lon,
      y: 0,
      z: 0,
    }))
    expect(handle).not.toBeNull()
    expect(scene.getObjectByName('billboardChains')).toBe(handle!.root)
    handle!.dispose()
    expect(scene.getObjectByName('billboardChains')).toBeUndefined()
    expect(handle!.root.parent).toBeNull()
  })
})

describe('planBillboardChainMount', () => {
  it('counts ribbon segments; solid plate uses no period texture', () => {
    const features: WorldFeature[] = [
      {
        id: 'chain:1',
        name: 'c',
        type: 'billboardChain',
        points: [
          { lat: 0, lon: 0, altMsl: 0 },
          { lat: 0, lon: 120, altMsl: 0 },
        ],
        heightM: 8,
        spacingM: 12,
        textureUrl: null,
        label: '',
      },
    ]
    const plan = planBillboardChainMount(features, (_lat, lon) => ({
      x: lon,
      y: 0,
      z: 0,
    }))
    expect(plan.instanceCount).toBe(1)
    expect(plan.uniqueBoardKeyCount).toBe(0)
    expect(plan.approxBytesShared).toBe(0)
    expect(plan.approxBytesIfUnshared).toBeGreaterThan(0)
    expect(plan.totalLengthM).toBeCloseTo(120)
  })

  it('plans one period texture when logos are present', () => {
    const features: WorldFeature[] = [
      {
        id: 'chain:1',
        name: 'c',
        type: 'billboardChain',
        points: [
          { lat: 0, lon: 0, altMsl: 0 },
          { lat: 0, lon: 60, altMsl: 0 },
          { lat: 60, lon: 60, altMsl: 0 },
        ],
        heightM: 8,
        spacingM: 12,
        logos: [
          { url: '/a.png', weight: 3 },
          { url: '/b.png', weight: 2 },
        ],
      },
    ]
    const plan = planBillboardChainMount(features, (lat, lon) => ({
      x: lon,
      y: 0,
      z: lat,
    }))
    expect(plan.instanceCount).toBe(2)
    expect(plan.uniqueBoardKeyCount).toBe(1)
    expect(plan.approxBytesShared).toBeGreaterThan(0)
    expect(plan.approxBytesShared).toBeLessThan(plan.approxBytesIfUnshared)
  })
})
