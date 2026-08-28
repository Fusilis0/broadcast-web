/**
 * One-shot: export procedural boat → public/models/boat.glb
 * Run: node --experimental-strip-types scripts/export-boat-glb.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Blob } from 'node:buffer'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { createProceduralBoatVisual } from '../src/assets/createProceduralBoatVisual.ts'

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
