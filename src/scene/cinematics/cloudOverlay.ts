import * as THREE from 'three'

export type CloudOverlayHandle = {
  setOpacity: (cloud01: number) => void
  getOpacity: () => number
  render: (renderer: THREE.WebGLRenderer) => void
  dispose: () => void
}

/**
 * Full-screen cloud pass. Opacity is shot `cloud01`. Not `scene.fog`.
 */
export function createCloudOverlay(): CloudOverlayHandle {
  const overlayScene = new THREE.Scene()
  overlayScene.name = 'cinematicCloud'
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const geometry = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.MeshBasicMaterial({
    color: 0xe8eef4,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.name = 'cinematicCloudQuad'
  mesh.visible = false
  overlayScene.add(mesh)

  let opacity = 0

  return {
    setOpacity(cloud01: number): void {
      const next =
        Number.isFinite(cloud01) && cloud01 > 0
          ? Math.min(cloud01, 1)
          : 0
      opacity = next
      material.opacity = next
      mesh.visible = next > 0.001
    },
    getOpacity: () => opacity,
    render(renderer: THREE.WebGLRenderer): void {
      if (!mesh.visible) return
      const prevAutoClear = renderer.autoClear
      renderer.autoClear = false
      renderer.render(overlayScene, camera)
      renderer.autoClear = prevAutoClear
    },
    dispose(): void {
      overlayScene.remove(mesh)
      geometry.dispose()
      material.dispose()
    },
  }
}
