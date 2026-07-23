/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Drone / primary live WebSocket URL override. */
  readonly VITE_WS_URL?: string
  /** Boat live WebSocket URL override. */
  readonly VITE_WS_BOAT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
