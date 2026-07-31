/**
 * Studio preload — exposes NDI IPC + main-process frame clock to the SPA.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('broadcastStudio', {
  isStudio: true,
  ndi: {
    start: (opts) => ipcRenderer.invoke('ndi:start', opts ?? {}),
    stop: () => ipcRenderer.invoke('ndi:stop'),
    sendFrame: (frame) => {
      ipcRenderer.send('ndi:frame', frame)
    },
    getStatus: () => ipcRenderer.invoke('ndi:status'),
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
