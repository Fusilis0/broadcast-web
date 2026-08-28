import * as THREE from 'three'
import {
  CATEGORY_TINT_USERDATA_KEY,
  SAIL_TINT_USERDATA_KEY,
} from './tintBoatVisual.ts'

/** Waterline length (metres). Mast is 1.2× this. */
export const PROCEDURAL_HULL_LENGTH_M = 16
export const PROCEDURAL_HULL_BEAM_M = 4.5
export const PROCEDURAL_DECK_Y_M = 1.5
export const PROCEDURAL_MAST_HEIGHT_M = PROCEDURAL_HULL_LENGTH_M * 1.2
/** Mast step slightly forward of midships (local +Z = bow). */
export const PROCEDURAL_MAST_Z_M = 0.8
export const PROCEDURAL_MAST_TOP_Y_M =
  PROCEDURAL_DECK_Y_M + PROCEDURAL_MAST_HEIGHT_M

function markTint(mat: THREE.Material, key: string): void {
  mat.userData[key] = true
}

function hullPlanform(scale = 1): THREE.Shape {
  const halfBeam = (PROCEDURAL_HULL_BEAM_M / 2) * scale
  const transom = 0.72 * halfBeam
  const halfLen = (PROCEDURAL_HULL_LENGTH_M / 2) * scale
  const shape = new THREE.Shape()
  // XY planform: +Y → bow (rotated to +Z). Transom is a flat stern.
  shape.moveTo(-transom, -halfLen)
  shape.lineTo(transom, -halfLen)
  shape.bezierCurveTo(
    halfBeam * 1.05,
    -halfLen * 0.22,
    halfBeam * 0.92,
    halfLen * 0.38,
    0,
    halfLen,
  )
  shape.bezierCurveTo(
    -halfBeam * 0.92,
    halfLen * 0.38,
    -halfBeam * 1.05,
    -halfLen * 0.22,
    -transom,
    -halfLen,
  )
  return shape
}

function planformToUpright(geo: THREE.BufferGeometry, liftY: number): void {
  // Shape in XY, extrude +Z → rotate so length is +Z and up is +Y.
  geo.rotateX(Math.PI / 2)
  geo.translate(0, liftY, 0)
}

/**
 * Triangular sail with mid-chord camber (double-sided later via material).
 * `head` / `tack` / `clew` in local metres.
 */
export function createCurvedSailGeometry(
  head: THREE.Vector3,
  tack: THREE.Vector3,
  clew: THREE.Vector3,
  camberM: number,
  rows = 6,
  cols = 5,
): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const tmp = new THREE.Vector3()
  const luff = new THREE.Vector3()
  const leech = new THREE.Vector3()

  for (let i = 0; i <= rows; i++) {
    const t = i / rows
    luff.lerpVectors(head, tack, t)
    leech.lerpVectors(head, clew, t)
    for (let j = 0; j <= cols; j++) {
      const s = j / cols
      tmp.lerpVectors(luff, leech, s)
      const camber =
        camberM * Math.sin(s * Math.PI) * Math.sin(Math.max(t, 0.04) * Math.PI)
      tmp.x += camber
      positions.push(tmp.x, tmp.y, tmp.z)
    }
  }

  const stride = cols + 1
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * stride + j
      const b = a + 1
      const c = a + stride
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/**
 * Race-readable sailboat used as glTF fallback (and export source).
 * Local frame: bow / forward = +Z, up = +Y, starboard = +X. Length ~16 m.
 *
 * Named nodes: `hull`, `sail` (mainsail), `jib`, `mastTop`.
 * Hull + both sails share tint hooks (`categoryTint` / `sailTint`).
 */
export function createProceduralBoatVisual(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'boatVisualProcedural'

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xc45c26,
    roughness: 0.55,
    metalness: 0.05,
    emissive: 0xc45c26,
    emissiveIntensity: 0.25,
  })
  hullMat.name = 'hull'
  markTint(hullMat, CATEGORY_TINT_USERDATA_KEY)

  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xe8dcc8,
    roughness: 0.7,
    metalness: 0.0,
    emissive: 0x4a4538,
    emissiveIntensity: 0.15,
  })
  const coachMat = new THREE.MeshStandardMaterial({
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
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xf4f1ea,
    roughness: 0.85,
    metalness: 0.0,
    emissive: 0xf4f1ea,
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
  })
  sailMat.name = 'sail'
  markTint(sailMat, SAIL_TINT_USERDATA_KEY)

  const hullDepth = 1.35
  const hullGeo = new THREE.ExtrudeGeometry(hullPlanform(1), {
    depth: hullDepth,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.2,
    bevelSegments: 1,
    curveSegments: 8,
  })
  planformToUpright(hullGeo, hullDepth)
  const hull = new THREE.Mesh(hullGeo, hullMat)
  hull.name = 'hull'
  group.add(hull)

  const deckGeo = new THREE.ExtrudeGeometry(hullPlanform(0.9), {
    depth: 0.12,
    bevelEnabled: false,
    curveSegments: 6,
  })
  planformToUpright(deckGeo, PROCEDURAL_DECK_Y_M)
  const deck = new THREE.Mesh(deckGeo, deckMat)
  deck.name = 'deck'
  group.add(deck)

  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.75, 3.4), accentMat)
  keel.position.set(0, -0.55, -0.6)
  keel.name = 'keel'
  group.add(keel)

  const coach = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.78, 3.6), coachMat)
  coach.position.set(0, PROCEDURAL_DECK_Y_M + 0.42, -2.15)
  coach.name = 'coachroof'
  group.add(coach)

  const mastH = PROCEDURAL_MAST_HEIGHT_M
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.12, mastH, 8),
    mastMat,
  )
  mast.position.set(0, PROCEDURAL_DECK_Y_M + mastH / 2, PROCEDURAL_MAST_Z_M)
  mast.name = 'mast'
  group.add(mast)

  const mastTop = new THREE.Object3D()
  mastTop.name = 'mastTop'
  mastTop.position.set(0, PROCEDURAL_MAST_TOP_Y_M, PROCEDURAL_MAST_Z_M)
  group.add(mastTop)

  const boomLen = 6.8
  const boomY = PROCEDURAL_DECK_Y_M + 0.52
  const boom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, boomLen, 6),
    mastMat,
  )
  boom.rotation.x = Math.PI / 2
  boom.position.set(0, boomY, PROCEDURAL_MAST_Z_M - boomLen / 2)
  boom.name = 'boom'
  group.add(boom)

  const head = new THREE.Vector3(
    0,
    PROCEDURAL_MAST_TOP_Y_M - 0.15,
    PROCEDURAL_MAST_Z_M,
  )
  const mainTack = new THREE.Vector3(0, boomY + 0.04, PROCEDURAL_MAST_Z_M - 0.12)
  const mainClew = new THREE.Vector3(
    0.08,
    boomY + 0.04,
    PROCEDURAL_MAST_Z_M - boomLen + 0.25,
  )
  const mainsail = new THREE.Mesh(
    createCurvedSailGeometry(head, mainTack, mainClew, 0.55),
    sailMat,
  )
  mainsail.name = 'sail'
  group.add(mainsail)

  const jibHead = new THREE.Vector3(
    0,
    PROCEDURAL_MAST_TOP_Y_M - 1.1,
    PROCEDURAL_MAST_Z_M,
  )
  const jibTack = new THREE.Vector3(0, PROCEDURAL_DECK_Y_M + 0.08, 7.7)
  const jibClew = new THREE.Vector3(0.12, boomY + 0.35, PROCEDURAL_MAST_Z_M + 1.6)
  const jib = new THREE.Mesh(
    createCurvedSailGeometry(jibHead, jibTack, jibClew, 0.38, 5, 4),
    sailMat,
  )
  jib.name = 'jib'
  group.add(jib)

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(PROCEDURAL_HULL_BEAM_M * 0.98, 0.12, 14.2),
    accentMat,
  )
  stripe.position.set(0, 0.28, -0.35)
  stripe.name = 'waterline'
  group.add(stripe)

  return group
}
