# projects

Owned by **PLT** (pack I/O) with **SCN** feature shape and **CON** `?race=` boot wire.

## Responsibility

- RaceProject types + light parse/validate
- Fetch local packs from `/races/<id>/project.json`
- Merge pack into `AppConfig` before deeplink overrides

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
