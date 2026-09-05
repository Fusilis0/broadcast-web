# Dispatch DSP-PLT-20260901-01-library-seed

## Meta
- From orchestrator: PLT
- Worker role: WORKER(DSP-PLT-20260901-01-library-seed)
- Priority: P0
- Phase: Phase 19.16 — Senexus studio QoL (library seed + git-trackable uploads)
- Related handoffs: none (BW Wave C; SCN 19.11 / 19.7 pickers unblocked)
- **Status: DONE** — PLT accepted 2026-09-02 → `done/`

## Goal

Seed `public/assets/library/` from the three in-repo sponsor PNGs so the Library tab is not empty, keep that tree **git-tracked**, and make sure new Library uploads (API, and Electron if it writes files) land in the same folder so `git status` shows them and other studio PCs get them on pull.

## Background

- Design: `docs/architecture/phase19-senexus-qol.md` §6 (19.16 / N23–N24)
- Brief: `docs/agentic/briefs/phase19/PLT_PHASE19.md`
- Layout: `public/assets/library/README.md` + `src/assets/library/README.md`
- Storage already exists (Phase 11.3 / `DSP-PLT-20260811-01`): `server/src/assets.ts` writes `image/<slug>-<8hex>.<ext>` + `index.json`. Default dir is repo `public/assets/library/` (`server/src/config.ts`). Root `.gitignore` does **not** currently mention `library/` — keep it that way.
- `public/assets/library/index.json` is `[]`. Source files:
  - `public/textures/sponsors/rolex.png`
  - `public/textures/sponsors/senexus.png`
  - `public/textures/sponsors/vodafone.png`
- Leave originals in `public/textures/sponsors/` (do not delete). Copy into the library tree.
- SCN owns the World Authoring logo **picker UI** — do not build it.

## In scope

1. **Seed** — Copy the three PNGs into `public/assets/library/image/` using the existing naming convention (`<slug>-<shortHash>.png`, same hash as `storeAsset` / `server/src/assets.ts` so a later re-upload of the same bytes would collide cleanly). List them in `index.json` with labels **Rolex**, **Senexus**, **Vodafone**, valid `addedAt` / `sizeBytes` / `id` / `kind` / `filename`. Pretty-print the manifest as today.
2. **Git** — Confirm nothing gitignores `public/assets/library/` (or `*.png` under it). Do not add ignore rules. Seeded files must show as untracked/modified so they can be committed.
3. **Uploads stay in-repo** — Trace POST `/api/assets` (and any Electron write path). Writes must land under repo `public/assets/library/` in the normal studio path (`npm run server` / `desktop:dev` without a custom `PROJECTS_ASSETS_LIBRARY_DIR`). If a path writes to `userData`, `server/data/`, or any gitignored cache, **fix that for the git-trackable studio path** (dev / repo-rooted server). Document that `--file` / userData is a separate air machine and must not be the shared logo store. Do not invent a second library root.
4. **Docs** — Operator step: after upload, **commit** `public/assets/library/index.json` + the new file(s) so other PCs get them on pull. Update `public/assets/library/README.md` and a short note in `docs/ops/projects-api.md` and/or `src/assets/library/README.md`. Library sidebar hint may mention commit if it currently only says “upload writes to public/…”.
5. **Tests** — Manifest parse still green; add or extend a test that seeded `index.json` lists three image entries with those labels (or that a fixture copy of the seed parses). `npm test` + `npm run build` green.

## Out of scope

- World Authoring / Assets details **picker modal** (SCN 19.11 / 19.7)
- Project-switch load speed (19.17 — later PLT DSP)
- New logo art, LFS, deleting `public/textures/sponsors/`
- Auth / OAuth / Hetzner
- Cesium, NDI, calib

## Likely files

- `public/assets/library/index.json`
- `public/assets/library/image/*` (three PNGs)
- `public/assets/library/README.md`
- `docs/ops/projects-api.md`
- `src/assets/library/README.md` and/or `libraryPanel.ts` hint text only if needed for the commit step
- `server/src/assets.ts` / `config.ts` / tests **only if** uploads do not already write to the repo library dir
- `.gitignore` only if you must *remove* a bad ignore (do not add one)

## Inputs provided

- Workspace: `C:\Users\PC\Documents\GitHub\broadcast-web`
- Hash helper: `server/src/assets.ts` (`slugifyFilename` + sha256 slice 0,8)
- Manifest shape in `public/assets/library/README.md`

## Acceptance criteria

- [ ] Library catalogue (static `index.json`) contains Rolex, Senexus, Vodafone image entries pointing at files under `public/assets/library/image/`
- [ ] Those PNGs + `index.json` are **not** gitignored (`git check-ignore` / `git status` would show them)
- [ ] Originals remain at `public/textures/sponsors/`
- [ ] POST `/api/assets` (editor) still writes into `public/assets/library/` + updates `index.json` (existing tests still prove this; fix if a studio path diverted to a cache)
- [ ] Docs tell the operator to commit library files after upload
- [ ] `npm test` + `npm run build` green
- [ ] No World Authoring picker UI

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for PLT

## Worker paste block

```
You are WORKER(DSP-PLT-20260901-01-library-seed).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260901-01-library-seed.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/architecture/phase19-senexus-qol.md §6 (19.16)
4. public/assets/library/README.md
5. server/src/assets.ts

Seed the three sponsor PNGs into public/assets/library/ + index.json. Keep uploads git-trackable. No World Authoring picker. Report back per dispatch.
```
