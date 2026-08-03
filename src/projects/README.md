# projects

Owned by **PLT** (pack I/O) with **SCN** feature shape / editor UX and **CON** `?race=` boot wire.

## Responsibility

- RaceProject types + light parse/validate
- Fetch packs: optional API (`projectsApiBase`) then static `/races/<id>/project.json`
- Merge pack into `AppConfig` before deeplink overrides
- Build / download a RaceProject from runtime editor + config (Phase 6.2)
- Optional API write (`POST` create / `PUT` update) when `projectsApiBase` is set (Phase 6.4)
- List pack ids: API list when reachable, else `/races/index.json`

Contract: [`docs/contracts/race-project.md`](../../docs/contracts/race-project.md).  
API stub: [`server/README.md`](../../server/README.md) · ops: [`docs/ops/projects-api.md`](../../docs/ops/projects-api.md).

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
| **Save** | Overwrite current pack id. Always **downloads** `project.json`. If `projectsApiBase` is set and the stub is up → `PUT` (revision) or `POST` when the id is new. |
| **Save as** | Prompt (HUD) or editor id/name fields for a **new** `id` + `name`. Download + optional API `POST`. |
| **Load** | HUD picker / typed id / `?race=` → apply origin, fleet (`boatIds`), `povIds`, URLs into runtime; Fleet panel + origin fields refresh. |

Payload includes **runtime session** state: world origin (`config.origin` / world-anchor Apply), Fleet `boatIds` / `povIds`, `boatNamesUrl`, features (embedded when the editor has them), and fixture URLs.

### Save = download (primary)

The browser cannot write into `public/races/`. Download is always the durable local path:

1. **Save** or **Save as** → `project.json` download
2. Drop it at `public/races/<id>/project.json` (folder name should match `id`)
3. Add `<id>` to `public/races/index.json` → `{ "ids": ["demo-istanbul", "<id>"] }`
4. Reload with `?race=<id>` or pick it in the HUD race list

### Optional API write

When `projectsApiBase` is set (e.g. `"/api"` with `npm run server` + Vite proxy):

- Save as → `POST /api/races`
- Save → `PUT /api/races/:id` with `If-Match` revision (falls back to create on miss)

Download still happens first. API failure does not undo the download.

```ts
import {
  buildRaceProject,
  defaultEditedRaceId,
  downloadRaceProject,
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
if (config.projectsApiBase) {
  await writeRaceProject(project, {
    projectsApiBase: config.projectsApiBase,
    mode: 'create',
  })
}
```
