# Dispatch DSP-TEL-20260829-02-flow-live-assets

## Meta
- From orchestrator: BW (route to TEL; `flowPanel.ts` is SCN's file — coordinating BW note below)
- Worker role: WORKER(DSP-TEL-20260829-02-flow-live-assets)
- Priority: P1
- Phase: 18.6
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md) · [`HO-TEL-SCN-20260829-01`](../../handoffs/HO-TEL-SCN-20260829-01.md)
- Status: **active** — wave 2
- Note 2026-08-29: `DSP-TEL-20260829-01-telemetry-disconnect` has **landed**, so the out-of-scope warning below is now live, not hypothetical. A drone that the operator deliberately disconnected is still in the registry and **must keep its empty card**. Disconnected ≠ deleted.

## Goal

The Output Flow / Live JSON panel must show the assets that are actually part of the show. The operator reports seeing entries for things that are neither present nor related — for example, a drone that was deleted from the project is still listed.

## Background

BW traced it. The panel unions the current fleet registry with **every id ever seen** by the telemetry tap:

```190:206:src/scene/flowPanel.ts
export function buildFlowCards(
  snapshot: unknown,
  registry: FlowRegistryIds = {},
): FlowCardModel[] {
  const entities = normalizeFlowSnapshot(snapshot)
  const byId = new Map(entities.map((e) => [e.id, e.events]))
  const ids = new Set<string>()
  for (const id of registry.povs ?? []) { if (id) ids.add(id) }
  for (const id of registry.boats ?? []) { if (id) ids.add(id) }
  for (const id of registry.buoys ?? []) { if (id) ids.add(id) }
  for (const id of byId.keys()) ids.add(id)
```

The registry (`main.ts` L1780–1783) is the live fleet, so deleting drone 2 does drop it from that half of the union. But `flowTap`'s ring buffer still holds drone 2's history, the last line adds it straight back, and `flowTap.reset()` is called **only from tests** — never from `main.ts`, never on a project load, never on a fleet change. So the card lives on with stale JSON.

## BW decision on what the panel should show

Do not simply restrict the panel to the registry. Showing an id that is arriving on the wire but is **not** in the fleet is genuinely useful — it is how you notice a producer sending `dji-7` when the fleet says `1`. The rule instead is:

- An id in the current registry: **always** shown, even with no traffic (an empty card, as today).
- An id **not** in the registry: shown **only while it is actively receiving**, within a short recency window. BW's starting value is **5 seconds**; tune it if that flickers, and say what you chose.
- On an explicit fleet change or project load, prune the tap for ids that are gone, so the operator gets immediate feedback rather than waiting out the window.

That satisfies the complaint (a deleted drone stops sending and its card disappears within seconds, or instantly on delete) while keeping the diagnostic value of the panel.

## In scope

1. Give `flowTap` the ability to forget: remove a single id, and retain only a given set of ids. Keep `reset()`. These are TEL-owned APIs in `src/telemetry/flowTap.ts`.
2. Prune the tap when the fleet registry changes — a boat, drone, or buoy deleted from the panel — and when a project is loaded or switched. Wire this in `main.ts`, at the same places that already rebuild the fleet allow-lists.
3. Add the recency rule to `buildFlowCards`: registry ids always, non-registry ids only if they have an event newer than the window. `buildFlowCards` is a pure function — it must take the current time as an argument rather than reading the clock, so it stays testable.
4. Make sure SRT flow cards follow the same rule. `pushSrtFlowSnapshots` (`main.ts` L997–1022) stops pushing for disabled POVs, so those cards should age out; verify they do.
5. Tests: a deleted id disappears; an unknown id that is actively sending still appears; an unknown id that stops sending ages out; a registry id with no traffic still shows an empty card.

## Coordinating BW note

`src/scene/flowPanel.ts` is SCN's file and `src/telemetry/flowTap.ts` is TEL's. The change is one behaviour across both and splitting it would produce two half-working dispatches. BW assigns the pair to this single TEL worker; `HO-TEL-SCN-20260829-01` records it for SCN. Keep the `flowPanel.ts` edit to the card-selection rule and its test — no layout, styling, or panel structure changes.

## `src/main.ts` region lock (BW, 2026-08-29)

You are one of **three** wave-2 workers editing `src/main.ts` in parallel. The original wave plan called wave 2 disjoint; it is not, and BW is resolving that with region locks rather than by serialising the wave.

**Your region only:** the fleet-registry rebuild sites (~L1780–1783), the `buildFlowCards` call site, and `pushSrtFlowSnapshots` (~L997–1022).

**Do not touch, even to tidy:** `onSrtApply` (~L2580–2614), `maybeFallbackSrtDecodeStall` / `beginFfmpegH264Fallback` (~L790–835), `beforeunload` (~L2730–2757) — those belong to `DSP-SRT-20260829-01`. The studio-tick subscriber registrations (~L2061–2301) belong to `DSP-PRF-20260829-01`.

No import reordering, no reformatting, no drive-by renames anywhere in the file. Keep every edit minimal and local so the three sets of changes merge cleanly.

**Semantic coupling to be aware of:** `DSP-SRT-20260829-01` is changing SRT session lifecycle in parallel with you. Scope item 4 asks you to verify SRT flow cards age out when a POV is disabled. Verify that against the code as it stands **now**; if SRT-01 lands a change that alters it, that is a follow-up, not your problem to pre-empt.

## Out of scope

- Panel layout, styling, the Live JSON toggle, or the ≤4 Hz poll rate.
- What the cards display internally (JSON shape, fields, formatting).
- Clearing `telemetryHistory`, `ptsNtpMap`, or the pose bus. The tap is a debug view; the matching buffers are not, and wiping them could mask a real bug.
- The telemetry and SRT Disconnect work (`DSP-TEL-20260829-01`, `DSP-SRT-20260829-01`). If those land first, do not conflate "disconnected" with "not in the registry" — a disconnected but still-configured drone should keep its empty card.

## Likely files

- `src/telemetry/flowTap.ts` + test
- `src/scene/flowPanel.ts` (`buildFlowCards` only) + test
- `src/main.ts` — prune on fleet change and project load; pass the clock into `buildFlowCards`
- `src/telemetry/README.md`

## Inputs provided

- Registry source: `main.ts` L1780–1783 (fleet `boatIds`, `povIds`, `bootConfig.buoyIds`).
- Card removal already works when an id leaves the model set (`flowPanel.ts` L507–511) — the bug is purely that the id never leaves.
- Operator example: drone 2 deleted from the project, still visible in Output Flow Live JSON.

## Acceptance criteria

- [ ] Deleting a drone or boat from the fleet removes its Flow card promptly, without a reload.
- [ ] Loading a different project leaves no card from the previous one.
- [ ] An id that is not in the fleet but is actively arriving on the wire is still shown.
- [ ] That same id disappears once it stops arriving, within the chosen window.
- [ ] A configured id with no traffic still shows an empty card, as today.
- [ ] `buildFlowCards` takes the current time as a parameter and is unit-tested for all four cases above.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human smoke:** with live telemetry running, delete a drone in the Fleet panel and watch Output → Flow. Its card should go within a second or two. A problem would look like the card persisting, or like a genuinely live drone's card flickering in and out.

## Report back

1. The retention rule you implemented and the window you chose
2. Files touched and tests added
3. Where the prune is triggered from
4. Follow-ups / blockers
5. Suggested memo bullets for TEL, plus a bullet SCN can paste for `flowPanel.ts`
