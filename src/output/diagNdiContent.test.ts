import { describe, expect, it } from 'vitest'
import {
  configureDiagNdiFrameId,
  diag2dGrabOverlapMs,
  diagNote2dGrabSeq,
  diagNote2dGrabWallWindow,
  diagNoteArCaptureBegin,
  diagNoteArSend,
  diagNotePresentTick,
  diagTakeArCaptureStamp,
  DUP_DUMP_RUN_LEN,
  peekDiagDuplicateRuns,
  resetDiagNdiContent,
  takeDiagNdiContentWindow,
} from './diagNdiContent.ts'

describe('diagNdiContent', () => {
  it('counts unique PTS sent vs consecutive repeats of the same PTS', () => {
    resetDiagNdiContent()
    diagNotePresentTick({ pts90k: 1000, reason: 'min-clamp', povId: '1' })
    diagNoteArCaptureBegin()
    diagNoteArSend(diagTakeArCaptureStamp())
    diagNotePresentTick({ pts90k: 1000, reason: 'repeat', povId: '1' })
    diagNoteArCaptureBegin()
    diagNoteArSend(diagTakeArCaptureStamp())
    diagNotePresentTick({ pts90k: 4000, reason: 'min-clamp', povId: '1' })
    diagNoteArCaptureBegin()
    diagNoteArSend(diagTakeArCaptureStamp())
    const snap = takeDiagNdiContentWindow()
    expect(snap.sendN).toBe(3)
    expect(snap.sendNewPts).toBe(2)
    expect(snap.sendSamePts).toBe(1)
    expect(snap.distinctPts).toBe(2)
    expect(snap.sentPts).toEqual([1000, 1000, 4000])
    expect(snap.captureMinClamp).toBe(2)
    expect(snap.captureRepeat).toBe(1)
  })

  it('pairs capture begin stamps FIFO with later drains', () => {
    resetDiagNdiContent()
    diagNotePresentTick({ pts90k: 1, reason: 'min-clamp', povId: '1' })
    diagNoteArCaptureBegin()
    diagNotePresentTick({ pts90k: 2, reason: 'min-clamp', povId: '1' })
    diagNoteArCaptureBegin()
    expect(diagTakeArCaptureStamp().pts90k).toBe(1)
    expect(diagTakeArCaptureStamp().pts90k).toBe(2)
  })

  it('assigns monotonic frameSeq on unique present binds', () => {
    resetDiagNdiContent()
    diagNotePresentTick(
      { pts90k: 100, reason: 'min-clamp', povId: '1', wallMs: 1 },
      { unique: true },
    )
    const a = diagNoteArCaptureBegin()
    diagNotePresentTick(
      { pts90k: 100, reason: 'repeat', povId: '1', wallMs: 2 },
      { unique: false },
    )
    const b = diagNoteArCaptureBegin()
    diagNotePresentTick(
      { pts90k: 200, reason: 'min-clamp', povId: '1', wallMs: 3 },
      { unique: true },
    )
    const c = diagNoteArCaptureBegin()
    expect(a.frameSeq).toBe(1)
    expect(b.frameSeq).toBe(1)
    expect(c.frameSeq).toBe(2)
    const snap = takeDiagNdiContentWindow()
    expect(snap.uniquePresentN).toBe(2)
  })

  it('emits duplicate-run events with 2dGrab overlap', () => {
    resetDiagNdiContent()
    const dumps: unknown[] = []
    configureDiagNdiFrameId({
      search: '?ndiFrameDump=1',
      onDump: (ev) => dumps.push(ev),
    })

    diagNote2dGrabWallWindow(true, 1000)
    diagNotePresentTick(
      { pts90k: 5000, reason: 'min-clamp', povId: '1', wallMs: 1010 },
      { unique: true },
    )
    diagNoteArCaptureBegin(1100)
    diagNoteArCaptureBegin(1200)
    diagNoteArCaptureBegin(1300)
    diagNote2dGrabWallWindow(false, 5000)

    diagNotePresentTick(
      { pts90k: 8000, reason: 'min-clamp', povId: '1', wallMs: 6000 },
      { unique: true },
    )
    diagNoteArCaptureBegin(6100) // closes prior run of 3

    const runs = peekDiagDuplicateRuns().filter((r) => r.kind === 'capture')
    expect(runs.length).toBeGreaterThanOrEqual(1)
    const last = runs[runs.length - 1]!
    expect(last.runLen).toBe(3)
    expect(last.pts90k).toBe(5000)
    expect(last.spanMs).toBe(200)
    expect(last.overlap2dGrab).toBe(true)
    expect(last.overlap2dGrabMs).toBe(200)
    expect(dumps.length).toBeGreaterThanOrEqual(1)
    expect(last.runLen).toBeGreaterThanOrEqual(DUP_DUMP_RUN_LEN)

    const snap = takeDiagNdiContentWindow()
    expect(snap.captureDupRunN).toBeGreaterThanOrEqual(1)
    expect(snap.captureDupRunOverlap2dN).toBeGreaterThanOrEqual(1)
    expect(snap.captureDupRunMaxLen).toBe(3)
  })

  it('computes 2dGrab interval overlap', () => {
    resetDiagNdiContent()
    diagNote2dGrabWallWindow(true, 10)
    diagNote2dGrabWallWindow(false, 30)
    expect(diag2dGrabOverlapMs(0, 100)).toBe(20)
    expect(diag2dGrabOverlapMs(20, 25)).toBe(5)
    expect(diag2dGrabOverlapMs(40, 50)).toBe(0)
  })

  it('tracks 2d grab seq start/end counts', () => {
    resetDiagNdiContent()
    diagNote2dGrabSeq('start', 1)
    diagNote2dGrabSeq('end', 2)
    diagNote2dGrabSeq('start', 3)
    diagNote2dGrabSeq('end', 4)
    const snap = takeDiagNdiContentWindow()
    expect(snap.grab2dStartN).toBe(2)
    expect(snap.grab2dEndN).toBe(2)
  })
})
