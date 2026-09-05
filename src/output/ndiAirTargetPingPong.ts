/**
 * Two AR air FBOs so PBO `begin()` packs last tick’s plate, not the one
 * just rendered (avoids GPU sync in `arReadbackBegin`).
 *
 * Adds **one studio tick** of render-to-send on top of existing PBO
 * pack-to-poll latency (`NDI_ASYNC_READBACK_LATENCY_FRAMES`). AR
 * `packPbo` skips `gl.flush()`; 3D is not wired through this helper.
 */

export const NDI_AR_AIR_TARGET_COUNT = 2

export type NdiAirTargetPair<T> = {
  /** Bind and render this tick. */
  render: T
  /** Previous tick’s plate for `readback.begin`, or null before the first advance. */
  pack: T | null
}

export type NdiAirTargetPingPong<T> = {
  acquire: (width: number, height: number) => NdiAirTargetPair<T>
  /** Call after a successful FBO render so the next acquire packs this plate. */
  advance: () => void
  dispose: () => void
}

export function createNdiAirTargetPingPong<T>(options: {
  create: (width: number, height: number) => T
  dispose: (target: T) => void
}): NdiAirTargetPingPong<T> {
  const slots: T[] = []
  let width = 0
  let height = 0
  let write = 0
  let havePrev = false

  function clearSlots(): void {
    for (const slot of slots) options.dispose(slot)
    slots.length = 0
  }

  function alloc(w: number, h: number): void {
    clearSlots()
    for (let i = 0; i < NDI_AR_AIR_TARGET_COUNT; i++) {
      slots.push(options.create(w, h))
    }
    width = w
    height = h
    write = 0
    havePrev = false
  }

  return {
    acquire(w: number, h: number): NdiAirTargetPair<T> {
      const nw = Math.floor(w)
      const nh = Math.floor(h)
      if (
        slots.length !== NDI_AR_AIR_TARGET_COUNT ||
        nw !== width ||
        nh !== height
      ) {
        alloc(nw, nh)
      }
      return {
        render: slots[write]!,
        pack: havePrev ? slots[1 - write]! : null,
      }
    },
    advance(): void {
      if (slots.length !== NDI_AR_AIR_TARGET_COUNT) return
      write = 1 - write
      havePrev = true
    },
    dispose(): void {
      clearSlots()
      width = 0
      height = 0
      write = 0
      havePrev = false
    },
  }
}
