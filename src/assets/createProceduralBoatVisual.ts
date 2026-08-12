import * as THREE from 'three'
import { CATEGORY_TINT_USERDATA_KEY } from './tintBoatVisual.ts'

/**
 * Race-readable multi-mesh hull used as glTF fallback (and export source).
 * Local frame: bow / forward = +Z, up = +Y, starboard = +X. Length ~18 m.
 */
export function createProceduralBoatVisual(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'boatVisualProcedural'

  // Mild emissive so the hull stays readable if lights are weak / glTF PBR is dark.
  // Marked for catalogue category tint (deck/cabin stay neutral).
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xc45c26,
    roughness: 0.55,
    metalness: 0.05,
    emissive: 0xc45c26,
    emissiveIntensity: 0.25,
  })
  hullMat.userData[CATEGORY_TINT_USERDATA_KEY] = true
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xe8dcc8,
    roughness: 0.7,
    metalness: 0.0,
    emissive: 0x4a4538,
    emissiveIntensity: 0.15,
  })
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0xf2f0ea,
    roughness: 0.45,
    metalness: 0.1,
    emissive: 0x3a3830,
    emissiveIntensity: 0.2,
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x2a3340,
    roughness: 0.4,
    metalness: 0.2,
    emissive: 0x1a2030,
    emissiveIntensity: 0.15,
  })
  const mastMat = new THREE.MeshStandardMaterial({
    color: 0xd9dde3,
    roughness: 0.35,
    metalness: 0.35,
    emissive: 0x303840,
    emissiveIntensity: 0.2,
  })

  // Mid hull — elongated prism
  const mid = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.8, 11), hullMat)
  mid.position.set(0, 0.95, -0.5)
  mid.name = 'hullMid'
  group.add(mid)

  // Bow wedge (pointed) — cone tip toward +Z
  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(2.7, 5.5, 4, 1, false),
    hullMat,
  )
  bow.rotation.x = -Math.PI / 2
  bow.rotation.z = Math.PI / 4 // square cone → diamond reads as bow
  bow.position.set(0, 0.95, 7.2)
  bow.name = 'hullBow'
  group.add(bow)

  // Stern transom (slightly wider, flat)
  const stern = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.9, 2.2), hullMat)
  stern.position.set(0, 0.95, -7.2)
  stern.name = 'hullStern'
  group.add(stern)

  // Deck cap
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 14), deckMat)
  deck.position.set(0, 1.95, -0.3)
  deck.name = 'deck'
  group.add(deck)

  // Cabin / coachroof — aft of midships so yaw reads clearly
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 5.2), cabinMat)
  cabin.position.set(0, 3.15, -2.2)
  cabin.name = 'cabin'
  group.add(cabin)

  // Windscreen dark band
  const screen = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.35), accentMat)
  screen.position.set(0, 3.6, 0.55)
  screen.name = 'windscreen'
  group.add(screen)

  // Mast (race silhouette from drone altitude)
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 14, 8),
    mastMat,
  )
  mast.position.set(0, 9.2, -1.5)
  mast.name = 'mast'
  group.add(mast)

  // Boom along +Z (forward of mast step)
  const boom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 7, 6),
    mastMat,
  )
  boom.rotation.x = Math.PI / 2
  boom.position.set(0, 3.4, 2.2)
  boom.name = 'boom'
  group.add(boom)

  // Soft waterline stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.25, 0.2, 15.5), accentMat)
  stripe.position.set(0, 0.35, -0.4)
  stripe.name = 'waterline'
  group.add(stripe)

  return group
}
