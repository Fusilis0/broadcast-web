/**
 * Ops Flow inspector — per-entity telemetry + SRT JSON cards.
 *
 * DOM overlay only. Never WebGL / NDI (`ndiFramePump` reads the framebuffer).
 * Poll ≤ 4 Hz. Default off. Do not replace Output sync-debug.
 */

import { redactSrtUrl } from '../output/srtCallerUrl.ts'
import type { FlowTapEvent, FlowTapKind } from '../telemetry/flowTap.ts'

export const FLOW_LIVE_JSON_STORAGE_KEY = 'bw.flowPanel.liveJson'
/** Cap: 4 Hz. Callers cannot poll faster. */
export const FLOW_POLL_MS = 250
/**
 * Non-registry Flow cards stay only while an event is this fresh.
 * Registry ids (including disconnected) always keep a card.
 */
export const FLOW_CARD_RECENCY_MS = 5_000

export type FlowRegistryIds = {
  boats?: readonly string[]
  povs?: readonly string[]
  buoys?: readonly string[]
}

export type FlowDisplayKind = FlowTapKind | 'entity'

type FlowEntitySnapshot = {
  id: string
  events: FlowTapEvent[]
}

export type FlowCardModel = {
  id: string
  kind: FlowDisplayKind
  badges: Array<'telem' | 'srt' | 'anchor'>
  telem: FlowTapEvent | null
  srt: FlowTapEvent | null
  srtPlaceholder: 'null' | 'no stream'
}

export type FlowPanelOptions = {
  container: HTMLElement
  /** PiP / pop-out host (sidebar overlay). Falls back to `document.body`. */
  overlayHost?: HTMLElement | null
  getSnapshot: () => unknown
  getRegistryIds?: () => FlowRegistryIds
  /** SRT push (main) — called on the same poll while Live JSON is on. */
  beforePoll?: () => void
  pollMs?: number
}

export type FlowPanelHandle = {
  readonly root: HTMLElement
  refresh: () => void
  setLiveJson: (on: boolean) => void
  isLiveJson: () => boolean
  dispose: () => void
}

const TELEM_KINDS: FlowTapKind[] = ['drone', 'boat', 'buoy']

function readLiveFlag(): boolean {
  try {
    return sessionStorage.getItem(FLOW_LIVE_JSON_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeLiveFlag(on: boolean): void {
  try {
    sessionStorage.setItem(FLOW_LIVE_JSON_STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* private mode / quota */
  }
}

function clampPollMs(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return FLOW_POLL_MS
  }
  return Math.max(FLOW_POLL_MS, Math.floor(raw))
}

export function formatReceivedAt(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  try {
    return `${new Date(ms).toISOString()} (${Math.round(ms)})`
  } catch {
    return String(Math.round(ms))
  }
}

function redactSrtLikeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (/^srt:\/\//i.test(value) || /streamid=/i.test(value)) {
      return redactSrtUrl(value)
    }
    return value
  }
  if (Array.isArray(value)) return value.map(redactSrtLikeValue)
  if (value != null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactSrtLikeValue(child)
    }
    return out
  }
  return value
}

export function formatFlowJson(body: unknown): string {
  if (body === undefined) return 'null'
  try {
    return JSON.stringify(redactSrtLikeValue(body), null, 2) ?? 'null'
  } catch {
    return 'null'
  }
}

function isFlowEvent(value: unknown): value is FlowTapEvent {
  if (value == null || typeof value !== 'object') return false
  const rec = value as Record<string, unknown>
  return typeof rec.id === 'string' && typeof rec.kind === 'string'
}

function isEntitySnapshot(value: unknown): value is FlowEntitySnapshot {
  if (value == null || typeof value !== 'object') return false
  const rec = value as Record<string, unknown>
  return typeof rec.id === 'string' && Array.isArray(rec.events)
}

/** Accept TEL-10 `FlowTapEvent[]`, `{ entities }`, or grouped snapshots. Empty if missing. */
export function normalizeFlowSnapshot(raw: unknown): FlowEntitySnapshot[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    if (raw.length === 0) return []
    if (isEntitySnapshot(raw[0])) {
      return (raw as FlowEntitySnapshot[]).filter(
        (row) => row && typeof row.id === 'string',
      )
    }
    if (isFlowEvent(raw[0])) {
      const byId = new Map<string, FlowTapEvent[]>()
      for (const ev of raw as FlowTapEvent[]) {
        if (!isFlowEvent(ev)) continue
        const id = ev.id.trim()
        if (!id) continue
        const list = byId.get(id) ?? []
        list.push(ev)
        byId.set(id, list)
      }
      return [...byId.entries()].map(([id, events]) => ({ id, events }))
    }
    return []
  }
  if (typeof raw === 'object' && raw !== null && 'entities' in raw) {
    return normalizeFlowSnapshot((raw as { entities: unknown }).entities)
  }
  return []
}

function latestOf(
  events: readonly FlowTapEvent[],
  kinds: readonly FlowTapKind[],
): FlowTapEvent | null {
  let best: FlowTapEvent | null = null
  for (const ev of events) {
    if (!kinds.includes(ev.kind)) continue
    if (!best || ev.receivedAtMs >= best.receivedAtMs) best = ev
  }
  return best
}

function displayKindFor(
  id: string,
  events: readonly FlowTapEvent[],
  registry: FlowRegistryIds,
): FlowDisplayKind {
  const kinds = new Set(events.map((e) => e.kind))
  if (kinds.has('drone')) return 'drone'
  if (kinds.has('boat')) return 'boat'
  if (kinds.has('buoy')) return 'buoy'
  const buoys = registry.buoys ?? []
  const boats = registry.boats ?? []
  const povs = registry.povs ?? []
  if (buoys.includes(id)) return 'buoy'
  if (boats.includes(id)) return 'boat'
  if (povs.includes(id)) return 'drone'
  if (kinds.has('srt') || kinds.has('anchor')) return 'drone'
  return 'entity'
}

function newestReceivedAtMs(events: readonly FlowTapEvent[]): number | null {
  let best: number | null = null
  for (const ev of events) {
    if (typeof ev.receivedAtMs !== 'number' || !Number.isFinite(ev.receivedAtMs)) {
      continue
    }
    if (best == null || ev.receivedAtMs > best) best = ev.receivedAtMs
  }
  return best
}

export function buildFlowCards(
  snapshot: unknown,
  registry: FlowRegistryIds = {},
  nowMs: number,
): FlowCardModel[] {
  const entities = normalizeFlowSnapshot(snapshot)
  const byId = new Map(entities.map((e) => [e.id, e.events]))
  const registryIds = new Set<string>()
  for (const id of registry.povs ?? []) {
    if (id) registryIds.add(id)
  }
  for (const id of registry.boats ?? []) {
    if (id) registryIds.add(id)
  }
  for (const id of registry.buoys ?? []) {
    if (id) registryIds.add(id)
  }
  const ids = new Set(registryIds)
  const recencyOk = Number.isFinite(nowMs)
  for (const [id, events] of byId) {
    if (registryIds.has(id)) continue
    if (!recencyOk) continue
    const newest = newestReceivedAtMs(events)
    if (newest != null && nowMs - newest <= FLOW_CARD_RECENCY_MS) ids.add(id)
  }

  const cards: FlowCardModel[] = []
  for (const id of ids) {
    const events = byId.get(id) ?? []
    const kind = displayKindFor(id, events, registry)
    const telem = latestOf(events, TELEM_KINDS) ?? latestOf(events, ['anchor'])
    const srt = latestOf(events, ['srt'])
    const badges: FlowCardModel['badges'] = []
    if (latestOf(events, TELEM_KINDS)) badges.push('telem')
    if (srt) badges.push('srt')
    if (latestOf(events, ['anchor'])) badges.push('anchor')
    const srtPlaceholder: FlowCardModel['srtPlaceholder'] =
      kind === 'boat' || kind === 'buoy' ? 'no stream' : 'null'
    cards.push({ id, kind, badges, telem, srt, srtPlaceholder })
  }
  cards.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  return cards
}

type CardWidgets = {
  root: HTMLElement
  kindEl: HTMLElement
  idEl: HTMLElement
  badgesEl: HTMLElement
  chevron: HTMLElement
  popBtn: HTMLButtonElement
  body: HTMLElement
  telemPre: HTMLPreElement
  telemAt: HTMLElement
  srtPre: HTMLPreElement
  srtAt: HTMLElement
  expanded: boolean
  popped: boolean
  popLeft: number
  popTop: number
}

/**
 * Right-rail Flow section. Live JSON toggle (sessionStorage). Per-id cards
 * with collapse + optional draggable pop-out. DOM-only — never NDI.
 */
export function startFlowPanel(options: FlowPanelOptions): FlowPanelHandle {
  const pollMs = clampPollMs(options.pollMs)
  const overlayHost = options.overlayHost ?? document.body
  const cards = new Map<string, CardWidgets>()
  let liveOn = readLiveFlag()
  let popOffset = 0

  const root = document.createElement('div')
  root.className = 'flow-panel'
  root.setAttribute('data-ops', 'flow')

  const toggleRow = document.createElement('label')
  toggleRow.className = 'flow-panel__toggle'
  const toggle = document.createElement('input')
  toggle.type = 'checkbox'
  toggle.setAttribute('data-ops', 'flow-live-json')
  toggle.checked = liveOn
  const toggleText = document.createElement('span')
  toggleText.textContent = 'Live JSON'
  toggleRow.append(toggle, toggleText)
  root.appendChild(toggleRow)

  const hint = document.createElement('p')
  hint.className = 'flow-panel__hint'
  hint.textContent =
    'Ops-only (DOM). Never on the AR plate / NDI. Off by default. ≤4 Hz. Tokens redacted.'
  root.appendChild(hint)

  const body = document.createElement('div')
  body.className = 'flow-panel__body'
  body.setAttribute('data-ops', 'flow-body')
  root.appendChild(body)

  options.container.appendChild(root)

  function applyLiveChrome(): void {
    body.hidden = !liveOn
    if (!liveOn) {
      body.replaceChildren()
      for (const card of cards.values()) {
        card.root.remove()
      }
      cards.clear()
    }
  }

  function applyExpanded(card: CardWidgets): void {
    card.body.hidden = !card.expanded && !card.popped
    card.chevron.textContent = card.expanded || card.popped ? '▾' : '▸'
    card.root.classList.toggle('flow-panel__card--open', card.expanded || card.popped)
  }

  function applyPop(card: CardWidgets): void {
    card.root.classList.toggle('flow-panel__card--pop', card.popped)
    card.popBtn.textContent = card.popped ? 'Dock' : 'Pop out'
    if (card.popped) {
      card.root.style.left = `${card.popLeft}px`
      card.root.style.top = `${card.popTop}px`
      overlayHost.appendChild(card.root)
    } else {
      card.root.style.left = ''
      card.root.style.top = ''
      body.appendChild(card.root)
    }
    applyExpanded(card)
  }

  function bindDrag(card: CardWidgets): void {
    let drag: { pointerId: number; dx: number; dy: number } | null = null
    const header = card.root.querySelector('.flow-panel__card-header')
    if (!(header instanceof HTMLElement)) return
    header.addEventListener('pointerdown', (ev) => {
      if (!card.popped) return
      if (ev.button !== 0) return
      const t = ev.target as HTMLElement | null
      if (t && (t.closest('button') || t.tagName === 'BUTTON')) return
      ev.preventDefault()
      drag = {
        pointerId: ev.pointerId,
        dx: ev.clientX - card.popLeft,
        dy: ev.clientY - card.popTop,
      }
      header.setPointerCapture(ev.pointerId)
    })
    header.addEventListener('pointermove', (ev) => {
      if (!drag || ev.pointerId !== drag.pointerId) return
      card.popLeft = Math.max(8, ev.clientX - drag.dx)
      card.popTop = Math.max(8, ev.clientY - drag.dy)
      card.root.style.left = `${card.popLeft}px`
      card.root.style.top = `${card.popTop}px`
    })
    const stop = (ev: PointerEvent) => {
      if (!drag || ev.pointerId !== drag.pointerId) return
      drag = null
    }
    header.addEventListener('pointerup', stop)
    header.addEventListener('pointercancel', stop)
  }

  function makeCard(id: string): CardWidgets {
    const article = document.createElement('article')
    article.className = 'flow-panel__card'
    article.setAttribute('data-flow-id', id)

    const header = document.createElement('div')
    header.className = 'flow-panel__card-header'

    const toggleBtn = document.createElement('button')
    toggleBtn.type = 'button'
    toggleBtn.className = 'flow-panel__card-toggle'
    toggleBtn.setAttribute('data-ops', 'flow-card-toggle')

    const chevron = document.createElement('span')
    chevron.className = 'flow-panel__chevron'
    chevron.textContent = '▸'

    const kindEl = document.createElement('span')
    kindEl.className = 'flow-panel__kind'

    const idEl = document.createElement('span')
    idEl.className = 'flow-panel__id'
    idEl.textContent = id

    toggleBtn.append(chevron, kindEl, idEl)

    const badgesEl = document.createElement('span')
    badgesEl.className = 'flow-panel__badges'

    const popBtn = document.createElement('button')
    popBtn.type = 'button'
    popBtn.className = 'flow-panel__pop'
    popBtn.setAttribute('data-ops', 'flow-pop')
    popBtn.textContent = 'Pop out'

    header.append(toggleBtn, badgesEl, popBtn)

    const cardBody = document.createElement('div')
    cardBody.className = 'flow-panel__card-body'

    const telemBlock = document.createElement('div')
    telemBlock.className = 'flow-panel__block'
    const telemHead = document.createElement('div')
    telemHead.className = 'flow-panel__block-head'
    const telemLabel = document.createElement('span')
    telemLabel.textContent = 'Telemetry'
    const telemAt = document.createElement('span')
    telemAt.className = 'flow-panel__received'
    telemAt.setAttribute('data-ops', 'flow-telem-at')
    telemHead.append(telemLabel, telemAt)
    const telemPre = document.createElement('pre')
    telemPre.className = 'flow-panel__json'
    telemPre.setAttribute('data-ops', 'flow-telem-json')
    telemBlock.append(telemHead, telemPre)

    const srtBlock = document.createElement('div')
    srtBlock.className = 'flow-panel__block'
    const srtHead = document.createElement('div')
    srtHead.className = 'flow-panel__block-head'
    const srtLabel = document.createElement('span')
    srtLabel.textContent = 'SRT'
    const srtAt = document.createElement('span')
    srtAt.className = 'flow-panel__received'
    srtAt.setAttribute('data-ops', 'flow-srt-at')
    srtHead.append(srtLabel, srtAt)
    const srtPre = document.createElement('pre')
    srtPre.className = 'flow-panel__json'
    srtPre.setAttribute('data-ops', 'flow-srt-json')
    srtBlock.append(srtHead, srtPre)

    cardBody.append(telemBlock, srtBlock)
    article.append(header, cardBody)

    const card: CardWidgets = {
      root: article,
      kindEl,
      idEl,
      badgesEl,
      chevron,
      popBtn,
      body: cardBody,
      telemPre,
      telemAt,
      srtPre,
      srtAt,
      expanded: false,
      popped: false,
      popLeft: 360,
      popTop: 72,
    }

    toggleBtn.addEventListener('click', () => {
      card.expanded = !card.expanded
      applyExpanded(card)
    })
    popBtn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      card.popped = !card.popped
      if (card.popped) {
        card.expanded = true
        card.popLeft = 320 + (popOffset % 5) * 18
        card.popTop = 64 + (popOffset % 5) * 18
        popOffset += 1
      }
      applyPop(card)
    })
    bindDrag(card)
    applyExpanded(card)
    return card
  }

  function paintCard(card: CardWidgets, model: FlowCardModel): void {
    card.kindEl.textContent = model.kind
    card.idEl.textContent = model.id
    card.badgesEl.replaceChildren()
    for (const name of model.badges) {
      const b = document.createElement('span')
      b.className = 'flow-panel__badge'
      b.setAttribute('data-flow-badge', name)
      b.textContent = name
      card.badgesEl.appendChild(b)
    }
    if (model.telem) {
      card.telemAt.textContent = formatReceivedAt(model.telem.receivedAtMs)
      card.telemPre.textContent = formatFlowJson(model.telem.body)
    } else {
      card.telemAt.textContent = '—'
      card.telemPre.textContent = 'null'
    }
    if (model.srt) {
      card.srtAt.textContent = formatReceivedAt(model.srt.receivedAtMs)
      card.srtPre.textContent = formatFlowJson(model.srt.body)
    } else {
      card.srtAt.textContent = '—'
      card.srtPre.textContent =
        model.srtPlaceholder === 'no stream' ? '"no stream"' : 'null'
    }
  }

  function render(): void {
    if (!liveOn) return
    options.beforePoll?.()
    const models = buildFlowCards(
      options.getSnapshot(),
      options.getRegistryIds?.() ?? {},
      Date.now(),
    )
    const seen = new Set<string>()
    for (const el of [...body.querySelectorAll(':scope > .flow-panel__hint')]) {
      el.remove()
    }
    for (const model of models) {
      seen.add(model.id)
      let card = cards.get(model.id)
      if (!card) {
        card = makeCard(model.id)
        cards.set(model.id, card)
        if (!card.popped) body.appendChild(card.root)
      }
      paintCard(card, model)
    }
    for (const [id, card] of [...cards]) {
      if (seen.has(id)) continue
      card.root.remove()
      cards.delete(id)
    }
    if (models.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'flow-panel__hint'
      empty.textContent = 'No entities yet (fleet empty and tap idle).'
      body.appendChild(empty)
    }
  }

  function setLiveJson(on: boolean): void {
    liveOn = on
    toggle.checked = on
    writeLiveFlag(on)
    applyLiveChrome()
    if (on) render()
  }

  toggle.addEventListener('change', () => {
    setLiveJson(toggle.checked)
  })

  applyLiveChrome()
  if (liveOn) render()

  const timer = window.setInterval(() => {
    if (liveOn) render()
  }, pollMs)

  return {
    root,
    refresh: () => {
      if (liveOn) render()
    },
    setLiveJson,
    isLiveJson: () => liveOn,
    dispose(): void {
      window.clearInterval(timer)
      for (const card of cards.values()) card.root.remove()
      cards.clear()
      root.remove()
    },
  }
}
