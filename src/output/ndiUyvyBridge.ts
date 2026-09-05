/**
 * Renderer helper: pack RGBA on a worker thread (second core).
 * Transfer the source buffer in; do not reuse it.
 */

import type { NdiPackedFormat } from './ndiUyvy.ts'
import { diagMarkMacrotask } from './ndiDeferredSend.ts'

export type NdiUyvyWorkerHandle = {
  pack(
    rgba: ArrayBuffer,
    width: number,
    height: number,
    format: NdiPackedFormat,
  ): Promise<ArrayBuffer>
  dispose(): void
}

export function createNdiUyvyWorker(): NdiUyvyWorkerHandle | null {
  if (typeof Worker === 'undefined') return null
  try {
    const worker = new Worker(new URL('./ndiUyvy.worker.ts', import.meta.url), {
      type: 'module',
      name: 'ndi-uyvy-pack',
    })
    let nextId = 1
    const pending = new Map<
      number,
      { resolve: (data: ArrayBuffer) => void; reject: (err: Error) => void }
    >()
    worker.onmessage = (event: MessageEvent<{ id: number; data?: ArrayBuffer; error?: string }>) => {
      diagMarkMacrotask('uyvyWorker')
      const msg = event.data
      const entry = pending.get(msg.id)
      if (!entry) return
      pending.delete(msg.id)
      if (msg.error || !msg.data) {
        entry.reject(new Error(msg.error || 'UYVY worker returned no data'))
        return
      }
      entry.resolve(msg.data)
    }
    worker.onerror = () => {
      for (const entry of pending.values()) {
        entry.reject(new Error('UYVY worker failed'))
      }
      pending.clear()
    }
    return {
      pack(rgba, width, height, format) {
        const id = nextId++
        return new Promise<ArrayBuffer>((resolve, reject) => {
          pending.set(id, { resolve, reject })
          try {
            worker.postMessage({ id, rgba, width, height, format }, [rgba])
          } catch (err) {
            pending.delete(id)
            reject(err instanceof Error ? err : new Error(String(err)))
          }
        })
      },
      dispose() {
        for (const entry of pending.values()) {
          entry.reject(new Error('UYVY worker disposed'))
        }
        pending.clear()
        worker.terminate()
      },
    }
  } catch {
    return null
  }
}
