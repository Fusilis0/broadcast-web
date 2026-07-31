/**
 * Studio preload — exposes NDI IPC to the SPA (contextIsolation).
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
})
