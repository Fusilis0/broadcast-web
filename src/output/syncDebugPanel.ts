/**
 * Sync-debug overlay (Phase 17.2 / L8 commissioning).
 *
 * DOM-only ops panel — **never** drawn into WebGL / NDI. Off by default.
 * TEL-08 / OUT-06 fill presented PTS, pose, and decoder counters when wired;
 * until then those rows show "—" rather than inventing numbers.
 */

import type { PtsNtpHealth, PtsNtpMode } from '../telemetry/ptsNtpMap.ts'

export const PRESENTATION_LATENCY_MIN_MS = 100
export const PRESENTATION_LATENCY_MAX_MS = 400

export type LatencyClampPin = 'floor' | 'ceiling' | null

export type SyncDebugBoatRow = {
  id: string
  mode: string
  /** Producer `brg === 0` — held, not walked north. */
  heldBearingUnknown: boolean
}

export type SyncDebugDecoderCounters = {
  framesDecoded: number | null
  framesDropped: number | null
  queueDepth: number | null
}

export type SyncDebugStreamSnapshot = {
  povId: string
  srtId: string
  /** LUT key; default = SRT id. */
  lutStreamId: string
  presentedPts90k: number | null
  resolvedNtpMs: number | null
  ptsMode: PtsNtpMode
  extrapolatedByMs: number
  presentationLatencyMs: number | null
  latencyClampPinned: LatencyClampPin
  health: PtsNtpHealth
  freeRun: boolean
  poseAgeMs: number | null
  poseMode: string | null
  poseStale: boolean
  boats: SyncDebugBoatRow[]
  decoder: SyncDebugDecoderCounters
  /** Read-only here — CAL-05 owns the control. */
  syncTrimMs: number
  /** Presented `t_ntp` from the pose pipeline (PTS → LUT + trim). */
  tNtpMs: number | null
  /** Newest drone NTP in the matched buffer for this POV. */
  newestPoseNtpMs: number | null
  /** `newestPoseNtpMs − tNtpMs`. Negative = video ahead of the pose buffer. */
  poseMinusVideoMs: number | null
  /** Pacing anchors on the LUT used for this POV. */
  pacingCount: number
}

export type SyncDebugPanelOptions = {
  container: HTMLElement
  getSnapshot: () => SyncDebugStreamSnapshot[]
  /** Poll interval. Default 500 ms. */
  pollMs?: number
}

export type SyncDebugPanelHandle = {
  readonly root: HTMLElement
  refresh: () => void
  setEnabled: (on: boolean) => void
  isEnabled: () => boolean
  dispose: () => void
}

const DEFAULT_POLL_MS = 500
const POSE_STALE_MS = 2_000

export function emptyPtsNtpHealth(): PtsNtpHealth {
  return {
    pacingCount: 0,
    frameCount: 0,
    slope: null,
    lastAnchorNtpMs: null,
    lastPacingPts90k: null,
    rejected: {
      ntpUnsynced: 0,
      ntpNotFinite: 0,
      ptsUnusable: 0,
      unknownKind: 0,
      wrongStream: 0,
      clockStep: 0,
    },
    residualMs: null,
  }
}

export function clampAdaptiveLatencyMs(rawMs: number): {
  effectiveMs: number
  pinned: LatencyClampPin
} {
  if (!Number.isFinite(rawMs)) {
    return { effectiveMs: PRESENTATION_LATENCY_MIN_MS, pinned: 'floor' }
  }
  if (rawMs < PRESENTATION_LATENCY_MIN_MS) {
    return { effectiveMs: PRESENTATION_LATENCY_MIN_MS, pinned: 'floor' }
  }
  if (rawMs > PRESENTATION_LATENCY_MAX_MS) {
    return { effectiveMs: PRESENTATION_LATENCY_MAX_MS, pinned: 'ceiling' }
  }
  return { effectiveMs: rawMs, pinned: null }
}

export function isFreeRun(health: PtsNtpHealth): boolean {
  return health.pacingCount === 0
}

/**
 * Assemble a row. Missing PTS / pose / decoder stay null — callers (TEL-08,
 * OUT-06) fill them; this dispatch does not invent a presented frame.
 */
export function buildSyncDebugSnapshot(input: {
  povId: string
  srtId: string
  lutStreamId?: string
  health: PtsNtpHealth
  syncTrimMs: number
  presentedPts90k?: number | null
  resolvedNtpMs?: number | null
  ptsMode?: PtsNtpMode
  extrapolatedByMs?: number
  presentationLatencyMs?: number | null
  poseAgeMs?: number | null
  poseMode?: string | null
  boats?: SyncDebugBoatRow[]
  decoder?: SyncDebugDecoderCounters | null
  /**
   * Override FREE-RUN. Holding (video clock, no LUT) must pass `false`
   * even when `pacingCount === 0`.
   */
  freeRun?: boolean
  tNtpMs?: number | null
  newestPoseNtpMs?: number | null
  poseMinusVideoMs?: number | null
  pacingCount?: number
}): SyncDebugStreamSnapshot {
  const health = input.health
  const freeRun = input.freeRun ?? isFreeRun(health)
  const rawLat = input.presentationLatencyMs
  let presentationLatencyMs: number | null = null
  let latencyClampPinned: LatencyClampPin = null
  if (typeof rawLat === 'number' && Number.isFinite(rawLat)) {
    const clamped = clampAdaptiveLatencyMs(rawLat)
    presentationLatencyMs = clamped.effectiveMs
    latencyClampPinned = clamped.pinned
  }
  const poseAgeMs =
    typeof input.poseAgeMs === 'number' && Number.isFinite(input.poseAgeMs)
      ? input.poseAgeMs
      : null
  const ptsMode: PtsNtpMode = freeRun
    ? 'unavailable'
    : (input.ptsMode ?? 'unavailable')
  return {
    povId: input.povId,
    srtId: input.srtId,
    lutStreamId: (input.lutStreamId ?? input.srtId).trim() || input.srtId,
    presentedPts90k: input.presentedPts90k ?? null,
    resolvedNtpMs: input.resolvedNtpMs ?? null,
    ptsMode,
    extrapolatedByMs: input.extrapolatedByMs ?? 0,
    presentationLatencyMs,
    latencyClampPinned,
    health,
    freeRun,
    poseAgeMs,
    poseMode: input.poseMode ?? null,
    poseStale: poseAgeMs !== null && poseAgeMs > POSE_STALE_MS,
    boats: input.boats ?? [],
    decoder: input.decoder ?? {
      framesDecoded: null,
      framesDropped: null,
      queueDepth: null,
    },
    syncTrimMs: input.syncTrimMs,
    tNtpMs:
      typeof input.tNtpMs === 'number' && Number.isFinite(input.tNtpMs)
        ? input.tNtpMs
        : null,
    newestPoseNtpMs:
      typeof input.newestPoseNtpMs === 'number' &&
      Number.isFinite(input.newestPoseNtpMs)
        ? input.newestPoseNtpMs
        : null,
    poseMinusVideoMs:
      typeof input.poseMinusVideoMs === 'number' &&
      Number.isFinite(input.poseMinusVideoMs)
        ? input.poseMinusVideoMs
        : null,
    pacingCount:
      typeof input.pacingCount === 'number' && Number.isFinite(input.pacingCount)
        ? input.pacingCount
        : health.pacingCount,
  }
}

export function syncDebugBadges(row: SyncDebugStreamSnapshot): string[] {
  const badges: string[] = []
  if (row.freeRun) badges.push('FREE-RUN')
  if (row.ptsMode === 'extrapolated') badges.push('EXTRAPOLATING')
  if (row.latencyClampPinned) badges.push('CLAMP PINNED')
  if (row.poseStale) badges.push('POSE STALE')
  if (row.boats.some((b) => b.heldBearingUnknown)) {
    badges.push('BOAT HELD')
  }
  return badges
}

function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return String(Math.round(n))
}

export function formatHealthLine(health: PtsNtpHealth): string {
  const age =
    health.lastAnchorAgeMs != null
      ? `${Math.round(health.lastAnchorAgeMs)}ms`
      : '—'
  const slope = health.slope == null ? '—' : health.slope.toFixed(4)
  const resid = health.residualMs == null ? '—' : `${health.residualMs.toFixed(1)}ms`
  const r = health.rejected
  const rej = `u${r.ntpUnsynced}/nf${r.ntpNotFinite}/pts${r.ptsUnusable}/k${r.unknownKind}/st${r.wrongStream}/clk${r.clockStep}`
  return `pacing ${health.pacingCount} · frames ${health.frameCount} · slope ${slope} · resid ${resid} · age ${age} · rej ${rej}`
}

function dash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  return String(value)
}

/**
 * Ops sidebar **Output** section: per-stream PTS/NTP, clamp, anchors, pose,
 * boat DR, decoder counters, trim. Default off.
 *
 * **Invariant:** DOM-only. Must never participate in the WebGL render wrap /
 * framebuffer readback / NDI IPC (`docs/architecture/unified-ops-sidebar.md` §2).
 */
export function startSyncDebugPanel(
  options: SyncDebugPanelOptions,
): SyncDebugPanelHandle {
  const pollMs =
    typeof options.pollMs === 'number' && options.pollMs > 0
      ? options.pollMs
      : DEFAULT_POLL_MS

  const root = document.createElement('div')
  root.className = 'sync-debug'
  root.setAttribute('data-ops', 'sync-debug')

  const toggleRow = document.createElement('label')
  toggleRow.className = 'sync-debug__toggle'
  const toggle = document.createElement('input')
  toggle.type = 'checkbox'
  toggle.setAttribute('data-ops', 'sync-debug-toggle')
  const toggleText = document.createElement('span')
  toggleText.textContent = 'Sync debug'
  toggleRow.append(toggle, toggleText)
  root.appendChild(toggleRow)

  const hint = document.createElement('p')
  hint.className = 'sync-debug__hint'
  hint.textContent =
    'Ops-only (DOM). Never on the AR plate / NDI. Off by default. FREE-RUN = unmatched video (connecting, no picture). Holding last pose is not FREE-RUN.'
  root.appendChild(hint)

  const body = document.createElement('div')
  body.className = 'sync-debug__body'
  body.hidden = true
  root.appendChild(body)

  options.container.appendChild(root)

  function render(rows: SyncDebugStreamSnapshot[]): void {
    body.replaceChildren()
    if (rows.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'sync-debug__hint'
      empty.textContent =
        'No Video-enabled POVs. Check Video on a drone row and set its SRT id.'
      body.appendChild(empty)
      return
    }
    for (const row of rows) {
      body.appendChild(streamBlock(row))
    }
  }

  function refresh(): void {
    if (!toggle.checked) return
    render(options.getSnapshot())
  }

  toggle.addEventListener('change', () => {
    body.hidden = !toggle.checked
    if (toggle.checked) refresh()
  })

  const timer = window.setInterval(refresh, pollMs)

  return {
    root,
    refresh,
    setEnabled(on): void {
      toggle.checked = on
      body.hidden = !on
      if (on) refresh()
    },
    isEnabled: () => toggle.checked,
    dispose(): void {
      window.clearInterval(timer)
      root.remove()
    },
  }
}

function streamBlock(row: SyncDebugStreamSnapshot): HTMLElement {
  const el = document.createElement('div')
  el.className = 'sync-debug__stream'
  el.setAttribute('data-sync-pov', row.povId)

  const title = document.createElement('div')
  title.className = 'sync-debug__stream-title'
  title.textContent = `POV ${row.povId} · SRT ${row.srtId}`
  el.appendChild(title)

  const badges = syncDebugBadges(row)
  if (badges.length > 0) {
    const bar = document.createElement('div')
    bar.className = 'sync-debug__badges'
    for (const name of badges) {
      const b = document.createElement('span')
      b.className = 'sync-debug__badge'
      b.setAttribute('data-sync-badge', name)
      b.textContent = name
      bar.appendChild(b)
    }
    el.appendChild(bar)
  }

  el.appendChild(
    kv(
      'PTS / NTP',
      `${dash(row.presentedPts90k)} → ${dash(row.resolvedNtpMs)} · last pacing ${dash(row.health.lastPacingPts90k)}`,
    ),
  )
  el.appendChild(
    kv(
      'Mode',
      `${row.ptsMode}${
        row.extrapolatedByMs > 0
          ? ` · extra ${Math.round(row.extrapolatedByMs)}ms`
          : ''
      }`,
    ),
  )
  const lat =
    row.presentationLatencyMs == null
      ? '—'
      : `${Math.round(row.presentationLatencyMs)}ms [${PRESENTATION_LATENCY_MIN_MS}–${PRESENTATION_LATENCY_MAX_MS}]${
          row.latencyClampPinned ? ` · PINNED ${row.latencyClampPinned}` : ''
        }`
  el.appendChild(kv('Latency', lat))
  el.appendChild(kv('Anchors', formatHealthLine(row.health)))
  el.appendChild(
    kv(
      'Pose',
      row.poseMode == null && row.poseAgeMs == null
        ? `— · Δ ${fmtInt(row.poseMinusVideoMs)}ms (newest−t_ntp) · pacing ${fmtInt(row.pacingCount)}`
        : `${dash(row.poseMode)} · age ${fmtInt(row.poseAgeMs)}ms${
            row.poseStale ? ' · STALE' : ''
          } · newest ${dash(row.newestPoseNtpMs)} · Δ ${fmtInt(row.poseMinusVideoMs)}ms (newest−t_ntp) · pacing ${fmtInt(row.pacingCount)}`,
    ),
  )
  const boatText =
    row.boats.length === 0
      ? '—'
      : row.boats
          .map((b) =>
            b.heldBearingUnknown
              ? `${b.id} held (bearing unknown)`
              : `${b.id} ${b.mode}`,
          )
          .join(' · ')
  el.appendChild(kv('Boats', boatText))
  el.appendChild(
    kv(
      'Decoder',
      `decoded ${fmtInt(row.decoder.framesDecoded)} · dropped ${fmtInt(row.decoder.framesDropped)} · queue ${fmtInt(row.decoder.queueDepth)}`,
    ),
  )
  el.appendChild(kv('Trim', `${fmtNum(row.syncTrimMs, 0)}ms (CAL, read-only)`))
  return el
}

function kv(label: string, value: string): HTMLElement {
  const row = document.createElement('div')
  row.className = 'sync-debug__row'
  const lab = document.createElement('span')
  lab.className = 'sync-debug__label'
  lab.textContent = label
  const val = document.createElement('span')
  val.className = 'sync-debug__value'
  val.textContent = value
  row.append(lab, val)
  return row
}
