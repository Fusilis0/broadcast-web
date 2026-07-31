# Dispatch DSP-OUT-20260731-05-transparent-ndi-alpha-send

**Status:** Done / archived (2026-07-31) — accepted; human vMix alpha Results pending → then 7.6

## Meta
- From orchestrator: OUT (BW: Phase **7.3b** → toward **7.5**)
- Worker role: WORKER(DSP-OUT-20260731-05-transparent-ndi-alpha-send)
- Priority: P0
- Phase: Phase 7.3 / 7.5 — transparent plate + named alpha NDI
- Related: `docs/architecture/ndi-alpha-electron.md`; desktop shell (7.3a done)
- Prior: `DSP-OUT-20260731-04` accepted — shell + contract, no SDK

## Goal

1. Add SPA **transparent** clear mode (alpha 0 plate; opaque AR + 8×8 timecode).  
2. Wire **NDI SDK** send from the Electron studio path so vMix/OBS sees a **named** source with **alpha** (not green-key).  
3. Draft a short **vMix alpha ingest** checklist; keep chroma Chrome path as fallback.

If NDI SDK install/licensing blocks the machine, land (1) + checklist stub, report blocker for (2), do not invent a fake sender.

## Background

- End-state lock: **A + alpha NDI** ([`ndi-path-evaluation.md`](../../ops/ndi-path-evaluation.md)).
- Shell: `desktop/` — `npm run desktop:dev` loads SPA.
- Contract: [`ndi-alpha-electron.md`](../../architecture/ndi-alpha-electron.md).
- Path B still deferred. C closed.

## In scope

1. **`outputMode=transparent`** (name may match contract; wire through normalize/config/deeplink/OUT control as existing modes do)
   - WebGL clear alpha `0`; AR + timecode remain opaque
   - Do not break `chroma` / `preview`
2. **Electron → NDI** (preferred path for this slice)
   - Named source (document default name)
   - Frames from WebGL/canvas → BGRA (or SDK alpha-capable format) → NDI send
   - Native addon / binding approach is worker choice; document in README + contract update
3. **`docs/ops/vmix-ndi-alpha-runbook.md`** (or section in existing ops doc) — alpha ingest, no chroma key on NDI input
4. Update `ndi-alpha-electron.md` status + `desktop/README.md` run notes

## Out of scope

- Path B helper
- Production cutover / killing chroma air
- Full electron-builder release polish
- 5.4 egress, 6.4 DB
- Perfect GPU zero-copy if CPU readback works for spike

## Likely files

- `src/output/**` (clear modes)
- `desktop/**` (main, native, package deps)
- `docs/architecture/ndi-alpha-electron.md`
- `docs/ops/vmix-ndi-alpha-runbook.md` (new)
- tests for outputMode normalize if present

## Acceptance criteria

- [ ] `outputMode=transparent` clears with alpha 0; chroma/preview unchanged
- [ ] Electron studio path publishes a **named NDI** source with alpha (or blocked with explicit SDK reason + transparent still shipped)
- [ ] Timecode still sharp on sent frames (or on transparent canvas if SDK blocked)
- [ ] vMix/OBS alpha ingest notes exist; chroma remains documented fallback
- [ ] No green-key as the production NDI mode

## Report back

Standard five sections. Note SDK version / binding used. Suggest 7.6 cutover DSP only if send is studio-usable.

## Worker paste block

```
You are WORKER(DSP-OUT-20260731-05-transparent-ndi-alpha-send).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260731-05-transparent-ndi-alpha-send.md
2. docs/architecture/ndi-alpha-electron.md
3. docs/ops/ndi-path-evaluation.md
4. desktop/README.md
5. src/output/README.md

Deliver: transparent clear mode + Electron named alpha NDI send (or transparent + SDK blocker report).
Chroma stays fallback. No path B. Report back per dispatch.
```
