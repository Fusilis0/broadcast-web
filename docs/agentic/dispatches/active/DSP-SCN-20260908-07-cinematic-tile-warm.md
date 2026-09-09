# Dispatch DSP-SCN-20260908-07-cinematic-tile-warm

## Meta
- From orchestrator: SCN (BW issued 2026-09-08)
- Worker role: WORKER(DSP-SCN-20260908-07-cinematic-tile-warm)
- Priority: **P0** (operator: tiles popping is the worst look issue)
- Phase: **21.3b** — prefetch from a **repo manifest**; bytes on disk via PLT
- Related: `DSP-PLT-20260908-01-cinematic-tile-disk` (**code-complete 2026-09-08**). Design: `docs/architecture/commercial-video.md` §7
- **Worker result 2026-09-09:** **code-complete.** Manifest regions; Vite GET+POST / Electron IPC; Play waits; lock-tiles during take. Dump URLs for later `contentUrls`. Human Pass = second Play, no pop.

## Goal

When the camera approaches, ion must **not** still be loading. On **project start**, check a **manifest in git**, download **missing** tiles into the PLT cache dir, skip hits. Globe countries = **coarse**. İstanbul ENU = **detailed** (terrain + Aerial + OSM). Then lock-tiles for Play/Record so LOD does not refine mid-shot.

## Background

`TilesRenderer` currently fetches live from ion as SSE changes. `lock-tiles` only **stops updates**; it does not fill the cache. Operator: store **tile ids** in the repo; binaries local, not git; check every project start.

## In scope

1. **Manifest in repo** (no binaries): `public/cinematics/warm/intro-bosphorus.json` (or `src/scene/cinematics/warm/manifest.ts` + JSON). Include:
   - ion assets: World Terrain **1**, Bing Aerial **2**, OSM Buildings **96188** (ENU only)
   - **Regions:** camera geodetic + `errorTarget` (countries coarse, e.g. 32–64; İstanbul current race / buildings 16)
   - Optional **content URL / tile id list** once a dump exists — if the first slice only has regions, that is OK; add an ops **Dump warm URLs** that writes the list for a later commit
2. **On project start** (after origin + token): for each region, pose the cinematic (or a hidden) camera, `tiles.update` until download queue is idle (timeout + status — no throw loop). Globe: **do not** pull İstanbul-detail OSM. ENU region: OSM + Aerial + terrain around the Bosphorus bbox.
3. **Disk (PLT-01 contract):**
   - **Do not import** `getCinematicTileCacheDir` from the SPA entry (`node:fs`).
   - Filename: `cinematicTileCacheFileName(contentUrl)` (SHA-256, strips `access_token` / `*token*` query) — hash in the renderer with the **same** strip rules if you cannot import crypto from Node; or POST URL to a Vite/Electron write helper that uses the PLT helper.
   - Renderer **read:** `GET /cinematic-tiles/${name}` → 200 hit / 404 miss (`desktop:dev` = Vite `.cache`).
   - **Write:** Vite GET-only today. Add a **POST** (dev) and Electron **IPC** (packaged `--file` / userData) so ion bytes land on disk. Do not commit those bytes.
   - Intercept tileset fetch: cache hit → arrayBuffer from GET; miss → ion GET → write → serve.
4. **Play:** do not start the 60 s take until warm has finished **or** show ops status `tiles: warming N/M` and let Play wait. After warm, **lock-tiles** while cinematic is active (restore operator lock-tiles on Off).
5. Tests: manifest parse; skip-if-present; coarse vs İstanbul region flags; no tile fixtures committed. `npm test` new module.

## Out of scope

- Committing tile bytes / `maidens-tower.glb` rules
- Changing intro keyframes (06)
- CesiumJS, Google Photorealistic, NDI, SRT
- Warming the whole planet

## Likely files

- `public/cinematics/warm/intro-bosphorus.json`
- `src/scene/cinematics/warm.ts` (+ test)
- `src/scene/terrain/createTerrain.ts` fetch hook (keep watermask / overlay)
- `src/main.ts` or `createScene.ts` one `warmCinematicTiles()` call on project load
- **Do not** rewrite `intro-bosphorus.json` path (06 owns that file if both chats exist — wait or don’t touch)

## Acceptance criteria

- [ ] Second Play of `intro-bosphorus` over already-warmed regions does **not** show empty/popping globe at country holds (network off or lock-tiles after warm).
- [ ] İstanbul ENU has finer tiles than USA hold (log errorTarget / tile count once).
- [ ] `.cache/cinematic-tiles` (or userData) has files; `git status` clean of those files.
- [ ] Manifest in git has **ids / URLs / regions**, not binaries.
- [ ] AR still gates terrain off.

## Report back

1. Manifest shape (regions vs URL list)
2. Files / cache size order-of-magnitude
3. How to Dump URLs for a later commit
4. Tests
5. Memo bullets for SCN

## Worker paste

```
Role: WORKER(DSP-SCN-20260908-07-cinematic-tile-warm)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260908-07-cinematic-tile-warm.md
3. docs/architecture/commercial-video.md §7
4. docs/agentic/dispatches/active/DSP-PLT-20260908-01-cinematic-tile-disk.md
5. src/scene/terrain/createTerrain.ts
6. src/platform/cinematicTileCache.ts
7. src/platform/README.md

Start only after PLT-01 (in tree). Manifest in repo; tile bytes on disk not git. Do not import getCinematicTileCacheDir from the SPA. Renderer GET /cinematic-tiles/<sha256>. Write via Vite POST (dev) + Electron IPC (packaged userData). Countries coarse; Istanbul detailed. Lock-tiles while cinematic plays. Do not retouch intro-bosphorus.json. No MP4.

Implement that dispatch only.
```
