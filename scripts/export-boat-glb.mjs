/**
 * One-shot: export procedural boat → public/models/boat.glb
 * Run: node scripts/export-boat-glb.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Blob } from 'node:buffer'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// GLTFExporter binary path expects browser FileReader.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    result = null
    onloadend = null
    onerror = null
    readAsArrayBuffer(blob) {
      Promise.resolve(blob.arrayBuffer())
        .then((buf) => {
          this.result = buf
          this.onloadend?.({ target: this })
        })
        .catch((err) => {
          this.onerror?.(err)
        })
    }
  }
}
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = Blob
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.resolve(__dirname, '../public/models/boat.glb')

function createProceduralBoatVisual() {
  const group = new THREE.Group()
  group.name = 'boatVisual'

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xc45c26,
    roughness: 0.55,
    metalness: 0.05,
  })
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xe8dcc8,
    roughness: 0.7,
    metalness: 0.0,
  })
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0xf2f0ea,
    roughness: 0.45,
    metalness: 0.1,
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x2a3340,
    roughness: 0.4,
    metalness: 0.2,
  })
  const mastMat = new THREE.MeshStandardMaterial({
    color: 0xd9dde3,
    roughness: 0.35,
    metalness: 0.35,
  })

  const mid = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.8, 11), hullMat)
  mid.position.set(0, 0.95, -0.5)
  group.add(mid)

  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(2.7, 5.5, 4, 1, false),
    hullMat,
  )
  bow.rotation.x = -Math.PI / 2
  bow.rotation.z = Math.PI / 4
  bow.position.set(0, 0.95, 7.2)
  group.add(bow)

  const stern = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.9, 2.2), hullMat)
  stern.position.set(0, 0.95, -7.2)
  group.add(stern)

  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 14), deckMat)
  deck.position.set(0, 1.95, -0.3)
  group.add(deck)

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 5.2), cabinMat)
  cabin.position.set(0, 3.15, -2.2)
  group.add(cabin)

  const screen = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.35), accentMat)
  screen.position.set(0, 3.6, 0.55)
  group.add(screen)

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 14, 8),
    mastMat,
  )
  mast.position.set(0, 9.2, -1.5)
  group.add(mast)

  const boom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 7, 6),
    mastMat,
  )
  boom.rotation.x = Math.PI / 2
  boom.position.set(0, 3.4, 2.2)
  group.add(boom)

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.25, 0.2, 15.5), accentMat)
  stripe.position.set(0, 0.35, -0.4)
  group.add(stripe)

  return group
}

const visual = createProceduralBoatVisual()
const exporter = new GLTFExporter()

exporter.parse(
  visual,
  (result) => {
    if (!(result instanceof ArrayBuffer)) {
      console.error('Expected binary glTF ArrayBuffer')
      process.exit(1)
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, Buffer.from(result))
    console.log(`Wrote ${outPath} (${result.byteLength} bytes)`)
  },
  (err) => {
    console.error(err)
    process.exit(1)
  },
  { binary: true },
)
