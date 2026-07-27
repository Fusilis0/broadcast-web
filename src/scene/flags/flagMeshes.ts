import * as THREE from 'three'

export const FLAG_WATER_Y = 0

const POLE_RADIUS_M = 0.12
const FLAG_WIDTH_M = 2.4
const FLAG_HEIGHT_M = 1.5

export type FlagKind = 'white' | 'orange' | 'blueWhite'

export type FlagMeshHandle = {
  root: THREE.Group
  /** Flag cloth mesh — visibility toggled by phase. */
  cloth: THREE.Mesh
  setVisible: (visible: boolean) => void
  dispose: () => void
}

function makeClothMaterial(kind: FlagKind): THREE.MeshStandardMaterial {
  if (kind === 'white') {
    return new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0.05,
    })
  }
  if (kind === 'orange') {
    return new THREE.MeshStandardMaterial({
      color: 0xff7a00,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.05,
    })
  }
  // Blue-and-white: procedural canvas stripes
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const stripes = 6
    const h = canvas.height / stripes
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1e4d8c' : '#f5f5f5'
      ctx.fillRect(0, i * h, canvas.width, h + 1)
    }
  }
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.needsUpdate = true
  return new THREE.MeshStandardMaterial({
    map,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0.05,
  })
}

/**
 * Pole at water Y + flag cloth. Cloth local +Z faces look-at after FaceFlat yaw.
 * Flag hangs to local +X from the pole top.
 */
export function createFlagPole(
  kind: FlagKind,
  poleHeightM: number,
  flagYOffsetM: number,
): FlagMeshHandle {
  const root = new THREE.Group()
  root.name = `flag-${kind}`

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x6a727a,
    roughness: 0.7,
    metalness: 0.2,
  })
  const poleGeo = new THREE.CylinderGeometry(
    POLE_RADIUS_M,
    POLE_RADIUS_M * 1.15,
    poleHeightM,
    10,
  )
  const pole = new THREE.Mesh(poleGeo, poleMat)
  pole.name = 'pole'
  pole.position.set(0, FLAG_WATER_Y + poleHeightM / 2, 0)
  root.add(pole)

  const clothMat = makeClothMaterial(kind)
  const clothGeo = new THREE.PlaneGeometry(FLAG_WIDTH_M, FLAG_HEIGHT_M)
  const cloth = new THREE.Mesh(clothGeo, clothMat)
  cloth.name = 'cloth'
  // Hang from near pole top; plane in XY so FaceFlat LookRotation(+Z) faces peer.
  cloth.position.set(
    FLAG_WIDTH_M / 2 + POLE_RADIUS_M,
    FLAG_WATER_Y + poleHeightM + flagYOffsetM - FLAG_HEIGHT_M / 2,
    0,
  )
  cloth.visible = false
  root.add(cloth)

  return {
    root,
    cloth,
    setVisible(visible: boolean): void {
      cloth.visible = visible
    },
    dispose(): void {
      poleGeo.dispose()
      poleMat.dispose()
      clothGeo.dispose()
      const map = clothMat.map
      clothMat.dispose()
      map?.dispose()
    },
  }
}

/**
 * Unity FaceFlat: yaw-only LookRotation toward peer on the XZ plane.
 * Three.js objects look along −Z by default for cameras, but meshes use +Z
 * as “forward” when we LookRotation(dir) — matches Unity flag facing.
 */
export function faceFlat(
  object: THREE.Object3D,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): void {
  const dx = toX - fromX
  const dz = toZ - fromZ
  if (dx * dx + dz * dz < 1e-8) return
  const yaw = Math.atan2(dx, dz)
  object.rotation.set(0, yaw, 0)
}
