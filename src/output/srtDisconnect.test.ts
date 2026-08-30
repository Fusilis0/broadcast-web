import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  bumpSrtConnect,
  bumpSrtDisconnect,
  createSrtDisconnectHold,
  srtCheckboxOpenAllowed,
  srtReopenAllowed,
} from './srtDisconnect.ts'

describe('srt disconnect hold', () => {
  it('suppresses stall-fallback reopen after an explicit Disconnect', () => {
    const hold = createSrtDisconnectHold()
    const gen = bumpSrtConnect(hold)
    expect(srtReopenAllowed(hold, gen)).toBe(true)
    expect(srtCheckboxOpenAllowed(hold)).toBe(true)

    bumpSrtDisconnect(hold)
    expect(srtReopenAllowed(hold, gen)).toBe(false)
    expect(srtReopenAllowed(hold, hold.generation)).toBe(false)
    expect(srtCheckboxOpenAllowed(hold)).toBe(false)
  })

  it('Connect after Disconnect allows reopen; old generation stays dead', () => {
    const hold = createSrtDisconnectHold()
    const first = bumpSrtConnect(hold)
    bumpSrtDisconnect(hold)
    const second = bumpSrtConnect(hold)
    expect(srtReopenAllowed(hold, first)).toBe(false)
    expect(srtReopenAllowed(hold, second)).toBe(true)
    expect(srtCheckboxOpenAllowed(hold)).toBe(true)
  })

  it('Vid checkbox and stall-fallback must not open before the first Connect SRT', () => {
    const hold = createSrtDisconnectHold()
    expect(srtCheckboxOpenAllowed(hold)).toBe(false)
    expect(srtReopenAllowed(hold, hold.generation)).toBe(false)
  })

  it('watchdog-style bridge.open is not invoked after Disconnect', () => {
    const hold = createSrtDisconnectHold()
    const gen = bumpSrtConnect(hold)
    let opens = 0
    const tryStallFallback = () => {
      if (!srtReopenAllowed(hold, gen)) return
      opens += 1
    }
    tryStallFallback()
    expect(opens).toBe(1)
    bumpSrtDisconnect(hold)
    tryStallFallback()
    tryStallFallback()
    expect(opens).toBe(1)
  })
})

describe('main.ts wiring (DSP-SRT-20260829-01)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const main = readFileSync(join(here, '../main.ts'), 'utf8')

  it('stall watchdog and H.264 fallback consult srtReopenAllowed', () => {
    const fallback = main.indexOf('function beginFfmpegH264Fallback')
    const stall = main.indexOf('function maybeFallbackSrtDecodeStall')
    expect(fallback).toBeGreaterThan(0)
    expect(stall).toBeGreaterThan(0)
    const fallbackBody = main.slice(fallback, stall)
    expect(fallbackBody).toContain('srtReopenAllowed')
    const stallEnd = main.indexOf('function maybeNoteTranscodeStall')
    const stallBody = main.slice(stall, stallEnd)
    expect(stallBody).toContain('srtReopenAllowed')
  })

  it('Disconnect SRT is wired beside onSrtApply and bumps the hold first', () => {
    expect(main).toContain('onSrtDisconnect:')
    expect(main).toContain('bumpSrtDisconnect(srtHold)')
    expect(main).toContain('bumpSrtConnect(srtHold)')
    const apply = main.indexOf('onSrtApply:')
    const disconnect = main.indexOf('onSrtDisconnect:')
    expect(disconnect).toBeGreaterThan(apply)
  })

  it('beforeunload closes every SRT session before disposing the decoder', () => {
    const unload = main.indexOf("window.addEventListener('beforeunload'")
    expect(unload).toBeGreaterThan(0)
    const tail = main.slice(unload)
    const closeAll = tail.indexOf("close('all')")
    const dispose = tail.indexOf('videoStreamManager?.dispose()')
    expect(closeAll).toBeGreaterThan(0)
    expect(dispose).toBeGreaterThan(closeAll)
  })
})
