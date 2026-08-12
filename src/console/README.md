# console

Owned by **CON** (Console Bridge Orchestrator).

## Responsibility

- Parse console deep-link query strings (`parseConsoleDeeplink`)
- Apply overrides to boot config (`applyDeeplinkToBoot`) after `loadConfig()` (+ optional race pack)
- Optional future: parent↔overlay `postMessage` (not implemented)

Contract (proposed / pending console ack): [`docs/contracts/console-deeplink.md`](../../docs/contracts/console-deeplink.md).  
Race packs: [`docs/contracts/race-project.md`](../../docs/contracts/race-project.md).  
Ack pack for console team: [`docs/agentic/handoffs/HO-CON-console-team-20260804-01.md`](../../docs/agentic/handoffs/HO-CON-console-team-20260804-01.md).

LAN `?role=air` / `?projectsRole=air` are **PLT** companion params (`projectsAuth`) — not fields on `ConsoleDeeplink`.

## Usage

```ts
import { applyDeeplinkToBoot, parseConsoleDeeplink } from './console/index.ts'
import { applyRaceProjectToConfig, loadRaceProject } from './projects/index.ts'

const config = await loadConfig()
const deeplink = parseConsoleDeeplink(window.location.search)
if (deeplink.race) {
  try {
    applyRaceProjectToConfig(
      config,
      await loadRaceProject(deeplink.race, {
        projectsApiBase: config.projectsApiBase,
      }),
    )
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

## Local examples

```
http://127.0.0.1:5173/?race=demo-istanbul
http://127.0.0.1:5173/?race=demo-istanbul&role=air
http://127.0.0.1:5173/?mode=replay&originLat=41.0082&originLon=28.9784
http://127.0.0.1:5173/?race=demo-istanbul&mode=live&outputMode=chroma&role=editor
```

Full matrix: contract [Example URL matrix](../../docs/contracts/console-deeplink.md#example-url-matrix-ack-pack).

`race` loads a local RaceProject pack (PLT); unsafe ids are ignored (warn). `token` remains opaque / never validated in V1.
