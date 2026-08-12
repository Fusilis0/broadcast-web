import { describe, expect, it } from 'vitest'
import {
  resolveStreamMapOptions,
  STREAM_MAP_DEFAULT_TITLE,
  STREAM_MAP_SIZE_PX,
} from './streamMap.ts'

describe('resolveStreamMapOptions', () => {
  it('defaults hidden, stream variant, and broadcast PiP size', () => {
    expect(STREAM_MAP_SIZE_PX).toBeGreaterThanOrEqual(480)
    expect(STREAM_MAP_SIZE_PX).toBeLessThanOrEqual(560)
    expect(resolveStreamMapOptions()).toEqual({
      sizePx: STREAM_MAP_SIZE_PX,
      title: STREAM_MAP_DEFAULT_TITLE,
      visible: false,
      variant: 'stream',
    })
  })

  it('honors size / title / visible overrides', () => {
    expect(
      resolveStreamMapOptions({
        sizePx: 320,
        title: 'Custom',
        visible: true,
      }),
    ).toEqual({
      sizePx: 320,
      title: 'Custom',
      visible: true,
      variant: 'stream',
    })
  })
})
