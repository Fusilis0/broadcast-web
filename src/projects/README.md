# projects

Owned by **PLT** (pack I/O) with **SCN** feature shape / editor UX and **CON** `?race=` boot wire.

## Responsibility

- RaceProject types + light parse/validate
- Fetch packs: optional API (`projectsApiBase`) then static `/races/<id>/project.json`
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
| **Save** | Overwrite current pack id. Always **downloads** `project.json`. If `projectsApiBase` is set and the stub is up → `PUT` (revision) or `POST` when the id is new. Before save: non-blocking warning if fleet boat ids are missing from the boat-name catalogue. |
| **Save as** | DOM id/name prompts (`promptModal` — Electron-safe; not `window.prompt`) via HUD or editor fields for a **new** `id` + `name`. Download + optional API `POST`. Same boat-id warning. |
| **Load** | HUD picker / typed id / `?race=` → apply origin, fleet (`boatIds`), `povIds`, URLs into runtime; Fleet panel + origin fields refresh. |

### Project manager (Phase 11.4)

Sidebar **Project** section (`startProjectManagerPanel`) lists API projects when `projectsApiBase` is set:

| Action | Behaviour |
| --- | --- |
| **List** | Default hides `archived`; toggle shows all via `?includeArchived=1` |
| **Duplicate** | `POST` copy under a new id (DOM id/name prompts via `promptModal`) |
| **Rename** | Create new id first, then `DELETE` old (ids immutable; no data loss if create fails). Same DOM prompts as Duplicate. |
| **Archive** | Label `archived` via PUT wrapper — still loadable by id |
| **Static-only** | Controls disabled with a clear message; Save download still works |

Helpers: `listRaceProjects`, `duplicateRaceProject`, `renameRaceProject`, `setRaceProjectArchived`, `confirmSaveWithOrphanBoatIds` (`src/projects/projectManager.ts`).

Payload includes **runtime session** state: world origin (`config.origin` / world-anchor Apply), Fleet `boatIds` / `povIds`, `boatNamesUrl`, features (embedded when the editor has them), fixture URLs, and soft **`calibration.byPovId`** (CAL offsets snapshot for current `povIds`; omitted when empty). Load hydrates `offsetsStore` when the field is present.

### Save = download (primary)

The browser cannot write into `public/races/`. Download is always the durable local path:

1. **Save** or **Save as** → `project.json` download
2. Drop it at `public/races/<id>/project.json` (folder name should match `id`)
3. Add `<id>` to `public/races/index.json` → `{ "ids": ["demo-istanbul", "<id>"] }`
4. Reload with `?race=<id>` or pick it in the HUD race list

### Optional API write + LAN roles

When `projectsApiBase` is set (e.g. `"/api"` with `npm run server` + Vite proxy):

- Save as → `POST /api/races`
- Save → `PUT /api/races/:id` with `If-Match` revision (falls back to create on miss)
- Editor PC: `projectsRole: "editor"` + `projectsApiToken` → `Authorization: Bearer …`
- Air PC: `projectsRole: "air"` (or `?role=air`) → Save / Save as disabled; no API write

Download still happens first on editor saves. API failure does not undo the download. Ops: [`docs/ops/projects-api.md`](../../docs/ops/projects-api.md).

```ts
import {
  buildRaceProject,
  canWriteProjectsApi,
  defaultEditedRaceId,
  downloadRaceProject,
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
downloadRaceProject(project) // → project.json
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
| **`?race=`** | Boot / Load | API → static `/races/<id>/project.json` → **cached venue pack** |

Precedence on load:

1. `projectsApiBase` API get (when set)
2. Static `/races/<id>/project.json`
3. Cached venue pack (IndexedDB / memory fallback)

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
