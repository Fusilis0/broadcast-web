# Universal asset library

Cross-project images and models (Phase 11.3 / `DSP-PLT-20260811-01`, seed
Phase 19.16 / `DSP-PLT-20260901-01`).

## Layout

```
public/assets/library/
  index.json          # manifest (pretty-printed array)
  image/<slug>-<hash>.<ext>
  model/<slug>-<hash>.<ext>
```

Manifest entry shape:

```json
{
  "id": "image/logo-a1b2c3d4.png",
  "kind": "image",
  "filename": "image/logo-a1b2c3d4.png",
  "label": "Logo",
  "addedAt": "2026-08-11T10:00:00.000Z",
  "sizeBytes": 1234
}
```

Public URL for an entry: `/assets/library/<filename>`.

Seeded logos (copies; originals stay in `public/textures/sponsors/`): Rolex,
Senexus, Vodafone.

## Upload

With the projects API running (`npm run server`) and SPA `projectsApiBase` set
(e.g. `"/api"`), the Library sidebar section can POST multipart to `/api/assets`.
Writes land in **this** git-tracked folder (`public/assets/library/`), not
`userData`, `server/data/`, or `dist/`. `--file` / Electron `userData` is the
air-machine races/config store — it is **not** the shared logo library.

Without the API, this folder is browse-only via static `index.json`.

**After every upload:** commit `index.json` plus the new file(s) under `image/`
or `model/` so other studio PCs get them on pull. Do not gitignore this tree.

Extensions: `png` | `jpg` | `jpeg` | `webp` | `glb` | `gltf`. Size cap: **20 MiB**
(override with `PROJECTS_MAX_ASSET_BYTES`). Delete/replace is out of scope for v1
(append-only).

See [`src/assets/library/README.md`](../../../src/assets/library/README.md) and
[`docs/architecture/unified-ops-sidebar.md`](../../../docs/architecture/unified-ops-sidebar.md) §6.
