/**
 * Studio preload — exposes NDI IPC, SRT ingest, races/config, and the
 * main-process frame clock to the SPA.
 *
 * NDI API is multi-channel (`ar` | `3d` | `2d`). Omitting `channel` defaults
 * to `'ar'` (today's air plate) for back-compat.
 */
const { contextBridge, ipcRenderer } = require('electron')

const ndiFrameChannel = new MessageChannel()
ipcRenderer.postMessage('ndi:frame-port', null, [ndiFrameChannel.port1])
contextBridge.exposeInMainWorld(
  'broadcastStudioNdiFramePort',
  ndiFrameChannel.port2,
)

contextBridge.exposeInMainWorld('broadcastStudio', {
  isStudio: true,
  ndi: {
    /**
     * @param {{ channel?: string, name?: string }} [opts]
     */
    start: (opts) => ipcRenderer.invoke('ndi:start', opts ?? {}),
    /**
     * @param {string | { channel?: string } | undefined} [channelOrOpts]
     *   omit → stop `'ar'`; `'all'` / `{ channel: 'all' }` → stop every sender
     */
    stop: (channelOrOpts) => ipcRenderer.invoke('ndi:stop', channelOrOpts),
    /**
     * @param {{
     *   channel?: string,
     *   width: number,
     *   height: number,
     *   data: ArrayBuffer,
     *   bottomUp?: boolean,
     * }} frame
     */
    sendFrame: (frame) => {
      ipcRenderer.send('ndi:frame', frame)
    },
    /**
     * @param {string} [channel] omit → `'ar'`; `'all'` → status map
     */
    getStatus: (channel) => ipcRenderer.invoke('ndi:status', channel),
    getStatusAll: () => ipcRenderer.invoke('ndi:statusAll'),
    getPerfSummary: () => ipcRenderer.invoke('ndi:perfSummary'),
    /**
     * Low-rate (1 Hz) main-process stage timing + busy-drop counts.
     * @param {(summary: object) => void} cb
     * @returns {() => void} unsubscribe
     */
    onPerfSummary: (cb) => {
      const handler = (_evt, summary) => {
        try {
          cb(summary)
        } catch {
          /* ignore */
        }
      }
      ipcRenderer.on('ndi:perf', handler)
      return () => {
        ipcRenderer.removeListener('ndi:perf', handler)
      }
    },
  },
  /**
   * Local RaceProject folder (Phase 13.8).
   * Dev/Vite → repo `public/races/`; `--file` → `userData/races/`.
   */
  races: {
    save: (project) => ipcRenderer.invoke('races:save', project),
    list: () => ipcRenderer.invoke('races:list'),
    read: (id) => ipcRenderer.invoke('races:read', id),
    getRoot: () => ipcRenderer.invoke('races:root'),
  },
  /**
   * Studio config writes. Dev/Vite → repo `public/config.json` (git-share).
   * `--file` → `userData/config.json`.
   */
  config: {
    setCesiumIonToken: (token) =>
      ipcRenderer.invoke('config:setCesiumIonToken', token),
  },
  /**
   * Packaged `--file` ion tile cache (userData). Vite `desktop:dev` uses
   * GET/POST `/cinematic-tiles/<sha256>` instead.
   */
  cinematicTiles: {
    packaged: () => ipcRenderer.invoke('cinematicTiles:packaged'),
    has: (name) => ipcRenderer.invoke('cinematicTiles:has', name),
    read: (name) => ipcRenderer.invoke('cinematicTiles:read', name),
    write: (payload) => ipcRenderer.invoke('cinematicTiles:write', payload),
  },
  /**
   * Silent cinematic MP4 (Phase 21). Renderer captures; main saves.
   * Absent in Chrome — Record status is "desktop only".
   */
  cinematicRecord: {
    choosePath: (opts) =>
      ipcRenderer.invoke('cinematicRecord:choosePath', opts ?? {}),
    write: (payload) => ipcRenderer.invoke('cinematicRecord:write', payload),
  },
  /**
   * SRT ingest (Phase 17.1). Main is a dumb MPEG-TS byte pipe — no demux.
   * Absent in Chrome; callers use getSrtBridge() and no-op when null.
   */
  srt: {
    /**
     * @param {{ povId: string, url: string, streamId?: string, latencyMs?: number, passphrase?: string, transcodeToH264?: boolean }} opts
     */
    open: (opts) => ipcRenderer.invoke('srt:open', opts),
    /**
     * @param {string | { povId?: string } | undefined} povIdOrOpts
     *   `{ povId }` → that session; `'all'` / `{ povId: 'all' }` → every session
     */
    close: (povIdOrOpts) => ipcRenderer.invoke('srt:close', povIdOrOpts),
    getStatus: () => ipcRenderer.invoke('srt:status'),
    /**
     * @param {(payload: { povId: string, chunk: Uint8Array }) => void} cb
     * @returns {() => void} unsubscribe
     */
    onSrtData: (cb) => {
      const handler = (_evt, payload) => {
        try {
          cb(payload)
        } catch {
          /* ignore renderer data errors */
        }
      }
      ipcRenderer.on('srt:data', handler)
      return () => {
        ipcRenderer.removeListener('srt:data', handler)
      }
    },
    /**
     * @param {(status: { povId: string, state: string, bitrateKbps: number, lastError: string | null }) => void} cb
     * @returns {() => void} unsubscribe
     */
    onSrtStatus: (cb) => {
      const handler = (_evt, payload) => {
        try {
          cb(payload)
        } catch {
          /* ignore renderer status errors */
        }
      }
      ipcRenderer.on('srt:status', handler)
      return () => {
        ipcRenderer.removeListener('srt:status', handler)
      }
    },
  },
  /** Main-process clock — NDI + minimize-safe (~30 fps). Preview uses rAF when visible. */
  debugLog: (payload) => {
    ipcRenderer.send('debug:ndjson', payload)
  },
  onStudioTick: (cb) => {
    const handler = () => {
      try {
        cb()
      } catch {
        /* ignore renderer tick errors */
      }
    }
    ipcRenderer.on('studio:tick', handler)
    return () => {
      ipcRenderer.removeListener('studio:tick', handler)
    }
  },
})
