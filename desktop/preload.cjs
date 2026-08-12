/**
 * Studio preload — exposes NDI IPC + main-process frame clock to the SPA.
 *
 * NDI API is multi-channel (`ar` | `3d` | `2d`). Omitting `channel` defaults
 * to `'ar'` (today's air plate) for back-compat.
 */
const { contextBridge, ipcRenderer } = require('electron')

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
  /** Main-process clock — stays at ~30 fps when the window is minimized. */
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
