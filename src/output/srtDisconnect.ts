/**
 * Explicit SRT Disconnect hold — same idea as telemetry's generation tag
 * + `intentionalStop`. Late ffmpeg / watchdog callbacks must not reopen
 * a caller the operator just killed. Do not await ffmpeg teardown.
 */

export type SrtDisconnectHold = {
  /** Bumped on Connect and Disconnect so in-flight opens die. */
  generation: number
  /** True after Disconnect until the next Connect SRT. */
  explicitlyDisconnected: boolean
  /**
   * True after Connect SRT until Disconnect SRT.
   * Vid checkbox opens a POV only while this is set (TEL: while running).
   */
  operatorConnected: boolean
}

export function createSrtDisconnectHold(): SrtDisconnectHold {
  return {
    generation: 0,
    explicitlyDisconnected: false,
    operatorConnected: false,
  }
}

export function bumpSrtConnect(hold: SrtDisconnectHold): number {
  hold.generation += 1
  hold.explicitlyDisconnected = false
  hold.operatorConnected = true
  return hold.generation
}

export function bumpSrtDisconnect(hold: SrtDisconnectHold): number {
  hold.generation += 1
  hold.explicitlyDisconnected = true
  hold.operatorConnected = false
  return hold.generation
}

/**
 * Decode-stall watchdog and HEVC→H.264 fallback may call `bridge.open`
 * only while this is true. Capture `generation` at the call site so a
 * Disconnect that lands during `open()` is ignored in `.then`.
 */
export function srtReopenAllowed(
  hold: SrtDisconnectHold,
  capturedGeneration: number,
): boolean {
  if (hold.explicitlyDisconnected) return false
  if (!hold.operatorConnected) return false
  if (hold.generation !== capturedGeneration) return false
  return true
}

/** Unchecking/checking Vid opens a new caller only while Connect is in force. */
export function srtCheckboxOpenAllowed(hold: SrtDisconnectHold): boolean {
  return hold.operatorConnected && !hold.explicitlyDisconnected
}
