# SRT_MEMO

**Last updated:** 2026-09-04  
**Status:** **(a) decode-error fixed**; **post-a jitter** fixed; **(b) present-lock** verified; **round-4 AR frame-identity** fixed (OUT freshness gate); **round-5 2dGrab scheduling** live-verified (sendNewPts **30.20** ≥30).

## Round 5 — 2dGrab off critical path 2026-09-04

**Phase 1 (code):** Happy path is a **real Worker + OffscreenCanvas** (`ndi2dCapture.worker.ts`); `createImageBitmap` stays on main; `defer` is `setTimeout(0)`. Sync fallback existed and **reappeared on per-grab worker errors** via `failClosedToSync`. Round-4 `2dGrab` wall marks wrap the whole await (mostly worker wait) — overlap % is wall occupancy, not proven main-thread `getImageData`.

**Phase 2 mechanism (falsifiable, postfix-like log windows n=519):** With freshness on, `uniquePresent` mean **30.01**/s but `sendNewPts` mean **26.31**/s; AR `busy` mean **6.46**/s covers ≥70% of that gap. High `2dGrab` wall (~100 ms) windows → sendNew~22–24 / busy~14–20; low wall (~50 ms) → sendNew~27–28 / busy~0. **H1 rejected** (worker path). **H2 weak** (transferable UYVY already). **H3 + FBO/GPU contention** primary for the fps gap via busy skips.

**Phase 3 fix (OUT-owned, keep freshness):** (1) 2D on independent `setInterval`, not `studio:tick`. (2) Yield 2D when AR/3D `!canBegin()`. (3) Never fail-closed to sync on per-grab errors; refuse sync while FBO probes live. (4) AR content-priority `forceAdmit` when a new present PTS is waiting so rate phase cannot drop unique Send. Fixture: `grabContentionReplay20260904.json`. Diag: `[diag:ar-send-fps]`, `[diag:2d-contention]`.

**Live before / after (2D+3D on, healthy decode-present, skip connect):**

| | postfix freshness (pre-r5) | **r5 schedule+yield** | **+ content forceAdmit** |
| --- | --- | --- | --- |
| sendNewPts mean | **26.31** | 29.31 | **30.20** |
| uniquePresent mean | 30.01 | 30.25 | 30.28 |
| AR busy/s | **6.46** | 0.02 | **0.04** |
| AR rateCap/s | ~4 | 3.76 | **0** |
| sendSamePts | 0 | 0 | **0** |
| 2dGrab meanMs | ~95 | ~42 | ~42 |

Acceptance **met**: sustained unique-PTS AR Send **30.20** ≥ 30. Four prior fixtures still pass.

## Round 4 — AR frame identity / duplicate PTS 2026-09-04

**Phase 0 methodology:** frame-identity tracing via extended `diagNdiContent` (not a parallel system). Ruled out again: IPC TS drops, IPC bufferbloat, present unstick-to-oldest, RF/SPS as primary.

**Mechanism (falsifiable, live A/B):**
- Baseline 2D+3D (~152 s healthy): capture dup-runs **6.66/s** (maxLen **2**), **71%** time-overlap a `2dGrab` wall; sendSamePts **19.4%**; capture ~31.9/s vs uniquePresent ~28.8/s.
- **2D off** (`?ndi2d=off`, ~117 s): capture dup-runs **5.26/s** (−21%), overlap **0%**, sendSame **16.8%** — 2dGrab amplifies but is **not** primary.
- **3D off** (`?ndi3d=off`, ~115 s): capture dup-runs **5.18/s**, overlap still **81%**, maxLen **24** — similar rate cut, not a cure.

**Fix (OUT-owned, separable):** AR freshness gate in `ndiFramePump.ts` — skip capture when `present()` PTS unchanged since last AR capture (`noteNdiSkip('ar','freshness')`). SRT present path untouched. No `ndiSender.cjs`.

**Before / after (healthy decode-present, 2D+3D on):**

| | baseline | **postfix freshness** |
| --- | --- | --- |
| capture dup-runs/s | 6.66 | **0** |
| max runLen | 2 | **0** |
| sendSamePts % | 19.4 | **0** |
| capture/s | 31.9 | **29.2** |
| uniquePresent/s | 28.8 | **30.3** |
| freshness skips/s | — | **25.8** |

Fixture: `src/output/fixtures/frameIdentityReplay20260904.json`. Diag: `[diag:frame-id]` + content.duplicateRuns. Killswitches: `?ndi2d=off`, `?ndi3d=off`, `?ndiFrameDump=1`.

## Post-a jitter / connect latency park 2026-09-04

**MAX_QUEUED_CHUNKS=1 origin (`48eca0b`):** deliberate **main-process memory bound** (“one in-flight + one queued”), not a tuned low-latency knob. Raising to 32 for (a) was correct for drops; it did **not** cause IPC bufferbloat.

**Mechanism (falsifiable, live `diag-jitter-session1` ~301 s):**
- **H1 IPC bufferbloat rejected:** `queuedHighWater` max **3** / p90 **2** (cap 32); ipc-drops **0**.
- **Connect + steady are the same present-side mechanism:** first ~5 s `retainedDepth` 9→25 and `latencyMs` 267→800; then both stay parked (`lat` mean **686**, `ret` mean **21.6**) while `uniquePresent≈30`. Unstick-to-**oldest** + `lut-miss` catch-up disabled under pace left produce≈unique unable to recover.
- **H3 rejected as primary:** `auArrivalMean≈33.5 ms`; stdout gaps p90 ~121 ms — not an 800 ms park.

**Fix shape (NDI depth-bound analogy, present retained — not SRT IPC):**
1. Unstick paced newest/backlog → **min-latency** frame (100 ms), not oldest.
2. `trimRetained` also drops non-shown frames with PTS latency **> maxLatency (400 ms)**.
3. Soft max-clamp catch-up only if shownL **> maxL+50** (hysteresis). Aggressive every-tick max-clamp was tried live and **ruined** intervals (`gte60` 5.8%→57%) — reverted that shape.
4. **`MAX_QUEUED_CHUNKS=32` survives** — IPC was not the depth curve that mattered.

**Before / after (healthy decode-present secs):**

| | pre (session1) | bad every-tick max-clamp | **trim+unstick** |
| --- | --- | --- | --- |
| lat mean | 686.6 | 397 | **300.7** |
| retained mean | 21.6 | 12.9 | **10.0** |
| adv ≥60% | 5.8 | 57.3 | **3.7** |
| advMax≥100 count | 0 | 248 | **0** |
| ipc HW max | 3 | 3 | **3** |
| decode-error | 0 | 0 | **0** |

131 s present-pace replay still passes (mean ~36.3 ms, gte60 4.9%<8). Fixture: `ingestJitterReplay20260904.json`. Logs: `diag-jitter-session1-20260904.log`, `diag-jitter-postfix2-20260904.log`.

## (a) fix 2026-09-04 — IPC TS drops → Decoding error → KF wait

**Mechanism (falsifiable):** Across 2 live sessions (**14** `Decoding error.` events), **14/14** occurred within 1.5 s of an `srtReader` IPC chunk drop; **13/14** also showed MPEG-TS continuity-counter gaps and/or sync resyncs in the demux delta; `ffmpeg drop_frames` stayed **0** and PTS gaps stayed exactly **3000** (no missing AU timestamps) — therefore the corrupt NAL is from **application-level TS byte drops** (`MAX_QUEUED_CHUNKS = 1`), not RF SRT loss or SPS-unescape (H3). The visible hitch is the subsequent `waitingForKeyframe` until the next IDR.

**Fixability:** H1 app-level (IPC pipe) — fixable in `desktop/srtHelpers.cjs` / `srtReader.cjs`. Not a drone GOP ops change (H2 amplifies duration only). Not H3.

**Fix:** `MAX_QUEUED_CHUNKS` **1 → 32** (bound ~8 MB at 256 KB/chunk; absorbs ffmpeg stdout bursts across one IPC round-trip without splicing the bitstream).

**Instrumentation retained for regression:** demux `lossStats()` (ccGaps/syncResyncs); `[diag:decode-error]` events; ipc-drop stage logs; fixture `src/output/fixtures/decodeErrorReplay20260904.json`.

**Before / after (live):**

| | session1 | session2 | **post-fix** |
| --- | --- | --- | --- |
| present secs | 233 | 166 | **368** |
| decode-error events | 8 | 6 | **0** |
| ipc-drop events | 8 | 6 | **0** |
| errors/min | 2.06 | 2.17 | **0** |

131 s present-pace replay unchanged (mean 34.94 ms). Raw logs: `diag-decode-a-session{1,2}-20260904.log`, `diag-decode-a-postfix-20260904.log`.

**Assumption wrong in brief:** `srtReader` did **not** expose libsrt packet-loss/retransmit counters — only IPC `dropCount` + ffmpeg `drop_frames` (always 0 on copy path). CC gaps in demux are the bitstream-level loss signal.

## Live post-fix 2026-09-04 (b)

Last ~180 s with `retainedDepth` in diag:
- `unique==0`: **0** secs (was ~129/131)
- `advN==0`: **0**; `advMax≥1s`: **0** (was ~1.4/min)
- `unique>15`: **178/180**; reasons dominated by `pace-hold` / `min-clamp` / `lut-miss-live`
- Agent B snapshots: **3** brief (ahead≈3, L≈100, **shownPts advancing**) vs **101** stuck on one shownPts pre-fix
- 2× `onDecoderError` in agent log — recovered without multi-second freeze

## (b) fix 2026-09-04 (L≈0 / min-clamp → shown lock)

**Pin:** retained not inverted (`arrLastIsNewest`, ahead=24); NTP latency collapsed (`toNtp`≈flat); `min-clamp` → `frameAtLatency` → `frames[0]`=shown → forced `repeat`.

**Changes:**
1. `latencyMsOf` — if |NTP L − PTS L| > max(50ms, 0.25×|PTS L|), use PTS latency.
2. `frameAtLatency` — optional `avoidPts90k` (shown); fallback is oldest-ahead, never sticky shown.
3. `pickPresentationPts` — `newestPts90kOf`; pose-covered picks newest-by-PTS; passes `shownPts90k`.
4. `ptsNtpMap.toNtp` — slope outside [0.5, 2.0] → unavailable (lut-miss path).
5. `onDecoderError` — reset + drop queue/pending + clear PTS map; clear `decodeError` on next keyframe decode.

**Tests:** collapsed flat toNtp pick + paced no-freeze; flat-slope LUT unavailable; 131s replay unchanged.

## freeze-b2 lock pin 2026-09-04

101× `repeat lock snapshot` after connect KF-skip only (A idle). Stable pattern:
- `shownPts` frozen (e.g. 137250000) while `trueNewest` keeps rising; `ahead=24`, `behind=0`, `uniqPts=24`.
- `arrLastIsNewest=true` — array-order newest is fine; not the frames[last] bug this run.
- `rawReason=min-clamp`, `stillQueued=false` → reason forced to `repeat`.
- `shownNtp≈newestNtp` (often sub-ms / few-ms) despite large PTS gaps → latency collapse; `frameAtLatency(100)` finds nothing → returns `frames[0]` (unshifted shown).
- `shownNtp` for a **fixed** shownPts still drifts upward over wall time — LUT/`toNtp` not a stable PTS→NTP map during the lock.

## Live reproduce 2026-09-04 (retainedDepth session) — (b) lock

- First ~2 s: unique advances (≈12 then ≈5), then **unique=0 / advN=0 for ~129/131 s**.
- Every locked second: `decodedFps≈30`, `auFps≈30`, `q=0`, `out=0`, **`retainedDepth=25`**, `decodeError=null`, `kf=false`, reasons **~100% `repeat`**.
- `latencyMs` often **near 0 or negative** (−100..+100) — not a 400 ms backlog; matches known “L≈0 freeze” comment in `allowsCatchUpSkip` (lut-miss→newest).
- Agent ingest only saw connect KF-skip (hypothesis A); no `onDecoderError`. Hypothesis **A rejected for this run**. Prior 13 min log’s recurring ≥1 s events remain (a)-correlated; this lock is the (b) class in extreme form.

## (a) vs (b) from same log (byte 1067879038) — 2026-09-04

Deciding metric: per-second `decodedFps` (VideoDecoder outputs) vs `auFps` (demux AUs) on freeze windows.

### Recurring ≥1 s freezes → **(a)**

- Of **18** `advMax≥1000` events, **16/18** have `decodeError='Decoding error.'` within ±2 s.
- Typical pattern: `waitingForKeyframe=true`, `decodedFps` drops to ~0–15 while `auFps` stays ~27–31 (AUs still counted, then skipped in `feedAu` until keyframe after `onDecoderError` → `decoder.reset()`).
- Errors are **not** swallowed invisibly: 1 Hz rows show sticky `decodeError` + `kf=true` on freeze seconds (8/40 freeze-related secs).

### Connect multi-second freeze → **(b)** (separate class)

- `advanceN==0` rows 19–23 (~5 s): `dec≈28–32`, `au≈29–31`, `q=0`, `out=0`, **no** decodeError, reasons all `repeat`, **latency 263→831 ms**.
- Latency climb ⇒ newer PTS exist in pick candidates / retained; pick keeps selecting shown → `repeat`. Not empty decode, not pace-hold.
- Ring/consume starving the pick queue is **rejected for this window**: consume→retained is ahead of shown (latency proves it). Two paths exist (`queue`→consume→`retained` for pick), but consume is not leaving pick with nothing.

### Classification over freeze-related seconds

| class | count | meaning |
| --- | --- | --- |
| (a) dec~0 & au~30 | 3 | decoder output stopped |
| (b) dec~30 & au~30 | 20 | decode OK, present stuck |
| mixed (often err+partial dec) | 10 | recovery / error seconds |

Many of the “(b)” seconds in that table are **connect-cluster** or interspersed; the **≥1 s advMax events that match subjective recurring freezes** align with **(a)**.

## Hold-streak distribution 2026-09-04 (same live log, ~788 s)

Definition: wall-clock gap between consecutive **unique PTS advances** (repeat + pace-hold both count as hold). Source: `ndi.pace` advIntervals + advMax (lastAdvAt persists across 1 Hz windows so a multi-second freeze becomes one large gap on resume). Also stitched `advanceN==0` whole seconds.

### Distribution (17352 unique-advance gaps)

| hold duration | count | share |
| --- | --- | --- |
| &lt;100 ms (normal pace) | 17280 | **99.59%** |
| 100–500 ms | 24 | 0.14% |
| 500 ms–1 s | 30 | 0.17% |
| **1–3 s** | **15** | **0.09%** |
| **≥3 s** | **3** | **0.02%** |

- mean gap 39.0 ms / median 31.6 / p90 55 / **max 11.3 s**
- **≥1 s freezes: 18 ≈ 1.37 per minute** (systemic enough to match “keeps freezing”)
- **≥3 s: 3 ≈ 0.23 per minute** (connect cluster: 11.3 s, 5.7 s, 3.7 s)

Whole-second `advanceN==0` streaks: **14 s**, **5 s**, **3 s** at connect (all-repeat, q=0, out=0, au≈30).

### During holds ≥1 s (resume-second context)

- **queueDepth=0, outstanding=0** every time — not a full queue sitting unused; consume is emptying, present is not advancing PTS.
- Reasons on those seconds: **repeat 57%**, min-clamp 24%, pace-hold 19% (freeze itself is mostly **repeat**, not pace-hold).
- Decode: auFps often still ~29–31; decodedFps sometimes dips on the resume second. Frozen whole-seconds: decode continued (dec~21–30, au~30) while unique=0.

### Burst after ≥1 s hold

Following advances are mostly **~20–45 ms** (mean often ~31–35). Some &lt;29 ms (min interval floor is 20 ms) but **not** a gate-failed dump of many &lt;20 ms uniques. Subjective “burst” ≈ paced catch-up after stillness; a few post samples still contain another ~1 s gap (recurring ~1 Hz-ish long holds later in session).

### vs AR busy (~60%)

**Uncorrelated / anti-correlated.** Long-hold seconds: busy mean **44.5%**; normal seconds: **56.6%**. Of busy≥70% seconds, only 3.5% are long-hold seconds. Canvas+NDI same pattern + this split ⇒ chase **`present()` / pick / retained / LUT**, not NDI capture, for the freeze/burst.

## Live force-upload verify 2026-09-04 (~6 min counters; then longer log for streaks)

URL: auto-connect as before. Log from byte 1067879038. DevTools: **no** insufficient-resources over multi-minute run. Healthy-window hist ~36 ms / 69% in 20–40; outstanding **0**. Prior note that connect max unique=0 streak was “≈5 s” understated the **14 s / 5 s / 3 s** `advanceN==0` clusters and the recurring ~1 s gaps (~1.4/min) — see streak section above.

## Force-upload fix 2026-09-03 (A chosen; default pacing on)

## Force-upload fix 2026-09-03 (A chosen; default pacing on)

### A vs B

| | A: force GPU upload at consume | B: defer `close()` until slot drawn |
| --- | --- | --- |
| API | **`WebGLRenderer.initTexture(tex)`** → public; calls `WebGLTextures.setTexture2D` → `texImage2D(VideoFrame)` / CopyTextureCHROMIUM — **same GPU-GPU path as 0e1838e**, no scene draw, no CPU `copyTo` | Need per-slot “drawn” flag after a render that bound that slot |
| VideoFrame lifetime | Close **immediately** after `initTexture` + seal | Hold until first draw; warm/inactive POVs may **never** draw ring slots → open frames pile up → decoder backpressure returns |
| Risk | Must wire `forceUploadTexture` in main (throws if missing) | Reopens the stall we already fixed |

**Chose A** — shorter VideoFrame lifetime, uses an existing Three.js API, no warm-POV leak.

### Implementation

1. `consumeToRing`: `uploadFrame` → `forceUploadTexture` (`renderer.initTexture`) → `sealUploadedVideoTexture` (replace `.image` with dimension stub, `needsUpdate=false`) → mark `gpuReady`.
2. Pipeline closes the `VideoFrame` **immediately** after `onConsumeFrame` returns (no one-tick `gpuPending` deferral — that assumed a draw of off-screen slots).
3. `bindRing` only accepts `gpuReady` + `textureHasImage`.
4. main: `forceUploadTexture: (tex) => renderer.initTexture(tex)`.

### Ring depth = **8** (not 24)

- 1 displayed slot (never overwritten while bound).
- Live AU-per-tick is 0/2/3; paced uniques are mostly **ticksBetween gap-2** → ≤2 studio ticks between swaps.
- Worst two ticks ≈ 3+3 = 6 arrivals while holding display → **1+6+1 spare = 8**.
- Old 24 was `DEFAULT_QUEUE_CAP`, yielding up to 96×1080p textures across warm POVs (“insufficient resources”). Max live textures now **8 × active warm POVs** (≤32 at cap 4).

### Tests / replay

- Invariant: over a paced tick sequence the bound texture’s `.image` is never a closed `VideoFrame` (sealed stub after force-upload).
- Resource: 2 warm POVs → exactly `2 * PRESENT_DISPLAY_RING_SLOTS` (16), not 48.
- 131 s replay: mean **34.94 ms**, **74.2%** in 20–40, 22.3% in 40–60, 3.4% ≥60 — unchanged vs pre-fix replay (interval design was fine). outstanding max **0** after immediate close.

Killswitch remains `?presentPace=off`. Live verify next (eye + DevTools).

## Black-screen between paced frames 2026-09-03 (root cause; fixed above)

Manual killswitch: `?presentPace=off` played imperfect but functional video. Pacing ON: one frame → extended **black** → one frame. Not a stale hold — `material.map` pointed at a ring slot whose GPU upload never happened (closed `VideoFrame`).

### Exact mechanism (was)

1. **Consume** set `tex.image = VideoFrame` + `needsUpdate` on a **non-displayed** ring slot — no GL call.
2. Three.js only uploads in `setTexture2D` when that texture is in a **drawn** material.
3. Next `present()` closed those VideoFrames.
4. Later paced bind → `texImage2D(closed VideoFrame)` → black.
5. Displayed-slot stomp was **not** primary (`consumeToRing` skips `displayIndex` once `hasFrame`).

## Live hybrid verify 2026-09-03 (auto-connect, working-tree Vite `--dev`)

URL: `?race=demo-istanbul&outputMode=transparent&arBackground=video&autoConnectLive=1&livePov=1&autoConnectSrt=1&srtPov=1`. Killswitch not off (`pace-hold` in 1 Hz `reasonCounts`). Electron + Vite started this session; log appended after byte 576153040.

Healthy filter (same family as the 131 s replay window): `decodedFps` 20–40, `advanceN≥15`, `advMean<200`, **101 s**.

### 1. Unique-present interval histogram

| | pre-gate | broken gate (live) | replay prediction | **this live** |
| --- | --- | --- | --- | --- |
| mean | 33.5 ms | 43.4 ms | 34.94 ms | **34.21 ms** |
| &lt;20 | 43% | 0% | 0% | **0.3%** |
| 20–40 | 27% | 47% | 74.2% | **76.0%** |
| 40–60 | 13% | 44% | 22.3% | **21.8%** |
| ≥60 | 18% | 8.9% | 3.4% | **1.9%** |
| unique fps | ~30 | ~23 | ~30 | **29.44** |

`ticksBetween`: gap1 932, **gap2 1459**, gap3 514, gap4+ 106 (mostly gap2). Last-1s example: `29.5, 43.1, 44.5, 40.4, 38.6, 27.9, 42.3, 25, 26.9, 37.7, 35.7, 24.2, 27.5, 32.6, 40.6, 23.9, 44.3, 39.9, 43.4, 37.1`.

### 2. queueDepth / outstandingFrames

Healthy: mean **0.47**, max **3**, never ≥10 (0 / 101). Matches replay max ~4. Unclosed VideoFrames are not parking at ~10.

### 3. decodedFps vs auFps

Healthy: decoded **29.53** (21.8–33.1), au **29.86** (25.6–33.0). They track ~30. Not the broken-gate **decoded ~23 / au ~30** throttle.

### 4. AR readback / busy / Send

| | contended texSubImage | `0e1838e` 15 s | **this live 101 s** |
| --- | --- | --- | --- |
| arReadbackBegin mean | ~15 ms | 2.62 ms | **2.02 ms** (1.04–2.97) |
| p90 | ~23 | ~4 | **4.24** |
| ms/s | ~410 | ~84 | **~65** |
| busy share | 70–93% | ~1% | **3.75% mean** (max 30.8% in a 1 s row, p90 10.3%) |
| AR Send | 12–15 | 22–26 | **31.52** (28–34) |

Consume ~30/s GPU-GPU uploads did **not** restore the 15 ms / 70%+ busy stall. Busy is a bit noisier than the 1% snapshot; Send is at the 32 fps capture gate, not the old 22–26 keep-newest drop.

### 5. reasonCounts (per-second means over 101 s)

`min-clamp` **29.8**, `pace-hold` **24.5**, `repeat` **4.0**. Uniques are almost all `min-clamp` (100 ms policy), not `lut-miss-live`. `pace-hold` + `repeat` ≈ the 60 Hz ticks that do not unique. Gate is loaded.

### 6. Connect-time — not a smooth 12-frame drain

First second: 8 `min-clamp` uniques (PTS +3000 walk) + 4 `pace-hold`, then **~35 s of unique=0 / 100% `repeat`** while `decodedFps`/`auFps` stay ~30 and `queueDepth` stays 0–2. Latency of the frozen shown PTS climbs ~0 → ~114 ms. One jump at ~14 s (`294927000` → `296220000`, ~14.4 s of PTS in a single min-clamp). Unique returns at s39–42 (`unique` 33–34, latency **712 → 133**). That is freeze-then-catch-up, not unstick+consume drain. After that, the 101 s healthy window above.

**Verdict (counters):** steady-state matches the replay; decoder is not throttled; AR begin stays cheap; connect-time still freezes. **Smoothness is the user's eye**, not this table.

## Hybrid consume + paced display 2026-09-03 (design recap)

Approved mechanism: every `studio:tick` **consumes** queued `VideoFrame`s (GPU copy into a non-displayed ring slot, then `close` on the following tick after one `renderer.render()`). The wall-clock gate only **binds** which ring slot is shown and updates `presentedPts90k` in that same step. Overlay stays `sampleAt(toNtp(shownPts)+trim)` at display commit — never newest-at-consume (Option B). Pose-lock test `delayed draw uses pose for shown PTS, not newest-at-draw` is unchanged and still passes.

### 1. Upload frequency vs `0e1838e` cost

`0e1838e` changed **cost**, not frequency. Production `createVideoStreamTexture()` sets `isVideoTexture` so Three.js uses **`texImage2D(VideoFrame)` → Chromium `CopyTextureCHROMIUM`** (GPU-GPU). It is **not** `VideoFrame.copyTo()` / CPU readback / PBO `readPixels`.

Measured **after** `0e1838e` under sustained healthy HEVC (~30 decoded/s, unique present in the low–mid 20s with Send 22–26): `arReadbackBegin` mean **2.62 ms** / p90 **~4** / **~84 ms/s** vs the old texSubImage stall **15 / 23 / 410**. Consume-every-arrival uploads at **decode rate (~30/s)** — the same upload *frequency* as pre-pacing unique present, not a new class of work. The 15 ms stall was per-upload *cost* on `texSubImage2D`; going back to ~30 GPU-GPU uploads/s does not reintroduce that stall. Live confirmation of `arReadbackBegin` under hybrid is still the next session.

### 2. Replay fixture (not a perfect 16.7 ms clock)

Source: `diag-srt-fps.log` healthy **131 s** after first `pace-hold` (decoded 20–40, advanceN≥20, advMax<200). Per-second `tickHist` / `tickMean` / `tickMin` / `auDeltaPerPresent` reconstructed into 7701 ticks (0/1/2/3 AU bursts, 0 ms doubles). `liveUniqueIntervalsMs` is the concatenated recorded unique-present intervals from that window.

Display gate is a **phase accumulator** (`pacePhaseMs += tickDt`, swap when phase ≥ period−slack and unique gap ≥ 20 ms, then `phase -= period`). Resetting `lastAdvanceWallMs = now` on a late tick was compounding 3-tick holds (~43 ms mean). `pace-hold` remains its own reason.

### 3. Replay before / after (pass bar)

| | live with old gate (before) | hybrid replay (after) | design |
| --- | --- | --- | --- |
| n unique intervals | 3024 | 3725 | ~30/s |
| mean | **43.31 ms** | **34.94 ms** | ~33 ms |
| &lt;20 | 0% | **0%** | ~0% |
| 20–40 | 46.8% | **74.2%** | ~100% |
| 40–60 | 44.1% | **22.3%** | ~0% |
| ≥60 | 9.1% | **3.4%** | ~0% |
| queueDepth | mean **10.08**, max **12** | max **4**, mean **0.51**, never ≥10 | not parked at 10 |
| outstandingFrames | (unclosed JS queue) | max **4** | decoder keeps pace |

Remaining 40–60 / ≥60 buckets are mostly recorded long `studio:tick` intervals (cannot invent a unique with no tick). Not live-verified.

`?presentPace=on` opts into consume-close + gate + unstick. Default is the legacy hold-`VideoFrame`-until-swap path (safe).

## VideoFrame close vs WebCodecs stall 2026-09-03 (code + docs, no new live)

**Close is not “every tick.”** `closeFrame` only via `dropQueued` from: (1) swap `skip` (older than pick), (2) `prevPresented` rotate on forward swap, (3) `trimQueue` when `queue.length > 24`, (4) dispose/reset, (5) `onFrame` if already disposed. **`pace-hold` / `repeat` return before any of that.** With snap-to-next +1, skip is usually empty, so close rate ≈ unique display swaps. Cap 24 is not the live limiter (q was ~10).

**Not “picked-over then abandoned.”** Held frames are *future* PTS waiting for the next allowed swap. They stay outstanding until their turn (or cap). Texture `tex.image = VideoFrame` also requires `prevPresented` to stay unclosed one swap so GL can upload.

**Backpressure:** W3C WebCodecs: failing to `close()` output frames “can cause decoding to stall.” Chrome WebCodecs collaborator (w3c/webcodecs#680): HW decoders have an **output-buffer limit**; software does not; dropping JS refs without `close()` is the usual stall. w3c/webcodecs#753: “outstanding (non-closed) outputs exceeds the decoder's limit… stall. This limit varies / isn’t known in general.” That is **output** stall, not `decodeQueueSize` (input chunks). This repo never reads `decodeQueueSize` / `ondequeue`. Config prefers `hardwareAcceleration: 'prefer-hardware'`. Exact HW surface count is implementation-defined — **no new live SRT needed** to establish the mechanism; the prior session’s q≈10 / decoded≈23 / au≈30 is consistent with it but is not a Chromium constant.

**Hybrid (implemented 2026-09-03):** every tick **consumes** (GPU copy then `close` next tick). **Display** still atomic: bind the shown ring slot + `presentedPts90k` together on the pace gate. Do not publish PTS at copy time (that was Option B). Ring of 24 GPU textures so the displayed slot is never the one being overwritten. Pose stays `sampleAt(toNtp(shownPts))`. Replay numbers are in the section above; live SRT is next.

## Live pacing re-verify 2026-09-03 (visual: not smooth)

Deploy: HEAD is still `06e63ad` (pacing **uncommitted**). Session served working-tree via Vite `--dev`. Killswitch **not** off: 1 Hz `reasonCounts` show `pace-hold` (e.g. 34/s vs min-clamp 21). Electron was down when this note was written; log mtime 16:56.

Healthy window after first `pace-hold` (decoded 20–40, advanceN≥20, advMax<200, **131 s**):

| | old (pre-gate) | live with gate | design |
| --- | --- | --- | --- |
| advHist <20 | **43%** | **0%** | ~0% |
| 20–40 | 27% | **47%** | **~100%** |
| 40–60 | 13% | **44%** | ~0% |
| ≥60 | **18%** | **8.9%** | ~0% |
| adv mean | 33.5 ms | **43.4 ms** | ~33 ms |
| unique fps | ~30 | **~23** | 30 |
| ticksBetween | 66% gap1 | 18% gap1, **35% gap2, 31% gap3, 17% gap4+** | mostly gap2 |

Example last 1 s intervals (ms): `44.5, 38.3, 48.1, 34.2, 36.6, 44.1, 35.8, 28.4, 65.4, 29.2, 65.8, 43.6, 47.8, 70.7, 30.8, 52.6, 45.3, 110, 67.1, 31.6, 61.5`

Why vs unit tests: live `latencyMs` sits at **~270 ms** (q≈10), `auFps`~30 but `decodedFps`~23 (WebCodecs backpressure from unclosed frames). Unstick-to-oldest + 28 ms wall gate + ~0 ms double-ticks ⇒ many **3-tick** holds (40–60 ms). Tests drained a static 12-frame queue with a fake decoder and a perfect 16.7 ms clock.

Downstream: canvas still rAF vs `studio:tick` present — but present cadence itself is already irregular at ~23 fps, so rAF cannot make it look 30. AR Send ~25, `sendNewPts`~18, busy skips ~21/s. **2dGrab** mean **~94–108 ms**, Send ~5 fps — real, but 2D map only; not the AR canvas plate.

Verdict: **(b)** gate active, live behavior ≠ design. Not (a) “present is clean.” 2dGrab is a separate 2D-NDI hitch, not the AR/canvas miss.

## Option A pacing (implemented 2026-09-03)

Clock: still only `studio:tick`. Gate = wall-clock since last unique advance. Not a second timer.

Slack from measured tick intervals (mean **17.41 ms**, std **11.39 ms**):
- θ = mean+1σ = **28.80 ms** (a +1σ single tick is still one 60 Hz slot, not a 30 fps period)
- slack = 1000/30 − 28.80 = **4.53 → 5 ms** (`PRESENT_PACE_SLACK_MS`)
- 4 ms was the unrounded estimate of the same quantity; 5 matches mean+σ as the threshold (θ ≈ 28.3 ms)

Order inside `present()` (texture + `presentedPts90k` still one step):

1. `pickPresentationPts`
2. Unstick if pick is newest and backlog exists (presented null or already newest) → oldest queued PTS, reason `min-clamp`. Re-queue the old newest on rewind so it is not closed via `prevPresented`.
3. bdb4c73 snap-to-next. With pace on, `lut-miss-live` is **not** a catch-up skip (would jump back to newest and oscillate). `max-clamp` / `stall-pin` still skip.
4. pick PTS == presented → `repeat`
5. else if elapsed < θ and swap is not a rewind → `pace-hold`
6. else atomic swap; `lastAdvanceWallMs = now`

`lastAdvanceWallMs` is **not** reset on stall/reconnect. Huge elapsed ⇒ gate open (first swap immediate). Short stall < period: rewind bypasses the gate so we do not sit on newest; forward drain is still paced.

Killswitch: `?presentPace=off` (manager → pipeline). Overlay still `sampleAt(toNtp(shownPts))`.

## Option A pacing gate design 2026-09-03 (review, not implemented)

Clock: **not** a second timer. Still invoked only on `studio:tick`. Gate = wall-clock since last *unique* advance.

```
PACE_PERIOD_MS = 1000/30          // 33.333
PACE_SLACK_MS  = 4                // first tick with elapsed >= ~29.3 ms may advance
// so a 32 ms tick is not deferred to ~48 ms
```

Order inside `present()` (same atomic swap as today):

1. `pickPresentationPts` (unchanged)
2. bdb4c73 snap-to-next (unchanged; min-clamp/adaptive/fixed only)
3. if pick PTS == presented PTS → `repeat` (pick), no swap
4. else if `now - lastAdvanceWallMs < PACE_PERIOD_MS - PACE_SLACK_MS` → **`pace-hold`**, no swap, `presentedPts90k` unchanged
5. else swap texture + `presentedPts90k` together; `lastAdvanceWallMs = now`

`pace-hold` is a new `PresentationReason` — do **not** reuse `repeat` (diag must tell healthy 60 Hz holds from stuck pick). Catch-up skip still allowed on a paced swap (one jump per ~33 ms, not 26 gap-1 bursts).

Connect freeze: pacing is a **hold** gate, not a force-advance. L≈0 / 100% repeat / q=12 **still needs a pick unstick** (rewind to min-clamp candidate or play next queued PTS; keep newer frames, don’t `dropQueued` the backlog). Decoder stall is because stuck present never closes frames.

Steady 1 s: ~30 unique advances, intervals clustered 29–45 ms (tick quantization), not 43% <20 / 18% ≥60. Min-clamp still chooses *which* PTS; pace chooses *when*. Snap-to-next still prevents 2-PTS holes on the allowed swap.

## Pose vs present vs composite (pacing desync risk) 2026-09-03

User worry: a post-`present()` pacing buffer would show delayed video while overlay reads freshest pose. **That is not how overlay is sampled today.**

| Consumer | When | What it reads |
| --- | --- | --- |
| `pickPresentationPts` | `present()` on `studio:tick` | `getNewestPoseNtp()` = newest **drone history NTP** — **gate only** (is this PTS covered?). Not the overlay sample. |
| Texture | same `present()` call | `uploadFrame` of picked `VideoFrame`; `presentedPts90k` updates in the same call |
| Overlay (boats/drone/buoys) | pose pipeline **own rAF** | `sampleAt(toNtp(presentedPts90k)+syncTrimMs)` when `arBackground==='video'` |
| Composite | `renderer.render` wrap | current video texture, then current mesh poses. **Does not call `getNewestPoseNtp`.** |

`getNewestPoseNtp` is **not** called at render. Re-matching already happens: pose re-reads `getPresentedPts90k` each pose tick and samples history at that PTS’s NTP. Wind/OpenMeteo is **not** PTS-matched (already true).

**Option A** (pace *when* `present()` advances; atomic texture + `presentedPts90k`): preserves the lock. Pose follows the PTS that is actually on the plate.

**Option B** (pick now, show later): desync **if** `presentedPts90k` updates at pick while pixels stay old. Safe only if unpublished PTS until release — which is Option A with extra machinery.

Test (not written): at composite, overlay NTP = `toNtp(shownPts)+trim`, not `newestPoseNtp` at draw and not newest-at-pick. Do not lock overlay to the pick-gate pose (that is ahead of the plate by design, 100–400 ms).

## Present/tick interval regularity 2026-09-03

Raw SRT outside broadcast-web is smooth 30. Same feed in **canvas preview** and **NDI Studio Monitor** is choppy → inside broadcast-web, at or before canvas. Throughput (~30 unique/s) was the wrong metric.

**Canvas vs present clock (code, Electron):** preview `renderer.render` is **rAF** (`previewFrameClock.subscribePreview` when visible). `present()` / texture swap is **`studio:tick` only** (`subscribeTick: studioBridge.onStudioTick`). Canvas paints ~60 Hz; new video texture arrives on the jittery tick.

Diag: `diagPresentPace.ts` — wall-clock gaps between consecutive `present()` calls (tick) and consecutive unique-PTS advances (min-clamp; they match). Logged `ndi.pace`.

### Healthy window (decoded 20–40, advanceN≥20, advMax&lt;200, 61 s)

| | tick (studio:tick) | unique present advance / min-clamp |
| --- | --- | --- |
| **mean** | **17.41 ms** (~57 Hz) | **33.45 ms** (~30 Hz average) |
| **std** | **11.39 ms** | **27.12 ms** |
| **min** | **~0 ms** (60/61 s had tickMin&lt;1) | **~1.7 ms** typical |
| **max** | **~45 ms** typical (peak 58) | **~108 ms** typical (peak 193) |

Histogram (requested buckets):

| bucket | tick | unique advance | clean 33 ms ref |
| --- | --- | --- | --- |
| &lt;20 ms | **62.4%** | **42.6%** | ~0% |
| 20–40 ms | 33.8% | **27.0%** | **~100%** |
| 40–60 ms | 3.8% | 12.6% | ~0% |
| ≥60 ms | 0% | **17.8%** | ~0% |

Tick &gt;20 ms = **37.6%** — matches the old 10 s `over20ms` ~37%.

**Ticks between unique advances:** **65.5% gap 1** (consecutive ticks), 7.8% gap 2 (the “every other 60 Hz tick → 33 ms” pattern), 8.6% gap 3, **18.0% gap 4+**. present() is **not** tick-jitter passed through a regular 2-tick hold. It often double-advances, then stalls.

Example 1 s advance intervals (ms): `20, 6.2, 86.8, 7.7, 14.3, 38.7, 29.3, 76.5, 10.6, 44.7, 3.6, 21.6, 17.1, 31.2, 69.5, 30.3, 40.8, 29.8, 22.5, 21.2, 13.6, 120.5, 23.7, 72.1`

No pacing-buffer / decouple-from-tick change this pass.

## Connect freeze → burst → jitter 2026-09-03

Same mechanism as steady jitter, **exaggerated**. Not a separate keyframe-wait bug.

`latencyMs` is PTS-vs-newest (not wall clock). `queueDepth` = queued + presented + prevPresented. Cap is 24; connect peak observed is **12**. No new instrumentation — 1 Hz `decode-present` + `ndi.pace` from the present-pace live run.

### Timeline (marker `present-pace-2026-09-03`)

| phase | duration | queueDepth | outstanding | decodedFps | uniquePresent | reason | latencyMs | waitingForKeyframe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| empty | 1 s | 0 | 0 | 0 | 0 | null | null | false |
| brief start | 1 s | **12** | 12 | 22 | 12 | mixed | ~0 | **false** |
| **FREEZE** | **~107 s** | **12 pinned** | **12** | **0** (`framesDecoded` stuck 23) | **0** | **100% repeat** | **~0** | **false** |
| unstick / catch-up | 1 s | 12→10 | 10 | 23.5 | 26 | 27 min-clamp / 33 repeat | **0→266** | false |
| drain | 1–2 s | 10→6 | 6 | 30 | 35 | min-clamp | 266→133 | false |
| steady jitter | rest | **5–7** | 5–7 | ~30 | ~30 | ~50/50 | **100–167** | false |

Retry run (`ndi-content-unique-retry`): freeze ~q=12, then **~25 s burst** decoded/unique **~52–61 fps**, q 8→6, then steady ~30. Peak **q=12**. `waitingForKeyframe` false on freeze/burst rows (kf-true exists elsewhere, not this freeze).

Catch-up second (ln 185478): `ticksBetween` **26× gap 1**, `advMax` 24397 ms (the freeze hole). present() ripped unique PTS on consecutive ticks. `droppedFps` 25–34 then ~50 in the burst run — queue skip-drain (`dropQueued`), not a paced 33 ms cadence.

### vs the user’s hypothesized story

| guess | measured |
| --- | --- |
| freeze = starved queue waiting for first min-clamp candidate | **Opposite:** queue **full** (12), presenting **newest** (`latencyMs≈0`), repeating it |
| freeze = `waitingForKeyframe` | **No.** false for the whole freeze |
| burst = drain of backlog once min-clamp finds candidates | **Yes.** q 12→5, L 0→266→100, uniquePresent 26–57/s, almost all advances gap-1 |
| same root as steady bunch/gap | **Yes.** present() is not a wall-clock pacer. Connect = long hold + dump; steady = small holds (`≥60 ms`) + bunches (`<20 ms`) |

Decoder freeze is coupled: `outstandingFrames=12` stuck with `framesDecoded` frozen — VideoFrames not closed while present() repeats, so WebCodecs stops emitting until the drain.

Per-advance `pts90k` list was not logged this pass (1 Hz snapshots only). Not needed to identify the connect mechanism.

Fix implication (not implemented): a **pacing/smoothing buffer** would cover connect burst and steady judder; a **narrow keyframe-wait fix would not** (kf is not the freeze). A pick-logic tweak (don’t stick on newest at L≈0 while 12 frames sit) might shorten connect freeze but would not by itself make intervals regular.

## Unique content vs Send count 2026-09-03

Hypothesis: AR’s 32 fps gate samples `present()` **repeat** ticks, so NDI transmits ~30/s but only ~15 unique PTS. Duplicate NDI content = two sends with the same PTS (a `repeat` capture is same as previous *present*, not automatically previous *NDI send*).

Diag: `diagNdiContent.ts` stamps AR `begin` with that tick’s active-POV present PTS/reason (present runs first), FIFO through PBO/pack, counted at `sendStudioNdiFrame`. Log: `ndi.content` on `stage:decode-present`.

### Healthy window (retry, 20&lt;decodedFps&lt;40, sendN≥20, n=24 s)

| | mean (med) |
| --- | --- |
| decodedFps | 30.3 |
| uniquePresentFps | **30.5** (med 30.3) |
| present min-clamp / repeat | **31.0 / 27.9** (~50/50) |
| AR Send / sendN | **26.5** (24–28) |
| **sendNewPts (unique-content-sent)** | **22.2** (med 22, min 11, max 26) |
| sendSamePts (consecutive same PTS) | **4.4** (med 4, max 17) |
| distinctPts | **22.3** |
| capture on min-clamp / repeat | **19.2 / 8.0** |

**Hypothesis as stated is not confirmed.** Unique-content-sent is ~22, not ~15. Captures are biased toward **min-clamp** (19 vs 8), not systematically oversampling repeats. present() is healthy (~30 unique).

Direct 1 s PTS list (ln 181766, Send 28, 24 new / 4 same):

`228030000, 228033000, 228039000, 228042000, 228045000, 228045000, 228048000, 228051000, 228054000, 228057000, 228063000, 228066000, 228066000, 228069000, 228072000, 228075000, 228078000, 228084000, 228087000, 228087000, 228090000, 228099000, 228102000, 228102000, 228108000, 228111000, 228114000, 228117000`

2 s concat: 53 sends, 44 distinct; run lengths mostly 1, **7× double**, 1× triple. Cadence is “mostly new frame, occasional hold”, not every-other-frame 15 fps.

If it still “looks like 15”, that is not unique-PTS-sent≈15 here. Ask what surface (studio preview vs NDI/vMix). No skip-send-on-repeat implemented.

### Cold start on the same run (before decode woke)

ffmpeg ~29.6 copy, `auFps` ~30, `decodedFps` ~0, present 100% repeat, Send ~32, **distinctPts 1**. Frozen plate — ignore for the aliasing test.

## Depth-2 keep-newest-of-2 queue 2026-09-03

Approved: **A now, depth 2 only**, drain-all-in-order when the late timer fires. Recovered frames can be up to **~31 ms older glass-to-glass**; newer frames follow immediately after. Depth 3 is a separate follow-up from new measurement if the 32–82 ms tail recurs.

### Coverage (not symmetry)

| Channel | Before (timeout healthy) | Why this depth |
| --- | --- | --- |
| **AR** | Send **~25.6**, evict **6.4/s**, begin ~32 | Depth **2** |
| **3D** | Send **~27.6**, evict **4.4/s**, begin ~32 | Depth **2** (better than AR, still real drops) |
| **2D** | 0 evicts in that window | Stay depth **1** |

Killswitch: `?ndiQueueDepth=1`. Default defer remains `setTimeout(0)`. `?ndiDefer=microtask` not shipped.

### Live after (same auto-connect URL, HEVC `decodedFps` 22–40, 64 s)

| | AR before | AR after | 3D before | 3D after |
| --- | --- | --- | --- | --- |
| **Send fps** | **25.6** | **30.5** (med 31, min 23, max 34) | **27.6** | **31.1** (med 32) |
| **evict/s** | **6.4** | **0.55** | **4.4** | **0.00** |
| begin n | ~32 | 31.2 | ~32 | 31.2 |
| `queueWait` mean | 17.9 ms | **27.5 ms** | 22.7 ms | 34.2 ms |

Send now tracks begin (~30–32). Eviction collapsed. `queueWait` is **not** shorter — the change tolerates the delay instead of dropping the older slot. Residual AR evicts (~0.55/s) are the depth-2 overflow tail (`queueWait` max 108 ms in this window). That tail is **not** depth 3 in this change.

## HEVC texture upload path 2026-09-03

### 1. Exact call (this repo)

`present()` does **not** call `texImage2D` / `texSubImage2D`. `videoDecodePipeline.present()` returns the WebCodecs `VideoFrame`; `uploadVideoFrameToTexture` assigns `tex.image = frame`, stamps `videoWidth`/`width`, sets `needsUpdate`. No `ImageBitmap`, no canvas 2D, no `createImageBitmap`.

The GPU upload happens later, when `videoBackground` draws and Three.js `WebGLTextures.uploadTexture` runs:

- `createVideoStreamTexture()` is `new THREE.Texture()` — **not** `VideoTexture` / `VideoFrameTexture`.
- Three.js r178: `useTexStorage = (texture.isVideoTexture !== true)`. Plain textures on WebGL2 allocate once with `texStorage2D`, then every unique frame is  
  `texSubImage2D(TEXTURE_2D, 0, 0, 0, format, type, videoFrame)`.
- `THREE.VideoTexture` exists specifically to skip texStorage and use `texImage2D` every frame (Chromium video bug [40915685](https://issues.chromium.org/issues/40915685)). This repo never sets `isVideoTexture`.

First unique HEVC `present()` → next `renderer.render()` that samples the map (AR FBO / preview) is the upload. First `readPixels`/`packPbo` after that upload is the 15–25 ms wait. That is why idle/AR/3D whichever packs first after the composite pays, and why packing before `present()` only moved the stall to 3D.

### 2. Chromium / ANGLE (not just “our PBO”)

Blink `WebGLRenderingContextBase::TexImageHelperMediaVideoFrame`:

- GPU-GPU fast path `use_copy_texture_chromium` is **`params.function_id == kTexImage2D` only** (plus default rect, `TEXTURE_2D`, sRGB unpack, `CopyTextureCHROMIUM`). **`texSubImage2D` never takes this path.**
- Shared-image frames then `CopySharedImageDirectlyToGLTexture` / `CopyVideoFrameTexturesToGLTextureViaIntermediateSI` (WaitSyncToken + CopyTextureCHROMIUM / keyed-mutex DXGI). That work is queued in the GPU process; the **next synchronizing GL call on this context** (our `readPixels`) waits for it.
- `texSubImage2D` falls through to `CreateAcceleratedImageFromVideoFrame` → `TexImageStaticBitmapImage` (YUV→RGB via canvas resource provider). Known slow: [w3c/webcodecs#421](https://github.com/w3c/webcodecs/issues/421) / Chromium **1279351** (`texSubImage2D` of D3D11VideoDecoder `VideoFrame` stayed slow after `drawImage` was fixed). Three.js [#28980](https://github.com/mrdoob/three.js/issues/28980): VideoFrame on a storage texture is **~5× worse on ANGLE**; workaround is `isVideoTexture = true` → `texImage2D`.

Software fix is **possible** as a GL entry-point change (texImage2D / VideoTexture flag), not as another NDI pack reorder. ImageBitmap would skip `TexImageHelperVideoFrame` entirely (`TexImageHelperImageBitmap`) — extra conversion, not the documented fast path. A post-upload `gl.flush()` does not wait; `gl.finish()` would only relocate the 15 ms on the same studio tick.

### 3. Live `texImage` vs production `texSubImage` (2026-09-03)

Diag (off by default): `?ndiUploadProbe=texImage` sets `isVideoTexture` + no-op `update()`. Logs `stage:upload-probe` and first `VideoFrame.format` = **NV12** (1920×1088 coded / 1080 display). Production pack-after-render. Solo Electron after idle instance killed.

| Window | AR Send | AR busy | arReadbackBegin mean/p90 / ms/s | arFboRender | 3d begin |
| --- | --- | --- | --- | --- | --- |
| First 15 s healthy | **24.3** (22–26) | **1%** | **2.62 / ~4 / ~84** | **0.98 ms** | 6.2 |
| Last 40 s | 16.1 (14–18) | 65% | **3.20 / 5.8 / ~96** | 1.31 ms | 9.7 |
| Prior contended texSubImage | 12–15 | 74–84% | **15 / 23 / 410** | ~1 | 6–8 |

The 15 ms first-pack stall is **gone**; it did **not** move into `arFboRender` or 3D. Later Send 16 is a **different** bottleneck (`2dGrab` 42 → 78 ms) — next investigation (OUT/PRF), not this pass.

### 4. Colour contract + ship 2026-09-03

Do **not** pin `texStorage2D(SRGB8_ALPHA8)` on the `isVideoTexture` path: Three.js `DECODE_VIDEO_TEXTURE` already applies `sRGBTransferEOTF` in `map_fragment` ([#26516](https://github.com/mrdoob/three.js/issues/26516) — SRGB8_ALPHA8 + video is not reliable). Hardware SRGB8_ALPHA8 (old texSubImage) and shader EOTF (new texImage) are the same IEC sRGB transfer; combining both would double-decode (too dark).

Production `createVideoStreamTexture()` now sets `isVideoTexture` + `SRGBColorSpace` + `internalFormat=null` → GL **RGBA8** + shader decode. Killswitch: `?ndiUploadProbe=texSubImage`. Default auto-connect URL is the new path. Commit `0e1838e`.

## AR Send 22–26 after texImage2D (not closed) 2026-09-03

Same healthy 15 s as the texImage report (`decodedFps>20`, AR Send 22–26, `arReadbackBegin` ~2.6 ms, busy ~1%). Symptom 10–15 fps is improved, not fixed.

### 1. Skip histogram (exact, not busy share)

Per 1 s decode-present row, AR skips:

| cause | mean n/s | range | share of skips |
| --- | --- | --- | --- |
| **rateCap** | **25.67** | 24–28 | **99.0%** (92.6–100) |
| stagger | **0** | 0 | 0% |
| busy | **0.27** | 0–2 | **1.0%** (0–7.4) |

Stagger is dead (PBO path, `blocking: false`). Busy is gone. **Every refused tick is `rateCap`.**

### 2. Rate-cap target vs achieved begin vs Send

- Declared AR/3D/2D `fps: 30`. `STUDIO_TICK_FPS = 60` (`desktop/main.cjs` `setInterval`).
- Gate (`ndiCaptureClock.ts`): declared ≥30 → **`NDI_CAPTURE_NOMINAL_FPS = 32`**, interval **31.25 ms**, tolerance **half a 60 Hz tick (8.33 ms)**. Designed so a 1 s Send readout never shows 29; resyncs when >1 interval behind (**no burst**).
- `noteNdiSkip('ar','rateCap')` is `!captureGate.isDue(now)` on that studio:tick — “not due yet”, not a 22–26 ceiling.

| 1 s mean | AR | 3D |
| --- | --- | --- |
| studio ticks (`presentHz`) | **57.7** | same clock |
| rateCap skips | 25.7 | ~24 |
| **readback begin n** | **32.1** (30–33) | **32.3** |
| **arEnqueueIpc / Send** | **24.4 / 24.3** (22–26) | **28.5 / 28.5** (26–31) |
| begin − Send | **~7.7 fps dropped** | **~3.8 fps dropped** |
| IPC stage mean | **7.04 ms** | **4.79 ms** |

**The 32 fps gate is hitting its target.** 57.7 ticks − 25.7 rateCap ≈ 32 admits. Send 22–26 is **after** a successful begin.

### 3. Where frames die (keep-newest deferred send)

`ndiDeferredSend`: `setTimeout(0)` off the tick; **one pending slot**; a second `enqueue` **releases the older buffer and keeps newest** (intentional: 8 MB `ipcRenderer.send` used to collapse the tick to ~50 Hz).

`arEnqueueIpc` is counted inside `sendFrameData` (the deferred `send`), not at `ipc.enqueue`. Sustained begin 32 vs Send 24 for 15 s is not pipeline fill. Completions that land while a send is in flight / a flush already scheduled replace `pending` → drop. AR UYVA send is slower (7.0 vs 4.8 ms) and drops more (~8 vs ~4), same mechanism.

Worker `uyvyWorker.pack` is unbounded async; PBO `begin`+`drain` on the same tick can post two packs close together. Those resolve into the same keep-newest slot.

### 4. Tick jitter vs Send jitter

`tickInterval` 10 s window: mean **17.33 ms** (~**57.7 Hz**, not 60), **>20 ms = 211 / 576 (~37%)**. Matches earlier ~38%.

`captureTicks` AR (10 s): **1** and **2** and **3** mixed (e.g. 1:115–142, 2:109–146, 3:45–60) — not `tight on 2`. Long ticks (>20 ms) make the 31.25 ms gate due on the *next* tick (gap **1**); phase then waits a gap **3**. That **spaces** captures; it does **not** cut begin below 32.

Send 22–26 (min–max 4) is the 1 s send **count** moving as keep-newest drops vary, not the rate-cap refusing 22–26 by design. 2dGrab **42 ms** mean @ ~10 fps (~420 ms/s main thread) lengthens the macrotask queue under the same `setTimeout(0)` — correlates with drops; not measured as a skip cause.

No fix this pass. Diag stays. `0e1838e` stays.

### 5. AR vs 3D send cost, eviction timing, 2dGrab (2026-09-03, no fix)

Diag-only: per-channel enqueue→evict wait, `duringSend` vs `awaitingMacrotask`, send-start `queueWait`, 2dGrab wall vs `createImageBitmap` occupancy. Logged as `[diag:srt-fps] stage:deferred-send`. Restarted Electron to load it; SRT ingest stayed `connecting`/`error` (no `decodedFps>20` with these counters). Two windows still answer the three questions:

| Window | HEVC | AR begin n | AR Send | AR evict/s |
| --- | --- | --- | --- | --- |
| **A** 15 s post-restart | none (`streams: []`) | **32.3** | **27.7** (23–31) | **4.3** |
| **B** 192 s HMR on old instance | already dead | **31.6** | **17.8** (14–18) | **13.7** |

Window A is the 32-admit → ~28-send gap (same class as 22–26, milder). Window B is the contended later-Send-16 class. Eviction *kind* is identical in both.

**1. Why AR send is slower — size, not extra send-path CPU**

Live bytes on every send: **AR 6,220,800** (UYVA 1920×1080×3) vs **3D 4,147,200** (UYVY 1920×1080×2 = GPU 960×1080 RGBA8). Ratio **1.50×**. `bytesAfterSend` equals `bytes` — the ArrayBuffer is still attached after `sendStudioNdiFrame` (not a MessagePort transfer; full clone).

| | AR | 3D | ratio |
| --- | --- | --- | --- |
| payload | 6.221 MB | 4.147 MB | 1.50 |
| Window A send mean | **7.16 ms** | **4.97 ms** | **1.44** |
| A effective BW | 869 MB/s | 834 MB/s | ~1 |
| Window B send mean | 8.30 ms | 5.76 ms | 1.44 |
| B effective BW | 750 MB/s | 720 MB/s | ~1 |

The 7.0/4.8 (~1.46×) from the healthy 15 s matches the byte-size ratio. Same memcpy bandwidth; AR is not disproportionately worse.

AR extra CPU (`rgbaToUyva` = Rec.709 UYVY + copy the A plane, **no premultiply**) runs on `uyvyWorker` **before** `ipc.enqueue`. 3D GPU UYVY is packed before enqueue too. `arEnqueueIpc` / `3dEnqueueIpc` wrap only `sendStudioNdiFrame`. Main `fillSlot` is `Buffer.copy` for both `uyvy` and `uyva` (no `rgbaToBgra`).

**2. Drop mechanism is queue delay, not in-flight send**

Capture interval is 31.25 ms; a 7 ms send cannot occupy multiple intervals unless flush is delayed.

| | A AR | A 3D | B AR | B 3D |
| --- | --- | --- | --- | --- |
| `evictDuringSend` | **0** | **0** | **0** | **0** |
| `evictAwaitingMacrotask` | **100%** (4.3/s) | 100% (1.5/s) | **100%** (13.7/s) | 100% (12.6/s) |
| enqueue→evict wait mean / max | **11.2 / 28.8 ms** | 5.8 / 23.4 | **21.7 / 81.8 ms** | 19.4 / 42.6 |
| send-start `queueWait` mean / max | **16.8 / 40.8 ms** | 19.8 / 37.6 | **23.0 / 101 ms** | 27.7 / 73.7 |
| `queueWait` >16 ms (per s) | 16.0 / 28 sends | 23.2 / 31 | 11.9 / 18 | 16.2 / 19 |

**0 of 2242** AR evict samples in window B were `duringSend`. The pending slot is replaced while `setTimeout(0)` is still queued — typically **8–32 ms** after enqueue (B buckets: 16–32 ms = 1481, 32+ = 433, 8–16 = 400). Completions bunch from async UYVA pack; they do not wait on a 7 ms in-flight IPC.

**3. 2dGrab does not raise the drop rate**

`2dGrab` wall (~42 ms @ ~10.6/s) is **awaiting the worker**, not a 42 ms main-thread block. `createImageBitmap` occupancy is **0.63 ms/s** (A) / **6.7 ms/s** (B). Evicts *do* run during the grab wall (main thread is free). Drop **rate** is **lower** during the wall than in the gaps:

| AR evict/s | during 2dGrab wall | outside (gaps) | wall share of time |
| --- | --- | --- | --- |
| A | **1.5–2.9** | **5.3–6.4** | 43% |
| B | **8.8** | **16.1** | 40% |

`evictDuringGrabBitmap` ≈ 0. A samples after a grab: mean `afterGrabMs` **~43 ms** (next gap), not a spike in the 8 ms after grab (`evictAfterGrab8ms` 0.3/s vs 4.3 total). 2dGrab is **not** a proven `setTimeout(0)` blocker for these drops.

No production queue/policy/2dGrab change. Diag stays.

### 6. What delays setTimeout(0) (2026-09-03, no fix)

The delayed timer is **`src/output/ndiDeferredSend.ts` in the Electron renderer** (Chromium), not Node’s main-process timers/check phases. Main still *feeds* `studio:tick` IPC (~60 Hz `setInterval` + `webContents.invalidate()`). ffmpeg stdout / NDI `fillSlot` run on main **during** `sendStudioNdiFrame`, i.e. after flush starts — they cannot explain enqueue→flush `queueWait`.

**Renderer macrotasks sharing the thread with the deferred send:** `studio:tick` IPC (present + AR FBO + 3D FBO + 2D `setTimeout(0)` schedule, several `ipcRenderer.on` handlers in one turn); **rAF preview** (`previewFrameClock`, full scene); three keep-newest send timers (AR/3D/2D); 2D grab defer; UYVA `uyvyWorker` messages. `flushInTickN = 0` (send never runs inside the tick, as designed).

Live 59 s, `?ndiDefer` default timeout, ingest live, AR Send ~25, begin ~32:

| AR | |
| --- | --- |
| `queueWait` mean / max | **17.9 / 103 ms** |
| studio ticks during wait | mean **1.57**, max **8** |
| enqueue on tick | **0** (worker completions) |
| evict preceding | **100% `uyvyWorker`** |
| late flush preceding (`queueWait>8`) | **rAF 67%** (832), **studio:tick:end 26%** (324), flush:2d 5%, 2dDefer/flush:3d <2% |

3D enqueues **on-tick** (`enqueueInTickN` = all 32). Late 3D flush preceding is **flush:ar 57%** (serial behind AR’s 7 ms clone), then rAF 16%, studio:tick:end 13%. Evict preceding **100% `studio:tick`**.

**Scheduler experiment** (probes scheduled at the same enqueue as the real defer; then a 42 s `?ndiDefer=immediate` run):

| primitive | AR fire delay | 3D fire delay | actual send path |
| --- | --- | --- | --- |
| `setTimeout(0)` | **20.7 ms** | 22.7 ms | baseline: Send 25.6, evict 6.4/s, wait 17.9 |
| MessageChannel (`setImmediate` stand-in) | **20.8 ms** | 22.7 ms | `?ndiDefer=immediate`: Send **25.1**, evict **6.8/s**, wait **18.8** — **no win** |
| `queueMicrotask` | **0.05 ms** | **6.2 ms** | not used for send (would run before rAF; 3D’s 6.2 ms is leftover tick work after in-tick enqueue) |

Immediate and timeout are the same stall: Chromium is busy with **rAF + queued studio:tick** before *any* macrotask (timer or port message). Microtask is the only primitive that fires before that work. Using it for send would put AR IPC at worker-completion (~0 ms extra) and 3D IPC at end-of-tick (~6 ms, then rAF waits). That is the original tick-collapse risk; not a fix this pass.

**Queue depth (symptom, not cause).** This timeout window, 377 AR evicts: **96.3% wait <32 ms**, 3.4% 32–48, 0.3% 48–64. At 32 fps (~31 ms arrivals), **depth 2** (keep-newest, 2 slots) covers ~one extra frame → ~95% of *this* window. Contended window B had **16.5% of evicts ≥32 ms** (max 82 ms) — depth 2 would miss that tail; depth 3 (~62 ms) would be closer. Depth increase does **not** stop rAF/tick from delaying the first send; it only keeps extra newest frames until the late macrotask finally runs.

Default defer remains `setTimeout(0)`. `?ndiDefer=immediate|microtask` is diag-only.

## contended idle + early 2026-09-03
Early-pack instance recovered overnight (first `decodedFps>20` ~line 62942). Reported that window, then force-stopped (one GPU) and launched solo `ndiReadbackProbe=idle`. Idle reached contention in **<1 min** (no 12-frame stall this time).

### Idle probe — contended 40 s (log **125507–125591**)
`decodedFps>20`, AR Send **12–15**. Idle 16×16 packed **after** this tick’s AR composite and **before** the real AR pack (same queue slot AR used to occupy).

| Metric | Idle 16×16 | AR 1080p (after idle) | 3D UYVY |
| --- | --- | --- | --- |
| begin mean / p90 | **15.76 / 23.18 ms** | **0.82 / 1.16 ms** | 6.81 / 8.18 ms |
| n / ms/s | 25.8 / **404** | 25.8 / **21** | ~26 / 175 |
| AR Send / busy | **12.88** / 83.7% | | 3D Send 13.1 |
| present unique/decoded | 29.75 / 29.75 (1.000), min-clamp~50% / repeat~50% | | |

Idle matches the original AR stall (~14–22 ms, **410–480 ms/s**). AR’s own 1080p pack is cheap once idle has paid. **Not AR-plate-specific.**

### Early-pack probe — contended 40 s AR Send 10–12 (log **125165–125275**)
Previous FBO packed **before** `present()` and before `arFboRender`.

| Metric | AR (early) | 3D (still after present+AR render) |
| --- | --- | --- |
| begin mean / p90 | **4.38 / 11.08 ms** | **23.08 / 28.51 ms** |
| n / ms/s | 20.8 / **91** | 20.8 / **476** |
| Send / busy | AR **10.32** (10–12), busy **93.8%** | 3D Send 10.35 |
| present unique/decoded | 29.41 / 29.39 (0.999) | |

AR begin **410 → 91 ms/s**, but AR Send stays ~10: the stall **moves to 3D** `3dReadbackBegin` (476 ms/s). Drain stays ~0.3 ms.

### Mechanism
Same-context command-order behind unique HEVC `present()` / texture upload. The **first** `packPbo`/`readPixels` after that upload blocks ~15–25 ms (idle 16×16 or AR 1080p). Later packs on the same tick are cheap. Packing AR before `present()` makes AR begin cheap and dumps the cost on 3D’s still-late pack. Reordering **AR only** will not restore AR Send fps while 3D still packs after `present()`.

Proposed next (not implemented): either pack **both** AR and 3D before `present()` (3D still previous-tick FBO), or keep 3D from issuing PBO begin after HEVC upload on this context this tick. Then re-measure AR Send, not only `arReadbackBegin`.

## diagnosis 2026-09-02 — queue-pressure probes (measurement only)
Query: `ndiReadbackProbe=idle|early` (`diagNdiReadbackProbe.ts`). Default URL still production pack-after-render. `npx vitest run src/output`: **352 passed**.

### 3. WebGL / ANGLE (logged `webgl-context`, this machine)
Three.js: `antialias: true`, `alpha: true`, `powerPreference: 'high-performance'`. **Not set:** `desynchronized` (false), `preserveDrawingBuffer` (false). Live `getContextAttributes()`: alpha/antialias/depth true, stencil false, premultipliedAlpha true, xrCompatible false, failIfMajorPerformanceCaveat false. Unmasked: **ANGLE (NVIDIA GeForce RTX 5080, Direct3D11 vs_5_0 ps_5_0, D3D11)**. Backend is D3D11, not D3D9/GL/Vulkan.

### 4. Size vs AR stall (a+c contended window 48538–48621)
| Path | Read size | begin mean | ms/s |
| --- | --- | --- | --- |
| AR PBO | 1920×1080 RGBA (~8 MB) | **15.12 ms** | **410** |
| 3D PBO | GPU UYVY **960×1080** (~4 MB) | **6.03 ms** | **162** |

Size ratio ~2×, time ~2.5× — not a clean bytes-linear story. During HEVC **decode stall** (no unique present), AR 1080p begin drops to **~0.5–2 ms / ~70 ms/s** while 3D stays **~7–8 ms**. **Volume does not explain the AR-only 15 ms stall.**

### 1. Idle 16×16 pack after this tick’s AR composite (before AR pack)
Separate PBO; pixels discarded. **No contended `decodedFps>20` window** this evening (burst 12 decoded, outstanding=12, never recovered; first idle launch also overlapped the leftover a+c Electron — ignore that GPU load). Solo idle while HEVC stalled (`probe-idle-solo`): idle begin **~1.1–2.7 ms** (n≈32), AR begin **~0.5 ms**, AR Send **~23–27**. First pack-after-render of a tiny unused FBO is **not** 15–25 ms when `present()` is not uploading unique HEVC frames.

### 2. Pack previous AR FBO **before** `present()` and before `arFboRender`
`probe-early`, listener registered before videoStreamManager. Same decode stall: AR begin **~1.7–2.1 ms / ~70 ms/s**, Send **~23–26**, busy ~0. **Cannot score queue-position vs 410 ms/s baseline without a healthy HEVC window.** Cheap early-pack during stall is consistent with “no HEVC upload in the queue,” not a proof that reordering would help under contention.

### Mechanism so far (not a fix)
The 15 ms `arReadbackBegin` **tracks unique HEVC `present()` / texture upload**, not “this FBO was just drawn” (ping-pong already falsified that) and not “any PBO after some GPU work” (idle 16×16 and 1080p AR are both cheap when decode is stuck; 3D still renders). Next measurement needed: **one** idle-probe run with `decodedFps>20` and AR Send 10–19 — if idle is also ~15 ms, queue-behind-HEVC-upload; if idle stays ~2 ms, AR-plate-specific. Then one early-pack run in that same contended regime. Do not ship a reorder until those two numbers exist.

**Watch:** `--dev` still self-exits on some long runs; HEVC 12-frame then outstanding=12 stall is frequent and can last >12 min. Dual Electron on `broadcast-web-repro` invalidates GPU timings.

## (c) AR skip `gl.flush()` + (a)+(c) live 2026-09-02
**Flush guarantee (not “it’ll flush eventually”):** Chromium WebGL2 `GLES2Implementation::ClientWaitSync` writes the wait into the command buffer then `WaitForCmd()` (`CommandBufferHelper::Finish()`), which submits pending commands (including the preceding `fenceSync`) to the GPU process. AR `captureAirTarget` calls `drainReadback` → `poll()` → `clientWaitSync(fence, 0, 0)` on the same tick as `begin()`, so that wait is the submit — not a later canvas swap, and not 3D’s remaining `gl.flush()` (3D is often `rateCap` on the same tick). `flushAfterPack` defaults **true** (3D); AR passes **false**.

**Tests:** `npx vitest run src/output` **348 passed** (344 after (a); +4: no-GL-between fence/wait CONDITION_SATISFIED, ALREADY_SIGNALED, TIMEOUT then SATISFIED, AR/3D source wiring).

**Live:** same auto-connect URL / `BROADCAST_NDI_NAME=broadcast-web-repro`. Vite serving `flushAfterPack: false`. Ingest live HEVC copy immediately; decode **1 s burst then 0** (outstanding=13) until recovery ~**8 min** later (log **48117+**). Window: last 40 s `decodedFps>20` and AR Send ≤19 (lines **48538–48621**). Electron still running at ~12 min this pass (has not self-exited yet). **Watch:** `--dev` has now exited cleanly on its own twice before (9 min, 67 min) — relevant if a long measurement window dies.

| Metric | This window (a+c) | Original contended (`340fade` / `fb3ff08`) |
| --- | --- | --- |
| presentHz | **59.02** (min 56.56) | 58.73 / 59.28 |
| unique / decoded | **29.71 / 29.76** (ratio **0.998**) | 1.001 / 0.997 |
| reasonCounts | min-clamp **50.3%**, repeat **49.7%**. catch-up **0** | ~50/50, catch-up 0 |
| NDI AR Send | **13.88** (min 12, max 16) | 10–19 (14.65 / 11.58) |
| AR NdiSkip busy | **73.7%** (min 52.9, max 100) | 71.2% / peak 93.5% |
| arReadbackBegin | mean **15.12** / p90 **23.19** / n≈27 / **410 ms/s** | ~14–22 / ~21–27 / n≈23–28 / **410–480 ms/s** |
| arReadbackDrain | mean **0.37** / p90 **1.1** / n≈87 | ~0.29 / ~0.98 — still cheap, not stalling |

Verdict: dropping AR `gl.flush()` did **not** regress drain. Combined with ping-pong it also did **not** move `arReadbackBegin` or AR Send off the contended baseline. Stall is still inside `readback.begin()` / `packPbo` (`readPixels`+`fenceSync` on the shared context after this tick’s FBO render), not the explicit flush.

## contended re-baseline 2026-09-02 (`340fade`)
Kept watching the already-running retry (same auto-connect / `broadcast-web-repro`). Decode stalled immediately after live (1 s burst then 0); **recovered ~4 min later** without a restart. Window: last 40 s HEVC `decodedFps>20` and AR Send ≤19 (log **40256–40336**).

| Metric | Value |
| --- | --- |
| presentHz | **58.73** (min 55.21) |
| unique / decoded | **29.99 / 29.97** (ratio **1.001**) |
| reasonCounts | min-clamp **1218 (51.1%)**, repeat **1167 (48.9%)**. catch-up = 0 |
| NDI AR Send | **14.65** (min 13, max 17) |
| NDI 3D / 2D Send | 15.13 / 6.45 |
| AR skips | rateCap 28.8% / **busy 71.2%** / stagger 0 |
| 3D skips | rateCap 65.4% / **busy 34.6%** / stagger 0 |
| 2D skips | busy **88.5%** / rateCap 11.5% |
| arReadbackBegin | mean **14.52** / p90 **21.22** / n≈28 / **410 ms/s** |

Earlier 75 s peak in the same recovery (39574–39731): AR Send **10.6**, `arReadbackBegin` **22.6 ms / 480 ms/s**, AR busy **93.5%**. Labeling fix lights up `busy` when readback is the bottleneck. No `arReadbackBegin` / `present()` change this pass.

## skip-cause busy 2026-09-02 (`340fade`)
AR `captureFrame` returned at `!readback.canBegin()` with no `noteNdiSkip`, so readback-blocked skips were omitted and the histogram read 100% `rateCap`. Same gate on 3D. Fix: `noteNdiSkip(ch, 'busy')` at that return only — no change to when capture is skipped. Tests: `ndiFramePump.skipCause.test.ts` + source regex in `ndiIndependentClocks.test.ts`. `npx vitest run src/output`: **339 passed**.

Re-measure (same auto-connect URL / `BROADCAST_NDI_NAME=broadcast-web-repro`): `"state":"live"` line 39064, `transcodeToH264=false`, ffmpeg 29.90 fps / 0.995x. HEVC AUs ~30 fps but decoded stuck at 0 after a 1 s burst (~19 decoded, outstanding=12). **No `decodedFps>20` window** (unlike 37908–38032). ~2 min after live (lines 39065–39316):

| Metric | Value |
| --- | --- |
| unique / decoded | **~0 / ~0** (100% `repeat` after burst) |
| NDI AR Send | **28.7** (min 21) |
| AR skips | rateCap **99.3%**, busy **0.7%** (22), stagger 0 |
| 3D skips | rateCap **99.5%**, busy **0.5%** (15), stagger 0 |
| 2D skips | busy **70.6%**, rateCap 29.4% |
| arReadbackBegin | mean **2.11** / p90 **4.57** / n≈32 / 68 ms/s |

Busy is no longer identically 0 (the old mislabel). Share is small because this window is **not** the contended readback case (`arReadbackBegin` was 18.6 ms / AR Send 11.6 when present was healthy). Do not treat this as a re-baseline of the stall; need HEVC `decodedFps>20` for that. No `arReadbackBegin` timing fix this pass.

## concurrent present+NDI 2026-09-02 (`fb3ff08`) — HEVC-healthy window
Logging only (already on `fb3ff08`). Relaunch same no-click URL + `BROADCAST_NDI_NAME=broadcast-web-repro`. Ingest `error` ~70 s (no ffmpeg child) then `connecting` → `"state":"live"` line **37729**, `transcodeToH264=false`, HEVC copy. Prior `--dev` instance had exited cleanly (`exit_code` 0) after ~9 min; this pass did not investigate that. This instance still up at ~3 min when the window was read.

**Window:** last 40 s HEVC `decodedFps>20` (log lines **37908–38032**).

| Metric | Value |
| --- | --- |
| presentHz | **59.28** (min 56.60) |
| unique / decoded | **28.89 / 28.98** (ratio **0.997**) |
| reasonCounts | min-clamp **1171 (48.7%)**, repeat **1232 (51.3%)**. catch-up = 0 |
| ffmpeg | 29.79 fps / 0.996x / copy |
| NDI AR Send | **11.58** (min 10, max 14) |
| NDI 3D / 2D Send | 11.95 / 5.43 |
| AR skips | rateCap **100%**, stagger 0, busy 0 |
| 3D skips | rateCap **100%**, stagger 0, busy 0 |
| 2D skips | rateCap 4.2% / busy **95.8%** / stagger 0 |
| arReadbackBegin | mean **18.59** / p90 **26.3** / n≈23 / **432 ms/s** |
| arEnqueueIpc | mean 7.49 / p90 8.14 / n≈11.8 / 89 ms/s |
| arReadbackDrain | mean 0.29 / p90 0.98 / n≈83 |
| arFboRender | mean 1.12 / p90 1.46 / n≈23 |
| 2dGrab | mean **87.55** / p90 **95.1** / n≈5.5 / 477 ms/s |
| totalTick | mean 11.61 ms, max 59, n≈60 (`p90` n/a) |

Morning session (decode stall, unique=0) had AR Send **~29** and `arReadbackBegin` **~1.6 ms**. This HEVC-healthy session matches 4404a68 present **and** the screenshot AR Send 10–19.

Verdict: **yes, NDI capture is the concurrent bottleneck while present() is healthy.** The AR stage that consumes disproportionate time is **`arReadbackBegin`** (GPU readback begin, p90 26 ms, 432 ms/s), not `arEnqueueIpc` (cheap; n≈12 is the *result* of slow readback). AR `NdiSkipCause` stays 100% `rateCap` because `!readback.canBegin()` does not `noteNdiSkip('busy')`. 2D `2dGrab` is also saturated (OUT/PRF). No present()/NDI logic change this pass.

## no-click repro 2026-09-02
No existing query/config auto-connect. Checkboxes = sessionStorage tab cache (not restored as Connect). Connect SRT is an explicit `operatorConnected` hold. `arBackground` is `config.json` (`alpha`); URL had `outputMode` only. Order: Vid/Live checkboxes → Connect live and Connect SRT (independent) → AR video can be anytime (no SRT/autoplay gate; ffmpeg is main-process). `desktop/configFs.cjs` does not persist these. Diag query params; POV ids must be in the URL (no default POV in source).

Verified `6fe97cd`: launch Electron `--dev` with
`BROADCAST_WEB_URL=http://127.0.0.1:5173/?race=demo-istanbul&outputMode=transparent&arBackground=video&autoConnectLive=1&livePov=1&autoConnectSrt=1&srtPov=1`
(POV `1` from the prior live HUD / pack `srtByPovId`, not a source default). `diag-srt-fps.log` `[diag:auto-connect]` then ingest `connecting` → `live` in ~6–8 s from process start. `start-studio.ps1` default URL unchanged.

## live verify log 2026-09-02 (4404a68, post tray-quit)
New session starts at log line 2751 (`sameFrameUpload` field). Steady HEVC copy, `decodedFps>20`, `kfRise=0`, **n=148 s**.

| Metric | Steady mean |
| --- | --- |
| ffmpeg | 29.69 fps / 0.982x / 0.007 CPU cores |
| ipcDropPerSec | 0.06 (10 drops whole session) |
| auFps / decodedFps / uniquePresentFps | **29.87 / 29.71 / 29.73** (unique/decoded = **1.001**) |
| presentHz | **58.80** (min 54.65, never <50) |
| reasonCounts | min-clamp **4468 (50.57%)**, repeat **4368 (49.43%)**. max-clamp/stall-pin/lut-miss-live/**other = 0** |
| AU per present | 0: 77.4%, 1: 2.0%, 2: 13.1%, 3: 7.6%, 4+: 0 |
| latency / queue | 113 ms / depth 5.4 |

First 20s rollup uniquePresent **13.93** is idle+connect dilution (~10 empty seconds). Seven later 20s windows unique **28.1–29.8**. Verdict **(c)**: present() unique tracks decode; studio:tick still feeds present() at ~59 Hz. Pre-restart HUD AR Send 10–19 / `arEnqueueIpc n≈11–13` is downstream NDI capture, not this skip bug. `droppedFps≈decoded` is prevPresented recycle (one drop per unique advance), not hole-skip.

## live verify after present() fix 2026-09-02
Running instance (no restart this pass): Electron `--dev` pid 29452 started 11:22:32; Vite pid 34280 since 08:54; HEAD `bdb4c73` 09:38:51, clean tree. Vite is serving `allowsCatchUpSkip` from `videoDecodePipeline.ts`. Packaged app is not in use.

Existing HUD (this process, SRT already connected): `pov 1 srt=1 live ~4.6–5.1 Mbps codec=hevc picture=yes err=Decoding error.` Cumulative demux/decoded ~25–28 fps session average (e.g. demux 10123 / decoded 9506 at ~6.5 min). **No `reason`, uniquePresent, dropped, or queueDepth** on the Race SRT HUD. Sync debug is off and below the NDI fold. NDI AR Send oscillating **10–19 fps**; `arEnqueueIpc n≈11–13`; `3dFboRender n≈21–25`; `2dGrab ~80ms n=6`; studio tick mean ~17ms but `>20ms` ~38%. `dropBusy=0`.

Cannot tell skip-vs-catch-up-vs-NDI from this HUD. Diag `diag:` commit restores ingest+decode logs plus per-reason counts / AU-per-present hist / uniquePresentFps. **Needs tray-quit (not park) + Connect SRT ~20s.** Do not patch `present()` until that log is read.

## present() 2:1 skip 2026-09-02
Live: copy HEVC ~30 decoded, `presentHz` ~60, `uniquePresentFps` ~14. Cause: `dropQueued` of every `pts < pick` when `frameAtLatency(100ms)` jumped two PTS steps on a decode burst. Fix: snap pick to the next queued PTS for `min-clamp` / `adaptive` / `fixed`; skip-jump only for `max-clamp` / `stall-pin` / `lut-miss-live`. Tests: paired 87/90 after (44/90 before), asymmetric 87/90 after (29/90 before), smooth already 87/90. Diag instrumentation reverted.

## FPS collapse bisect 2026-09-02 (measured)
`diag-srt-fps.log` after Electron restart + Connect SRT. First live run ~116s; `transcodeToH264=false` (bitstream copy), `codec=hevc`.

Steady seconds (`kfRise=0`, `decodedFps>20`, n=110): ffmpeg **29.60 fps** / **0.98x** / **~0.009 CPU cores**; `ipcDropPerSec` **0** (7 drops in the whole run); `auFps` **29.06**; `decodedFps` **29.06**; `droppedFps` **29.01**; `uniquePresentFps` **14.31**; `presentHz` **59.19**; `kfRise` **0**. Latency pinned ~100 ms; reason `min-clamp` / `repeat`.

Collapse is **presentation skip** (suspect 4), not ingest/IPC/tick/transcode. Brief HEVC `"Decoding error."` seconds dip decode further (secondary). Diag `6099188` reverted in `23c37e7`.

## HEVC SPS RBSP unescape 2026-08-29 (pulled main)
Far-device `fix(srt): unescape HEVC SPS so WebCodecs can copy-decode DJI`.

- Annex-B EPB `0x000003` was parsed into `hev1.*` → WebCodecs rejected → transcode.
- `unescapeRbsp` before HEVC SPS/VPS PTL. Feed AUs stay Annex-B (no `description`).
- Intended live path: ffmpeg **`-c copy`** + WebCodecs **HEVC** (D3D11VA / VCN). `transcodeToH264` only on true unsupported or ~2.5 s `decoded=0`.
- No Store pack. No raw-frame IPC. No shared GPU. Electron stays the shell.

## Keep-PTS accepted 2026-08-28 (BW)
`done/DSP-SRT-20260828-01`. Transcode: `-copytb 1` + `-enc_time_base 1:90000`. Copy path untouched. File round-trip kept muxer PTS. Live ~34 s extra is operator + OUT-05 PES identity. No `setpts` / `setts` next.

## Role
SRT Ingest Orchestrator (`SRT`). Caller, catalog, ffmpeg TS, demux/decode, HEVC fallback, Race ops SRT HUD. New workers: `DSP-SRT-*`. Historical SRT code shipped as `DSP-OUT-03`…`09`.

## Locks
- Caller, DJI only, catalog 1–27 @ `49.13.20.49:9000`, `read:camN:pubN:<token>`
- Empty / dummy `host` template → catalog
- No `%3A` in `streamid`; never log tokens
- HEVC on wire; WebCodecs HEVC after RBSP-unescaped `hev1` (2026-08-29). ffmpeg→H.264 on WebCodecs fail or live `decoded=0` stall (~2.5 s)
- Transcode must keep **muxer 90 kHz PTS** (not a new origin). Colour bars ≠ drone. Cap 4. Present 100–400 ms
- No Store HEVC pack. No WHEP. No `STUDIO_TICK_FPS = 60`

## Leftovers (not this dispatch)
- Electron `desktop/srtHelpers.cjs` `redactSrtUrl` may still be passphrase-only on some log paths
- PLT: vendor gyan **full** `ffmpeg.exe` (libx264) in extraResources — still needed for fallback
- Confirm Race ops: `codec=hevc`, no `ffmpeg→h264`, PTS still maps (TEL-04)

## Handoffs / dispatches
- `HO-BW-SRT-20260828-01` / `DSP-SRT-20260828-01` **accepted**
- 2026-08-29 HEVC unescape: no DSP (direct `main` commit `1a4e0ae`)
