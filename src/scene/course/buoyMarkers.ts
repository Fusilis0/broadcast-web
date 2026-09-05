import * as THREE from 'three'
import {
  isBuoyMeshVisible,
  isBuoyTagVisible,
} from '../features/featureVisibility.ts'
import type { CourseAppearance, CourseEnuPoint } from './types.ts'
import { COURSE_WATER_Y } from './courseLayout.ts'
import {
  createRoundingArrowRing,
  DEFAULT_ROUNDING_RADIUS_M,
} from './roundingArrows.ts'

export type BuoyMarkersHandle = {
  root: THREE.Group
  dispose: () => void
}

const LABEL_CANVAS_W = 256
const LABEL_CANVAS_H = 64
const LABEL_ASPECT = LABEL_CANVAS_W / LABEL_CANVAS_H

function drawBuoyLabel(
  canvas: HTMLCanvasElement,
  name: string,
  accent: number,
): void {
  canvas.width = LABEL_CANVAS_W
  canvas.height = LABEL_CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, LABEL_CANVAS_W, LABEL_CANVAS_H)
  ctx.fillStyle = 'rgba(12, 16, 22, 0.72)'
  ctx.fillRect(4, 8, LABEL_CANVAS_W - 8, LABEL_CANVAS_H - 16)
  const r = (accent >> 16) & 0xff
  const g = (accent >> 8) & 0xff
  const b = accent & 0xff
  ctx.strokeStyle = `rgba(${r},${g},${b},0.85)`
  ctx.lineWidth = 3
  ctx.strokeRect(4, 8, LABEL_CANVAS_W - 8, LABEL_CANVAS_H - 16)
  ctx.fillStyle = '#f5f2ea'
  ctx.font = '600 28px "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, LABEL_CANVAS_W / 2, LABEL_CANVAS_H / 2, LABEL_CANVAS_W - 24)
}

function isGateEnd(type: CourseEnuPoint['type']): boolean {
  return type === 'gateLeft' || type === 'gateRight'
}

/**
 * Racing-mark style buoy: float body + band + stem + cap.
 * Scale spirit matches Unity BuoyMarker (markerSize≈5, fat cylinder).
 */
function createBuoyPole(
  point: CourseEnuPoint,
  appearance: CourseAppearance,
): {
  root: THREE.Group
  dispose: () => void
} {
  const height = appearance.buoyHeightM
  const gate = isGateEnd(point.type)
  const bodyColor = appearance.buoyColor
  const accent = gate ? appearance.gateColor : appearance.buoyColor
  // Unity cylinder scale ~(1.5, 5, 1.5) → radius ~0.75 on a 5 m marker.
  const bodyR = height * 0.16
  const floatH = height * 0.42
  const stemH = height * 0.38
  const capH = height * 0.2

  const group = new THREE.Group()
  group.name = `buoy_${point.name}`
  group.position.set(point.x, COURSE_WATER_Y, point.z)

  const disposables: Array<{
    geom?: THREE.BufferGeometry
    mat?: THREE.Material
    tex?: THREE.Texture
  }> = []

  const showMesh = isBuoyMeshVisible(point)
  const showTag = isBuoyTagVisible(point)

  if (showMesh) {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.38,
      metalness: 0.12,
    })
    const accentMat = new THREE.MeshStandardMaterial({
      color: accent,
      roughness: 0.32,
      metalness: 0.18,
    })
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      roughness: 0.65,
      metalness: 0.05,
    })
    disposables.push({ mat: bodyMat }, { mat: accentMat }, { mat: darkMat })

    // Float — slightly elongated sphere sitting mostly above water.
    const floatGeom = new THREE.SphereGeometry(bodyR, 16, 12)
    disposables.push({ geom: floatGeom })
    const floatMesh = new THREE.Mesh(floatGeom, bodyMat)
    floatMesh.name = 'buoyFloat'
    floatMesh.scale.set(1, floatH / (bodyR * 2), 1)
    floatMesh.position.y = floatH * 0.45
    group.add(floatMesh)

    // Mid band (gate ends get gate-green stripe; marks keep yellow/dark).
    const bandGeom = new THREE.TorusGeometry(bodyR * 0.92, bodyR * 0.12, 8, 24)
    disposables.push({ geom: bandGeom })
    const band = new THREE.Mesh(bandGeom, gate ? accentMat : darkMat)
    band.name = 'buoyBand'
    band.rotation.x = Math.PI / 2
    band.position.y = floatH * 0.5
    group.add(band)

    // Stem
    const stemR = bodyR * 0.22
    const stemGeom = new THREE.CylinderGeometry(stemR, stemR * 1.15, stemH, 10)
    disposables.push({ geom: stemGeom })
    const stem = new THREE.Mesh(stemGeom, darkMat)
    stem.name = 'buoyStem'
    stem.position.y = floatH + stemH / 2
    group.add(stem)

    // Cap cone
    const capGeom = new THREE.ConeGeometry(bodyR * 0.45, capH, 10)
    disposables.push({ geom: capGeom })
    const cap = new THREE.Mesh(capGeom, accentMat)
    cap.name = 'buoyCap'
    cap.position.y = floatH + stemH + capH / 2
    group.add(cap)
  }

  if (showTag) {
    const canvas = document.createElement('canvas')
    drawBuoyLabel(canvas, point.name, accent)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.needsUpdate = true
    disposables.push({ tex: map })
    const spriteMat = new THREE.SpriteMaterial({
      map,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    })
    disposables.push({ mat: spriteMat })
    const sprite = new THREE.Sprite(spriteMat)
    sprite.name = 'buoyLabel'
    sprite.position.set(0, height + 1.8, 0)
    const labelH = 2.2
    sprite.scale.set(labelH * LABEL_ASPECT, labelH, 1)
    group.add(sprite)
  }

  const extraDispose: Array<() => void> = []

  const ringRadius = Math.max(height * 1.8, DEFAULT_ROUNDING_RADIUS_M)
  const rounding = createRoundingArrowRing({
    sense: point.rounding,
    radiusM: ringRadius,
  })
  if (rounding) {
    group.add(rounding.root)
    extraDispose.push(rounding.dispose)
  }

  return {
    root: group,
    dispose(): void {
      for (const d of extraDispose) d()
      extraDispose.length = 0
      for (const d of disposables) {
        d.geom?.dispose()
        d.mat?.dispose()
        d.tex?.dispose()
      }
      disposables.length = 0
    },
  }
}

/**
 * Polished racing buoys at marks and gate ends (visible for web ops / air).
 */
export function createBuoyMarkers(
  points: readonly CourseEnuPoint[],
  appearance: CourseAppearance,
): BuoyMarkersHandle {
  const root = new THREE.Group()
  root.name = 'buoyMarkers'
  const disposers: Array<() => void> = []

  // Dedupe by rounded ENU so gate ends that coincide with marks get one pole.
  const seen = new Set<string>()
  for (const p of points) {
    const key = `${p.x.toFixed(2)},${p.z.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    const buoy = createBuoyPole(p, appearance)
    root.add(buoy.root)
    disposers.push(buoy.dispose)
  }

  return {
    root,
    dispose(): void {
      for (const d of disposers) d()
      disposers.length = 0
      root.clear()
    },
  }
}
