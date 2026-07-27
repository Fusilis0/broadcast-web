# Countdown flag fixtures

Bodrum Cup–style race-start countdown for SCN (Phase 2.6). GPS-anchored poles + world `MM:SS` timer (Unity `CountdownFlagController` spirit).

## Schema

```json
{
  "name": "optional label",
  "point1": { "lat": 41.00795, "lon": 28.9775, "altMsl": 0 },
  "point2": { "lat": 41.00795, "lon": 28.9793, "altMsl": 0 },
  "startMinutes": 6,
  "whiteRaiseMinutes": 5,
  "orangeRaiseMinutes": 6,
  "blueWhiteRaiseMinutes": 4,
  "blueWhiteLowerMinutes": 1,
  "point1FlagVerticalOffset": 0,
  "point2FlagVerticalOffset": 0,
  "blueWhiteExtraOffsetM": 6,
  "canvasVerticalOffset": 12,
  "poleHeightM": 10,
  "autoStart": true,
  "demoTimeScale": 20
}
```

| Field | Role |
| --- | --- |
| `point1` | Shore / “Samandıra” GPS — **white** flag |
| `point2` | Committee boat GPS — **orange** + **blue-white** |
| `altMsl` | Optional AMSL (default `0`); graphics force **water Y = 0** for pole bases |
| `startMinutes` | Total countdown (default `6`) |
| `whiteRaiseMinutes` | White raises when remaining ≤ this (default `5`) |
| `orangeRaiseMinutes` | Orange raises when remaining ≤ this (default `6` = start) |
| `blueWhiteRaiseMinutes` / `blueWhiteLowerMinutes` | Blue-white up while `raise ≥ minutes > lower` (defaults `4` / `1`) |
| `blueWhiteExtraOffsetM` | Extra height of blue-white above orange cloth (default **`6` m** — readable demo; Unity inspector often uses `35`) |
| `canvasVerticalOffset` | Timer height above P1 (meters, default `12`) |
| `poleHeightM` | Pole height (default `10`) |
| `autoStart` | Start ticking on load (default `true`) |
| `demoTimeScale` | Wall-clock speedup (default **`20`** → ~18 s for a 6-min sequence). Set `1` for real-time soaks |

## Timeline (Unity defaults)

1. **6:00** — P2 orange up (stays)
2. **5:00** — P1 white up (stays)
3. **4:00** — P2 blue-white up
4. **1:00** — P2 blue-white down (orange remains)
5. **0:00** — freeze; text `00:00` (plate turns green)

## Placement

- Lat/lon → ENU via GEO **`gpsToEnuAmsl`** after origin + EGM96.
- Flags face the other point (yaw-only flat look).
- Config key: **`flagsUrl`** (default `/fixtures/flags/demo-istanbul-countdown.json`).

No Unity FBX/PNG dump — procedural colored planes.
