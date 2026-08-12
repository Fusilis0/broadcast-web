# Dispatch DSP-TEL-20260811-01-buoy-telemetry

## Meta
- From orchestrator: BW → TEL (Phase 11.2)
- Worker role: WORKER(DSP-TEL-20260811-01-buoy-telemetry)
- Priority: P1
- Phase: Phase 11 — Unified ops sidebar & universal asset pipeline
- Independent of the sidebar shell — can run in parallel with `DSP-SCN-20260811-01`
- Design doc: `docs/architecture/unified-ops-sidebar.md` §5
- **Status: DONE** — worker complete + BW accepted 2026-08-11

## Goal

Buoys float and drag on the sea just like boats, and in real life carry the same kind of GPS
tracker. Add a `buoy` telemetry kind that reuses the **existing boat packet shape**
(`BoatTelemetry`: lat/lon/alt/spd/brg/id) rather than inventing a new wire format, so SCN can bind a
placed buoy (from the future 2D-map buoy tool, `DSP-SCN-20260811-02`) to a live id and have it move
with real telemetry — or leave it unbound and stay at its placed static point.

## Background

- `src/telemetry/types.ts` — `BoatTelemetry` shape (lat/lon/alt/acc/spd/brg/time/id/t_sync/t_err).
- `src/telemetry/bus.ts` / `ingest.ts` — current bus channels: `drone`, `boat`, `stream_anchor`.
  Router classifies packets by shape/`type` field (see `router.ts`).
- `src/pose/pipeline.ts` — converts `boat`/`drone` bus events into ENU poses on `poseBus`.
- Boat ids and buoy ids must not collide in the same namespace as ordinary race boats — a buoy is a
  distinct asset class even though the wire shape is identical.

## In scope

1. Add a `buoy` telemetry bus channel (same payload shape as `boat`) — either a new `router.ts`
   classification key (e.g. packets whose `id` matches a project's configured buoy-id set) or a
   thin wrapper type `BuoyTelemetry = BoatTelemetry` with its own bus topic. Prefer the simplest
   correct option; document the classification rule you pick (likely: caller tells ingest which ids
   are buoys, same pattern as `povIds`/`boatIds` allow-lists today).
2. Extend `src/pose/pipeline.ts` (or add a small parallel path) so `buoy` packets produce
   `poseBus` events with `kind: 'buoy'` (extend the `PoseEvent` union additively — do not break
   existing `drone`/`boat` consumers).
3. Extend ingest config plumbing (`src/telemetry/ingest.ts`, `src/config/types.ts`/`loadConfig.ts`)
   with an optional `buoyIds` allow-list, mirroring how `boatIds`/`povIds` already work. Empty/
   absent = no buoy channel opened (fully backward compatible; no behavior change for existing
   projects).
4. Mock/replay support: extend `mockSource.ts` (or a small addition) so `telemetryMode=mock` can
   emit a demo buoy packet or two, useful for SCN/PLT to develop against without live hardware.
5. Tests for the new channel (bus routing, pose mapping, allow-list gating) mirroring existing boat
   tests (`multiBoat.test.ts`, `pose.test.ts` patterns).
6. Docs: `src/telemetry/README.md`, `src/pose/README.md` — note buoy = boat-shaped packet, separate
   id namespace, no new wire format.

## Out of scope

- Any UI (buoy placement tool, live-bind picker in Assets details) — SCN's job
  (`DSP-SCN-20260811-02`/`-03`).
- Physics/drag simulation beyond telemetry-driven position (per design doc §5, non-goal).
- RaceProject schema change for buoy static/fallback points — that's additive JSON SCN can add
  later on `WorldFeature` (`type: 'buoy'`); this dispatch is telemetry-only.

## Likely files

- Edit: `src/telemetry/types.ts`, `bus.ts`, `router.ts`, `ingest.ts`, `mockSource.ts`,
  `src/config/types.ts`, `loadConfig.ts`, `src/pose/pipeline.ts`, `src/pose/types.ts` (if `PoseEvent`
  kind union lives there)
- New/edit tests: `src/telemetry/*.test.ts`, `src/pose/pose.test.ts`
- Docs: `src/telemetry/README.md`, `src/pose/README.md`

## Inputs provided

- `docs/architecture/unified-ops-sidebar.md` §5 (buoy design rationale).
- Existing boat pipeline as the template: `src/telemetry/multiBoat.test.ts`,
  `src/pose/pipeline.ts` boat handling.

## Acceptance criteria

- [ ] `buoy` packets (boat-shaped) route to a distinct `poseBus` `kind: 'buoy'` event
- [ ] Buoy ids configurable via an allow-list; empty/absent list opens no buoy channel (no
      regression for projects without buoys)
- [ ] Existing `drone`/`boat`/`stream_anchor` behavior unchanged (full existing suite still green)
- [ ] Mock mode can emit at least one demo buoy packet for local dev
- [ ] `npm test` + `npm run build` green
- [ ] README notes: buoy = boat wire shape, own id namespace, no drag physics in this slice

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for TEL

## Worker paste block

```
You are WORKER(DSP-TEL-20260811-01-buoy-telemetry).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-TEL-20260811-01-buoy-telemetry.md
2. docs/architecture/unified-ops-sidebar.md (§5 only, for context)
3. src/telemetry/types.ts, bus.ts, router.ts, ingest.ts
4. src/pose/pipeline.ts

Add a `buoy` telemetry channel reusing the boat packet shape, gated by an id allow-list,
producing poseBus kind:'buoy' events. No UI work. Report back per dispatch.
```
