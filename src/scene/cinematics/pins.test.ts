/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CINEMATIC_PIN_ALT_MSL, createCinematicPins } from './pins.ts'

describe('cinematic pins', () => {
  it('places GEO ECEF sprites and hides on setVisible(false)', () => {
    const toEcef = (lat: number, lon: number, altMsl: number) => ({
      x: lon * 1000,
      y: altMsl,
      z: lat * 1000,
    })
    const pins = createCinematicPins({ geodeticToEcefMeters: toEcef })
    pins.setPins([
      { id: 'usa', label: 'USA', lat: 39.83, lon: -98.58 },
      { id: 'uk', label: 'UK', lat: 54, lon: -2.5 },
    ])
    expect(pins.root.children).toHaveLength(2)
    const usa = pins.root.children.find(
      (c) => c.name === 'cinematicPin:usa',
    )
    expect(usa).toBeDefined()
    expect(usa?.position.x).toBeCloseTo(-98.58 * 1000, 5)
    expect(usa?.position.y).toBe(CINEMATIC_PIN_ALT_MSL)
    expect(usa?.position.z).toBeCloseTo(39.83 * 1000, 5)

    pins.setVisible(true)
    expect(pins.root.visible).toBe(true)
    pins.setVisible(false)
    expect(pins.root.visible).toBe(false)
    pins.dispose()
    expect(pins.root.children).toHaveLength(0)
  })

  it('hides far-side pins in update()', () => {
    const toEcef = (lat: number, lon: number, _alt: number) => ({
      x: lon,
      y: 0,
      z: lat,
    })
    const pins = createCinematicPins({ geodeticToEcefMeters: toEcef })
    pins.setPins([
      { id: 'front', label: 'Front', lat: 10, lon: 10 },
      { id: 'back', label: 'Back', lat: -10, lon: -10 },
    ])
    pins.setVisible(true)
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(100, 0, 100)
    pins.update(camera)
    const front = pins.root.getObjectByName('cinematicPin:front')
    const back = pins.root.getObjectByName('cinematicPin:back')
    expect(front?.visible).toBe(true)
    expect(back?.visible).toBe(false)
    const mat = (front as THREE.Sprite).material
    expect(mat.depthTest).toBe(false)
    pins.dispose()
  })

  it('pops the focused pin larger than the rest', () => {
    const toEcef = (lat: number, lon: number, altMsl: number) => ({
      x: lon * 1000,
      y: altMsl,
      z: lat * 1000,
    })
    const pins = createCinematicPins({ geodeticToEcefMeters: toEcef })
    pins.setPins([
      { id: 'canada', label: 'Canada', lat: 56.13, lon: -106.35, flag: 'canada' },
      { id: 'uk', label: 'UK', lat: 54, lon: -2.5, flag: 'uk' },
    ])
    pins.setVisible(true)
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(1e7, 1e7, 1e7)
    for (let i = 0; i < 12; i++) pins.update(camera, 'canada')
    const canada = pins.root.getObjectByName(
      'cinematicPin:canada',
    ) as THREE.Sprite
    const uk = pins.root.getObjectByName('cinematicPin:uk') as THREE.Sprite
    expect(canada.scale.y).toBeGreaterThan(uk.scale.y * 1.15)
    pins.dispose()
  })

  it('anchors a map-pin needle (tip) at ECEF, not a mid-pill gold dot', () => {
    const toEcef = (lat: number, lon: number, altMsl: number) => ({
      x: lon * 1000,
      y: altMsl,
      z: lat * 1000,
    })
    const pins = createCinematicPins({ geodeticToEcefMeters: toEcef })
    pins.setPins([
      { id: 'istanbul', label: 'İstanbul', lat: 41.0082, lon: 28.9784, kind: 'place' },
    ])
    const sprite = pins.root.children.find(
      (c) => c.name === 'cinematicPin:istanbul',
    ) as THREE.Sprite | undefined
    expect(sprite).toBeDefined()
    expect(sprite?.center.y).toBeLessThan(0.08)
    expect(sprite?.center.x).toBeGreaterThan(0.05)
    expect(sprite?.center.x).toBeLessThan(0.25)
    pins.dispose()
  })

  it('anchors hero name callouts at the needle', () => {
    const toEnu = (lat: number, lon: number, altMsl: number) => ({
      x: lon * 1000,
      y: altMsl,
      z: lat * 1000,
    })
    const pins = createCinematicPins({ enuKeyframeToScene: toEnu })
    pins.setFrame('enu')
    pins.setPins([
      {
        id: 'galata-tower',
        label: 'Galata Tower',
        lat: 41.0256,
        lon: 28.9741,
        kind: 'hero',
      },
    ])
    const sprite = pins.root.getObjectByName(
      'cinematicPin:galata-tower',
    ) as THREE.Sprite | undefined
    expect(sprite).toBeDefined()
    expect(sprite?.center.y).toBeLessThan(0.08)
    expect(sprite?.center.x).toBeGreaterThan(0.05)
    expect(sprite?.center.x).toBeLessThan(0.25)
    pins.dispose()
  })

  it('hides İstanbul until Turkey is focused, and never infers a Turkey flag', () => {
    const toEcef = (lat: number, lon: number, altMsl: number) => ({
      x: lon * 1000,
      y: altMsl,
      z: lat * 1000,
    })
    const pins = createCinematicPins({ geodeticToEcefMeters: toEcef })
    pins.setPins([
      { id: 'turkey', label: 'Turkey', lat: 39, lon: 35.2, flag: 'turkey' },
      { id: 'istanbul', label: 'İstanbul', lat: 41.0082, lon: 28.9784 },
    ])
    pins.setVisible(true)
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(1e7, 1e7, 1e7)
    pins.update(camera, 'europe')
    expect(pins.root.getObjectByName('cinematicPin:istanbul')?.visible).toBe(
      false,
    )
    pins.update(camera, 'turkey')
    expect(pins.root.getObjectByName('cinematicPin:istanbul')?.visible).toBe(
      true,
    )
    pins.dispose()
  })

  it('pins a hero at the mesh XZ centre from heroAnchor', () => {
    const toEnu = (lat: number, lon: number, altMsl: number) => ({
      x: lon * 1000,
      y: altMsl,
      z: lat * 1000,
    })
    const pins = createCinematicPins({
      enuKeyframeToScene: toEnu,
      heroAnchor: (id) =>
        id === 'dolmabahce' ? { x: 12, y: 34, z: -8 } : null,
    })
    pins.setFrame('enu')
    pins.setPins([
      {
        id: 'dolmabahce',
        label: 'Dolmabahçe',
        lat: 41.03917,
        lon: 29.0007,
        kind: 'hero',
      },
    ])
    const sprite = pins.root.getObjectByName(
      'cinematicPin:dolmabahce',
    ) as THREE.Sprite
    expect(sprite.position.x).toBe(12)
    expect(sprite.position.y).toBe(34)
    expect(sprite.position.z).toBe(-8)
    pins.dispose()
  })

  it('loads USA, Canada, and Bulgaria flag photos', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'pins.ts'),
      'utf8',
    )
    expect(src).toContain('/cinematics/pins/flags/usa.webp')
    expect(src).toContain('/cinematics/pins/flags/canada.webp')
    expect(src).toContain('/cinematics/pins/flags/bulgaria.webp')
    expect(src).toContain("bulgaria: 'BGR'")
  })

  it('centers name, place, and country HUD text in the pin field', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'pins.ts'),
      'utf8',
    )
    expect((src.match(/fillFittedText\(/g) ?? []).length).toBe(4)
    expect((src.match(/,\s*'center',\s*\)/g) ?? []).length).toBe(3)
    expect(src).not.toMatch(/,\s*'left',\s*\)/)
  })

  it('shows only the focused hero pin', () => {
    const toEnu = (lat: number, lon: number, altMsl: number) => ({
      x: lon * 1000,
      y: altMsl,
      z: lat * 1000,
    })
    const pins = createCinematicPins({ enuKeyframeToScene: toEnu })
    pins.setFrame('enu')
    pins.setPins([
      {
        id: 'hagia-sophia',
        label: 'Hagia Sophia',
        lat: 41.00858,
        lon: 28.98018,
        kind: 'hero',
      },
      {
        id: 'sultan-ahmed',
        label: 'Sultan Ahmed',
        lat: 41.00541,
        lon: 28.97681,
        kind: 'hero',
      },
    ])
    pins.setVisible(true)
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 200, 0)
    pins.update(camera, 'hagia-sophia')
    expect(pins.root.getObjectByName('cinematicPin:hagia-sophia')?.visible).toBe(
      true,
    )
    expect(pins.root.getObjectByName('cinematicPin:sultan-ahmed')?.visible).toBe(
      false,
    )
    pins.dispose()
  })
})
