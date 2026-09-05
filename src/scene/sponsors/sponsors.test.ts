/**
 * @vitest-environment happy-dom
 */
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { normalizeSponsors } from './normalizeSponsors.ts'
import {
  containFitRect,
  DEFAULT_FRAME_COLOR,
  DEFAULT_PANEL_COLOR,
  DEFAULT_WATER_PLANE_PANEL_ALPHA,
  GLYPH_ALPHA_MIN,
  glyphCropFromPlan,
  glyphCropIsFullBoard,
  hexToCss,
  knockOutNearBlackRgba,
  LOGO_KNOCKOUT_LUMA_HARD,
  LOGO_KNOCKOUT_LUMA_SOFT,
  luma601,
  meshSizeFromGlyphCrop,
  opaqueGlyphAabb,
  parseOptionalAlpha,
  parseOptionalHexColor,
  planSponsorBoard,
  recordSponsorBoardDraws,
  resolveWaterPlanePanelAlpha,
  shouldKnockOutLogo,
  zeroRgbWhereAlphaZero,
} from './boardCompose.ts'
import {
  applySponsorScaleOnEdit,
  buildSponsorLayout,
  DEFAULT_SPONSOR_BOARD_ASPECT,
  glyphScaleInsideCanvas,
  horizontalSpanFromEnu,
  sponsorPlaneSize,
  stampSponsorBoardAspect,
  SPONSOR_WATER_Y,
} from './sponsorLayout.ts'
import {
  facingBasisFromSpan,
  createSponsorBillboard,
  WATER_PLANE_BOARD_ALPHA_TEST,
} from './sponsorBillboard.ts'
import { createLineSignMesh } from '../lineSigns/lineSignMesh.ts'
import {
  WATER_PLANE_Y,
  WATER_PLANE_Y_OFFSET,
} from '../waterPlanePlacement.ts'
import type { GpsToEnuAmslFn, SponsorEnuEndpoints } from './types.ts'

describe('normalizeSponsors', () => {
  it('keeps valid entries and fills defaults', () => {
    const data = normalizeSponsors({
      name: 'demo',
      sponsors: [
        {
          id: 'sp1',
          label: 'Sponsor A',
          a: { lat: 41.0, lon: 28.97 },
          b: { lat: 41.0, lon: 28.98 },
        },
        {
          id: '',
          label: 'bad',
          a: { lat: 1, lon: 2 },
          b: { lat: 3, lon: 4 },
        },
        {
          id: 'sp2',
          label: 'B',
          a: { lat: 41.1, lon: 29.0, altMsl: 2 },
          b: { lat: 41.2, lon: 29.1 },
          heightM: 12,
          textureUrl: '/sponsors/x.png',
          color: '#aabbcc',
        },
      ],
    })
    expect(data.name).toBe('demo')
    expect(data.sponsors).toHaveLength(2)
    expect(data.sponsors[0]).toMatchObject({
      id: 'sp1',
      label: 'Sponsor A',
      heightM: 8,
      textureUrl: null,
      a: { lat: 41.0, lon: 28.97, altMsl: 0 },
    })
    expect(data.sponsors[1]).toMatchObject({
      id: 'sp2',
      heightM: 12,
      textureUrl: '/sponsors/x.png',
      color: 0xaabbcc,
      a: { altMsl: 2 },
    })
    expect(data.sponsors[0]!.panelColor).toBeUndefined()
    expect(data.sponsors[0]!.frameColor).toBeUndefined()
    expect(data.sponsors[0]!.panelAlpha).toBeUndefined()
    expect(data.sponsors[0]!.boardAspect).toBeUndefined()
  })

  it('parses optional panelColor / frameColor additively', () => {
    const data = normalizeSponsors({
      sponsors: [
        {
          id: 'sp1',
          label: 'A',
          a: { lat: 41, lon: 29 },
          b: { lat: 41.01, lon: 29 },
          panelColor: '#ffeeaa',
          frameColor: '0x112233',
        },
      ],
    })
    expect(data.sponsors[0]!.panelColor).toBe(0xffeeaa)
    expect(data.sponsors[0]!.frameColor).toBe(0x112233)
  })

  it('parses optional panelAlpha and boardAspect additively', () => {
    const data = normalizeSponsors({
      sponsors: [
        {
          id: 'sp1',
          label: 'A',
          a: { lat: 41, lon: 29 },
          b: { lat: 41.01, lon: 29 },
          panelAlpha: 0.4,
          boardAspect: 2.5,
        },
      ],
    })
    expect(data.sponsors[0]!.panelAlpha).toBe(0.4)
    expect(data.sponsors[0]!.boardAspect).toBe(2.5)
  })

  it('returns empty for junk', () => {
    expect(normalizeSponsors(null).sponsors).toEqual([])
    expect(normalizeSponsors({ sponsors: 'nope' }).sponsors).toEqual([])
  })
})

describe('horizontalSpanFromEnu', () => {
  it('computes width and midpoint', () => {
    const span = horizontalSpanFromEnu(0, 0, 30, 40)
    expect(span.widthM).toBe(50)
    expect(span.midX).toBe(15)
    expect(span.midZ).toBe(20)
  })
})

describe('buildSponsorLayout', () => {
  const mockEnu: GpsToEnuAmslFn = (lat, lon, alt) => ({
    x: lon * 1000,
    y: alt + 35,
    z: lat * 1000,
  })

  it('forces water-plane midpoints and drops degenerate spans', () => {
    const data = normalizeSponsors({
      sponsors: [
        {
          id: 'ok',
          label: 'Ok',
          a: { lat: 0.01, lon: 0.02 },
          b: { lat: 0.01, lon: 0.05 },
        },
        {
          id: 'degen',
          label: 'Same',
          a: { lat: 1, lon: 1 },
          b: { lat: 1, lon: 1 },
        },
      ],
    })
    const layout = buildSponsorLayout(data, mockEnu)
    expect(layout).toHaveLength(1)
    expect(layout[0]!.id).toBe('ok')
    expect(layout[0]!.widthM).toBeCloseTo(30)
    expect(layout[0]!.midX).toBeCloseTo(35)
    expect(layout[0]!.midZ).toBeCloseTo(10)
    expect(SPONSOR_WATER_Y).toBe(0)
  })

  it('passes optional panelColor / frameColor through to ENU endpoints', () => {
    const data = normalizeSponsors({
      sponsors: [
        {
          id: 'ok',
          label: 'Ok',
          a: { lat: 0.01, lon: 0.02 },
          b: { lat: 0.01, lon: 0.05 },
          panelColor: '#f4f4f2',
          frameColor: 0x2c3338,
        },
      ],
    })
    const layout = buildSponsorLayout(data, mockEnu)
    expect(layout[0]!.panelColor).toBe(0xf4f4f2)
    expect(layout[0]!.frameColor).toBe(0x2c3338)
  })

  it('A–B canvas is span × aspect; heightM 100 does not grow a slab', () => {
    const data = normalizeSponsors({
      sponsors: [
        {
          id: 'ok',
          label: 'Ok',
          a: { lat: 0.01, lon: 0.02 },
          b: { lat: 0.01, lon: 0.05 },
          heightM: 100,
          boardAspect: 30 / 100,
        },
      ],
    })
    const short = buildSponsorLayout(data, mockEnu)
    expect(short[0]!.widthM).toBeCloseTo(30)
    expect(short[0]!.heightM).toBeCloseTo(30 / DEFAULT_SPONSOR_BOARD_ASPECT)
    expect(short[0]!.heightM).toBeLessThan(20)
    expect(short[0]!.heightM).not.toBeCloseTo(100)
    expect(short[0]!.glyphScale).toBe(1)
    expect(short[0]!.canvasW).toBe(1024)
    expect(short[0]!.canvasH).toBe(Math.round(1024 / DEFAULT_SPONSOR_BOARD_ASPECT))

    data.sponsors[0]!.b = { lat: 0.01, lon: 0.08, altMsl: 0 }
    const long = buildSponsorLayout(data, mockEnu)
    expect(long[0]!.widthM).toBeCloseTo(60)
    expect(long[0]!.heightM).toBeCloseTo(60 / DEFAULT_SPONSOR_BOARD_ASPECT)
    expect(long[0]!.canvasH / long[0]!.canvasW!).toBeCloseTo(
      1 / DEFAULT_SPONSOR_BOARD_ASPECT,
      2,
    )
  })
})

describe('facingBasisFromSpan', () => {
  it('faces left of A→B (along × up)', () => {
    // A→B south (−Z): left is +East (+X)
    const basis = facingBasisFromSpan(0, 10, 0, 0)
    expect(basis).not.toBeNull()
    expect(basis!.along.z).toBeCloseTo(-1)
    expect(basis!.normal.x).toBeCloseTo(1)
    expect(basis!.normal.y).toBeCloseTo(0)
  })
})

describe('parseOptionalAlpha', () => {
  it('clamps 0–1 and ignores junk', () => {
    expect(parseOptionalAlpha(0.4)).toBe(0.4)
    expect(parseOptionalAlpha('0.25')).toBe(0.25)
    expect(parseOptionalAlpha(2)).toBe(1)
    expect(parseOptionalAlpha(-1)).toBe(0)
    expect(parseOptionalAlpha(undefined)).toBeUndefined()
    expect(parseOptionalAlpha('nope')).toBeUndefined()
  })
})

describe('hexToCss alpha', () => {
  it('stays #rrggbb when opaque and uses rgba when alpha < 1', () => {
    expect(hexToCss(0xf4f4f2)).toBe('#f4f4f2')
    expect(hexToCss(0xff0000, 0.5)).toBe('rgba(255, 0, 0, 0.5)')
  })
})

describe('parseOptionalHexColor', () => {
  it('accepts #rrggbb, 0x, bare hex, and numbers; rejects junk', () => {
    expect(parseOptionalHexColor('#f4f4f2')).toBe(0xf4f4f2)
    expect(parseOptionalHexColor('0x2c3338')).toBe(0x2c3338)
    expect(parseOptionalHexColor('aabbcc')).toBe(0xaabbcc)
    expect(parseOptionalHexColor(0xff0000)).toBe(0xff0000)
    expect(parseOptionalHexColor(undefined)).toBeUndefined()
    expect(parseOptionalHexColor('#fff')).toBeUndefined()
    expect(parseOptionalHexColor('red')).toBeUndefined()
  })
})

describe('containFitRect', () => {
  it('preserves aspect and centers inside the box (no stretch)', () => {
    // Wide source in a square box → letterbox top/bottom
    const wide = containFitRect(200, 100, 0, 0, 400, 400)
    expect(wide.dw).toBe(400)
    expect(wide.dh).toBe(200)
    expect(wide.dx).toBe(0)
    expect(wide.dy).toBe(100)
    expect(wide.dw / wide.dh).toBeCloseTo(2)

    // Tall source → pillarbox left/right
    const tall = containFitRect(100, 200, 10, 20, 400, 400)
    expect(tall.dw).toBe(200)
    expect(tall.dh).toBe(400)
    expect(tall.dx).toBe(110)
    expect(tall.dy).toBe(20)
    expect(tall.dw / tall.dh).toBeCloseTo(0.5)
  })
})

describe('recordSponsorBoardDraws', () => {
  it('fills the default white board then strokes the dark frame', () => {
    const calls = recordSponsorBoardDraws({ label: 'Acme' })
    expect(calls[0]).toMatchObject({
      op: 'fillRect',
      x: 0,
      y: 0,
      w: 1024,
      h: 512,
      fill: hexToCss(DEFAULT_PANEL_COLOR),
    })
    expect(calls[1]).toMatchObject({
      op: 'strokeRect',
      stroke: hexToCss(DEFAULT_FRAME_COLOR),
    })
    expect(calls[2]).toMatchObject({ op: 'fillText', text: 'Acme' })
    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
  })

  it('never burns the label when a logo URL was chosen (suppressLabel)', () => {
    const calls = recordSponsorBoardDraws({
      label: 'xxx',
      suppressLabel: true,
    })
    expect(calls.some((c) => c.op === 'fillText')).toBe(false)
    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
  })

  it('fills the plate with rgba when panelAlpha < 1', () => {
    const calls = recordSponsorBoardDraws({
      label: 'Acme',
      panelColor: 0xff0000,
      panelAlpha: 0.4,
    })
    expect(calls[0]).toMatchObject({
      op: 'fillRect',
      fill: 'rgba(255, 0, 0, 0.4)',
    })
  })

  it('contain-fits a logo onto the board instead of the label', () => {
    const plan = planSponsorBoard({
      label: 'Acme',
      logo: { width: 400, height: 100 },
    })
    expect(plan.label).toBeNull()
    expect(plan.logoDest).not.toBeNull()
    const dest = plan.logoDest!
    expect(dest.dw / dest.dh).toBeCloseTo(4)
    expect(dest.dx).toBeGreaterThanOrEqual(plan.innerRect.x - 1e-6)
    expect(dest.dy).toBeGreaterThanOrEqual(plan.innerRect.y - 1e-6)
    expect(dest.dx + dest.dw).toBeLessThanOrEqual(
      plan.innerRect.x + plan.innerRect.w + 1e-6,
    )
    expect(dest.dy + dest.dh).toBeLessThanOrEqual(
      plan.innerRect.y + plan.innerRect.h + 1e-6,
    )
    expect(plan.innerRect.x).toBeLessThan(40)

    const scaled = planSponsorBoard({
      label: 'Acme',
      logo: { width: 400, height: 100 },
      glyphScale: 0.5,
    })
    expect(scaled.logoDest!.dw).toBeCloseTo(dest.dw * 0.5)
    expect(scaled.logoDest!.dh).toBeCloseTo(dest.dh * 0.5)

    const calls = recordSponsorBoardDraws({
      label: 'Acme',
      logo: { width: 400, height: 100 },
    })
    expect(calls.some((c) => c.op === 'fillText')).toBe(false)
    const draw = calls.find((c) => c.op === 'drawImage')
    expect(draw).toMatchObject({
      op: 'drawImage',
      dx: dest.dx,
      dy: dest.dy,
      dw: dest.dw,
      dh: dest.dh,
    })
  })

  it('uses additive panelColor / frameColor when set', () => {
    const calls = recordSponsorBoardDraws({
      label: 'X',
      panelColor: 0xffeeaa,
      frameColor: 0x112233,
    })
    expect(calls[0]).toMatchObject({ op: 'fillRect', fill: '#ffeeaa' })
    expect(calls[1]).toMatchObject({ op: 'strokeRect', stroke: '#112233' })
  })

  it('skips plate fill + frame when panelAlpha ≈ 0 (logo/text only)', () => {
    expect(resolveWaterPlanePanelAlpha(undefined)).toBe(
      DEFAULT_WATER_PLANE_PANEL_ALPHA,
    )
    expect(DEFAULT_WATER_PLANE_PANEL_ALPHA).toBe(0)
    const labelCalls = recordSponsorBoardDraws({
      label: 'Acme',
      panelAlpha: 0,
    })
    expect(labelCalls.some((c) => c.op === 'fillRect')).toBe(false)
    expect(labelCalls.some((c) => c.op === 'strokeRect')).toBe(false)
    expect(labelCalls).toEqual([
      { op: 'fillText', text: 'Acme', x: 512, y: 256 },
    ])
    const logoCalls = recordSponsorBoardDraws({
      label: 'xxx',
      panelAlpha: 0,
      logo: { width: 400, height: 100 },
    })
    expect(logoCalls.some((c) => c.op === 'fillRect')).toBe(false)
    expect(logoCalls.some((c) => c.op === 'strokeRect')).toBe(false)
    expect(logoCalls.some((c) => c.op === 'drawImage')).toBe(true)
    expect(logoCalls.some((c) => c.op === 'fillText')).toBe(false)
    expect(shouldKnockOutLogo(false)).toBe(true)
    expect(shouldKnockOutLogo(true)).toBe(false)
  })
})

describe('logo near-black knockout (04-05)', () => {
  it('keys opaque black to alpha 0 and keeps coloured glyphs + white', () => {
    expect(LOGO_KNOCKOUT_LUMA_HARD).toBeLessThan(24)
    expect(LOGO_KNOCKOUT_LUMA_SOFT).toBeGreaterThan(0)
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,
      8, 8, 8, 255,
      0, 96, 57, 255,
      227, 0, 27, 255,
      0, 212, 232, 255,
      255, 255, 255, 255,
      163, 126, 44, 255,
    ])
    knockOutNearBlackRgba(data)
    expect(data[3]).toBe(0)
    expect(data[0]).toBe(0)
    expect(data[7]).toBe(0)
    // Rolex green, Vodafone red, Senexus cyan, white sphere, gold crown.
    expect(data[11]).toBe(255)
    expect(data[8]).toBe(0)
    expect(data[9]).toBe(96)
    expect(data[10]).toBe(57)
    expect(data[15]).toBe(255)
    expect(data[12]).toBe(227)
    expect(data[19]).toBe(255)
    expect(data[23]).toBe(255)
    expect(data[20]).toBe(255)
    expect(data[21]).toBe(255)
    expect(data[22]).toBe(255)
    expect(data[27]).toBe(255)
    expect(luma601(0, 96, 57)).toBeGreaterThan(
      LOGO_KNOCKOUT_LUMA_HARD + LOGO_KNOCKOUT_LUMA_SOFT,
    )
    expect(luma601(255, 255, 255)).toBeGreaterThan(200)
  })

  it('soft-edges mid-luma so keyed blacks do not halo', () => {
    const mid = Math.round(
      LOGO_KNOCKOUT_LUMA_HARD + LOGO_KNOCKOUT_LUMA_SOFT * 0.5,
    )
    const data = new Uint8ClampedArray([mid, mid, mid, 255])
    knockOutNearBlackRgba(data)
    expect(data[3]).toBeGreaterThan(0)
    expect(data[3]).toBeLessThan(255)
  })

  it('zeros white RGB on already-transparent pixels (library PNG holes)', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 0, 227, 0, 27, 255])
    zeroRgbWhereAlphaZero(data)
    expect(data[0]).toBe(0)
    expect(data[1]).toBe(0)
    expect(data[2]).toBe(0)
    expect(data[3]).toBe(0)
    expect(data[4]).toBe(227)
    expect(data[5]).toBe(0)
    expect(data[6]).toBe(27)
    expect(data[7]).toBe(255)
  })

  it('knockOut sanitizes (255,255,255,0) instead of skipping a===0', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 0])
    knockOutNearBlackRgba(data)
    expect(data[0]).toBe(0)
    expect(data[1]).toBe(0)
    expect(data[2]).toBe(0)
    expect(data[3]).toBe(0)
  })
})

describe('opaque glyph AABB crop (04-08)', () => {
  it('returns the ink box, not the full 1024×512 empty canvas', () => {
    const width = 64
    const height = 32
    const data = new Uint8ClampedArray(width * height * 4)
    const paint = (x: number, y: number) => {
      const i = (y * width + x) * 4
      data[i] = 227
      data[i + 1] = 0
      data[i + 2] = 27
      data[i + 3] = 255
    }
    for (let y = 8; y < 14; y++) {
      for (let x = 20; x < 30; x++) paint(x, y)
    }
    const aabb = opaqueGlyphAabb(data, width, height)
    expect(aabb).not.toBeNull()
    expect(aabb!.w).toBeLessThan(width / 2)
    expect(aabb!.h).toBeLessThan(height / 2)
    expect(aabb!.w).toBeGreaterThanOrEqual(10)
    expect(aabb!.h).toBeGreaterThanOrEqual(6)
    expect(GLYPH_ALPHA_MIN).toBe(13)

    const crop = { ...aabb!, srcW: 1024, srcH: 512 }
    const mesh = meshSizeFromGlyphCrop(40, 20, crop)
    expect(mesh.widthM).toBeCloseTo(40 * (aabb!.w / 1024))
    expect(mesh.heightM).toBeCloseTo(20 * (aabb!.h / 512))
    expect(mesh.widthM).toBeLessThan(20)
    expect(mesh.heightM).toBeLessThan(10)
  })

  it('glyphCropFromPlan hugs logoDest, not the full 1024×512 board', () => {
    const plan = planSponsorBoard({
      label: 'xxx',
      panelAlpha: 0,
      logo: { width: 400, height: 100 },
    })
    const crop = glyphCropFromPlan(plan)
    expect(crop).not.toBeNull()
    expect(crop!.srcW).toBe(1024)
    expect(crop!.srcH).toBe(512)
    expect(crop!.w).toBeLessThan(1024)
    expect(crop!.h).toBeLessThan(512)
    expect(glyphCropIsFullBoard(crop!)).toBe(false)
  })
})

function eastWestSponsor(heightM: number): SponsorEnuEndpoints {
  return {
    id: 'sp-test',
    label: 'Acme',
    heightM,
    textureUrl: null,
    color: 0x2a6f7a,
    ax: 0,
    az: 0,
    bx: 30,
    bz: 0,
    midX: 15,
    midY: 0,
    midZ: 0,
    widthM: 30,
  }
}

describe('createSponsorBillboard placement', () => {
  it('lies flat on the water matching the line-sign basis and Y', async () => {
    const endpoints = { ...eastWestSponsor(8), panelAlpha: 1 }
    const panel = await createSponsorBillboard(endpoints)
    const sign = createLineSignMesh({
      id: 'start:1',
      kind: 'start',
      label: 'START',
      color: 0xad0000,
      ax: endpoints.ax,
      az: endpoints.az,
      bx: endpoints.bx,
      bz: endpoints.bz,
      midX: endpoints.midX,
      midY: endpoints.midY,
      midZ: endpoints.midZ,
      widthM: endpoints.widthM,
    })
    try {
      expect(panel.root.position.y).toBeCloseTo(
        WATER_PLANE_Y + WATER_PLANE_Y_OFFSET,
      )
      expect(sign.root.position.y).toBeCloseTo(panel.root.position.y)
      expect(panel.root.quaternion.angleTo(sign.root.quaternion)).toBeLessThan(
        1e-6,
      )
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
        panel.root.quaternion,
      )
      expect(normal.x).toBeCloseTo(0)
      expect(normal.y).toBeCloseTo(1)
      expect(normal.z).toBeCloseTo(0)
      const along = new THREE.Vector3(1, 0, 0).applyQuaternion(
        panel.root.quaternion,
      )
      expect(along.x).toBeCloseTo(1)
      expect(along.y).toBeCloseTo(0)
      const geo = panel.root.geometry as THREE.PlaneGeometry
      expect(geo.parameters.width).toBe(30)
      expect(geo.parameters.height).toBe(8)
      const mat = panel.root.material as THREE.MeshBasicMaterial
      expect(mat.transparent).toBe(true)
      expect(mat.depthWrite).toBe(false)
      expect(mat.fog).toBe(false)
      expect(mat.alphaTest).toBeCloseTo(WATER_PLANE_BOARD_ALPHA_TEST)
      const map = mat.map as THREE.CanvasTexture
      expect(map.generateMipmaps).toBe(false)
      expect(map.minFilter).toBe(THREE.LinearFilter)
      const signMat = sign.root.material as THREE.MeshBasicMaterial
      expect(signMat.fog).toBe(false)
      const signMap = signMat.map as THREE.CanvasTexture
      expect(signMap.generateMipmaps).toBe(false)
      expect(signMap.minFilter).toBe(THREE.LinearFilter)
      expect(panel.root.position.y).not.toBeCloseTo(endpoints.heightM / 2)
    } finally {
      panel.dispose()
      sign.dispose()
    }
  })

  it('clamps flat across-track size to A–B / aspect (heightM 100 is not a slab)', async () => {
    const endpoints = { ...eastWestSponsor(100), panelAlpha: 1 }
    const panel = await createSponsorBillboard(endpoints)
    try {
      const geo = panel.root.geometry as THREE.PlaneGeometry
      expect(geo.parameters.width).toBe(30)
      expect(geo.parameters.height).toBeCloseTo(30 / 2)
      expect(geo.parameters.height).not.toBeCloseTo(100)
      expect(panel.root.position.y).toBeCloseTo(
        WATER_PLANE_Y + WATER_PLANE_Y_OFFSET,
      )
      expect(panel.root.position.y).not.toBeCloseTo(100 / 2)
      const mat = panel.root.material as THREE.MeshBasicMaterial
      expect(mat.fog).toBe(false)
    } finally {
      panel.dispose()
    }
  })

  it('keeps an explicit upright wall for billboardChain', async () => {
    const endpoints = eastWestSponsor(8)
    const panel = await createSponsorBillboard(endpoints, {
      placement: 'upright',
    })
    try {
      expect(panel.root.position.y).toBeCloseTo(SPONSOR_WATER_Y + 4)
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
        panel.root.quaternion,
      )
      expect(localUp.y).toBeCloseTo(1)
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
        panel.root.quaternion,
      )
      expect(normal.y).toBeCloseTo(0)
      const mat = panel.root.material as THREE.MeshBasicMaterial
      expect(mat.transparent).toBe(false)
      expect(mat.depthWrite).toBe(true)
      expect(mat.fog).toBe(true)
    } finally {
      panel.dispose()
    }
  })
})

describe('sponsorPlaneSize / applySponsorScaleOnEdit', () => {
  const gpsToEnu: GpsToEnuAmslFn = (lat, lon, alt) => ({
    x: lon * 1000,
    y: alt,
    z: lat * 1000,
  })

  it('ignores authored heightM and packed boardAspect for the mesh OBB', () => {
    expect(DEFAULT_SPONSOR_BOARD_ASPECT).toBe(2)
    expect(sponsorPlaneSize(40, 8, undefined)).toEqual({
      widthM: 40,
      heightM: 20,
    })
    expect(sponsorPlaneSize(40, 100, 40 / 100).heightM).toBeCloseTo(20)
    expect(sponsorPlaneSize(40, 100, 40 / 100).heightM).not.toBeCloseTo(100)
  })

  it('A–B stretch scales glyph metres; heightM 100 does not rewrite aspect into a slab', () => {
    const prev = stampSponsorBoardAspect(
      {
        id: 'sp',
        name: 'sp',
        type: 'sponsor',
        points: [
          { lat: 0, lon: 0, altMsl: 0 },
          { lat: 0, lon: 0.02, altMsl: 0 },
        ],
        heightM: 8,
      },
      gpsToEnu,
    )
    expect(prev.boardAspect).toBeCloseTo(DEFAULT_SPONSOR_BOARD_ASPECT)

    const stretched = applySponsorScaleOnEdit(
      prev,
      {
        ...prev,
        points: [
          { lat: 0, lon: 0, altMsl: 0 },
          { lat: 0, lon: 0.04, altMsl: 0 },
        ],
      },
      gpsToEnu,
    )
    expect(stretched.heightM).toBeCloseTo(16)
    expect(stretched.boardAspect).toBeCloseTo(DEFAULT_SPONSOR_BOARD_ASPECT)
    expect(sponsorPlaneSize(40, stretched.heightM, stretched.boardAspect).heightM).toBe(
      20,
    )

    const taller = applySponsorScaleOnEdit(
      stretched,
      { ...stretched, heightM: 100 },
      gpsToEnu,
    )
    expect(taller.heightM).toBeCloseTo(100)
    expect(taller.boardAspect).toBeCloseTo(DEFAULT_SPONSOR_BOARD_ASPECT)
    const plane = sponsorPlaneSize(40, taller.heightM, taller.boardAspect)
    expect(plane.heightM).toBeCloseTo(20)
    expect(plane.heightM).not.toBeCloseTo(100)
    expect(glyphScaleInsideCanvas(100, plane.heightM)).toBe(1)
    expect(glyphScaleInsideCanvas(8, 20)).toBeCloseTo(0.4)
  })
})
