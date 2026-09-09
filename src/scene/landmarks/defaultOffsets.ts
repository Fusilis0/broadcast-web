/**
 * Built-in hero authoring offsets (operator lock 2026-09-08 from race `empty`).
 * Used when a pack has no `landmarks.byId` for that id. Pack rows still override.
 * Not a geoid — GPS stays `gpsToEnuAmsl`.
 */

import {
  normalizeLandmarkPose,
  ZERO_LANDMARK_POSE,
} from './projectLandmarks.ts'
import type { LandmarkPoseOffset } from './types.ts'

function pose(partial: Partial<LandmarkPoseOffset>): LandmarkPoseOffset {
  return normalizeLandmarkPose(partial)
}

export const DEFAULT_LANDMARK_OFFSETS: Readonly<
  Record<string, LandmarkPoseOffset>
> = {
  'maidens-tower': pose({ y: 0.7 }),
  'galata-tower': pose({ x: 4.1, y: 51.4, z: -6.4 }),
  'sultan-ahmed': pose({ x: -10.5, y: 39.2, z: 1.7 }),
  topkapi: pose({ x: -13, y: 17.3 }),
  suleymaniye: pose({ x: -9.5, y: 58.9, z: 33.1 }),
  'aya-irini': pose({ x: -25.7, y: 45.6, z: 73.9, yawDeg: -0.5 }),
  dolmabahce: pose({ x: 40.2, y: 9.2, z: -79.3, yawDeg: 0.5 }),
  ciragan: pose({ x: -136.4, y: 11.8, z: 3.5, yawDeg: 0.5 }),
  'bogazici-bridge': pose({ x: 7.2, y: -5.1, z: -37.6, yawDeg: 0.35 }),
  'fsm-bridge': pose({ x: 90, y: -20 }),
  'yavuz-selim-bridge': pose({ x: -600, z: -160 }),
}

export function defaultLandmarkPose(id: string): LandmarkPoseOffset {
  const row = DEFAULT_LANDMARK_OFFSETS[id]
  return row ? { ...row } : { ...ZERO_LANDMARK_POSE }
}
