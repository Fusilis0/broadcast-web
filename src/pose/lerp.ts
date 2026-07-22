/**
 * Unity `WorldAnchorManager.SetNewTarget` / `Update` midpoint lerp (pure math).
 * Position: linear lerp. Rotation: slerp via THREE.Quaternion.
 */

import { Euler, Quaternion } from 'three'
import type { EnuPosition, PoseRotation } from './types.ts'

const _qStart = new Quaternion()
const _qMid = new Quaternion()
const _qTarget = new Quaternion()
const _qOut = new Quaternion()
const _euler = new Euler()

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp01(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t
}

function rotToQuat(r: PoseRotation, out: Quaternion): Quaternion {
  // Unity Quaternion.Euler(pitch, yaw, roll) ≈ Three Euler YXZ
  _euler.set(
    (r.pitchDeg * Math.PI) / 180,
    (r.yawDeg * Math.PI) / 180,
    (r.rollDeg * Math.PI) / 180,
    'YXZ',
  )
  return out.setFromEuler(_euler)
}

function quatToRot(q: Quaternion): PoseRotation {
  _euler.setFromQuaternion(q, 'YXZ')
  return {
    pitchDeg: (_euler.x * 180) / Math.PI,
    yawDeg: (_euler.y * 180) / Math.PI,
    rollDeg: (_euler.z * 180) / Math.PI,
  }
}

function copyPos(p: EnuPosition): EnuPosition {
  return { x: p.x, y: p.y, z: p.z }
}

function copyRot(r: PoseRotation): PoseRotation {
  return { yawDeg: r.yawDeg, pitchDeg: r.pitchDeg, rollDeg: r.rollDeg }
}

export type LerpSample = {
  position: EnuPosition
  rotation: PoseRotation
}

/**
 * Per-entity midpoint lerp state.
 * First `setTarget` snaps; later targets lerp start → mid → target over measured packet interval.
 */
export class MidpointLerp {
  isFirstData = true
  packetIntervalSec = 1 / 15
  lastPacketTimeSec = 0
  moveTimerSec = 0

  startPos: EnuPosition = { x: 0, y: 0, z: 0 }
  midPos: EnuPosition = { x: 0, y: 0, z: 0 }
  targetPos: EnuPosition = { x: 0, y: 0, z: 0 }

  startRot: PoseRotation = { yawDeg: 0, pitchDeg: 0, rollDeg: 0 }
  midRot: PoseRotation = { yawDeg: 0, pitchDeg: 0, rollDeg: 0 }
  targetRot: PoseRotation = { yawDeg: 0, pitchDeg: 0, rollDeg: 0 }

  /** Current smoothed pose (updated by setTarget snap / tick). */
  currentPos: EnuPosition = { x: 0, y: 0, z: 0 }
  currentRot: PoseRotation = { yawDeg: 0, pitchDeg: 0, rollDeg: 0 }

  setTarget(pos: EnuPosition, rot: PoseRotation, nowSec: number): void {
    if (this.isFirstData) {
      this.targetPos = copyPos(pos)
      this.targetRot = copyRot(rot)
      this.currentPos = copyPos(pos)
      this.currentRot = copyRot(rot)
      this.startPos = copyPos(pos)
      this.midPos = copyPos(pos)
      this.startRot = copyRot(rot)
      this.midRot = copyRot(rot)
      this.lastPacketTimeSec = nowSec
      this.moveTimerSec = 0
      this.isFirstData = false
      return
    }

    const currentInterval = nowSec - this.lastPacketTimeSec
    if (currentInterval > 0.01 && currentInterval < 2.0) {
      this.packetIntervalSec = lerp(this.packetIntervalSec, currentInterval, 0.5)
    }
    this.lastPacketTimeSec = nowSec

    this.startPos = copyPos(this.currentPos)
    this.startRot = copyRot(this.currentRot)
    this.targetPos = copyPos(pos)
    this.targetRot = copyRot(rot)

    this.midPos = {
      x: lerp(this.startPos.x, this.targetPos.x, 0.5),
      y: lerp(this.startPos.y, this.targetPos.y, 0.5),
      z: lerp(this.startPos.z, this.targetPos.z, 0.5),
    }

    rotToQuat(this.startRot, _qStart)
    rotToQuat(this.targetRot, _qTarget)
    _qMid.slerpQuaternions(_qStart, _qTarget, 0.5)
    this.midRot = quatToRot(_qMid)

    this.moveTimerSec = 0
  }

  /** Advance by `dtSec` and refresh `current*`. Returns current sample. */
  tick(dtSec: number): LerpSample {
    if (this.isFirstData) {
      return { position: copyPos(this.currentPos), rotation: copyRot(this.currentRot) }
    }
    this.moveTimerSec += dtSec
    return this.sampleAt(this.moveTimerSec)
  }

  /**
   * Sample without mutating timer (tests). Also writes `current*` when used from `tick`.
   */
  sampleAt(moveTimerSec: number): LerpSample {
    if (this.isFirstData) {
      return { position: copyPos(this.currentPos), rotation: copyRot(this.currentRot) }
    }

    const half = this.packetIntervalSec / 2
    let position: EnuPosition
    let rotation: PoseRotation

    if (moveTimerSec < half) {
      const t = clamp01(half > 0 ? moveTimerSec / half : 1)
      position = {
        x: lerp(this.startPos.x, this.midPos.x, t),
        y: lerp(this.startPos.y, this.midPos.y, t),
        z: lerp(this.startPos.z, this.midPos.z, t),
      }
      rotToQuat(this.startRot, _qStart)
      rotToQuat(this.midRot, _qMid)
      _qOut.slerpQuaternions(_qStart, _qMid, t)
      rotation = quatToRot(_qOut)
    } else if (moveTimerSec < this.packetIntervalSec) {
      const t = clamp01(half > 0 ? (moveTimerSec - half) / half : 1)
      position = {
        x: lerp(this.midPos.x, this.targetPos.x, t),
        y: lerp(this.midPos.y, this.targetPos.y, t),
        z: lerp(this.midPos.z, this.targetPos.z, t),
      }
      rotToQuat(this.midRot, _qMid)
      rotToQuat(this.targetRot, _qTarget)
      _qOut.slerpQuaternions(_qMid, _qTarget, t)
      rotation = quatToRot(_qOut)
    } else {
      position = copyPos(this.targetPos)
      rotation = copyRot(this.targetRot)
    }

    this.currentPos = position
    this.currentRot = rotation
    return { position: copyPos(position), rotation: copyRot(rotation) }
  }
}
