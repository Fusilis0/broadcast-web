/** V1 map feature editor tools (ops palette). */
export type EditorTool =
  | 'select'
  | 'mark'
  | 'gateLeft'
  | 'gateRight'
  | 'gatePair'
  | 'sponsor'
  | 'flagP1'
  | 'flagP2'
  | 'start'
  | 'finish'
  | 'arrow'
  | 'buoy'
  | 'billboardChain'
  | 'placeBoat'
  | 'placeDrone'
  | 'setAnchor'

/** Tools that need two map clicks (A then B). */
export const TWO_CLICK_TOOLS: ReadonlySet<EditorTool> = new Set([
  'gatePair',
  'sponsor',
  /** A–B water line (Unity Start/Finish). */
  'start',
  'finish',
  /** A = position, B = heading tip (bearing stored on create). */
  'arrow',
])

/**
 * Tools that accumulate ≥2 polyline vertices (finish via Done / double-click).
 */
export const POLYLINE_TOOLS: ReadonlySet<EditorTool> = new Set([
  'billboardChain',
])

/** One-click tools that are not WorldFeatures (fleet / origin). */
export const FLEET_PLACE_TOOLS: ReadonlySet<EditorTool> = new Set([
  'placeBoat',
  'placeDrone',
  'setAnchor',
])

/** Readable labels for the World Authoring workspace palette. */
export const EDITOR_TOOL_LABELS: Record<EditorTool, string> = {
  select: 'Select',
  mark: 'Mark',
  gateLeft: 'Gate L',
  gateRight: 'Gate R',
  gatePair: 'Gate pair',
  sponsor: 'Sponsor',
  flagP1: 'Flag P1',
  flagP2: 'Flag P2',
  start: 'Start',
  finish: 'Finish',
  arrow: 'Arrow',
  buoy: 'Buoy',
  billboardChain: 'Billboard chain',
  placeBoat: 'Place boat',
  placeDrone: 'Place drone',
  setAnchor: 'Set anchor',
}

export type EditorToolGroupId =
  | 'select'
  | 'course'
  | 'graphics'
  | 'fleet'
  | 'anchor'

export type EditorToolGroup = {
  id: EditorToolGroupId
  label: string
  tools: readonly EditorTool[]
}

/** Palette groups for the dedicated authoring workspace. */
export const EDITOR_TOOL_GROUPS: readonly EditorToolGroup[] = [
  { id: 'select', label: 'Select', tools: ['select'] },
  {
    id: 'course',
    label: 'Course',
    tools: [
      'start',
      'finish',
      'mark',
      'gateLeft',
      'gateRight',
      'gatePair',
      'buoy',
      'flagP1',
      'flagP2',
    ],
  },
  {
    id: 'graphics',
    label: 'Graphics',
    tools: ['sponsor', 'billboardChain', 'arrow'],
  },
  {
    id: 'fleet',
    label: 'Fleet',
    tools: ['placeBoat', 'placeDrone'],
  },
  {
    id: 'anchor',
    label: 'Anchor',
    tools: ['setAnchor'],
  },
]

/** Flat order (legacy + tests); matches grouped palette coverage. */
export const EDITOR_TOOL_ORDER: readonly EditorTool[] =
  EDITOR_TOOL_GROUPS.flatMap((g) => g.tools)
