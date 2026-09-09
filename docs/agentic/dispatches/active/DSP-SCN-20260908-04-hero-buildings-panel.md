# Dispatch DSP-SCN-20260908-04-hero-buildings-panel

## Meta
- From orchestrator: SCN (Phase **20** — not cinematic Phase 21)
- Worker role: WORKER(DSP-SCN-20260908-04-hero-buildings-panel)
- Priority: **P0**
- Worker result: **code done 2026-09-08**. Left **Hero buildings**; offsets on `RaceProject.landmarks.byId`; auto-save skipDownload; SKP textures re-exported (Maiden’s untouched). Tests **101**. SCN **code-accept**. **Human Pass pending.**
- Placement base remains `gpsToEnuAmsl`. Offsets are **authoring**, not a geoid guess.
- No CesiumJS, Google Photorealistic, IBB, ocean rewrite, NDI, SRT, `STUDIO_TICK_FPS`.

## Goal

Left-rail **Hero buildings** panel: list every landmark, **Focus** the free cam on it, edit **X/Y/Z metres** and **yaw/pitch/roll degrees**, persist those offsets on the **RaceProject** (auto-write when the studio can save). Re-export SKP glbs **with textures** (`glb.export(..., textures=True)` — current files dropped them). Panel shows which ids have image textures.

## Background

Operator cannot find heroes in the city. They want a left-menu tab (same rail as Project / Fleet / Assets).

Offsets must be **project-global** (same pack on Load), not session-only. Auto-save: debounce into existing `saveCurrentRaceProject` **when Electron races folder or projects API can write**. Chrome-only must **not** spawn a download on every slider tick — keep in memory + include on next Save; optional `sessionStorage` backup for the session.

**Textures:** original `.skp` files **contain** PNG/JPEG (`Material.texture.data`). OpenSKP `glb.export` default is `textures=False`, so current `public/models/landmarks/*.glb` (except Maiden’s Sketchfab) have **0 images**. Re-export from `C:\Users\PC\Desktop\hero models\*.skp` with `textures=True`. Keep existing mm→m runtime scale unless you also switch export `units`. Maiden’s Tower already has 59 images — do not re-export that one. Rumeli has **no mesh** — stays untextured proxy.

## In scope

1. **Sidebar** — `OPS_RAIL_SECTIONS` left, id `heroes`, label **Hero buildings**, order **35** (between Assets 30 and Library 50). Accordion. Register in `main.ts` like Assets. Tests: section exists on left rail.

2. **Panel** — one row per catalogue id (display name):
   - **Focus** → free cam `frameEnuPoint` on the landmark world position (after offsets), radius from occupancy or AABB (bridges: cap radius so you don’t pull to space).
   - Spinboxes: offset **x y z** (metres, ENU: x east, y up, z −north), **yaw pitch roll** (degrees). Defaults 0.
   - Live apply (no remount of OSM). Occupancy disks follow **offset XZ** (not rotation).
   - Texture chip: `textured` | `no image` | `proxy`.

3. **Scene API** — `setLandmarkPoseOffset(id, { x, y, z, yawDeg, pitchDeg, rollDeg })`, `getLandmarkPoseOffsets()`, `getLandmarkWorldPosition(id)`, `getLandmarkTextureReport()`. Layout: GPS ENU + offset; rotation on the mesh group.

4. **Project persist** — soft `RaceProject.landmarks`:

```ts
landmarks?: {
  byId?: Record<string, {
    offsetM?: { x: number; y: number; z: number }
    yawDeg?: number
    pitchDeg?: number
    rollDeg?: number
  }>
}
```

Parse like `calibration` (junk/omit → ignore). `buildRaceProject` always writes current offsets (omit empty `byId`). Load pack → apply offsets. Debounced auto-save (~400 ms) via existing persist **only if** local races bridge or API write is available. Never auto-download in Chrome.

5. **Re-export SKP textures** — overwrite SKP-derived glbs in `public/models/landmarks/` from Desktop `hero models\*.skp` using OpenSKP `glb.export(skp, path, textures=True)`. Mapping same as DSP-03 dest names. Confirm GLB `images.length > 0` after. Do **not** copy 419 MB Galata folder. Do **not** replace `maidens-tower.glb`.

6. **Docs** — `docs/contracts/race-project.md` one row for `landmarks`. Sidebar README row. Landmark README: texture re-export note.

7. **Tests** — parse/build round-trip offsets; missing field still loads; Focus wiring (or frameEnuPoint called); occupancy uses offset XZ; SKP glbs (except maidens) have images after re-export (or a unit test that reads a fixture). Landmarks + HUD + parseRaceProject tests. Pre-existing library/OUT tsc not yours.

## Out of scope

- Phase 21 cinematic
- GEO / new `altMsl` survey
- Buying new art; Rumeli mesh
- Per-landmark inspector on Assets tab (new section only)

## Texture truth (SCN inspect 2026-09-08)

| id | Has image texture now? | Source |
| --- | --- | --- |
| `maidens-tower` | **Yes** (59 images in glb) | Sketchfab CC-BY |
| All other SKP glbs | **No** (0 images; SKP itself **has** textures — export flag was off) | re-export |
| `rumeli-hisari` | **No file** | proxy |

## Acceptance criteria

- [ ] Left rail **Hero buildings** lists all 13. Focus jumps the 3D cam to that mesh.
- [ ] XYZ + yaw/pitch/roll move the mesh live. Reload pack → offsets still there (Electron save or Load of written `project.json`).
- [ ] Chrome slider does not download a file every nudge.
- [ ] SKP landmarks show SketchUp textures when the SKP had them. Maiden’s unchanged. Rumeli still proxy.
- [ ] Panel (or console report) lists who is `no image` / `proxy`.
- [ ] AR still hides heroes. OSM holes follow XZ offset.

## Worker paste

```
Role: WORKER(DSP-SCN-20260908-04-hero-buildings-panel)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260908-04-hero-buildings-panel.md
3. src/scene/sidebar/railLayout.ts
4. src/scene/landmarks/createLandmarks.ts
5. src/projects/types.ts
6. src/projects/parseRaceProject.ts
7. src/main.ts (sidebar registerSection + saveCurrentRaceProject)

Left rail Hero buildings: Focus + XYZ/yaw/pitch/roll offsets saved on RaceProject.landmarks. Debounced auto-save only when Electron/API can write — no Chrome download spam. Re-export SKP glbs with OpenSKP textures=True. Maiden’s glb stays. Rumeli proxy.

Implement that dispatch only. Not Phase 21. No geoid guess.
```
