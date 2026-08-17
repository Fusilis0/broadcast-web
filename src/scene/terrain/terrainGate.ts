/**
 * Terrain is opaque, so it shares the realistic-env **opaque-clear** gate.
 * Do not invent a second channel gate — `setEnvironmentOpaqueClearSafe` is
 * the one switch (preview / 3D NDI on; transparent / chroma off).
 *
 * Enable is independent of `environmentMode` (`simple` | `realistic`).
 */
export function shouldShowTerrain(
  enabled: boolean,
  opaqueClearSafe: boolean,
): boolean {
  return enabled === true && opaqueClearSafe === true
}
