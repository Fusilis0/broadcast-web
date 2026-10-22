# NTP matching for video, pose, and boat GPS

This guide is for an engineer implementing **consumer-side** matching in `broadcast-web` (Three.js): given a decoded video frame’s PTS, find the NTP time of that frame, then sample DJI pose and boat GPS at that time.

It assumes no prior context. Every wire field and formula below is taken from the **current** producer and consumer code (after TimeSync, GPS capture-time stamps, DJI mux-delay EMA, and GoPro post-loopback EMA). Where a number comes from a lab session rather than code, it is labeled as such. Where the code does not give a clear answer, that is flagged instead of filled in.

**What exists today in `broadcast-web`:** ingest classifies packets and emits them on `telemetryBus`. The pose pipeline (`src/pose/pipeline.ts`) **does not** use `stream_anchor`. It lerps the latest pose/GPS packet over the interval between packets using `performance.now()`. `spd` is ignored on the live pose path. Matching at `t_ntp(pts)` is **not implemented** — that is the work this document specifies.

---

## 1. Why this system exists

Three independent devices produce data that must line up in one 3D scene:

- A DJI aircraft phone publishes **pose** (lat/lon/alt, gimbal, velocity) and **H.264/HEVC video**.
- A second phone (`gps_111`) publishes **boat GPS**.
- A GoPro phone publishes **video** (and anchors), not GPS.

Each phone has its own quartz oscillator. Android `System.currentTimeMillis()` can jump when the user or the network changes the wall clock. Video timestamps (**PTS**) are worse: they are a **counter** in the MPEG-TS muxer, in units of 1/90 000 of a second, starting at 0 when the muxer starts. PTS is not “time of day.” Two streams with PTS = 90000 are not the same instant unless you know when each muxer started.

The producers therefore:

1. Lock each phone to a **shared NTP server** (operator VPS, UDP port 123) using `TimeSync`, and expose a monotonic “NTP now” via `TimeSync.nowNtpMs()`.
2. Stamp telemetry with that NTP clock (`ts` on DJI pose, `time` on boat GPS).
3. Emit **stream_anchor** messages that pair a muxed video **PTS** with an NTP capture estimate (`ntp_capture_ms`).

The consumer’s job is: **PTS → NTP via anchors, then NTP → interpolated pose/GPS.** Same-device matching (DJI video vs DJI pose) mostly cancels a common NTP offset. **Cross-device** matching (DJI video vs boat GPS, or GoPro video vs boat GPS) does not: each phone’s remaining NTP error adds.

---

## 2. The wire contracts

All of these travel as JSON text over WebSocket. The VPS router (`server.js` on `host:8080`) fans out by **query-string channel**, not by JSON `kind`. Publishers connect as `ws://host:8080/ws?type=drone|boat&id=<channel>`. Subscribers connect as `type=client&subscribe=<channel>`.

**Router flag (must confirm before treating GoPro as live):** the live router only accepts query `type=drone|boat|client`. GoPro’s `AnchorPublisher.buildAnchorUrl` currently uses `type=anchor`. That query is **rejected** (close 1008) by the live `server.js` unless something else has changed on the VPS or GoPro is pointed at a different URL. DJI pose and DJI anchors share the **same** `type=drone&id=N` socket, so they fan out together. gps_111 often uses `type=drone` in the URL even though the JSON shape is boat GPS; the router’s *log* classifier then labels the body `BOAT` because it has `lat`+`time`+`id`. Fan-out still follows the query `id`.

Malformed JSON is dropped. `type === "stream_anchor"` is logged as `ANCHOR`; objects with `pos` or `seq` as `DRONE`; objects with `lat`+`time`+`id` as `BOAT`. Classification does **not** change which subscribers receive the message.

### 2.1 DJI pose (`TelemetryData`)

Published ~every **100 ms** (10 Hz) from `TelemetryCollector`, skipped if the DJI SDK has not updated location/attitude for **2 s**.

```json
{
  "ts": 1787668040672,
  "ntp_synced": true,
  "ntp_err_ms": 30,
  "seq": 412,
  "id": "5",
  "pos": { "lat": 41.084, "lon": 29.004, "alt": 12.3 },
  "rot": { "yaw": 10.0, "pitch": 2.0, "roll": -1.0 },
  "gimbal": { "yaw": 15.0, "pitch": -20.0, "roll": 0.0 },
  "vel": { "x": 1.2, "y": -0.3, "z": 0.05 },
  "cam": { "fov": 84.0 },
  "meta": { "bat": 87, "sat": 14, "sig": 3 }
}
```

| Field | Unit | Meaning |
| --- | --- | --- |
| `ts` | ms | `TimeSync.nowNtpMs()` at publish. **Load-bearing** for matching. |
| `ntp_synced` | bool | NTP lock. **Load-bearing** (gate). |
| `ntp_err_ms` | ms | ±offset uncertainty (`delay/2` of last NTP sample, clamped 1–500, exposed ≤10000). If **not** synced, `estimatedErrorMs()` returns `Int.MAX_VALUE` (2147483647) — treat as unsynced, not as a real error. Informational once synced. |
| `seq` | int | WebSocket sequence. Informational. |
| `id` | string | Drone slot (e.g. `"5"`). Load-bearing for entity identity. |
| `pos.lat/lon` | deg | WGS84. Load-bearing. |
| `pos.alt` | m | Aircraft altitude from the DJI SDK (MSL-style in collector). Load-bearing. |
| `rot.*` | deg | Aircraft Euler. Informational if gimbal is present. |
| `gimbal.*` | deg | Gimbal Euler. Load-bearing for camera attitude. Existing `droneRawPose` uses gimbal yaw and **negates** pitch/roll for the scene convention. |
| `vel.x/y/z` | m/s | `FlightControllerKey.KeyAircraftVelocity` copied through with no remapping. DJI documents this as **NED** (x north, y east, z down). Load-bearing for pose dead-reckoning. Convert before using in a scene where x=east, z=−north. |
| `cam.fov` | deg | Default **84**. Informational; live pose FOV currently comes from calibration, not this field. |
| `meta.bat/sat/sig` | int | Battery %, GNSS sats, signal. Informational. |

The TypeScript type `TelemetryData` also lists quaternion `x,y,z,w` on `rot`/`gimbal`. **The DJI sender does not emit those**; only Euler degrees.

### 2.2 Boat GPS (`GpsData` / `BoatTelemetry`)

```json
{
  "lat": 41.0840585,
  "lon": 29.0045248,
  "alt": 167.8,
  "acc": 5.095,
  "spd": 0.72,
  "brg": 156.6,
  "time": 1787668040672,
  "id": "31",
  "t_sync": true,
  "t_err": 30,
  "fix_age_ms": 24
}
```

| Field | Unit | Meaning |
| --- | --- | --- |
| `lat`/`lon` | deg | WGS84. **Load-bearing.** |
| `alt` | m | Android `Location.altitude` (HAE, not AMSL). Load-bearing for 3D; existing `boatRawPose` treats it as HAE. |
| `acc` | m | Horizontal accuracy reported by FLP. Informational for matching; hardware floor, not a timestamp. |
| `spd` | m/s | Ground speed (`Location.getSpeed()`). **Load-bearing for dead reckoning.** |
| `brg` | deg | Course, degrees **east of true north**, 0…360. **Load-bearing for DR.** Forced to **0** when speed ≤ **0.3 m/s** and `hasBearing()` is false (API 30+ uses `hasBearing()` instead). |
| `time` | ms | NTP of the **GNSS/FLP fix**, not of the callback: `nowNtpMs() − fix_age_ms`. **Load-bearing.** |
| `id` | string | Boat slot (e.g. `"31"`). Load-bearing. |
| `t_sync` | bool | NTP lock. **Load-bearing** (gate). |
| `t_err` | ms | Same uncertainty as `ntp_err_ms`. **−1** if not synced (unlike DJI’s `Int.MAX_VALUE`). |
| `fix_age_ms` | ms | Age of the location sample on the phone’s monotonic clock when the packet was built. **Load-bearing** for gating. `0` means the platform did not expose a fix elapsed time (treat as unknown, not as “perfect”). |

Ingest (`ingest.ts`) only *requires* `id`, `lat`, `lon`, `time` to accept a boat packet. Extra fields (`spd`, `brg`, `fix_age_ms`) are preserved on the object if present.

### 2.3 `stream_anchor`

Shared envelope from DJI `TelemetryWebSocketClient.buildStreamAnchorJson` and GoPro `AnchorPublisher.buildStreamAnchorJson`:

```json
{
  "type": "stream_anchor",
  "stream_id": "5",
  "kind": "periodic",
  "fps": 30,
  "pts_90khz": 90000,
  "ntp_capture_ms": 1787668041000,
  "ntp_synced": true,
  "ntp_err_ms": 30,
  "q_delay_ms": 42,
  "ema_delay_ms": 40
}
```

First/basis packets use `pts_basis_90khz` instead of `pts_90khz`.

| Field | Unit | Meaning |
| --- | --- | --- |
| `type` | string | Always `"stream_anchor"`. Classifier key. |
| `stream_id` | string | Must match the video path you are decoding. **Load-bearing.** DJI: drone id. GoPro: SRT `streamId` or `"gopro"`. |
| `kind` | string | See tables below. **Load-bearing** (which list the LUT uses). |
| `fps` | 1/s | Nominal frame rate used by the PTS generator (typically 30). Informational for pacing; PTS deltas are authoritative. |
| `pts_basis_90khz` / `pts_90khz` | 90 kHz ticks | Muxed PES PTS (33-bit). **Load-bearing.** DJI first (`kind:dji`) currently sends **basis 0**. |
| `ntp_capture_ms` | ms | Estimated NTP of that access unit (formulas in §3). **Load-bearing.** |
| `ntp_synced` | bool | **Load-bearing** (gate). |
| `ntp_err_ms` | ms | Clock uncertainty. Informational once synced. |
| `q_delay_ms` | ms | Raw enqueue→mux (or receive→parse) delay this sample. Omitted if &lt; 0. Informational / debug. |
| `ema_delay_ms` | ms | Filtered delay. Omitted if &lt; 0 (including GoPro before the first EMA sample, which reports −1 internally). Informational. |

**DJI kinds**

| `kind` | When | PTS field | `ntp_capture_ms` | Queued if WS down? |
| --- | --- | --- | --- | --- |
| `dji` | First muxed AU | `pts_basis_90khz` (0) | EMA-smoothed | Yes |
| `periodic` | ≥1000 ms NTP after previous periodic | `pts_90khz` = mux PTS | EMA-smoothed | Yes |
| `frame` | Every muxed AU if `sendPerAuFrameAnchors` (default **true**) | `pts_90khz` | **Unsmoothed** raw delay | **No** (`trySendEphemeral`) |

**GoPro kinds** (no `frame` kind in current code)

| `kind` | When | PTS field | `ntp_capture_ms` |
| --- | --- | --- | --- |
| `gopro` | First video PES (passthrough) or first muxed HEVC AU | `pts_basis_90khz` | EMA + residual bias |
| `periodic` | Every 30th PES/AU (`pesSeen % 30 == 0`, ~1 Hz at 30 fps) | `pts_90khz` | EMA + residual bias |

`broadcast-web` `tryParseStreamAnchor` copies the listed fields and **drops** `q_delay_ms` / `ema_delay_ms`. Extend the parser if you need those for diagnostics.

### 2.4 Load-bearing vs informational (matching)

**Must use**

- Pose: `ts`, `id`, `pos`, `gimbal` (attitude), `vel` (DR), `ntp_synced`
- Boat: `time`, `id`, `lat`, `lon`, `spd`, `brg`, `t_sync`, `fix_age_ms`
- Anchors: `type`, `stream_id`, `kind`, PTS field, `ntp_capture_ms`, `ntp_synced`

**Do not use for pacing / interpolation**

- `kind: "frame"` in the **pacing** array when a `dji`/`periodic`/`gopro` fit already exists (≥2 samples) — residual / accuracy only. **Exception (broadcast-web TEL-04, live DJI 2026-08-28):** if that pacing series has fewer than 2 samples, frames **are** the OLS series. Extra window still 2 s. Do not invent a fake `kind: dji`.
- `q_delay_ms` / `ema_delay_ms` (already baked into `ntp_capture_ms`)
- `acc`, `meta`, `seq`, `cam.fov` (unless you have a separate UI need)
- `t_err` / `ntp_err_ms` as a match *window* — they are uncertainty labels, not a search radius. Use them to **gate**, not to slide timestamps.

---

## 3. What each producer guarantees after recent fixes

### 3.1 Shared `TimeSync` (DJI, gps_111, GoPro — same algorithm, three copies)

- NTP: 8 UDP samples to `host:123`, keep lowest delay &lt; 250 ms; on success sleep **30 s**; on failure sleep 5 s; after 3 UDP fails, HTTP `GET /time`.
- Round-trip uses `elapsedRealtimeNanos`. T4 is **T1 + monotonic RTT**, not a second wall-clock read. Apply uses the winning sample’s T4 elapsed (not “now after 8 samples”).
- `nowNtpMs() = baseWall + Δelapsed_ms × (1 + drift)` with a two-point drift EMA (UDP only, ≥5 s apart, \|rate\| ≤ 200 ppm).
- `estimatedErrorMs()` is **delay/2** (offset uncertainty), not full RTT. MQTT/WS `ntp_err_ms` / `t_err` **halved** vs the old meaning. Matching/lerp never read this field today.
- When locked, the advertised error is typically tens of milliseconds. It is a **label**, not a measured cross-device offset.

Same-device (DJI video vs DJI pose) still cancels the common NTP offset. Cross-device errors add.

### 3.2 DJI video + pose

**Pose:** 10 Hz when the SDK is fresh; silence &gt; 2 s → no publish. `ts` = NTP at the telemetry tick, not at photon time.

**Video PTS:** synthetic 90 kHz from `SimplePtsGenerator` at **30 fps → 3000 ticks/AU** (`0, 3000, 6000, …`), 33-bit mask. Same generator for passthrough and HEVC mux. PES PTS is **not** the camera sensor timestamp.

**Capture NTP (after mux-delay EMA):**

```
ema (dji/periodic):  ntp_capture_ms = nowNtpMs() − round(emaDelayMs) − anchorPreCallbackOffsetMs
frame (per-AU):      ntp_capture_ms = nowNtpMs() − (muxNs − enqueueNs)/1e6 − anchorPreCallbackOffsetMs
```

- Enqueue = `elapsedRealtimeNanos` at the SDK NAL callback. Mux = after `muxWithPtsDirect` succeeds. HEVC keeps a FIFO of enqueue times so anchors track the **muxed** PTS, not the pre-transcode NAL.
- EMA τ = **2000 ms**, slew = **40 ms/s**. First sample is unfiltered.
- `anchorPreCallbackOffsetMs` default **0** — photon/SDK→callback delay is **not** measured. Do not assume DJI anchors are photon-accurate; they are **NAL-callback-accurate** minus mux queue.

### 3.3 gps_111 boat GPS

**Stamp:** `time = nowNtpMs() − fix_age_ms` using `Location.getElapsedRealtimeAgeMillis()` (API 33+) or elapsed nanos. This is fix time, not callback time.

**Requested FLP:** `PRIORITY_HIGH_ACCURACY`, interval 100 ms, fastest 0, maxDelay 0, `waitForAccurateLocation=false`. Existing phones may still have persisted 500 ms / balanced until config is overwritten.

**Achieved rate is not 100 ms.** From the **2026-08-25** VPS archive `ws-20260825-14.ndjson.gz` (not in git): **890** `kind=BOAT` frames, `channel_id` **31**, `time` **14:27:20.672–14:40:40.394 UTC** (~13.3 min).

| Metric | Value |
| --- | --- |
| Session mean rate | 1.11 Hz |
| Median Δt (`time`) | **504 ms** |
| Moving (spd ≥ 0.3), gaps &lt; 3 s | median **443 ms** (~**2.17 Hz**) |
| Near 50–150 ms | 84 / 889 pairs (9%) |
| `fix_age_ms` median / p95 | **30 ms** / 117 ms (excl. first) |
| First-fix `fix_age_ms` | **1585 ms** |
| Median `acc` | **5.1 m** |
| Median `spd` | 0.72 m/s |
| Gaps 5–10 s | 51, mostly while almost still (~6.3 s FLP silences) |
| `t_sync` | true on all 890 |

Do **not** tell the interpolator to expect 10 Hz GPS. Plan for ~0.5–1 s between fixes in motion, slower when parked, and occasional ~6 s holes while still.

### 3.4 GoPro video

**Measurable in software:** delay after loopback UDP arrives in the Android process.

- Passthrough: UDP `receive` elapsed → PES PTS parse (typically **sub-ms to a few ms**).
- HEVC: H.264 AU assembled → encode → **SRT send** (includes input prime default 15 frames and `outputQueue` cap default **240 frames** ≈ 8 s). Anchors use **`muxPts90k` at send**, step **3003** ticks (~29.97 fps), not pre-transcode loopback PTS.

```
ntp_capture_ms = nowNtpMs() − round(ema) − anchorFfmpegBiasMs
```

`anchorFfmpegBiasMs` default **0**. It is the **uncalibrated residual**: camera-internal + Wi-Fi + FFmpeg remux (FFmpeg has no T1 we can read). **Do not treat GoPro `ntp_capture_ms` as photon time.** Passthrough matching still has a residual that is likely **most** of the capture-to-anchor delay (often 150–400+ ms on GoPro webcam Wi-Fi — that range is typical of the product class, **not** measured in our archive). HEVC queue delay *is* subtracted; the same residual remains.

GoPro does **not** emit `kind:frame`. Linear interpolators should treat `gopro`+`periodic` like DJI `dji`+`periodic`.

---

## 4. Exactly what the consumer must implement

### 4.a PTS → NTP lookup

Keep **one map per `stream_id`**. Split each map into two series:

1. **Pacing series** (linear interpolators): `kind ∈ { "dji", "periodic", "gopro" }`. Use `ntp_capture_ms` as-is (already EMA-smoothed on the producer).
2. **LUT / truth series**: `kind === "frame"` (DJI only). Unsmoothed enqueue NTP for that exact AU. **Do not** insert these into the linear interpolator. Use them to (i) look up the nearest AU when you already have that PTS, or (ii) sanity-check that periodic NTP is within a few tens of ms of the local frame samples.

**PTS field:** prefer `pts_90khz`; on the first packet use `pts_basis_90khz`. Store as unsigned 33-bit (`pts & 0x1ffffffff`).

**Wrap:** MPEG-TS PTS wraps every \(2^{33}/90000 \approx 95443\) s. For interpolation, take the shortest signed 33-bit difference:

```
function ptsDiff(a, b) { // b - a, wrapped
  // JavaScript `&` is 32-bit (ToInt32). Do **not** use `& 0x1ffffffff`.
  const MOD = 0x200000000 // 2^33
  let d = ((b - a) % MOD + MOD) % MOD
  if (d >= 0x100000000) d -= MOD
  return d
}
```

**Live consumer (Phase 17):** `broadcast-web` does **not** use pairwise interpolation + reject-after-last for presentation. Live frames are always newer than the ~1 Hz periodic anchor, so the shipped mapper is a 30 s robust linear fit with bounded (~2 s) forward extrapolation (`src/telemetry/ptsNtpMap.ts`). Pairwise interpolate below remains the recording / VOD algorithm.

**Interpolate** (pacing series, sorted by PTS):

```
given decodePts:
  find i such that pts[i] ≤ decodePts ≤ pts[i+1]  (using wrapped compare)
  if none: reject (before first / after last / gap too large)
  w = ptsDiff(pts[i], decodePts) / ptsDiff(pts[i], pts[i+1])
  ntp = ntp[i] + w * (ntp[i+1] - ntp[i])
```

Reject the pair if `ntp[i+1] < ntp[i]` (clock step) or if the PTS span implies &gt; ~2 s of video (missing anchors). Require `stream_id` to equal the stream you are decoding (DJI drone id vs GoPro SRT id — they are different namespaces).

**DJI first point** has PTS **0** and `kind:dji`. After that, periodic points carry the actual mux PTS. `frame` points share that same synthetic PTS sequence (3000 ticks/frame). GoPro HEVC uses **3003** ticks/frame — do not assume 3000 for GoPro.

**Current TEL gap:** `pipeline.ts` never reads this LUT. `ingest.ts` already emits `stream_anchor` on `telemetryBus`. Subscribe there.

### 4.b Pose interpolation (DJI)

Buffer pose packets by `ts` (NTP ms), same `id` as the video `stream_id` you matched.

```
t = ntp from 4.a
find samples A, B with A.ts ≤ t ≤ B.ts
if no B: optionally extrapolate from A using vel for |t - A.ts| < T_max (e.g. 150–200 ms); else hold/degrade
u = (t - A.ts) / (B.ts - A.ts)

pos_ll = lerp(A.pos, B.pos, u)          // lat/lon/alt
or pos_enu = enu(A) + u * (enu(B)-enu(A))

attitude = lerpEuler(A.gimbal, B.gimbal, u)   // shortest-path on yaw

// optional DR along the segment, vel is NED m/s:
dt = (t - A.ts) / 1000
north += A.vel.x * dt
east  += A.vel.y * dt
down  += A.vel.z * dt
```

**broadcast-web (`telemetryHistory.sampleDroneAt`, DSP-TEL-20260828-01):** between A and B this is **not linear-only**. Lat/lon/alt use cubic Hermite from NED `vel` at both ends (linear fallback if either vel is unusable). Gimbal/rot Euler stay shortest-path lerp; quaternion `x,y,z,w` is **slerped** (not nearest-sample copy). Past the newest sample the window is unchanged: NED vel ≤150 ms, then hold — cubic does not extend it. Sample at the matched `t_ntp`, not wall-clock now.

Convert NED → scene ENU if the rest of the pipeline uses east / up / −north (existing `boatToStandardTelemetry` uses `vel.x = east`, `vel.z = −north`). Existing `droneRawPose` does **not** apply `vel`.

Do not lerp across a gap where `B.ts - A.ts` is many times the 100 ms pose period (e.g. &gt; 500 ms) without degrading. The producer already omitted stale SDK pose (&gt; 2 s); the consumer should still timeout if packets stop.

### 4.c Boat dead reckoning

Buffer boat packets by `time`. Target `t` is the same NTP from 4.a (cross-device: boat GPS vs DJI or GoPro video).

```
A = last fix with A.time ≤ t
B = next fix with B.time > t  (optional, for clamping)

if A.spd < 0.3 or A.brg === 0:
  // gps_111 zeros bearing when it does not trust course
  do not project — hold A.lat/lon (or wait for B)
else:
  dt = (t - A.time) / 1000
  dist = A.spd * dt
  br = A.brg * π / 180
  north = dist * cos(br)
  east  = dist * sin(br)
  // WGS84 step, or ENU then inverse
```

Scene mapping already used in `boatToStandardTelemetry.ts`:

```
vel.x = spd * sin(brg°)     // east
vel.y = 0
vel.z = -spd * cos(brg°)    // −north
```

**Do not** dead-reckon through `brg === 0` just because `spd` is small-but-nonzero: the producer uses 0 for “unknown,” not “north.”

If `B` exists, clamp the projection so it does not overshoot `B` when `t` is near `B.time` (linear blend of DR endpoint vs `B` is fine). Measured median step between fixes in motion was **0.55 m**; GNSS `acc` median **5.1 m** — DR between packets is smaller than GPS noise. Turns are worse than straight segments; still do not invent a high-rate GPS track.

### 4.d Gating / rejection

Refuse or mark degraded when:

| Condition | Action |
| --- | --- |
| Pose `ntp_synced === false` or boat `t_sync === false` or anchor `ntp_synced === false` | Do not use that sample for a precise match. |
| Boat `t_err === -1` | Not locked (gps_111). |
| Pose `ntp_err_ms === 2147483647` | Not locked (DJI). |
| Anchor `stream_id` ≠ decoded video id | Ignore (wrong LUT). |
| `kind === "frame"` in the linear interpolator | Ignore for pacing. |
| Boat `fix_age_ms` large vs session (e.g. **&gt; 200 ms**; first-fix **1585 ms** in the archive) | Down-weight or skip DR; prefer a later fix. `0` = unknown age, not perfect. |
| No periodic/dji/gopro anchors yet, or last pacing anchor older than ~2–3 s of video | No PTS→NTP; do not fake it from `performance.now()`. |
| Pose gap ≫ 100 ms or GPS gap ≫ 1–2 s (except known ~6 s still-holes) | Hold last / degrade; do not extrapolate across a tracking pause. |
| GoPro match to GPS/pose | Apply extra residual budget (see §5); never assume photon-accurate GoPro NTP. |

`ingest.ts` `isBoatTelemetry` does not require `t_sync`. You must check it yourself.

---

## 5. Known limits the consumer should not try to “fix”

- **HLS / dashboard video latency** is seconds of buffer. This matching path is for a decoder that exposes MPEG-TS PTS (or an equivalent 90 kHz clock). Do not try to recover sub-frame sync from an HLS playhead.
- **GPS spatial accuracy** (median **5.1 m** `acc` in the 2026-08-25 session) is a chip/FLP floor. Interpolation will not make it RTK.
- **GPS rate** will not become 10 Hz because you interpolate. The phone delivered ~2.2 Hz in motion.
- **GoPro camera + Wi-Fi + FFmpeg remux** is uncalibrated (`anchorFfmpegBiasMs = 0`). Post-loopback queue delay is already removed. A future clapper or GPMF correlation is required for the rest. Do not bake a guessed 200 ms into TEL.
- **DJI `anchorPreCallbackOffsetMs`** is still **0**. Anchors are NAL-callback time, not photon time.
- **NTP path asymmetry** remains up to ~`ntp_err_ms` per phone. Cross-device RSS of two ~30 ms uncertainties is ~40 ms even in the ideal case.
- **Synthetic PTS** (DJI 3000 ticks/frame, GoPro HEVC 3003) is assigned at mux, not read from the sensor. The LUT maps *mux PTS* to NTP, which is what the decoder will see.

---

## 6. Glossary

**NTP.** Network Time Protocol. Here: each phone measures offset to the VPS NTP server and exposes `nowNtpMs()` — milliseconds on that shared timeline, advanced with `elapsedRealtimeNanos` (and a small drift term) between 30 s resyncs.

**PTS.** Presentation Time Stamp in MPEG-TS, 90 kHz ticks, 33-bit. A muxer counter, not wall-clock time. Matching requires `stream_anchor` to translate PTS → NTP.

**elapsedRealtimeNanos.** Android monotonic nanoseconds since boot. Used for RTT, fix age, and enqueue→mux delay so a user clock change cannot corrupt a measurement in flight.

**EMA.** Exponential moving average. DJI/GoPro filter enqueue→mux delay with τ = 2000 ms and a 40 ms/s slew cap so 1 Hz anchors do not jump with single-frame queue spikes.

**Dead reckoning.** Projecting position forward from the last GPS fix using speed and bearing when you need a location at a time *between* fixes.

**stream_anchor.** JSON `{ type:"stream_anchor", stream_id, kind, pts_*, ntp_capture_ms, … }` pairing a muxed PTS with an NTP estimate.

**fix_age_ms.** Milliseconds between the GNSS/FLP sample and send, on the phone monotonic clock. Subtracted from `nowNtpMs()` to form boat `time`.

**ntp_capture_ms.** Producer estimate of NTP at that video access unit, after subtracting measured queue delay (and, on GoPro, the residual bias knob).

**NED vs ENU.** North-East-Down (DJI `vel`) vs East-North-Up (scene / `boatToStandardTelemetry`: x east, z −north). Convert before mixing with Three.js positions.

---

## Appendix: what `broadcast-web` does today

| Piece | Behavior |
| --- | --- |
| `classify` / `tryParseStreamAnchor` | Detects `type==="stream_anchor"`; does not keep delay extras. |
| `ingest.ts` | Emits `stream_anchor`, `drone`, `boat`, `buoy`. Boat test is `id+lat+lon+time` only. |
| `pipeline.ts` | Subscribes drone/boat/buoy only. `ts` stored but lerp is driven by packet arrival + `performance.now()`. Comment in source states anchors are unused. |
| `boatRawPose` | Yaw = `brg`; **ignores `spd`**. |
| `boatToStandardTelemetry` | Maps `spd`/`brg` into `vel` / `rot.yaw` for other consumers; pose pipeline does not call it. |

The implementation this document describes is **new work** on top of that ingest bus, not a description of the current pose loop.
