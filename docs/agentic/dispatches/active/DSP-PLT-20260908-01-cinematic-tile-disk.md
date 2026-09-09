# Dispatch DSP-PLT-20260908-01-cinematic-tile-disk

## Meta
- From orchestrator: PLT (BW issued 2026-09-08)
- Worker role: WORKER(DSP-PLT-20260908-01-cinematic-tile-disk)
- Priority: **P0**
- Phase: **21.3a** — local ion tile cache **directory**, not the warm cameras
- Related: `docs/architecture/commercial-video.md` §7. SCN warm: `DSP-SCN-20260908-07`
- **Worker result 2026-09-08:** **code-complete.** `getCinematicTileCacheDir` Node-only. Vite `GET /cinematic-tiles/*`. Filename SHA-256 minus token query. Packaged `--file` still needs SCN-07 IPC/protocol for userData.

## Goal

Studio must keep Cesium ion **tile bytes on disk** (the ones the cinematic uses most). **Not in git.** Repo only holds a manifest later (SCN-07). On start, SCN will check/download; this DSP only makes a **stable cache path** and gitignore.

## In scope

1. Cache directory:
   - Electron: `app.getPath('userData')/cinematic-tiles/`
   - `npm run dev` (Vite): repo-adjacent `.cache/cinematic-tiles/` (create on first use)
2. **`.gitignore`** `.cache/cinematic-tiles/` and any Electron copy under the repo. Never commit `.terrain` / ion content.
3. Small helper exported for SCN: `getCinematicTileCacheDir(): string` (absolute). Document in `src/` README one-liner or `docs/ops` if there is already a platform note — do not invent a new orchestrator.
4. If Vite needs a plugin so the renderer can `GET /cinematic-tiles/...` mapped to that folder, add it. Do **not** fetch ion here.
5. Tests: path is absolute; gitignore contains the folder; helper does not throw if the dir is missing (create or let SCN create).

## Out of scope

- Prefetch cameras, SSE, lock-tiles, sequence JSON (SCN-07)
- Pins, spline, MP4
- Putting tile files in `public/`

## Likely files

- `.gitignore`
- `src/platform/cinematicTileCache.ts` (or `desktop/` + a tiny shared path module)
- Vite config only if a static-map is required

## Acceptance criteria

- [ ] Cache dir is outside git; `git status` does not pick up a dummy file there after helper create.
- [ ] SCN-07 can import the path helper without Electron-only crash in Vitest (return `.cache/cinematic-tiles` under cwd in node).
- [ ] `npm test` for the new module.

## Report back

1. Path Electron vs Vite
2. Files
3. How SCN should write a tile file (filename convention — URL hash is OK)
4. Memo bullets for PLT

## Worker paste

```
Role: WORKER(DSP-PLT-20260908-01-cinematic-tile-disk)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-PLT-20260908-01-cinematic-tile-disk.md
3. docs/architecture/commercial-video.md §7

Cache dir for cinematic ion tiles: Electron userData, Vite .cache/cinematic-tiles. Gitignore the binaries. Export getCinematicTileCacheDir. Do not prefetch. Do not touch Three.js or intro-bosphorus.json.

Implement that dispatch only.
```
