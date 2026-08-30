/**
 * Off-main-thread RGBA → UYVY / UYVA pack so the GL / IPC thread
 * is not the only core doing 4:2:2.
 */

import {
  packedFrameBytes,
  rgbaToUyva,
  rgbaToUyvy,
  type NdiPackedFormat,
} from './ndiUyvy.ts'

type Request = {
  id: number
  rgba: ArrayBuffer
  width: number
  height: number
  format: NdiPackedFormat
}

type Ok = { id: number; data: ArrayBuffer }
type Err = { id: number; error: string }

type WorkerScope = {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<Request>) => void,
  ) => void
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

const scope = globalThis as unknown as WorkerScope

scope.addEventListener('message', (event: MessageEvent<Request>) => {
  const msg = event.data
  if (!msg || typeof msg.id !== 'number') return
  try {
    const bytes = packedFrameBytes(msg.format, msg.width, msg.height)
    const dest = new Uint8Array(bytes)
    const src = new Uint8Array(msg.rgba)
    const wrote =
      msg.format === 'uyva'
        ? rgbaToUyva(src, msg.width, msg.height, dest)
        : rgbaToUyvy(src, msg.width, msg.height, dest)
    if (wrote !== bytes) {
      const err: Err = { id: msg.id, error: 'UYVY pack failed' }
      scope.postMessage(err)
      return
    }
    const ok: Ok = { id: msg.id, data: dest.buffer }
    scope.postMessage(ok, [dest.buffer])
  } catch (err) {
    const fail: Err = {
      id: msg.id,
      error: err instanceof Error ? err.message : String(err),
    }
    scope.postMessage(fail)
  }
})
