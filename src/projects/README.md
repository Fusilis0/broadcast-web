# projects

Owned by **PLT** (pack I/O) with **SCN** feature shape / editor UX and **CON** `?race=` boot wire.

## Responsibility

- RaceProject types + light parse/validate
- Fetch local packs from `/races/<id>/project.json`
- Merge pack into `AppConfig` before deeplink overrides
- Build / download a RaceProject from runtime editor + config (Phase 6.2)
- List known local pack ids from `/races/index.json`

Contract: [`docs/contracts/race-project.md`](../../docs/contracts/race-project.md).

## Usage

```ts
import {
  applyRaceProjectToConfig,
  loadRaceProject,
} from './projects/index.ts'

const config = await loadConfig()
if (deeplink.race) {
  try {
    const project = await loadRaceProject(deeplink.race)
    applyRaceProjectToConfig(config, project)
  } catch (err) {
    console.warn('[projects] race pack load failed; continuing with config.json', err)
  }
}
applyDeeplinkToBoot(config, deeplink)
```

Local example:

```
http://127.0.0.1:5173/?race=demo-istanbul
```

## Save = download (no DB write)

The browser cannot write into `public/races/`. **Save project** downloads `project.json` (full RaceProject, including embedded `features` when the editor has them).

To persist in git / static hosting:

1. Download `project.json` from the HUD / editor
2. Drop it at `public/races/<id>/project.json` (folder name should match `id`)
3. Add `<id>` to `public/races/index.json` → `{ "ids": ["demo-istanbul", "<id>"] }`
4. Reload with `?race=<id>` or pick it in the HUD race list

```ts
import {
  buildRaceProject,
  defaultEditedRaceId,
  downloadRaceProject,
  listLocalRaceIds,
} from './projects/index.ts'

const project = buildRaceProject({
  id: defaultEditedRaceId(),
  name: 'My edit',
  origin: config.origin,
  boatIds: config.boatIds,
  povIds: config.povIds,
  features: editorFeatures,
  courseUrl: config.courseUrl,
  // …
})
downloadRaceProject(project) // → project.json
```
