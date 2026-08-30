# telemetry

Owned by **TEL**. WebSocket-shaped ingest: DTOs, JSON router, mock / replay / live sources, typed event bus.

## Layout

| File | Role |
| --- | --- |
| `types.ts` | Wire DTOs (`TelemetryData`, `BoatTelemetry`, `BuoyTelemetry` (= boat shape), `StreamAnchorMessage`) |
| `boatToStandardTelemetry.ts` | Boat → standard pose mapping (Unity `ToStandardTelemetry` parity) |
| `router.ts` | `classify` / `tryParseStreamAnchor` (Unity `TelemetryWsJsonRouter`) |
| `mockSource.ts` | Interval mock: one drone per `povIds`, one boat per `boatIds`, one buoy per `buoyIds`, periodic `stream_anchor` (`povIds[0]`) |
| `replayFixture.ts` | Fixture v1 types + `parseReplayFixture` / `loadReplayFixture` |
| `replaySource.ts` | Timer playback of a fixture onto `ingestPacket` |
| `liveSource.ts` | Browser WebSocket client(s) for live mode (drone + optional boat) |
| `bus.ts` | Typed pub-sub |
| `ingest.ts` | Start ingest from `telemetryMode`; route JSON onto the bus; live `getLiveStatus` / `onLiveStatus` / `disconnectLive` / `syncLiveIds`; replay `getReplayStatus` |
| `windTypes.ts` | Wind DTOs (`WindFrame.directionFromDeg`, `speedMs`, `source`) |
| `windBus.ts` | Sticky `windBus`: `publish` / `subscribe` / `getSnapshot` (default 6 kt from 000°) |
| `windDirection.ts` | `windTravelSceneXZ` (from→to, post-14.0 `x=East z=−North`) + knots↔m/s |
| `windOpsRow.ts` | Ops row: from-deg + speed kt + source/age + hold/Follow API |
| `windOpenMeteo.ts` | Open-Meteo poll (~10 min) → `source: 'api'` on `windBus` |
| `ptsNtpMap.ts` | Per-`stream_id` PTS→NTP fit. Bus-wired by the pose pipeline (TEL-08). LUT key is **SRT id**. |
| `telemetryHistory.ts` | NTP-keyed ring + `sampleDroneAt` / `sampleBoatAt`. Bus-wired by the pose pipeline (TEL-08). |
| `flowTap.ts` | Last-N ring per id for SCN-10 Flow inspector. TEL-10 wires ingest; SCN-10 pushes `kind:'srt'` (redacted). |
| `index.ts` | Public exports |

## Events

Subscribe via `telemetryBus.on(event, handler)` or the bus returned by `startTelemetryIngest`:

| Event | Payload |
| --- | --- |
| `drone` | `TelemetryData` |
| `boat` | `BoatTelemetry` |
| `buoy` | `BuoyTelemetry` (= `BoatTelemetry` wire shape; own id namespace) |
| `stream_anchor` | `StreamAnchorMessage` |

Boat vs drone for non-anchor pose JSON is decided by **source/channel context**, not by a `type` field (same as Unity).

### Buoy classification rule

Buoys reuse the **boat GPS packet** — no new wire format and **no drag physics** in TEL (motion is telemetry-driven only).

| Path | How it becomes `buoy` |
| --- | --- |
| Mock / replay | `channel: "buoy"` + boat-shaped JSON |
| Live (boat WS) | Boat-shaped frame on `channel: "boat"` whose `id` ∈ `buoyIds` allow-list |

Empty / absent `buoyIds` → **no buoy channel** (no sockets, no mock emit). Keep buoy ids **disjoint** from `boatIds`.

## Wind (`windBus`, Phase 14.3a + 14.3b)

Operator + Open-Meteo on the same bus. No anemometer socket in this slice (14.3c).
API / operator / default publish `WindFrame`; SCN ocean should only `subscribe`.

**Open-Meteo** forecast at `config.origin` (`current=wind_speed_10m,wind_direction_10m,wind_gusts_10m`,
`wind_speed_unit=ms`) polls every ~10 minutes. Last good snapshot is kept on fetch failure
(Ops age line goes `api · stale`). Optional marine current (wave height/direction/period) is
stored additively on the frame. **Operator hold beats API** until 30 minutes elapse or the
operator clicks **API** (Follow). Typing in the Ops row sets hold. Default/API update when
not holding.

Attribution: Open-Meteo data is **CC BY 4.0**. The free tier is **non-commercial** (studio/dev
OK). No `customer-` key in this slice. Credit lives in README + the Ops wind-row title — not
as a broadcast burn-in.

| Export | Role |
| --- | --- |
| `windBus.publish` / `subscribe` / `getSnapshot` | Sticky last `WindFrame` (or `null` on a fresh `WindBus`). Shared `windBus` is seeded with **6 kt from 000°**, `source: 'default'`. `subscribe` replays the snapshot immediately. |
| `WindFrame.directionFromDeg` | Meteorological **from**, true north, clockwise, `[0, 360)`. Never a bare `direction`. |
| `windTravelSceneXZ(directionFromDeg)` | Unit travel vector in scene XZ. Post-14.0: `x=East`, `z=−North`. **From north (0) travels +Z.** |
| `knotsToMs` / `msToKnots` | One conversion site (`kt * 0.514444`). Ops shows **kt**. |
| `mountWindOpsRow` | Stub HUD Ops row. Empty/invalid input keeps last or default; does not throw. **hold** / **API** toggles operator hold vs Follow Open-Meteo. |
| `startOpenMeteoWind` / `createOpenMeteoWindProvider` | Poll Open-Meteo; `publish` only when operator is not holding. Tests inject `fetchImpl` (no live network in CI). |

SCN ocean (14.2b) should `windBus.subscribe` and call `windTravelSceneXZ(frame.directionFromDeg)`. Config seed (`windDirectionFromDeg` / `windSpeedKt`) is a follow-up — hardcoded default until API or operator lands a frame.

## Config

`public/config.json`:

| Field | Notes |
| --- | --- |
| `telemetryMode` | `"mock"` \| `"replay"` \| `"live"` — **committed default is `mock`** |
| `replayUrl` | Fixture URL for replay (default `/fixtures/telemetry/spine-demo.json`) |
| `replayLoop` | Optional boolean override of fixture `loop`. Omit → use fixture. Committed samples use `loop: true` |
| `wsUrl` | Drone **base** live WebSocket (no `id`; default empty → Fleet panel uses VPS base) |
| `wsBoatUrl` | Boat **base** live WebSocket (no `id`). Live opens one socket per registered id |
| `boatIds` | `string[]` boat channel ids (default `["21","22","23","24"]`; band `21–52`) |
| `povIds` | `string[]` POV / drone+cam ids (default `["1","2"]`; bands `1–4` ∪ `11–12`) |
| `buoyIds` | `string[]` buoy telemetry ids (default `[]` = off). Demo mock: `["91"]`. No shared band with boats — do not collide with `boatIds` |

### `boatIds` (SCN consumers)

- Mock emits **one `boat` bus event per id** each pose tick (`BoatTelemetry.id` ∈ `boatIds`).
- `poseBus` already keys by `id` — SCN fleet registry should `Map<id, entity>` from the same list (`loadConfig().boatIds`).
- Pilots `81–84` are **deferred** (filtered if present in config). Full `21–52` is config-only later.
- Passed into `startTelemetryIngest({ boatIds })` the same way as `replayUrl` / `wsUrl`.

### `povIds` (SCN consumers)

- Mock emits **one `drone` bus event per id** each pose tick (`TelemetryData.id` ∈ `povIds`). Wire stays `channel: "drone"` even for cams `11–12` (Unity parity DTO).
- `poseBus` already keys `kind: 'drone'` by `id` — no new bus event. SCN POV switch should use `loadConfig().povIds`.
- Periodic `stream_anchor` uses **`povIds[0]`** (primary POV; not rotated).
- Passed into `startTelemetryIngest({ povIds })` like `boatIds`.
- **No Three camera / HUD POV switch in TEL** — that is SCN (`DSP-SCN-20260727-03`).
- **Live:** Fleet / Live panel stores **base** URLs; ingest builds `base?type=client&subscribe=<id>` for each **enabled** `povIds` / `boatIds` entry (one socket per enabled id). Producer URLs (`type=drone&id=`) do **not** deliver telemetry to the SPA. Registry defaults (`21–24` / `1–2`) stay for mock/scene — they do **not** auto-open live sockets. Empty enabled lists → no sockets for that channel (no legacy base-only fallback).
- **Buoys (live):** same boat WS base; subscribe ids = `boatIds ∪ buoyIds`. Frames whose `id` ∈ `buoyIds` emit bus `buoy` (not `boat`).

### `buoyIds` (TEL + future SCN bind)

- Mock emits **one `buoy` bus event per id** each pose tick when the list is non-empty (`channel: "buoy"`, `BuoyTelemetry` = boat shape).
- Empty / omitted → no buoy packets (backward compatible).
- Local demo: set `"buoyIds": ["91"]` in `public/config.json` (suggested `MOCK_BUOY_ID`).
- Passed into `startTelemetryIngest({ buoyIds })` like `boatIds`.
- **No buoy placement UI / live-bind picker in TEL** — that is SCN (`DSP-SCN-20260811-02` / `-03`).

### Modes

- **mock** — `MockTelemetrySource` with multi-id POVs from `povIds` + boats from `boatIds` + optional buoys from `buoyIds`.
- **replay** — fetch `replayUrl`, validate v1, play via timers onto `ingestPacket` (fixtures may carry multiple drone/boat/buoy ids). **Looping** is controlled by fixture `loop` (committed samples: `true`); optional `replayLoop` in config / `startTelemetryIngest` overrides. HUD mock↔replay↔live calls `stop()` then a fresh ingest — timers/sockets do not leak.
- **live** — base `wsUrl` / `wsBoatUrl` + **enabled** ids → one WebSocket per enabled id; text frames → `ingestPacket` by channel. Handshake (`open`) ≠ data flowing — see per-id `lastPacketAgeMs`.

If `/config.json` fetch fails, mode defaults to `mock`, `boatIds` to the four-id default, `povIds` to `["1","2"]`, and `buoyIds` to `[]`.

### Live reconnect (capped exponential backoff)

`LiveTelemetrySource` reconnects after unexpected close/error:

| Knob | Default | Behaviour |
| --- | --- | --- |
| `initialBackoffMs` | `500` | Delay before first reconnect attempt |
| `maxBackoffMs` | `10_000` | Cap; delay doubles after each attempt (`500 → 1000 → … → 10000`) |
| On successful `open` | — | Backoff resets to `initialBackoffMs` |
| Unexpected close | — | Status becomes `retrying` (with remaining delay); then reconnect |
| `stop()` | — | Bumps a **generation** tag, sets intentional-stop, **clears reconnect timers**, detaches handlers, closes sockets; no further connects. Optional `{ retainSlots: true }` keeps per-id rows as `closed` (operator Disconnect) |
| `disconnectLive()` | — | Ingest wrapper: `stop({ retainSlots: true })`. Nothing auto-reopens — not backoff, not the status poll, not a live-mode reassertion. Only Connect / Reconnect (`restartIngest` with `fromLiveApply`) |
| Empty URLs | — | Stay `idle` (warn once); **no** fake `open` |

Reconnect is stop-then-start: handlers are detached and generation is bumped **before** the old `ws.close()`, so a late `onclose` / `onmessage` cannot touch the new sockets. We do **not** await TCP close (impractical in the browser); the generation guard is the safety net.

HUD mode switches and `beforeunload` call ingest `stop()` so reconnect cannot fire after leave-live / teardown.

### Live URL resolution order

Documented order used by `startTelemetryIngest`:

1. **Explicit options** — `wsUrl` / `wsBoatUrl` passed into `startTelemetryIngest` (including `""` to force no connect).
2. **Vite env** — non-empty `import.meta.env.VITE_WS_URL` / `VITE_WS_BOAT_URL` (see `.env.example`).
3. **`public/config.json`** — `wsUrl` / `wsBoatUrl`.

Do **not** commit production VPS URLs or `telemetryMode: "live"` as defaults.

### Enable live locally

1. Set URLs (pick one layer):
   - `.env`: `VITE_WS_URL=…` and optional `VITE_WS_BOAT_URL=…`, **or**
   - `public/config.json`: `"wsUrl": "…"`, `"wsBoatUrl": "…"`.
2. Set `"telemetryMode": "live"` in config **or** pick **live** in the HUD mode select (mock ↔ replay ↔ live switches without reload).
3. Do **not** leave the committed default as `live`.

Empty drone URL in live mode: console warn, idle handle, app does not crash. Empty boat URL: drone-only live (OK for spine).

### Live status expose (HUD)

Live `IngestHandle` adds optional:

- `getLiveStatus()` → `LiveStatusSnapshot`: aggregate `{ drone, boat }` plus `droneIds[]` / `boatIds[]` each with `id`, `status` (`idle` \| `connecting` \| `open` \| `closed` \| `retrying`), `lastPacketAtMs`, `lastPacketAgeMs` (`null` = no packets yet), `retryInMs` (backoff remaining while `retrying`)
- `onLiveStatus(listener)` → unsubscribe; forwards channel-level `onStatus` (poll `getLiveStatus` for packet ages)
- `disconnectLive()` → close every socket, cancel backoff, keep per-id rows as `closed`
- `syncLiveIds({ boatIds, povIds })` → close sockets for ids that left the enabled set; open newly enabled ids only while still running

HUD compact line example: `ws d1=open/120ms b40=open/nopkt` — distinguishes connected-empty from receiving. `d1=retrying/500ms` is a backoff, not a dead socket. Soft console warn if a socket stays `open` with no packets for ~8s.

Mock/replay handles omit these — SCN HUD shows `ws=n/a (mock|replay)` instead of inventing sockets. Empty URLs / empty enabled ids stay `idle` (no fake `open`).

### Fleet Live enable toggles (ops)

Fleet / Live panel: per-row **Live** checkbox. **Connect live** opens sockets for checked ids. **Disconnect** closes every live telemetry socket and stays down until Connect or Reconnect (independent of SRT). While connected, unchecking Live (or deleting the row) **closes that id's socket immediately**; checking Live opens it. Defaults start unchecked (prefer empty); Add/Save turns Live on for that id. Session persists `enabledBoatIds` / `enabledPovIds`.

### Replay status expose (optional)

Replay `IngestHandle` adds optional:

- `getReplayStatus()` → `ReplayStatus` (`idle` | `playing` | `ended` | `error`)

Mock/live omit this. Not wired into SCN HUD yet — cheap for later soak/debug. Fixture load failure → `error` + console warn (ops-friendly message includes URL / HTTP / parse detail). One-shot (`loop: false`) reaches `ended`; call ingest again (HUD mode switch) or `source.start()` after stop to restart.

### `ws://` vs `wss://` (mixed content)

Browsers block **mixed content**: an **HTTPS** page cannot open `ws://` endpoints.

| Page origin | Use |
| --- | --- |
| `https://…` (Hetzner / static host) | **`wss://`** WebSocket URLs |
| `http://localhost` (Vite dev) | `ws://` or `wss://` both OK |

`LiveTelemetrySource` passes the resolved URL string through to `WebSocket` unchanged — `wss://` works when TLS terminates correctly. Empty URLs stay `idle` (no fake open).

Ops runbook (native WSS on telemetry host, or SPA-host nginx/Caddy reverse proxy → upstream `ws://`, `config.json` examples): [`docs/ops/wss-live-telemetry.md`](../../docs/ops/wss-live-telemetry.md).

Placeholder shapes (not committed defaults):

```text
wss://example.invalid/stream?client=web&id=drone1
wss://YOUR_SPA_DOMAIN/ws/drone
```

### Optional real-VPS soak (human-gated)

Not required for CI. Locally:

1. Put real URLs in `.env` (never commit).
2. `npm run dev` on `http://localhost` (so `ws://` is allowed if the VPS is plain WS).
3. HUD → **live** (or config mode `live`); confirm counters advance.
4. Switch back to **mock** — sockets must stop (check console / server).

## Replay fixture format (v1)

JSON only (not binary), served from `public/`. Shape:

```json
{
  "version": 1,
  "name": "spine-demo",
  "loop": true,
  "packets": [
    {
      "t_ms": 0,
      "channel": "drone",
      "payload": { }
    }
  ]
}
```

| Field | Rule |
| --- | --- |
| `version` | Must be `1` |
| `name` | String label |
| `loop` | `true` restarts after the last `t_ms`; `false` plays once then `ended`. Committed samples use `true`. Optional config / ingest `replayLoop` overrides this |
| `packets` | Non-empty array |
| `t_ms` | ms from replay start; finite ≥ 0; monotonic non-decreasing |
| `channel` | `"drone"` \| `"boat"` \| `"buoy"` (connection context; buoy = boat-shaped payload) |
| `payload` | Object matching wire DTOs — drone pose, boat, or `stream_anchor` |

Replay serializes each `payload` → JSON text and feeds `ingestPacket`, so the router / `stream_anchor` path stays real. A live→fixture recorder is **not** implemented here.

Sample: [`public/fixtures/telemetry/spine-demo.json`](../../public/fixtures/telemetry/spine-demo.json) — drone `1` + boat `21` near Istanbul (~3 s loop), includes `stream_anchor`.

Fleet sample (multi-id tests / SCN registry): [`public/fixtures/telemetry/spine-fleet.json`](../../public/fixtures/telemetry/spine-fleet.json) — drone `1` + boats `21–24` (~1.6 s loop). Default `replayUrl` stays `spine-demo`; point config at `spine-fleet` when exercising multi-boat replay.

POV sample (multi-drone for SCN camera switch): [`public/fixtures/telemetry/spine-pov.json`](../../public/fixtures/telemetry/spine-pov.json) — drones `1` + `2` + boat `21` (~1.2 s loop). Point `replayUrl` at `/fixtures/telemetry/spine-pov.json` when exercising multi-POV replay; committed default remains `spine-demo`.

Invalid fixtures fail soft: console warn with URL + reason (missing 404, bad JSON, schema), ingest returns a no-op `stop` with `getReplayStatus() === "error"`, app does not crash.

## Verify mock is alive

```bash
npm run dev
```

Open the app (default mode **mock**). You should see:

1. Scene + ops HUD.
2. Status line with rising `drone` / `boat` / `stream_anchor` counters.
3. HUD hint: `mock source`. Switch to **replay** → hint `fixture replay`. Switch to **live** → hint `live WS` (needs URLs; empty URLs warn and stay idle). Switch back to **mock**.

```bash
npm run build
npm run test
```

Must succeed with no TypeScript errors; Vitest covers fixture parse/playback and live WS (fake WebSocket) → bus.

## Channel IDs (mock / fixtures)

- POVs / drones+cams: configured `povIds` (default `"1"`, `"2"`; bands `1–4` ∪ `11–12`). Legacy export `MOCK_DRONE_ID === "1"` remains for single-id callers; prefer `povIds[0]` / configured list.
- Boats: configured `boatIds` (default `"21"`…`"24"`). Legacy export `MOCK_BOAT_ID === "21"` remains for single-id callers; prefer `boatIds[0]` / configured list.
- Buoys: configured `buoyIds` (default none). Suggested demo `MOCK_BUOY_ID === "91"`. Own namespace — must not collide with race boat ids.
- Pilots `81–84`: out of scope

## Out of this module (other orchestrators)

No ECEF/ENU (GEO), no Three boat/drone meshes / fleet registry / POV camera switch (SCN), no fixture recorder, no live multi-URL (multi-drone or multi-boat). WSS/proxy ops live under PLT [`docs/ops/wss-live-telemetry.md`](../../docs/ops/wss-live-telemetry.md) — this module only consumes URL strings.

## NTP-indexed history (`telemetryHistory.ts`, Phase 17.1 + TEL-08)

Sampler: **where was every tracked entity at NTP instant `t`?** No ENU, no Three.js, no timers. TEL-08’s pose pipeline subscribes `drone` / `boat` / `buoy` onto this buffer and, in matched mode, converts `sampleAt(t_ntp)` through `droneRawPose` / `boatRawPose`.

`createTelemetryHistory({ windowMs = 30000 })` keeps a per-id ring (hard cap `maxSamplesPerEntity = 512`). Inserts key drones on `packet.ts` and boats/buoys on `packet.time`. Out-of-order arrivals insert by stamp; duplicate stamps last-win. **Drones store on `id` + finite `ts` even without GPS and even when `ntp_synced` is false** (TEL-10). Missing `pos` defaults to `{lat:0,lon:0,alt:0}`. Unsynced / `ntp_err_ms === 2147483647` packets are kept and sampled as `quality.degraded`. Boats/buoys still require NTP lock (`t_sync` / `t_err`); missing lat/lon copies the last usable fix (do not drop a packet that has `time` because GPS is late).

| Call | Policy |
| --- | --- |
| `sampleDroneAt(id, ntpMs)` | Bracket A ≤ t ≤ B. GPS: **cubic Hermite** on lat/lon/alt from NED `vel` at A and B (C1). If either vel is unusable (non-finite), **linear** lerp for that segment. GPS only when **both** samples have usable lat/lon; otherwise last usable fix is held (do not walk toward 0,0). Attitude: shortest-path Euler **and** xyzw **slerp** (not nearer-copy). Constant-velocity + matching vel ⇒ Hermite ≡ linear (midpoint is the linear midpoint — no extra lag). No B: NED `vel` extrapolate ≤ **150 ms** only if GPS is usable, then `held` until **2 s**, then `unavailable`. Cubic does **not** extend that window. Gap > **500 ms** or unsynced → `degraded`. `vel` is **NED** (x north, y east, z down); projected position stays lat/lon/alt — converters own ENU. Pipeline `holdDroneEnu` still blocks GEO-projecting 0,0. |
| `sampleBoatAt` / `sampleBuoyAt` | Last fix A with `A.time ≤ t`. **Never wait for B.** If `A.spd < 0.3` or `A.brg === 0`, **do not project** (`brg === 0` means bearing unknown, not north). Else `dist = spd * dt` along `brg` (deg east of true north). If B exists and **both** ends have usable GPS + valid brg/spd, cubic Hermite on lat/lon (alt stays linear); otherwise blend DR toward B so the projection cannot overshoot as t → B. `fix_age_ms` is read off the object (not on the TS type); `0` = unknown; **> 200 ms** skips DR. |
| `prune(nowNtpMs?)` / `reset()` / `stats()` | Window trim; clear; per-entity `{ count, oldestNtpMs, newestNtpMs, lastGapMs }` for the ops HUD. |

Each sample is the interpolated **DTO plus** `{ mode, sourceAgeMs, degraded }`. `mode` is `'interpolated' \| 'extrapolated' \| 'held' \| 'unavailable'`. Unknown id / no data / t before the first stamp → `null` (no throw). Unknown id and empty history are `null`; a stale-but-known entity returns a DTO labelled `unavailable` so callers can badge without guessing.

## PTS→NTP map (`ptsNtpMap.ts`, Phase 17.1 + TEL-08)

LUT: **given a 90 kHz PTS on stream `S`, what NTP ms was that frame captured?** No I/O, no timers. The pose pipeline subscribes `telemetryBus` `'stream_anchor'` and calls `getPtsNtpMap(anchor.stream_id).addAnchor`, **and** aliases into the mapped SRT id / telem id when Fleet has a POV mapping, **and** aliases producer `dji-N` / `djiN` into the digit id (`dji-1` → `"1"`). **Lookup tries SRT id first, then telemetry `povId`.**

`t_ntp = toNtp(pts) + syncTrimMs` (CAL-05 sign: positive = AR leads video) is applied in the pose pipeline, not inside `toNtp`.

`createPtsNtpMap(options?)` is one instance per `stream_id`. `getPtsNtpMap(streamId)` / `clearPtsNtpMaps()` is the small registry so callers do not hand-roll a `Map`.

| Call | Behaviour |
| --- | --- |
| `addAnchor(anchor)` | `kind ∈ dji \| periodic \| gopro` → **pacing** (feeds the fit). `kind:frame` → **truth** (validation only) when pacing already has ≥2 samples; if pacing has < 2, `kind:frame` **is** the fit series (same OLS / unwrap / 2 s extra — no fake `kind: dji`). Prefer `pts_90khz`, else `pts_basis_90khz`; mask to unsigned 33-bit and unwrap with shortest signed difference. Reject `ntp_synced === false`, non-finite NTP, or unusable PTS (counted on `health().rejected`). |
| `toNtp(pts90k)` | `{ ntpMs, mode, extrapolatedByMs }`. In-span → `interpolated`. Newer than last fit sample, ≤ **2000 ms** → `extrapolated` (the live case; §4.a reject-after-last is wrong here). Beyond that / no fit / before first → `unavailable`, `ntpMs: null`. Frame-only needs two `kind:frame` samples; periodic-only is unchanged. |
| `health()` | `{ pacingCount, frameCount, slope, lastAnchorNtpMs, lastPacingPts90k, lastAnchorAgeMs?, rejected, residualMs }`. `pacingCount` / `lastPacingPts90k` follow the **fit series** (frames when frame-only). `slope` is NTP-ms vs PTS-ms (≈ **1.0**). `residualMs` is MAE of `kind:frame` vs the fit. Plain serialisable object for OUT-07. |
| `reset()` / `dispose()` | Clear; `dispose` also unregisters from the registry. |

**Fit:** least-squares line over the fit series in a **30 s** NTP window (count cap 64 pacing / 512 frame). Fit series is pacing when it has ≥2 samples, else `kind:frame` when that has ≥2. Second pass drops points with residual > **1000 ms**, then refits — a single seconds-off `ntp_capture_ms` cannot hinge the line. Backwards NTP vs the fit by > **1000 ms** drops the window and rebuilds (clock step). JS bitwise `&` is 32-bit, so wrap uses modulo `2^33`.

This is the amended live behaviour vs `ntp-matching.md` §4.a (pairwise interpolate + reject after last). See `docs/architecture/ar-video-underlay-ntp-sync.md` §4.2.

## Flow tap (`flowTap.ts`, TEL-10)

Per-id ring of the last **12** JSON-safe events (`drone` / `boat` / `buoy` / `anchor` / `srt`) for the SCN-10 Flow panel. `push` copies enumerable JSON fields only and redacts `streamid` last segment / `passphrase` in any string. `snapshot()` returns a serialisable list (newest first). Pose pipeline pushes accepted packets and every `stream_anchor`. SCN may `push` `kind:'srt'` with an already-redacted body. **No DOM here.**

`remove(id)` drops one ring. `retain(ids)` keeps only those ids. `reset()` still clears everything. `main` calls `retain` on fleet change and project load so a deleted drone/boat/buoy disappears from the tap immediately. Do **not** clear `telemetryHistory`, `ptsNtpMap`, or the pose bus from this path — the tap is a debug view.

SCN `buildFlowCards` always shows current registry ids (empty card if idle, including operator-disconnected). An id **not** in the registry is shown only while its newest tap event is within **5 s** (`FLOW_CARD_RECENCY_MS`).
