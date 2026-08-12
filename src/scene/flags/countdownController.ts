import * as THREE from 'three'
import {
  flagPhasesFromRemaining,
  type FlagPhaseThresholds,
} from './countdownPhase.ts'
import { createCountdownTimerSprite } from './countdownTimerSprite.ts'
import { createFlagPole, faceFlat, FLAG_WATER_Y } from './flagMeshes.ts'
import type { CountdownFlagsLayout } from './types.ts'

export type CountdownFlagsHandle = {
  root: THREE.Group
  start: () => void
  pause: () => void
  /** Reset remaining time + red plate; does not auto-start. */
  reset: () => void
  /** Reset then start. */
  restart: () => void
  /**
   * Tick clock only (demoTimeScale applied inside). Call once per RAF.
   * Billboard scale is separate — see `orientBillboards`.
   */
  tickClock: (dtSec: number) => void
  /**
   * Distance-scale the MM:SS sprite for the camera about to render
   * (preview vs air/NDI dual-render).
   */
  orientBillboards: (
    camera: THREE.Camera,
    viewportHeightPx: number,
  ) => void
  /**
   * Tick clock + billboard. Call each RAF with wall-clock `dtSec`
   * (demoTimeScale applied inside). Prefer `tickClock` + `orientBillboards`
   * when dual-rendering preview ≠ air.
   */
  update: (
    dtSec: number,
    camera: THREE.Camera,
    viewportHeightPx: number,
  ) => void
  getRemainingSeconds: () => number
  isRunning: () => boolean
  isFinished: () => boolean
  dispose: () => void
}

/**
 * Runtime countdown: poles at P1/P2, phase-driven flag visibility, MM:SS above P1.
 */
export function createCountdownFlagsController(
  layout: CountdownFlagsLayout,
): CountdownFlagsHandle {
  const { data, p1x, p1z, p2x, p2z } = layout
  const thresholds: FlagPhaseThresholds = {
    whiteRaiseMinutes: data.whiteRaiseMinutes,
    orangeRaiseMinutes: data.orangeRaiseMinutes,
    blueWhiteRaiseMinutes: data.blueWhiteRaiseMinutes,
    blueWhiteLowerMinutes: data.blueWhiteLowerMinutes,
  }

  const root = new THREE.Group()
  root.name = 'countdownFlags'

  const p1 = createFlagPole('white', data.poleHeightM, data.point1FlagVerticalOffset)
  p1.root.position.set(p1x, FLAG_WATER_Y, p1z)
  faceFlat(p1.root, p1x, p1z, p2x, p2z)
  root.add(p1.root)

  const p2Orange = createFlagPole(
    'orange',
    data.poleHeightM,
    data.point2FlagVerticalOffset,
  )
  p2Orange.root.position.set(p2x, FLAG_WATER_Y, p2z)
  faceFlat(p2Orange.root, p2x, p2z, p1x, p1z)
  root.add(p2Orange.root)

  // Blue-white shares P2 pole footprint but sits higher (extra offset on cloth).
  const p2Blue = createFlagPole(
    'blueWhite',
    data.poleHeightM,
    data.point2FlagVerticalOffset + data.blueWhiteExtraOffsetM,
  )
  p2Blue.root.position.set(p2x, FLAG_WATER_Y, p2z)
  faceFlat(p2Blue.root, p2x, p2z, p1x, p1z)
  // Hide duplicate pole mesh — orange pole is enough visually.
  const bluePole = p2Blue.root.getObjectByName('pole')
  if (bluePole) bluePole.visible = false
  root.add(p2Blue.root)

  const timer = createCountdownTimerSprite(data.canvasVerticalOffset)
  timer.root.position.set(p1x, data.canvasVerticalOffset, p1z)
  root.add(timer.root)

  let remainingSeconds = data.startMinutes * 60
  let running = false
  let finished = false

  function applyPhases(): void {
    if (finished) return
    const phases = flagPhasesFromRemaining(remainingSeconds, thresholds)
    p1.setVisible(phases.white)
    p2Orange.setVisible(phases.orange)
    p2Blue.setVisible(phases.blueWhite)
  }

  function syncDisplay(): void {
    timer.setRemaining(remainingSeconds, finished)
  }

  function tickClock(dtSec: number): void {
    if (running && !finished) {
      remainingSeconds -= dtSec * data.demoTimeScale
      if (remainingSeconds <= 0) {
        remainingSeconds = 0
        finished = true
        // Freeze last visibility (Unity: stop UpdateFlagStates after 0).
        const phases = flagPhasesFromRemaining(0, thresholds)
        p1.setVisible(phases.white)
        p2Orange.setVisible(phases.orange)
        p2Blue.setVisible(phases.blueWhite)
      } else {
        applyPhases()
      }
      syncDisplay()
    }
  }

  function orientBillboards(
    camera: THREE.Camera,
    viewportHeightPx: number,
  ): void {
    timer.update(camera, viewportHeightPx)
  }

  // Initial: all flags hidden until first UpdateFlagStates (Unity Instantiates hidden).
  applyPhases()
  syncDisplay()

  return {
    root,
    start(): void {
      running = true
    },
    pause(): void {
      running = false
    },
    reset(): void {
      remainingSeconds = data.startMinutes * 60
      finished = false
      running = false
      applyPhases()
      syncDisplay()
    },
    restart(): void {
      remainingSeconds = data.startMinutes * 60
      finished = false
      applyPhases()
      syncDisplay()
      running = true
    },
    tickClock,
    orientBillboards,
    update(dtSec, camera, viewportHeightPx): void {
      tickClock(dtSec)
      orientBillboards(camera, viewportHeightPx)
    },
    getRemainingSeconds: () => remainingSeconds,
    isRunning: () => running,
    isFinished: () => finished,
    dispose(): void {
      p1.dispose()
      p2Orange.dispose()
      p2Blue.dispose()
      timer.dispose()
      root.clear()
    },
  }
}
