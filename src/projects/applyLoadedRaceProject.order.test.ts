import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const main = readFileSync(join(here, '../main.ts'), 'utf8')
const createScene = readFileSync(join(here, '../scene/createScene.ts'), 'utf8')

function sliceFn(src: string, name: string, nextName: string): string {
  const start = src.indexOf(`async function ${name}`)
  const end = src.indexOf(`async function ${nextName}`)
  expect(start).toBeGreaterThan(0)
  expect(end).toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('applyLoadedRaceProject Load order (DSP-SCN-20260905-03)', () => {
  const body = sliceFn(main, 'applyLoadedRaceProject', 'switchRace')

  it('does not await remount or loadWorldForProject before fleetPanel.setState', () => {
    const setState = body.indexOf('fleetPanel?.setState')
    expect(setState).toBeGreaterThan(0)
    expect(body.search(/await\s+loadWorldForProject/)).toBe(-1)
    expect(body.search(/await\s+scene\.remountWorldFromFeatures/)).toBe(-1)
    expect(body.indexOf('startPackedWorldRemount')).toBeGreaterThan(setState)
    expect(body.indexOf('void loadWorldForProject')).toBeGreaterThan(setState)
  })

  it('does not await restartIngest before fleetPanel.setState', () => {
    const setState = body.indexOf('fleetPanel?.setState')
    expect(setState).toBeGreaterThan(0)
    expect(body.search(/await\s+restartIngest/)).toBe(-1)
    expect(body.indexOf('void restartIngest')).toBeGreaterThan(setState)
  })

  it('applies 2D + lists, yields paint, then starts remount', () => {
    const apply2d = body.indexOf('await applyWorldFeatures')
    const setState = body.indexOf('fleetPanel?.setState')
    const yieldPaint = body.indexOf('await yieldPaintFrames')
    const remountStart = body.indexOf('startPackedWorldRemount')
    expect(apply2d).toBeGreaterThan(0)
    expect(setState).toBeGreaterThan(apply2d)
    expect(yieldPaint).toBeGreaterThan(setState)
    expect(remountStart).toBeGreaterThan(yieldPaint)
    expect(body).toContain("logProjectSwitchStage('uiPaint'")
    expect(body).toContain("logProjectSwitchStage('remountStarted'")
  })

  it('boot still awaits remount via loadWorldForProject', () => {
    expect(main).toContain('const world = await loadWorldForProject(raceProject)')
    const apply = main.indexOf('async function applyLoadedRaceProject')
    const boot = main.indexOf('const world = await loadWorldForProject(raceProject)')
    expect(boot).toBeGreaterThan(apply)
  })

  it('keeps remountGen stale abort in createScene', () => {
    expect(createScene).toContain('let remountGen = 0')
    expect(createScene).toContain("phase: 'after-dispose'")
    expect(createScene).toContain('[scene] remount stale abort')
  })
})
