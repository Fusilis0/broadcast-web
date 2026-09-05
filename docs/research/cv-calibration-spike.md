# CV calibration spike plan (Phase 4.5)

**Owner:** CAL  
**Status:** Research plan only — no runtime CV code yet  
**Related:** architecture §5.3, `src/calibration/`, OUT WHEP underlay (3.3)

## Goal

Explore **runtime computer vision** that compares the live drone video frame to the synthetic SCN view (same camera pose + FOV) and nudges **existing** per-device `CalibrationOffsets` so AR lines up with sight.

Human offset sliders already prove the apply path (`setOffsets` → `applyCalibration` → SCN camera). CV must reuse that path only.

## Non-goals

- No second pose pipeline (no CV-owned ENU/world pose, no bypass of GEO)
- No change to `applyCalibration` math in this spike phase
- No WHEP / MediaMTX / NDI implementation (OUT owns underlay)
- No Unity replacement / cutover criteria (BW Phase 5.6)
- No OpenCV / TF / WASM packaging decisions locked here — spike picks a stack later
- Chroma is for air compositing; it is **not** assumed CV input

## Architecture lock

```
WHEP frame (+ pose/timecode) → CV estimator → setOffsets(deviceId, partial)
                                              ↓
rawTelemetryPose → GEO → + CAL offsets → SCN camera
```

Per architecture §5.3: **CV only writes these offsets.**

Target knobs (same store as sliders):

| Field | Role for CV |
| --- | --- |
| `yawDeg` / `pitchDeg` / `rollDeg` | Primary align (horizon / features) |
| `fovHDeg` | Scale / zoom mismatch (coupled — treat carefully) |
| `altMeters` | Vertical parallax / ground plane (secondary) |

API surface today: `setOffsets(deviceId, Partial<CalibrationOffsets>)` in `src/calibration/offsetsStore.ts`. Defaults: angles/alt `0`, hFOV `66.8832°`.

## Inputs

| Input | Source | Spike assumption |
| --- | --- | --- |
| Video frame | OUT WHEP underlay (`webrtc-underlay`) | Canvas/`VideoFrame` grab at ~10–30 Hz for CV (not every display frame) |
| Device id | Active POV / `povIds` | Same key as slider store |
| Synthetic view | SCN render (or depth/silhouette proxy) | Same calibrated camera as live HUD |
| Pose | TEL → GEO → calibrated pose | Frame must be paired with pose used for that synthetic view |
| Timecode / sync | TEL timestamps + media clock | Spike must measure skew; if unknown, use “latest pose” and document error |

**Sync assumptions (to validate in spike):**

1. Underlay latency is roughly constant over short windows (estimate once, hold).
2. Pose rate ≥ video effective CV rate, or interpolate pose to frame time.
3. Active `deviceId` matches the underlay stream being analyzed.
4. Ops may still override via sliders; CV writes are merges, not a lock-out (policy TBD: damp, gate, or “CV armed” flag).

## Outputs

**Only:** `setOffsets(deviceId, partial)` — typically small deltas on yaw/pitch (and optionally roll/FOV/alt).

Do **not:** mutate GEO origin, invent a parallel calibrated pose bus, or write Three camera state directly.

Ops UI remains source of truth for manual override; CV is an optional writer into the same map.

## Candidate approaches (high level)

### A — Template / render match (preferred first spike)

Render a cheap SCN proxy (silhouette, edges, or downscaled RGB) at current pose; optimize yaw/pitch (then roll) to maximize NCC / mutual information / edge overlap with the video crop.

- **Pros:** Uses existing world; no boat-specific detectors; aligns with “match sight to scene.”
- **Cons:** Needs a usable synthetic proxy; sensitive to lighting and water texture; FOV coupling.

### B — Horizon / vanishing-line

Detect horizon (or strong linear features) in video; compare to projected virtual horizon from calibrated pose; solve pitch/roll (yaw weaker at sea).

- **Pros:** Cheap; good for pitch/roll bias; works when sea/sky dominates.
- **Cons:** Weak yaw; fails in fog / no horizon; does not place boats.

### C — Feature / landmark (boats, buoys)

Detect known SCN objects (buoy markers, boat hulls) in video; solve PnP-like residual into offset space (not full 6DoF world pose).

- **Pros:** Strong when fleet/course geometry is visible.
- **Cons:** Detector brittleness; ID association; needs good SCN proxies; more engineering.

**Spike recommendation:** Start with **A** offline (fixture video + recorded pose + offline SCN frames). Use **B** as a cheap prior or fallback. Defer **C** until A/B show FOV/yaw limits.

## Risks

| Risk | Why it matters | Mitigation in spike |
| --- | --- | --- |
| Latency / skew | Wrong pose for frame → systematic offset chase | Measure A/V vs pose delay; time-align fixtures |
| False locks | Water glare, wakes, UI burn-in | Confidence gate; max step/frame; reject jumps |
| FOV coupling | FOV and pitch trade off in image scale | Freeze FOV at default unless residual clearly scale-like; separate FOV pass |
| Multi-device | Wrong `deviceId` pollutes another POV | Bind CV session to stream + `deviceId` explicitly |
| Perf | Main thread / WebGL contention | Off-main worker; low CV rate; downscale |
| Ops fight | Slider vs CV fighting | “CV armed” + soft blend; or CV proposes, human commits |

## Suggested spike milestones

1. **Offline fixture** — Recorded underlay (or file) + pose log + SCN screenshot sequence. Offline script/notebook estimates Δyaw/Δpitch; write results as if `setOffsets` (JSON dump). Success: residual shrinks vs human-calibrated reference.
2. **Live underlay hook** — After OUT 3.3 WHEP: grab frames + current `getOffsets` / pose; run estimator in a worker; call `setOffsets` behind a feature flag. Success: AR visibly improves within ~1–2 s of arming, no pose-bus fork.
3. **Race soak** — Multi-minute race segment; log offset time series, false-lock rate, CPU. Success: stable offsets within slider ranges (±200° angles, FOV 20–120°, alt ±50 m) without operator babysitting every second.

Each milestone stays docs+spike code behind a flag; promotion to product is a later CAL dispatch.

## Explicit exclusions

- **Unity replacement criteria** are out of scope (BW / Phase 5.6). This plan only covers how CV would feed the web CAL store.
- No commitment to browser-only vs native helper for heavy CV; decide after milestone 1 cost/quality data.

## Dependencies

| Dependency | Owner | Need |
| --- | --- | --- |
| WHEP underlay frames | OUT (3.3) | Milestone 2+ |
| Stable per-device offsets + sliders | CAL (done) | Already |
| Pose + device id | TEL / GEO / SCN POV | Frame pairing |
| Synthetic proxy quality | SCN | Edges/silhouette usefulness |

## References

- `docs/architecture/system-architecture.md` §5.3
- `src/calibration/README.md`, `offsetsStore.ts`, `types.ts`
- `src/pose/applyCalibration.ts`
- Roadmap Phase **4.5**
