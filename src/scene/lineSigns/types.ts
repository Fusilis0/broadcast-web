/** Injected GEO convert — keep ECEF out of scene. */
export type GpsToEnuAmslFn = (
  lat: number,
  lon: number,
  altAmsl: number,
) => { x: number; y: number; z: number }

export type LineSignKind = 'start' | 'finish'

/** Water-plane endpoints after GEO (Unity Start/Finish + BillboardBetweenTwoPoints). */
export type LineSignEnu = {
  id: string
  kind: LineSignKind
  label: string
  color: number
  ax: number
  az: number
  bx: number
  bz: number
  midX: number
  midZ: number
  widthM: number
}
