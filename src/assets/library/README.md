# Universal asset library (client)

Owned by **PLT** (storage/API) + **SCN** consumers (texture/model pickers).

Phase 11.3 (`DSP-PLT-20260811-01`). Design:
[`docs/architecture/unified-ops-sidebar.md`](../../../docs/architecture/unified-ops-sidebar.md) §6.

## Purpose

Shared, git-trackable images/models under `public/assets/library/`, reusable from
any race project by URL (`textureUrl` / future `modelUrl`). Not embedded in one
project's JSON. Seeded with Rolex / Senexus / Vodafone (copies of
`public/textures/sponsors/`). After a Library upload, **commit** `index.json` and
the new file(s) so other studio PCs get them on pull. `--file` / `userData` is
not the shared logo store.

## Public API

| Symbol | Role |
| --- | --- |
| `listLibraryAssets({ projectsApiBase? })` | Catalogue — API then static fallback |
| `uploadLibraryAsset({ projectsApiBase, file, filename, … })` | Multipart POST when API base set |
| `resolveLibraryAssetUrl(asset)` | `/assets/library/<filename>` for feature fields |
| `isLibraryUploadConfigured(base)` | Whether upload UI should show |
| `startLibraryPanel({ container, projectsApiBase, … })` | Sidebar Library section |

## Modes

| `projectsApiBase` | Behaviour |
| --- | --- |
| Set (e.g. `"/api"`) | List via `GET /api/assets`; upload via `POST /api/assets` (editor bearer) |
| Empty | Browse-only against `/assets/library/index.json` — clear hint in UI |

Air role (`canUpload: false`): browse-only even when API base is set.

## SCN consumers

Billboard-chain / sponsor / details pickers should call
`openLibraryLogoPicker` (`src/scene/sidebar/libraryLogoPicker.ts`) which uses
`listLibraryAssets` + `resolveLibraryAssetUrl` — do not re-implement paths or re-seed PNGs.
