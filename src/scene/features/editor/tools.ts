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

/** Tools that need two map clicks (A then B). */
export const TWO_CLICK_TOOLS: ReadonlySet<EditorTool> = new Set([
  'gatePair',
  'sponsor',
])

export const EDITOR_TOOL_LABELS: Record<EditorTool, string> = {
  select: 'select',
  mark: 'mark',
  gateLeft: 'gate L',
  gateRight: 'gate R',
  gatePair: 'gate pair',
  sponsor: 'sponsor',
  flagP1: 'flag P1',
  flagP2: 'flag P2',
  start: 'start',
  finish: 'finish',
  arrow: 'arrow',
}

export const EDITOR_TOOL_ORDER: readonly EditorTool[] = [
  'select',
  'mark',
  'gateLeft',
  'gateRight',
  'gatePair',
  'sponsor',
  'flagP1',
  'flagP2',
  'start',
  'finish',
  'arrow',
]
