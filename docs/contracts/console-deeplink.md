# Console deep-link contract (DRAFT)

**Owner:** CON — Console Bridge Orchestrator  
**Status:** Draft — not negotiated with console team yet  
**Constraint:** Console repo not available to this project today

## Intent

Web console shows a button that opens `broadcast-web` overlay in the same or new tab.

## Proposed URL

```
/overlay?race=<raceId>&token=<opaque>&mode=mock|replay|live&originLat=<deg>&originLon=<deg>
```

| Param | Required | Notes |
| --- | --- | --- |
| `race` | recommended | Selects config pack later |
| `token` | TBD | Auth — design with console team |
| `mode` | no | Default `mock` until V1 live |
| `originLat` / `originLon` | no | Override georef |

## Out of scope here

Console UI implementation. CON only maintains this contract and a parser stub in the SPA when dispatched.
