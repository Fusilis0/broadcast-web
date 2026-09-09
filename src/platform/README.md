# platform

Owned by **PLT**. Studio disk paths that are not domain logic.

## Cinematic ion tiles

`getCinematicTileCacheDir()` — absolute folder for Cesium ion **tile bytes** (not git). SCN-07 prefetches into it.

| Runtime | Path |
| --- | --- |
| Electron main (`app.getPath('userData')`) | `<userData>/cinematic-tiles/` |
| `npm run dev` / Vitest / node | `<cwd>/.cache/cinematic-tiles/` |

Renderer: `GET /cinematic-tiles/<file>` (Vite plugin). Filename = SHA-256 hex of the content URL with token query stripped (`cinematicTileCacheFileName`). SPA hashes with Web Crypto (`cinematicTileCacheFileNameAsync` in `cinematicTileCacheKey.ts`) — do not import `getCinematicTileCacheDir` from the SPA entry (Node `fs` / `path`). Dev write = `POST /cinematic-tiles/<file>`. Packaged Electron `--file` = IPC `cinematicTiles.read/write` into `userData`.
