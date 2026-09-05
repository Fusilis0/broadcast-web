# projects

Owned by **PLT** (pack I/O) with **SCN** feature shape / editor UX and **CON** `?race=` boot wire.

## Responsibility

- RaceProject types + light parse/validate
- Fetch packs: optional API (`projectsApiBase`) then Electron `races.read` then static `/races/<id>/project.json`
- Merge pack into `AppConfig` before deeplink overrides
- Build / download a RaceProject from runtime editor + config (Phase 6.2)
- Optional API write (`POST` create / `PUT` update) when `projectsApiBase` is set (Phase 6.4)
- LAN roles (Phase 9.1): `editor` vs `air` — bearer on writes; air disables Save / API write
- List pack ids: API list when reachable, else `/races/index.json`
- Venue / offline pack (Phase 9.2): export project + fixtures; IndexedDB cache; load on API/static miss

Contract: [`docs/contracts/race-project.md`](../../docs/contracts/race-project.md).  
API stub: [`server/README.md`](../../server/README.md) · ops: [`docs/ops/projects-api.md`](../../docs/ops/projects-api.md) · venue pack: [`docs/ops/venue-pack.md`](../../docs/ops/venue-pack.md).

## Usage

```ts
import {
  applyRaceProjectToConfig,
  loadRaceProject,
} from './projects/index.ts'

const config = await loadConfig()
if (deeplink.race) {
  try {
    const project = await loadRaceProject(deeplink.race, {
      projectsApiBase: config.projectsApiBase,
    })
    applyRaceProjectToConfig(config, project)
  } catch (err) {
    console.warn('[projects] race pack load failed; continuing with config.json', err)
  }
}
applyDeeplinkToBoot(config, deeplink)
```

With `projectsApiBase` empty/unset → static only (unchanged). When set (e.g. `"/api"`), get/list try the API first and fall back to static packs on miss or failure.

Local example:

```
http://127.0.0.1:5173/?race=demo-istanbul
```

## Save / Save as / Load

| Action | Behaviour |
| --- | --- |
| **Save** | Overwrite current pack id. **Electron** (races bridge): write `public/races/<id>/` (or `userData/races/` in `--file`). **Chrome**: download `project.json`. Optional API `PUT`/`POST` when `projectsApiBase` is set. Before save: non-blocking warning if fleet boat ids are missing from the boat-name catalogue. |
| **Save as** | DOM id/name prompts (`promptModal` — Electron-safe; not `window.prompt`) via HUD or editor fields for a **new** `id` + `name`. Same persist path as Save (folder in Electron, download in Chrome) + optional API `POST`. |
| **Export…** | Electron only — download `project.json` without writing the races folder. |
| **Load** | HUD dropdown of pack ids (`listLocalRaceIds` = static index + Electron `races.list`). Pick copies the id into the field only; **Load** (or Enter in the id field) applies the full pack via `switchRace`. Dropdown change never loads (Electron and Chrome). Packed Load paints chrome + 2D + fleet/Assets **before** 3D remount (Phase 19.17). Also `?race=` → apply origin, fleet, URLs. |

### Project manager (Phase 11.4)

Sidebar **Project** section (`startProjectManagerPanel`) lists API projects when `projectsApiBase` is set:

| Action | Behaviour |
| --- | --- |
| **List** | Default hides `archived`; toggle shows all via `?includeArchived=1` |
| **Duplicate** | `POST` copy under a new id (DOM id/name prompts via `promptModal`) |
| **Rename** | Create new id first, then `DELETE` old (ids immutable; no data loss if create fails). Same DOM prompts as Duplicate. |
| **Archive** | Label `archived` via PUT wrapper — still loadable by id |
| **Static-only** | API controls disabled. Electron still uses Load dropdown + folder Save above (no API required). Chrome: Save download still works. |

Helpers: `listRaceProjects`, `duplicateRaceProject`, `renameRaceProject`, `setRaceProjectArchived`, `confirmSaveWithOrphanBoatIds` (`src/projects/projectManager.ts`).

Payload includes **runtime session** state: world origin (`config.origin` / world-anchor Apply), Fleet `boatIds` / `povIds`, embedded **`fleet.boats`** rows (names, category, visibility, map flag, planned GPS), `boatNamesUrl` (fallback for old packs), **`features`** (present including `[]` is the complete world — demo `courseUrl` / `sponsorsUrl` / `flagsUrl` are ignored on Load), fixture URLs (compat when `features` omitted), soft **`calibration.byPovId`** (CAL offsets snapshot for current `povIds`; omitted when empty), and soft **`output.srtUrlTemplate` + `output.srtByPovId`** (SRT camera ids; the relay token is stripped on Save). Load hydrates `offsetsStore` when the field is present and rebuilds the Fleet list from `fleet.boats` when present (does not dump the names-URL catalogue).

### Save destinations

| Shell | Primary Save | Secondary |
| --- | --- | --- |
| **Electron** (`broadcastStudio.races`) | Folder write via `races.save` | **Export…** = download; API when configured |
| **Chrome** (no bridge) | Download `project.json` | Drop under `public/races/<id>/` + update `index.json` manually |

Electron folder roots:

| Shell mode | Folder |
| --- | --- |
| `desktop:dev` (Vite URL) | repo `public/races/` |
| `desktop:file` (`--file`) | `userData/races/` (not `dist/races/`) |

After a successful local save, the Load dropdown refreshes (`listLocalRaceIds` + `races.list`). Project **name** is shown next to Save. Under the Save/Load row, last action is `loading` → `loaded` or `saving` → `saved` (optional persist suffix such as `folder:` / `download` / `API`). Export success is `downloaded`. Failures use a short error line (pack id when useful); no modal. Folder hint `saving to: …` stays on the same row and is not replaced by the lifecycle word. Details: [`desktop/README.md`](../../desktop/README.md) § Local RaceProject saves.

### Optional API write + LAN roles

When `projectsApiBase` is set (e.g. `"/api"` with `npm run server` + Vite proxy):

- Save as → `POST /api/races`
- Save → `PUT /api/races/:id` with `If-Match` revision (falls back to create on miss)
- Editor PC: `projectsRole: "editor"` + `projectsApiToken` → `Authorization: Bearer …`
- Air PC: `projectsRole: "air"` (or `?role=air`) → Save / Save as disabled; no API write

API is **additive** to Electron folder write / Chrome download. Ops: [`docs/ops/projects-api.md`](../../docs/ops/projects-api.md).

```ts
import {
  buildRaceProject,
  canWriteProjectsApi,
  defaultEditedRaceId,
  downloadRaceProject,
  persistRaceProjectLocal,
  getRacesBridge,
  projectsApiBearerToken,
  writeRaceProject,
  listLocalRaceIds,
} from './projects/index.ts'

const project = buildRaceProject({
  id: defaultEditedRaceId(),
  name: 'My edit',
  origin: config.origin,
  boatIds: runtimeBoatIds,
  povIds: runtimePovIds,
  features: editorFeatures,
  boatNamesUrl: config.boatNamesUrl,
  courseUrl: config.courseUrl,
  // …
})
await persistRaceProjectLocal({
  project,
  racesBridge: getRacesBridge(),
  mode: 'save',
  download: downloadRaceProject,
})
if (config.projectsApiBase && canWriteProjectsApi(config)) {
  await writeRaceProject(project, {
    projectsApiBase: config.projectsApiBase,
    mode: 'create',
    bearerToken: projectsApiBearerToken(config),
  })
}
```

## Venue / offline pack (Phase 9.2)

Single JSON download (`{id}-venue-pack.json`) embeds the RaceProject plus referenced fixtures (and nested textures under `/textures/…`, etc.).

| Action | HUD | Behaviour |
| --- | --- | --- |
| **Pack ↓** | Download venue pack | `buildVenuePack` → download + IndexedDB cache |
| **Pack ↑** | Load pack file | Parse → cache → materialize `blob:` URLs → apply like Load |
| **`?race=`** | Boot / Load | API → Electron `races.read` → static `/races/<id>/project.json` → **cached venue pack** |

Precedence on load:

1. `projectsApiBase` API get (when set)
2. Electron `races.read` when the studio bridge is present
3. Static `/races/<id>/project.json`
4. Cached venue pack (IndexedDB / memory fallback)

Gated Load-switch timings (Phase 19.17): append `?debug1917=1` for `[19.17]` `console.info` stage ms (`uiPaint` / `remountStarted` / `remountWorldFromFeatures`). Default off. Packed Load does not await remount before lists.

Materialization rewrites project URL fields and nested asset paths inside embedded JSON to `blob:` URLs so the scene can boot without WAN or missing `public/` siblings.

```ts
import {
  buildVenuePack,
  downloadVenuePack,
  parseVenuePack,
  materializeVenuePack,
  getDefaultVenuePackCache,
} from './projects/index.ts'

const pack = await buildVenuePack(project)
downloadVenuePack(pack)
await getDefaultVenuePackCache().put(pack)

// Later / offline:
const cached = await getDefaultVenuePackCache().get('demo-istanbul')
const { project: offlineProject, revoke } = materializeVenuePack(cached!)
```

Ops note: [`docs/ops/venue-pack.md`](../../docs/ops/venue-pack.md).
