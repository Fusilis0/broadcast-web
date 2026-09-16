/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createFreeCam, OPS_CAM_DAMPING_FACTOR } from './freeCam.ts'
import {
  isTelemetryBoatLive,
  PROGRAM_CAM_DAMPING_FACTOR,
  PROGRAM_FRAME_BOATS_STALE_MS,
  PROGRAM_WASD_TAU_SEC,
  programCamShouldMirrorOps,
  studioShowsProgramRig,
} from './programCam.ts'
import { STATIC_HULL_LIVE_HOLD_MS } from './staticFleetHulls.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

describe('program cam damping', () => {
  it('is smoother than the ops MapControls factor', () => {
    expect(PROGRAM_CAM_DAMPING_FACTOR).toBeLessThan(OPS_CAM_DAMPING_FACTOR)
    expect(PROGRAM_CAM_DAMPING_FACTOR).toBeGreaterThan(0)
    expect(PROGRAM_WASD_TAU_SEC).toBeGreaterThan(0)
  })
})

describe('programCamShouldMirrorOps', () => {
  it('copies ops into program until the operator aims the air rig', () => {
    expect(
      programCamShouldMirrorOps({
        programOutputOnly: false,
        control3dProgram: false,
        programDriven: false,
      }),
    ).toBe(true)
    expect(
      programCamShouldMirrorOps({
        programOutputOnly: false,
        control3dProgram: true,
        programDriven: false,
      }),
    ).toBe(false)
    expect(
      programCamShouldMirrorOps({
        programOutputOnly: false,
        control3dProgram: false,
        programDriven: true,
      }),
    ).toBe(false)
    expect(
      programCamShouldMirrorOps({
        programOutputOnly: true,
        control3dProgram: false,
        programDriven: false,
      }),
    ).toBe(false)
  })
})

describe('studioShowsProgramRig', () => {
  it('shows ops until takeover; plate always shows program', () => {
    expect(
      studioShowsProgramRig({
        control3dProgram: false,
        programOutputOnly: false,
      }),
    ).toBe(false)
    expect(
      studioShowsProgramRig({
        control3dProgram: true,
        programOutputOnly: false,
      }),
    ).toBe(true)
    expect(
      studioShowsProgramRig({
        control3dProgram: false,
        programOutputOnly: true,
      }),
    ).toBe(true)
  })
})

describe('isTelemetryBoatLive', () => {
  it('ignores planned-only hulls and stale packets', () => {
    expect(isTelemetryBoatLive(undefined, 10_000)).toBe(false)
    expect(isTelemetryBoatLive(1_000, 1_000 + PROGRAM_FRAME_BOATS_STALE_MS)).toBe(
      true,
    )
    expect(
      isTelemetryBoatLive(1_000, 1_000 + PROGRAM_FRAME_BOATS_STALE_MS + 1),
    ).toBe(false)
    expect(PROGRAM_FRAME_BOATS_STALE_MS).toBe(STATIC_HULL_LIVE_HOLD_MS)
  })
})

describe('ops vs program WASD', () => {
  it('ops move does not change program pose; takeover routes input to program', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const ops = createFreeCam(host, 1, 73, { name: 'opsFreeCam' })
    const program = createFreeCam(host, 1, 73, {
      name: 'programCam',
      dampingFactor: PROGRAM_CAM_DAMPING_FACTOR,
      wasdTauSec: PROGRAM_WASD_TAU_SEC,
    })
    ops.setView({ px: 10, py: 40, pz: -10, tx: 0, ty: 0, tz: 0 })
    program.setView({ px: 10, py: 40, pz: -10, tx: 0, ty: 0, tz: 0 })
    const program0 = program.getView()

    ops.setEnabled(true)
    program.setEnabled(false)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }),
    )
    ops.update(1)
    program.update(1)
    expect(ops.camera.position.z).not.toBeCloseTo(program0.pz, 3)
    expect(program.getView()).toEqual(program0)

    window.dispatchEvent(
      new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }),
    )
    ops.setEnabled(false)
    program.setEnabled(true)
    const opsParked = ops.getView()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyD', key: 'd', bubbles: true }),
    )
    program.update(1 / 60)
    ops.update(1 / 60)
    expect(ops.getView()).toEqual(opsParked)
    expect(program.getView().px).not.toBeCloseTo(program0.px, 5)

    ops.dispose()
    program.dispose()
    host.remove()
  })

  it('program WASD is damped relative to ops for the same hold', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const ops = createFreeCam(host, 1, 73)
    const program = createFreeCam(host, 1, 73, {
      dampingFactor: PROGRAM_CAM_DAMPING_FACTOR,
      wasdTauSec: PROGRAM_WASD_TAU_SEC,
    })
    const pose = { px: 0, py: 80, pz: 0, tx: 0, ty: 0, tz: 0 }
    ops.setView(pose)
    program.setView(pose)
    ops.setEnabled(true)
    program.setEnabled(true)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }),
    )
    const dt = 1 / 60
    const ops0 = ops.camera.position.clone()
    const prog0 = program.camera.position.clone()
    ops.update(dt)
    program.update(dt)
    const opsStep = ops.camera.position.distanceTo(ops0)
    const progStep = program.camera.position.distanceTo(prog0)
    expect(opsStep).toBeGreaterThan(0)
    expect(progStep).toBeGreaterThan(0)
    expect(progStep).toBeLessThan(opsStep)
    ops.dispose()
    program.dispose()
    host.remove()
  })
})

describe('3D program IPC (source)', () => {
  it('retires ops previewView; 3D plate applies program pose', () => {
    const main = readFileSync(join(here, '../main.ts'), 'utf8')
    expect(main).toMatch(/getProgramCamView\(\)/)
    expect(main).toMatch(/sendProgramView/)
    expect(main).toMatch(/onProgramView/)
    expect(main).toMatch(/applyProgramCamView/)
    expect(main).toMatch(/programOutputOnly:\s*srtPlateChannel === '3d'/)
    expect(main).not.toMatch(/sendPreviewView/)
    expect(main).not.toMatch(/onPreviewView/)
    const sendBlock = main.slice(
      main.indexOf('if (!srtPlateChannel)'),
      main.indexOf('onActivePovChange'),
    )
    expect(sendBlock).toMatch(/getProgramCamView/)
    expect(sendBlock).not.toMatch(/getFreeCamView/)

    const desktop = readFileSync(join(repoRoot, 'desktop/main.cjs'), 'utf8')
    expect(desktop).toMatch(/srtOut:programView/)
    expect(desktop).not.toMatch(/srtOut:previewView/)
    expect(desktop).toMatch(/STUDIO_TICK_FPS\s*=\s*60/)
    expect(desktop).not.toMatch(/STUDIO_TICK_FPS\s*=\s*30/)

    const preload = readFileSync(join(repoRoot, 'desktop/preload.cjs'), 'utf8')
    expect(preload).toMatch(/sendProgramView/)
    expect(preload).not.toMatch(/sendPreviewView/)

    const scene = readFileSync(join(here, 'createScene.ts'), 'utf8')
    expect(scene).toMatch(/PROGRAM_CAM_DAMPING_FACTOR/)
    expect(scene).toMatch(/PROGRAM_WASD_TAU_SEC/)
    expect(scene).toMatch(/setControl3dProgram/)
    expect(scene).toMatch(/frameProgramBoats/)
    expect(scene).toMatch(/programCamShouldMirrorOps/)
    expect(scene).toMatch(/if \(programOutputOnly\) \{[\s\S]*cam\.updateMatrixWorld\(\)/)
    expect(scene).not.toMatch(/STUDIO_TICK_FPS\s*=/)
  })
})

describe('damping constant export', () => {
  it('stays a finite on-air smoother than ops', () => {
    expect(Number.isFinite(PROGRAM_CAM_DAMPING_FACTOR)).toBe(true)
    expect(PROGRAM_CAM_DAMPING_FACTOR).toBe(0.035)
  })
})
