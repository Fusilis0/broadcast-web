# Wind — data sources, conventions, and 3D visualisation

**Status:** 14.3a + **14.3b landed** (2026-08-17, `DSP-TEL-20260817-02`) — Open-Meteo
polls `config.origin` onto `windBus` (`source: 'api'`). Operator hold beats API.
**14.3d landed** (2026-08-17, `DSP-SCN-20260817-05`) — ops + stream 2D maps draw a
travel arrow + `from NNN° · XX kt` from `windBus` (no map-side fetch).
**14.3e landed** (2026-08-17, `DSP-SCN-20260817-06`) — Gerstner fragment scrolls a
gust mask along `uDirectionRad` (from-000° → +Z); intensity fades at calm
`speedMs`. 14.3c anemometer still open. Phase 14.3.
**Owner:** TEL (data ingest) + SCN (VFX) + PLT (config).
**Related:** [`ocean-waves-and-sea-state.md`](./ocean-waves-and-sea-state.md) (wind's first and most
important consumer is the wave direction).
**Locked by user 2026-08-17:** the wind *source* is undecided — **build the abstraction, test all
three, keep whichever works best on site.** Wave direction following the wind is the P0 deliverable.

---

## 1. Three possible sources, one interface

Rather than pick a source now, define a small provider interface and implement all three. They are
each modest, and the only way to know which is right is a day at the venue.

| Source | How | Pros | Cons |
| --- | --- | --- | --- |
| **Operator entry** | A field in the ops sidebar; the race committee's posted wind | Always available; matches what the commentary says; zero dependencies | Manual; goes stale unless someone updates it |
| **Weather API** | Open-Meteo (§2) | Automatic, free, no key, gives gusts and wave data too | Model resolution is 5 km in Europe — it will not capture a local Bosphorus channel effect; needs network |
| **On-site anemometer** | Streamed through the existing telemetry WebSocket as a new channel | Ground truth; already-built transport, matching the `buoy` channel precedent from Phase 11.2 | Needs hardware on site and a committee willing to run it |

**Proposed resolution order when several are live:** on-site sensor → operator override → API →
last known → configured default. Make the active source and its age **visible in the ops UI**;
silently falling back to a stale value is how a wrong wind arrow gets on air.

Architecturally this mirrors what the repo already does for telemetry: a typed frame, a bus, and a
mode selector (`mock` / `replay` / `live`). Follow that shape — `windBus` alongside `poseBus` —
rather than inventing a new pattern.

## 2. Open-Meteo (recommended API)

Two free endpoints, no API key, JSON over plain GET:

- **Wind** — `https://api.open-meteo.com/v1/forecast`
  with `current=wind_speed_10m,wind_direction_10m,wind_gusts_10m`
- **Marine** — `https://marine-api.open-meteo.com/v1/marine`
  with `hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period`

The marine endpoint is worth taking even if we only use wind for the visuals: it gives a physically
plausible starting wave height and period for the sea-state presets, so "moderate" means something
real rather than an art guess.

**Licensing caveat to resolve before air:** free use is *non-commercial*, CC BY 4.0, with
attribution and a 10,000 call/day limit. A commercial broadcast almost certainly needs the paid
`customer-` endpoint. Cheap, but it needs a decision and a key — treat it exactly like the Cesium
ion token (config, never committed).

**Polling:** the data updates twice daily and is hourly-resolution. Poll every ~10 minutes, cache
the last good value, and never let a failed fetch blank the display.

## 3. The convention trap: "direction" means *from*

This will cause a 180° error if it is not written down and tested.

- **Meteorological and sailing convention:** wind direction is the direction the wind blows **from**,
  in degrees clockwise from **true** north. "Wind 270" is a westerly — air moving toward the east.
  Open-Meteo's `wind_direction_10m` and all its `*_wave_direction` fields use this convention
  ("Wave directions are always reported as the direction the waves come from").
- **The renderer wants a "to" vector** — which way the swell train travels.

**Contract:**

- Name the field explicitly: `directionFromDeg`, never bare `direction`.
- Derive the travel vector in one shared, unit-tested helper. Nowhere else.
- Use **true** north, not magnetic. If any on-site sensor reports magnetic, convert at ingest and
  record the declination used.
- The conversion from compass bearing to a scene vector depends on the axis convention, which is
  the subject of [`enu-frame-handedness.md`](./enu-frame-handedness.md) — **14.0 landed**: scene
  packing is `x=East`, `y=Up`, `z=−North`. Shared helper `windTravelSceneXZ` in
  `src/telemetry/windDirection.ts`: from-north (`directionFromDeg = 0`) travels **+Z**.

Also worth stating: displayed wind speed should carry its unit explicitly (kt for sailing, m/s from
the API) and convert in one place.

## 4. Visualisation

The user's priority is unambiguous: **the sea must move in the wind's direction.** Everything else
is additive.

### P0 — the sea itself

Wave train direction locked to the wind vector, whitecap density scaling with wind speed
(`ocean-waves-and-sea-state.md` §3). This is the primary "wind VFX" and it needs no new visual
vocabulary — the viewer reads it instantly.

### P1 — wind streaks on the water

**Landed (14.3e).** Dark directional gust streaks on the Gerstner surface: an
anisotropic value-noise in the fragment shader, scrolled along the existing
`uDirectionRad` travel vector (same as swell; from-000° → **+Z**). The mask
darkens albedo and reduces glitter (roughness). Intensity and scroll scale
from `setWindSpeed` / `speedMs` and fade to 0 below ~0.4 m/s so calm wind
does not leave a static texture. No particles, no extra FBO, no `readPixels`.
Shore foam (14.2c) and wind coupling (14.2b) are unchanged.

### P1 — a wind readout graphic

**Landed (14.3d).** Arrow plus speed on the ops and stream 2D maps (`drawMapWindReadout` in
`mapChrome.ts`). Arrow is **travel** (`windTravelSceneXZ`); label is meteorological
**from** + kt. Maps subscribe to `windBus` only — they do not poll Open-Meteo. Stream
pill sits bottom-left (opposite the north compass) so it stays readable on NDI
`broadcast-web-2d`. Optional lower-third remains later.

### P2 — 3D wind indicator over the course

A ribbon, arrow, or drifting particle field in world space. Attractive but easy to get wrong:
world-space particles read as visual noise on a moving drone shot and can obscure the boats. If
built, it should be an operator-toggleable overlay, not always-on.

### P2 — flags and telltales

Mark flags and committee-boat flags oriented to the wind. Highest realism-per-pixel of the
remaining items, since the assets largely exist; a simple oriented sway is enough — no cloth sim.

### P2 — spray

Spray intensity scaling with wind speed. Particle-based, and the cost lands on the same frame
budget the NDI channels are already fighting for. Last.

## 5. Constraints

- **Alpha gate:** any opaque wind VFX obeys the same `opaqueClearSafe` rule as sky/ocean/terrain.
  A 2D map or DOM readout is unaffected.
- **Cross-channel determinism:** wind state must be a shared value read by every render pass, so
  AR and 3D agree.
- **Persistence:** the wind source choice, manual override and units belong on the `RaceProject`
  so a venue setup reloads intact.
- **Failure behaviour:** no network, no sensor, no operator input must still render a sensible sea.
  Default to a configured venue prevailing wind and show clearly that it is a default.

## 6. Suggested slice (14.3)

1. **14.3a — `windBus` + types + the from/to helper + operator entry UI.** Manual source only.
   This alone unblocks the ocean's P0 direction coupling. **Landed** (`windBus`,
   `windTravelSceneXZ`, Ops row in stub HUD).
2. **14.3b — Open-Meteo provider** (wind + marine), polling, caching, source-priority resolution,
   staleness display. **Landed** (`windOpenMeteo.ts`): ~10 min poll, last-good cache, operator
   hold (30 min or until Follow API). Marine fields optional on `WindFrame`. Attribution:
   Open-Meteo **CC BY 4.0** (README + Ops title; not on-air). Free tier is non-commercial.
3. **14.3c — telemetry anemometer channel** (TEL), following the Phase 11.2 buoy-channel pattern.
4. **14.3d — 2D map wind readout.** **Landed** (`DSP-SCN-20260817-05`): ops + stream
   travel arrow + `from NNN° · XX kt`; from-000° screen-down.
5. **14.3e — wind streaks in the ocean shader.** **Landed** (`DSP-SCN-20260817-06`):
   Gerstner fragment `windStreak` along `uDirectionRad`; `setWindSpeed` drives
   intensity + scroll; from-000° travels **+Z**.
6. **14.3f (optional) — 3D indicator, flags, spray.**

14.3a is the only part the ocean work strictly depends on; the rest can land in any order.

## Open questions

| # | Question |
| --- | --- |
| 1 | Is an on-site anemometer actually available at the venue, or is this hypothetical? (Decides whether 14.3c is built at all.) |
| 2 | Commercial licence for Open-Meteo — who buys the key? Same for units shown on air (kt vs m/s). |
| 3 | Does the race console (CON) already carry a committee wind value we should consume instead of asking the operator to re-type it? |
| 4 | Should the wind readout appear on the AR plate as a graphic, or only on the 2D/3D channels? |
