/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Drone / primary live WebSocket URL override. */
  readonly VITE_WS_URL?: string
  /** Boat live WebSocket URL override. */
  readonly VITE_WS_BOAT_URL?: string
  /** Cesium ion token for World Terrain. Never commit a real value. */
  readonly VITE_CESIUM_ION_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
