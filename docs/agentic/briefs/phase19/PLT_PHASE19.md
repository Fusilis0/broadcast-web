# PLT — Phase 19 brief

**Role:** PLT — Platform & DevEx Orchestrator  
**Design:** [`../../../architecture/phase19-senexus-qol.md`](../../../architecture/phase19-senexus-qol.md) §6  
**Also:** charter, `PLT_MEMO.md`, `public/assets/library/README.md`, this file.

You do **not** implement product features in this chat. You may dispatch workers that touch `public/assets/library/`, Electron save I/O, gitignore, and load sequencing **plumbing** — not Three.js art.

## Owns in Phase 19

### 19.16 Library seed + git-trackable uploads

- `public/assets/library/index.json` is empty. Seed from existing:

  `public/textures/sponsors/rolex.png`  
  `public/textures/sponsors/senexus.png`  
  `public/textures/sponsors/vodafone.png`

- Files under `public/assets/library/` must **not** be gitignored.  
- New Library uploads (API and/or Electron) must write into that tree + `index.json` so another PC gets them on **git pull**. Document the human commit step.  
- SCN consumes the catalogue; you do not build the picker UI.

### 19.17 Instant project switch (with SCN)

Operator pain: **switching project in the list** is slow. UI + 2D map + boat list should appear **immediately**; 3D models may follow.

- If the stall is Electron `races.read` / JSON parse / sync fs — that is **you**.  
- If the stall is SCN remounting the whole scene before painting lists — **handoff SCN**, don’t rewrite the scene graph.

## Does not own

Authoring inspector, NDI, Cesium vendor, calib ranges.

## Suggested dispatches

1. `DSP-PLT-…-library-seed` — copy logos + manifest; gitignore check; README.  
2. `DSP-PLT-…-project-switch-load` only after you (or SCN) **name** the blocking call. If unknown, issue a **read-only investigation** DSP first, not a speculative rewrite.

## Acceptance

- [ ] Library tab can show the three seeded logos without an empty catalogue  
- [ ] Adding a logo via Library leaves files that `git status` can see  
- [ ] Project switch: lists + 2D not blocked on terrain/tiles (with SCN)  

## After worker report

- After **19.16**: tell human **SCN may start 19.11 / 19.7 pickers**. Human: confirm Library shows Rolex / Senexus / Vodafone. **Done 2026-09-02.**
- After **19.17**: human switches `30agustos` (or two local packs) via **Load** (not dropdown change) and confirms list+map appear without waiting for 3D. Then **SCN** if remount still hitchy, else **BW**.

## Paste-ready chat starter

```
Role: PLT — Platform & DevEx Orchestrator

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/ORCHESTRATORS.md
3. docs/agentic/orchestrators/PLT_Platform_DevEx_Orchestrator.md
4. docs/agentic/memos/PLT_MEMO.md
5. docs/architecture/phase19-senexus-qol.md
6. docs/agentic/briefs/phase19/PLT_PHASE19.md
7. docs/agentic/briefs/phase19/README.md
8. public/assets/library/README.md

Phase 19 PLT is library seeding (existing sponsor PNGs, git-trackable uploads) and project-switch load speed. Do not implement src/ in this chat. Do not build the World Authoring picker (SCN). After each worker, tell me to test or to open SCN/BW.
```
