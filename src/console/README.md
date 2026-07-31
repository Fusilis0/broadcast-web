# console

Owned by **CON** (Console Bridge Orchestrator).

## Responsibility

- Parse console deep-link query strings (`parseConsoleDeeplink`)
- Apply overrides to boot config (`applyDeeplinkToBoot`) after `loadConfig()` (+ optional race pack)
- Optional future: parent↔overlay `postMessage` (not implemented)

Contract (proposed / not negotiated): [`docs/contracts/console-deeplink.md`](../../docs/contracts/console-deeplink.md).  
Race packs: [`docs/contracts/race-project.md`](../../docs/contracts/race-project.md).

## Usage

```ts
import { applyDeeplinkToBoot, parseConsoleDeeplink } from './console/index.ts'
import { applyRaceProjectToConfig, loadRaceProject } from './projects/index.ts'

const config = await loadConfig()
const deeplink = parseConsoleDeeplink(window.location.search)
if (deeplink.race) {
  try {
    applyRaceProjectToConfig(config, await loadRaceProject(deeplink.race))
  } catch (err) {
    console.warn(
      '[projects] race pack load failed; continuing with config.json',
      err,
    )
  }
}
applyDeeplinkToBoot(config, deeplink)
// then origin + ingest as usual
```

Local examples:

```
http://127.0.0.1:5173/?race=demo-istanbul
http://127.0.0.1:5173/?mode=replay&originLat=41.0082&originLon=28.9784
```

`race` loads a local RaceProject pack (PLT). `token` remains opaque / never validated in V1.
