# console

Owned by **CON** (Console Bridge Orchestrator).

## Responsibility

- Parse console deep-link query strings (`parseConsoleDeeplink`)
- Apply overrides to boot config (`applyDeeplinkToBoot`) after `loadConfig()`
- Optional future: parent↔overlay `postMessage` (not implemented)

Contract (proposed / not negotiated): [`docs/contracts/console-deeplink.md`](../../docs/contracts/console-deeplink.md).

## Usage

```ts
import { applyDeeplinkToBoot, parseConsoleDeeplink } from './console/index.ts'

const config = await loadConfig()
applyDeeplinkToBoot(config, parseConsoleDeeplink(window.location.search))
// then origin + ingest as usual
```

Local example:

```
http://127.0.0.1:5173/?mode=replay&originLat=41.0082&originLon=28.9784
```

`race` / `token` are read-only handoff fields (token never validated in V1).
