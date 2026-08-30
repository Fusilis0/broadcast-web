/**
 * @vitest-environment happy-dom
 */
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { normalizeSponsors } from './normalizeSponsors.ts'
import {
  buildSponsorLayout,
  horizontalSpanFromEnu,
  SPONSOR_WATER_Y,
} from './sponsorLayout.ts'
import { facingBasisFromSpan, createSponsorBillboard } from './sponsorBillboard.ts'
import { createLineSignMesh } from '../lineSigns/lineSignMesh.ts'
import {
  WATER_PLANE_Y,
  WATER_PLANE_Y_OFFSET,
} from '../waterPlanePlacement.ts'
import {
  containFitRect,
  DEFAULT_FRAME_COLOR,
  DEFAULT_PANEL_COLOR,
  hexToCss,
  parseOptionalHexColor,
  planSponsorBoard,
  recordSponsorBoardDraws,
} from './boardCompose.ts'
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
    midZ: 0,
    widthM: 30,
  }
}

describe('createSponsorBillboard placement', () => {
  it('lies flat on the water matching the line-sign basis and Y', async () => {
    const endpoints = eastWestSponsor(8)
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
      expect(panel.root.position.y).not.toBeCloseTo(endpoints.heightM / 2)
    } finally {
      panel.dispose()
      sign.dispose()
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
    } finally {
      panel.dispose()
    }
  })
})
