# Dispatch DSP-PLT-20260811-01-asset-library

## Meta
- From orchestrator: BW → PLT (Phase 11.3)
- Worker role: WORKER(DSP-PLT-20260811-01-asset-library)
- Priority: P0
- Phase: Phase 11 — Unified ops sidebar & universal asset pipeline
- Prerequisite: `DSP-SCN-20260811-01-ops-sidebar-shell` (mounts the Library section)
- Feeds: `DSP-SCN-20260811-02` (billboard-chain texture picker), `DSP-SCN-20260811-03` (details
  texture/model picker)
- Design doc: `docs/architecture/unified-ops-sidebar.md` §6
- **Status: DONE** — worker complete + BW accepted 2026-08-11

## Goal

A **universal** (cross-project) asset library: image/model files uploaded once, stored git-tracked
under `public/assets/library/`, reusable from any project by URL — same idea as today's manually
committed `public/textures/sponsors/*.png`, but with an upload/browse UI and a small server-side
endpoint instead of manual file drops. Ships as a **Library** section in the sidebar
(`DSP-SCN-20260811-01`).

## Background

- `server/src/app.ts` — existing `/api/races` handlers (GET/POST/PUT/DELETE), auth via
  `authorizeWrite` (`server/src/auth.ts`), CORS, JSON body size cap. Follow the same conventions for
  a new `/api/assets` route (auth-gated writes, editor vs air role per existing `WriteAuthTokens`).
- `src/projects/venuePack/collectVenuePackUrls.ts` — `isVenueAssetPath` already recognizes
  `/textures/`, `/models/`, etc. as venue-pack-relevant paths; a new `/assets/library/...` prefix
  should be added to that allow-list so library files referenced by a project are automatically
  swept into venue packs (no separate venue-pack code path needed).
- No existing multipart/file-upload handling in `server/` — this is new. Keep it minimal (no new
  heavy deps if avoidable; Node's built-in stream handling + a small multipart parser, or a light,
  well-known dependency if it meaningfully reduces risk — your call, document the choice).
- Static-only deployments (no `server/` running, just Vite serving `public/`) must not break: the
  Library UI must clearly indicate read-only/browse-only mode when no upload endpoint is reachable.

## In scope

1. **Storage convention** (local disk under the repo, git-trackable):
   `public/assets/library/<kind>/<slug>-<shortHash>.<ext>` where `kind` is `image` | `model`.
   Manifest `public/assets/library/index.json`: array of `{ id, kind, filename, label, addedAt,
   sizeBytes }`. Keep the manifest human-diffable (stable key order, pretty-printed).
2. **Server endpoint** (`server/src/`): `POST /api/assets` (multipart upload, editor-role bearer
   required per existing auth pattern; extension allow-list `png|jpg|jpeg|webp|glb|gltf`; size cap,
   e.g. 20 MB — pick and document a sane limit), `GET /api/assets` (list manifest, no auth — read is
   open like `GET /api/races`). Writes go to `public/assets/library/` relative to the server's
   configured static root (reuse whatever config pattern `server/src/config.ts` already has for
   paths) and update the manifest.
3. **Client library module** (`src/assets/library/` or similar): fetch/list catalogue, upload (when
   an API base is configured — mirror `projectsApiBase` pattern from `src/projects/writeRaceProject.ts`),
   and a helper to resolve a library entry into the URL a `WorldFeature.textureUrl` (or new optional
   `modelUrl`) should use.
4. **Library sidebar section**: browse grid/list (thumbnails for images, filename for models),
   upload button + file picker (hidden when no write endpoint configured — show a clear "browse-only
   (no API configured)" hint per design doc §6), delete is **out of scope** for v1 (append-only is
   fine — avoids orphaned-reference headaches for now).
5. Extend `collectVenuePackUrls.ts`'s `isVenueAssetPath`/prefix allow-list to include
   `/assets/library/`.
6. Tests: server route tests (`server/test/`, mirror `api.test.ts` patterns) for upload/list/
   rejection (bad extension, oversized, unauthorized write); client tests for the library helper and
   venue-pack path recognition.
7. Docs: `server/README.md`, `src/assets/README.md` (or new `src/assets/library/README.md`),
   `docs/ops/projects-api.md` (new endpoint), `docs/architecture/project-api-and-database.md`.

## Out of scope

- Wiring the Library picker into billboard-chain/sponsor/details forms — that's SCN's job in
  `DSP-SCN-20260811-02`/`-03`; this dispatch only needs to expose a clean client helper for them to
  call.
- Delete/replace/versioning of library assets.
- Any change to `RaceProject` schema (library URLs slot into existing `textureUrl` or a new
  additive optional field SCN defines).
- CDN/cloud storage (Hetzner is still deferred, Phase 12).

## Likely files

- New: `server/src/assets.ts` (or similar route module), `server/test/assets.test.ts`,
  `src/assets/library/index.ts` (+ types, test), `public/assets/library/index.json` (seed empty
  `[]` or with a couple of demo entries if convenient), `public/assets/library/README.md`
- Edit: `server/src/app.ts` (wire route), `server/src/config.ts` (storage root/limits if needed),
  `src/projects/venuePack/collectVenuePackUrls.ts`, `server/README.md`, `docs/ops/projects-api.md`

## Inputs provided

- `docs/architecture/unified-ops-sidebar.md` §6 (storage convention, endpoint shape).
- Existing `/api/races` implementation as the pattern to follow for auth/CORS/error shape
  consistency (`server/src/app.ts`, `auth.ts`, `validate.ts`).
- `src/projects/writeRaceProject.ts` as the client-side "optional API base, else local-only" pattern
  to mirror.

## Acceptance criteria

- [ ] `POST /api/assets` accepts an allow-listed file, stores it under
      `public/assets/library/<kind>/…`, updates the manifest, requires editor-role auth like other
      writes
- [ ] `GET /api/assets` lists the manifest, no auth required
- [ ] Bad extension / oversized / unauthorized upload rejected with clear error status (mirror
      existing `/api/races` error shapes)
- [ ] Client library helper lists + resolves URLs; upload works when API base configured, degrades
      to browse-only with a visible message when not
- [ ] `isVenueAssetPath` recognizes `/assets/library/...` — a project referencing a library texture
      pulls it into venue packs automatically
- [ ] `npm test --prefix server` + `npm test` + `npm run build` green
- [ ] Docs updated (server README, projects-api ops doc)

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for PLT

## Worker paste block

```
You are WORKER(DSP-PLT-20260811-01-asset-library).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260811-01-asset-library.md
2. docs/architecture/unified-ops-sidebar.md (§6)
3. server/src/app.ts, auth.ts, validate.ts
4. src/projects/venuePack/collectVenuePackUrls.ts
5. src/projects/writeRaceProject.ts (client API-base pattern)

Build the universal asset library: server upload/list endpoint + repo-tracked storage +
client helper + sidebar Library section (mounts into the shell from DSP-SCN-20260811-01 if
it has landed; otherwise mount standalone and note the integration step in your report).
Report back per dispatch.
```
