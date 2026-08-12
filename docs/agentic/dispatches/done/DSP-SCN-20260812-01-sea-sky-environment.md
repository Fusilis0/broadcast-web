# Dispatch DSP-SCN-20260812-01-sea-sky-environment

## Meta
- From orchestrator: BW → SCN (Phase 13.2)
- Worker role: WORKER(DSP-SCN-20260812-01-sea-sky-environment)
- Priority: P1
- Phase: Phase 13 — Multi-channel output
- Prerequisite: none
- Parallel-safe with: `DSP-OUT-20260812-01`, `DSP-PLT-20260812-01`
- **Not parallel with:** `DSP-SCN-20260812-02` (both edit `createScene.ts` / scene mount) — run overlay DSP **after** this one lands
- Design: `docs/architecture/realistic-3d-environment.md`
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 418+23 green; env API ready for 13.3)

## Goal

Add a toggleable **sea + sky model** to the existing Three.js scene (same boats/course/camera —
**not** a new render pipeline). Default **off** so AR/chroma transparent clears stay correct;
when on, it dresses the opaque/`preview` look to match the "realistic model sea" reference.

## Background

- Today: `src/scene/course/waterCue.ts` = small tinted pad; sky = clear color only.
- User + BW: "just adding sea model to 3d environment basically" — reuse scene, add environment.
- Hard constraint: environment meshes must **not** draw when the active clear needs transparency
  (`outputMode === 'transparent'`) or chroma key (`chroma`) — would break AR alpha.
- Prefer `three/examples/jsm/objects/Water.js` + `Sky.js` (already on `three` dep) — no new npm
  package unless absolutely required (justify in report if you add one).
- Course `waterCue` pad may remain as a crisp local tint **on top of** the large ocean, or be
  hidden when realistic mode is on — pick one, document it.

## In scope

1. New SCN module (e.g. `src/scene/environment/realisticEnvironment.ts`) that creates/disposes
   Water + Sky (+ optional light fog), mounted from `createScene`.
2. Scene API: `setEnvironmentMode('simple' | 'realistic')` / `getEnvironmentMode()` (naming may
   match design doc). Default `'simple'`.
3. When mode is `'realistic'` **and** clear is opaque-safe (`preview` or a future dedicated 3D
   opaque path): show environment. When `transparent` / `chroma`: **force hide/unmount** even if
   mode is realistic (no alpha pollution).
4. Ops (or World/Assets-adjacent) UI toggle: "Environment: Simple | Realistic" — temporary Ops
   checkbox is fine until the 3-way switcher (13.5) exists. Optional `?env=realistic` for boot.
5. Sane fixed defaults tuned toward shaded grey-blue sea (not photoreal). No full weather UI.
6. Tests: mode defaults; transparent clear path does not keep opaque env meshes visible; dispose
   on remount if that matches existing course patterns.
7. Docs: `src/scene/README.md` (+ short note in features/course README if useful).

## Out of scope

- Multi-sender NDI / wiring a separate 3D NDI channel (OUT 13.1 / 13.3).
- AR calibration coordinate overlay (`DSP-SCN-20260812-02`).
- Changing studio resolution or outputMode enum beyond gating the env.
- Leaderboards / broadcast graphics from the reference image.
- Editing Electron `desktop/` (OUT/PLT).

## Likely files

- New: `src/scene/environment/*` (+ test)
- Edit: `src/scene/createScene.ts`, `src/main.ts` (wire toggle), `src/scene/stubHud.ts` or Ops
  sidebar section, `src/style.css` (minimal), `src/scene/README.md`
- Optional touch: `src/scene/course/waterCue.ts` (interaction with realistic ocean)

## Inputs provided

- `docs/architecture/realistic-3d-environment.md`
- `docs/architecture/multi-output-streaming.md` §2 (3D = same scene + opaque + sea)

## Acceptance criteria

- [ ] Realistic sea+sky can be toggled on in `preview` without breaking boat/course render
- [ ] With `outputMode=transparent` (and chroma), environment is forced off / not drawn opaque
- [ ] Default boot behavior unchanged (`simple`)
- [ ] `npm test` + `npm run build` green
- [ ] Brief README note on the hard AR constraint

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers (API names for OUT 13.3)
5. Suggested memo bullets for SCN
