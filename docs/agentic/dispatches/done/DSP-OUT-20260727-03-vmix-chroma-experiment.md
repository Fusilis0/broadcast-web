# Dispatch DSP-OUT-20260727-03-vmix-chroma-experiment

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260727-03-vmix-chroma-experiment)
- Priority: P0
- Phase: Phase 3.5 — Local vMix chroma experiment (OUT docs + human studio run)
- Related handoffs: HO-OUT-BW-20260727-02 (BW: studio ready → open 3.5)
- Status: **DONE** — worker runbook 2026-07-27; **human studio Pass 2026-07-30** (OBS chroma key; BW/OUT accepted). Milestone C met.
- BW ask: Chrome fullscreen → chroma → vMix window capture → key green → confirm AR + visual timecode; **no WHEP**, **no NDI helper**
  - Note: studio used **OBS** instead of vMix (accepted equivalent).

## Goal

Produce a short **studio runbook** and pass/fail checklist so a human can prove the web-on-air chroma path: fullscreen Chrome, `outputMode=chroma`, vMix window capture, key on clear green, AR content and the 8×8 visual timecode readable over the keyed plate. No product feature work beyond docs / tiny ops notes.

## Background

- Roadmap **3.5**; Milestone C partial (chroma experiment recorded). **3.3 WHEP deferred**. Phase **5.3** air runbook can later absorb this.
- Already shipped:
  - **3.1** clear modes — default chroma key `0x00ff00` / RGB `(0, 255, 0)`; preview `0x1a1a1a`
  - **3.2** visual timecode — in-renderer WebGL overlay; defaults `timecodeEnabled: true`, `timecodeCorner: "bottom-right"`, `timecodeSizePx: 96`
  - Runtime OUT control toggles preview/chroma (not persisted); committed `public/config.json` stays `"outputMode": "preview"` unless studio sets chroma for the session
- Capture assumption: **window / screen capture of Chrome** (includes WebGL canvas + HUD chrome). Canvas-only tools also see timecode (in-renderer).
- **No in-browser NDI. No native NDI helper this phase.**

## In scope

1. **Runbook doc** (worker writes): `docs/ops/vmix-chroma-runbook.md` (create `docs/ops/` if missing)
   - Prerequisites: local `npm run dev`, Chrome, vMix on studio PC, mock/replay telemetry OK
   - Steps (locked intent):
     1. Start app (`npm run dev`) → open printed URL in **Chrome**
     2. Prefer **fullscreen** on the output monitor
     3. Set **chroma**: runtime OUT **output** control → `chroma`, **or** session config `"outputMode": "chroma"` (reload). Do not require committing chroma as default
     4. Confirm clear is solid green behind AR
     5. In **vMix**: capture the Chrome **window** (or screen region covering the WebGL view)
     6. Apply **chroma key** on the expected clear colour
     7. Confirm AR (boats/course/etc.) composites; confirm **8×8** timecode barcode visible and sharp (bottom-right ~96px)
   - **Expected defaults table** (must appear in runbook):

     | Item | Value |
     | --- | --- |
     | Preview clear | `#1a1a1a` / `0x1a1a1a` |
     | Chroma clear (default key) | `#00ff00` / RGB `(0, 255, 0)` / `0x00ff00` |
     | Optional override | `chromaKey` in config |
     | Timecode | enabled `true`; corner `bottom-right`; size `96` px |
     | Timecode encode | Unity 8×8 LSB; bit 0 bottom-left |

   - **Pass/fail checklist** (checkboxes) covering at least:
     - [ ] App runs; telemetry/scene visible in preview first (optional sanity)
     - [ ] Chroma clear is pure green (no sky/dark bleed in keyed areas)
     - [ ] vMix keys cleanly (minimal spill / hole-punch on green)
     - [ ] AR overlays readable after key
     - [ ] Visual timecode visible, pointy/nearest (not smeared), bottom-right
     - [ ] No reliance on NDI
   - **Results block** for human: date, operator, pass/fail, notes, screenshot paths (optional)
   - Explicit **non-goals**: WHEP underlay, NDI helper, Hetzner deploy, live VPS soak required

2. **Cross-links**
   - One-line pointer from `src/output/README.md` → runbook
   - Optional one line in root `README.md` under Run locally / Studio (only if already has a short ops section — keep tiny)

3. **Report**
   - Worker delivers runbook; does **not** need to run vMix
   - Human fills Results after studio; OUT accepts 3.5 when checklist recorded (pass or documented fail + follow-ups)

## Out of scope

- Changing clear/timecode implementation (unless a doc typo fix)
- Scene content / assets (SCN)
- TEL / WSS / live multi-URL
- WebRTC WHEP (3.3)
- Native NDI helper / in-browser NDI
- Phase 5.3 full air runbook rewrite (may cite this doc later)
- Committing unless human asks

## Likely files

- `docs/ops/vmix-chroma-runbook.md` (**new**, primary deliverable)
- `src/output/README.md` — link to runbook
- Optional: root `README.md` one-liner

## Inputs provided

- `src/output/README.md` (3.1 / 3.2 defaults)
- `public/config.json` timecode defaults
- `src/output/types.ts` — `PREVIEW_CLEAR_COLOR`, `DEFAULT_CHROMA_KEY`

## Acceptance criteria

- [ ] `docs/ops/vmix-chroma-runbook.md` exists with steps, defaults table, pass/fail checklist, results block
- [ ] Defaults match shipped code (`#00ff00`, timecode bottom-right 96, etc.)
- [ ] States clearly: no WHEP, no NDI
- [ ] `src/output/README.md` links to the runbook
- [ ] No scene/TEL/WHEP/NDI code changes
- [ ] `npm test` + `npm run build` still green if any file touched under `src/` (prefer docs-only)
- [ ] Human studio execution recorded in Results (OUT acceptance may wait on human)

## Report back

1. Summary (runbook path + what human must do next)
2. Files touched
3. Tests (or “docs-only”)
4. Follow-ups (3.3, 5.3 absorb, NDI only if chroma fails studio)
5. Suggested memo bullets for OUT

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-OUT-20260727-03-vmix-chroma-experiment).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260727-03-vmix-chroma-experiment.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. src/output/README.md, src/output/types.ts, public/config.json

Write the Phase 3.5 studio runbook at docs/ops/vmix-chroma-runbook.md
(steps, defaults table, pass/fail checklist, results block).
Link from src/output/README.md. Docs/ops notes only — no WHEP, no NDI,
no scene/TEL feature code. Report back per the dispatch.
```
