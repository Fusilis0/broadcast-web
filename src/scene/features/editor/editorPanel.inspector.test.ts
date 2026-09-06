/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { startMapFeatureEditor } from './editorPanel.ts'
import type { Map2dHandle } from '../../map2d.ts'

const fakeGpsToEnu = (lat: number, lon: number, alt: number) => ({
  x: lon * 1000,
  y: alt,
  z: -lat * 1000,
})
const fakeEnuToGps = (east: number, _up: number, north: number) => ({
  lat: north / 1000,
  lon: east / 1000,
  alt: 0,
})

function stubMap(): Map2dHandle {
  const root = document.createElement('div')
  const canvas = document.createElement('canvas')
  return {
    root,
    getCanvas: () => canvas,
    getPaintGeneration: () => 0,
    updatePose: () => {},
    setCourseMarks: () => {},
    setLayoutFeatures: () => {},
    setSelectedFeatureIds: () => {},
    setInteractive: () => {},
    setSizePx: () => {},
    setVisible: () => {},
    isVisible: () => true,
    setTitle: () => {},
    hitTestFeature: () => null,
    hitTestVertex: () => null,
    hitTestPose: () => null,
    hitTestPolylineInsert: () => null,
    nearestVertex: () => null,
    setSnapGuide: () => {},
    setDraftSegment: () => {},
    setDraftPolyline: () => {},
    onMapClick: () => () => {},
    onMapPointerMove: () => () => {},
    onMapPointerDown: () => () => {},
    setBoatDotColors: () => {},
    setBoatNames: () => {},
    setBoatIconScale: () => {},
    getBoatIconScale: () => 1,
    setBasemapEnabled: () => {},
    isBasemapEnabled: () => false,
    setGeoBridge: () => {},
    resetView: () => {},
    focusEnu: () => {},
    setHiddenPoseIds: () => {},
    removePose: () => false,
    retainPoseIds: () => 0,
    getPoseIds: () => [],
    redraw: () => {},
    dispose: () => {},
  }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('authoring inspector (19.7)', () => {
  it('hides pack id/name from the overlay form', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = startMapFeatureEditor({
      container: host,
      map: stubMap(),
      initialFeatures: [],
      gpsToEnuAmsl: fakeGpsToEnu,
      enuToGpsAmsl: fakeEnuToGps,
      onApply: () => {},
      initiallyOpen: true,
      initialProjectId: 'demo-istanbul',
      initialProjectName: 'Demo Istanbul',
    })
    const meta = host.querySelector('[data-ops="authoring-project-meta"]')
    expect(meta).toBeTruthy()
    expect((meta as HTMLElement).hidden).toBe(true)
    const inspector = host.querySelector('[data-ops="authoring-inspector"]')
    expect(inspector).toBeTruthy()
    expect(inspector!.textContent ?? '').not.toMatch(/project id/i)
    expect(inspector!.textContent ?? '').not.toMatch(/project name/i)
    expect(host.querySelector('[data-ops="authoring-commit"]')?.textContent).toBe(
      'Add',
    )
    editor.dispose()
  })

  it('coordinate Add puts the new id in getFeatures before onApply remount resolves', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let applyStarted = false
    let applyResolved = false
    let storeIds: string[] = []
    const remount = new Promise<void>(() => {
      /* never resolves during this test */
    })
    const editor = startMapFeatureEditor({
      container: host,
      map: stubMap(),
      initialFeatures: [],
      gpsToEnuAmsl: fakeGpsToEnu,
      enuToGpsAmsl: fakeEnuToGps,
      initiallyOpen: true,
      onStoreChange: (features) => {
        storeIds = features.map((f) => f.id)
      },
      onApply: async (features) => {
        applyStarted = true
        void features
        await remount
        applyResolved = true
      },
    })

    const type = host.querySelector(
      '[data-ops="authoring-type"]',
    ) as HTMLSelectElement
    type.value = 'sponsor'
    type.dispatchEvent(new Event('change'))
    const lat = host.querySelector(
      '[data-ops="authoring-lat"]',
    ) as HTMLInputElement
    const lon = host.querySelector(
      '[data-ops="authoring-lon"]',
    ) as HTMLInputElement
    lat.value = '41'
    lon.value = '29'
    const commit = host.querySelector(
      '[data-ops="authoring-commit"]',
    ) as HTMLButtonElement
    commit.click()

    const features = editor.getFeatures()
    expect(features.some((f) => f.type === 'sponsor')).toBe(true)
    expect(storeIds).toEqual(features.map((f) => f.id))
    expect(applyResolved).toBe(false)
    expect(host.querySelector('[data-ops="authoring-commit"]')?.textContent).toBe(
      'Edit',
    )
    editor.dispose()
    void applyStarted
  })

  it('Edit rewrites the selected start line both ends in place', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = startMapFeatureEditor({
      container: host,
      map: stubMap(),
      initialFeatures: [],
      gpsToEnuAmsl: fakeGpsToEnu,
      enuToGpsAmsl: fakeEnuToGps,
      onApply: () => {},
      initiallyOpen: true,
    })
    const type = host.querySelector(
      '[data-ops="authoring-type"]',
    ) as HTMLSelectElement
    type.value = 'start'
    type.dispatchEvent(new Event('change'))
    const lat = host.querySelector(
      '[data-ops="authoring-lat"]',
    ) as HTMLInputElement
    const lon = host.querySelector(
      '[data-ops="authoring-lon"]',
    ) as HTMLInputElement
    const latB = host.querySelector(
      '[data-ops="authoring-lat-b"]',
    ) as HTMLInputElement
    const lonB = host.querySelector(
      '[data-ops="authoring-lon-b"]',
    ) as HTMLInputElement
    lat.value = '41'
    lon.value = '29'
    latB.value = '41.01'
    lonB.value = '29.01'
    const commit = host.querySelector(
      '[data-ops="authoring-commit"]',
    ) as HTMLButtonElement
    commit.click()
    const created = editor.getFeatures()[0]!
    expect(created.type).toBe('start')
    expect(commit.textContent).toBe('Edit')

    lat.value = '40'
    lon.value = '28'
    latB.value = '40.1'
    lonB.value = '28.1'
    commit.click()
    const line = editor.getFeatures()[0]!
    expect(editor.getFeatures()).toHaveLength(1)
    expect(line.id).toBe(created.id)
    expect(line.points[0]!.lat).toBe(40)
    expect(line.points[0]!.lon).toBe(28)
    expect(line.points[1]!.lat).toBe(40.1)
    expect(line.points[1]!.lon).toBe(28.1)
    editor.dispose()
  })

  it('select-tool drag moves a boat without live telem and skips live hulls', () => {
    let claim: (
      east: number,
      north: number,
      ev: PointerEvent,
    ) => boolean = () => false
    let move: (east: number, north: number) => void = () => {}
    const moves: Array<{ east: number; north: number; id: string }> = []
    const map = stubMap()
    map.hitTestPose = () => ({
      id: '1',
      kind: 'boat',
      east: 10,
      north: 20,
      up: 0,
      yawDeg: 0,
    })
    map.onMapPointerDown = (cb) => {
      claim = cb
      return () => {}
    }
    map.onMapPointerMove = (cb) => {
      move = cb
      return () => {}
    }

    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = startMapFeatureEditor({
      container: host,
      map,
      initialFeatures: [],
      gpsToEnuAmsl: fakeGpsToEnu,
      enuToGpsAmsl: fakeEnuToGps,
      onApply: () => {},
      initiallyOpen: true,
      canMoveFleetPose: () => true,
      onMoveFleet: (_kind, east, north, id) => {
        moves.push({ east, north, id })
      },
    })
    const ev = { pointerId: 7 } as PointerEvent
    expect(claim(10, 20, ev)).toBe(true)
    move(44, 55)
    expect(moves).toEqual([{ east: 44, north: 55, id: '1' }])
    editor.dispose()

    moves.length = 0
    const liveMap = stubMap()
    liveMap.hitTestPose = map.hitTestPose
    liveMap.onMapPointerDown = (cb) => {
      claim = cb
      return () => {}
    }
    const liveHost = document.createElement('div')
    document.body.appendChild(liveHost)
    const liveEditor = startMapFeatureEditor({
      container: liveHost,
      map: liveMap,
      initialFeatures: [],
      gpsToEnuAmsl: fakeGpsToEnu,
      enuToGpsAmsl: fakeEnuToGps,
      onApply: () => {},
      initiallyOpen: true,
      canMoveFleetPose: () => false,
      onMoveFleet: (_kind, east, north, id) => {
        moves.push({ east, north, id })
      },
    })
    expect(claim(10, 20, ev)).toBe(false)
    expect(moves).toEqual([])
    liveEditor.dispose()
  })

  it('inspector Add point appends a vertex on the selected chain', () => {
    let click: (east: number, north: number) => void = () => {}
    const chain = {
      id: 'chain:1',
      name: 'chain',
      type: 'billboardChain' as const,
      points: [
        { lat: 0, lon: 0, altMsl: 0 },
        { lat: 0.02, lon: 0.04, altMsl: 0 },
      ],
      spacingM: 12,
    }
    const map = stubMap()
    map.hitTestFeature = () => ({
      id: 'chain:1',
      name: 'chain',
      type: 'billboardChain',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 40, y: 0, z: -20 },
      ],
      rawPoints: chain.points,
    })
    map.onMapClick = (cb) => {
      click = cb
      return () => {}
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = startMapFeatureEditor({
      container: host,
      map,
      initialFeatures: [chain],
      gpsToEnuAmsl: fakeGpsToEnu,
      enuToGpsAmsl: fakeEnuToGps,
      onApply: () => {},
      initiallyOpen: true,
    })
    click(10, 10)
    const add = host.querySelector(
      '[data-ops="authoring-add-chain-point"]',
    ) as HTMLButtonElement | null
    expect(add).toBeTruthy()
    add!.click()
    expect(editor.getFeatures()[0]!.points).toHaveLength(3)
    editor.dispose()
  })
})
