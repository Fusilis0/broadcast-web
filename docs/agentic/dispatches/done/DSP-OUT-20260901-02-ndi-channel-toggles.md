# Dispatch DSP-OUT-20260901-02-ndi-channel-toggles

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260901-02-ndi-channel-toggles)
- Priority: P1
- Phase: Phase **19.4** — Manual NDI AR / 3D / 2D on/off
- Related: Phase 19 design §19.4 · `OUT_PHASE19.md`
- Status: **DONE** 2026-09-02 — suite **1053 + 23**. Human toggle smoke still useful alongside PBO worker.

## Goal

Give the operator independent **hand** on/off for **AR**, **3D**, and **2D** NDI senders in Broadcast → Output. Off stops that channel’s capture/send; on resumes. **Not** persisted on `project.json`. Session (process / `sessionStorage`) OK. Default: all **on** (today’s behaviour).

## Background

- Today NDI start/stop is largely session-lifecycle (`ndiControllerPanel.ts`). 2D may already have a send toggle — bring AR/3D to the same operator model.
- Phase 19 N17 lock: independent switches; not race JSON.

## In scope

1. UI: three independent toggles (AR / 3D / 2D) in the Output / NDI controller surface.
2. Off → that pump stops sending (and does not claim heavy capture); On → resumes.
3. Persist preference in session only (`sessionStorage` or in-memory for process life) — **never** `project.json` / race pack.
4. Default all on on cold start if no session override.
5. Tests for “wanted” flags / start-stop wiring; docs one-liner in `src/output/README.md`.

## Out of scope

- Changing FourCC / stripe fix (19.3)
- Timecode (19.1)
- Raising fps caps
- Scene / PiP / World Authoring

## Likely files

- `src/output/ndiControllerPanel.ts` (+ tests)
- `src/main.ts` — wire wanted flags to pumps
- `src/output/ndiFramePump.ts`, `ndi3dChannelPump.ts`, `streamMapNdiPump.ts` — respect stop/start
- `src/output/README.md`

## Acceptance criteria

- [ ] Three hand toggles; independent
- [ ] Off stops that sender; On resumes
- [ ] Not written to race / `project.json`
- [ ] Default all on
- [ ] `npm test` + `npm run build` green

## Report back

1. Summary
2. Files
3. Tests / how verified
4. Human toggle checklist
5. Suggested OUT memo bullets

## Worker paste block

```
You are WORKER(DSP-OUT-20260901-02-ndi-channel-toggles).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260901-02-ndi-channel-toggles.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/architecture/phase19-senexus-qol.md §19.4
4. src/output/ndiControllerPanel.ts, ndiFramePump.ts, ndi3dChannelPump.ts, streamMapNdiPump.ts

Implement Phase 19.4: independent AR/3D/2D NDI hand toggles; session only; default all on.
No stripe/FourCC work, no timecode. Report back per dispatch.
```
