# Dispatch DSP-OUT-20260826-03-srt-transport

## Meta
- From orchestrator: BW → OUT (PLT consulted on the native dependency)
- Worker role: WORKER(DSP-OUT-20260826-03-srt-transport)
- Priority: P0
- Phase: Phase 17.1 — SRT ingest transport
- Design: `docs/architecture/ar-video-underlay-ntp-sync.md` §3.2
- Parallel-safe with: TEL-01, TEL-02, OUT-04, CAL-05. **You own** `desktop/*` and `src/output/srtBridge.*`. OUT-04 owns `src/output/types.ts` and the `main.ts` wiring block — stay out of both.
- **Status: DONE** — worker complete + BW accepted 2026-08-26 (merged tree `npm test` 741+23, `npm run build` green). ffmpeg `-c copy` + `-mpegts_copyts 1`; native SRT addon rejected.

## Goal

Get MPEG-TS bytes from an SRT source into the renderer, **with the muxer's PTS untouched**, and expose it on `window.broadcastStudio` in the same shape as the existing `ndi` / `races` / `config` namespaces.

Electron main is a **dumb byte pipe**. It does not parse, demux, decode, or transcode. Every format-sensitive decision happens in the renderer (OUT-06) where it is unit-testable.

## Background

The app has no SRT and no video ingest today. The only video path is `src/output/whepUnderlay.ts` — a WHEP `RTCPeerConnection` feeding a DOM `<video>`, preview-only, unrelated to this work and **not to be modified**.

### The one invariant that matters

**PTS must survive end to end.** Phase 17 matches telemetry to video by mapping the MPEG-TS muxer PTS to NTP via `stream_anchor`. If any stage re-stamps timestamps, the anchors no longer describe the frames we hold and the entire feature becomes decorative.

Concretely: if you use `ffmpeg`, it must be **`-c copy`**. A transcode rewrites PTS and silently destroys the feature — it will look like it works, because video will appear.

This is also why WHEP was rejected for this path: WebRTC re-stamps with RTP clocks and discards MPEG-TS PTS. Do not "simplify" by routing through MediaMTX WHEP.

### User locks

- **L3 — we are the caller.** broadcast-web dials `srt://…`. No listener mode.
- **L5 — 4 concurrent streams** must be supported.
- L2 — DJI only. No GoPro.

## In scope

1. **Dependency spike, decided and documented before you build.** Two candidates:
   - `ffmpeg` child process: `ffmpeg -i srt://… -c copy -f mpegts pipe:1`. Portable, PTS-safe, but ships an ~80 MB binary and needs a packaging story.
   - A native SRT Node binding. Smaller, but Windows prebuilds are the historical failure mode here.

   Pick one, **write down why**, and confirm it survives `npm run desktop:dev` on Windows. If neither works cleanly, stop and report — do not ship something that only builds on your machine. Target platform is Windows (see `<user_info>`); Electron is `^37.2.6`.

2. **Main process** (`desktop/srtReader.cjs`, new):
   - Per-POV session: open, stream bytes, close, restart with backoff on failure.
   - Configurable SRT `latency` (the transport's own buffer, distinct from our presentation latency) and optional `passphrase` / `streamid`.
   - Emit raw TS chunks to the owning renderer. Do not buffer unboundedly — if the renderer is not keeping up, drop and count, never grow without limit.
   - Clean teardown on window close and on app quit. A leaked `ffmpeg` child outliving the app is a real failure mode; kill the process group.

3. **IPC** (`desktop/main.cjs`), following the existing `ndi:*` pattern exactly:

   | Direction | Channel | Payload |
   | --- | --- | --- |
   | renderer → main | `srt:open` | `{ povId, url, streamId?, latencyMs?, passphrase? }` |
   | renderer → main | `srt:close` | `{ povId }` — plus `'all'` support, like `ndi:stop` |
   | renderer → main | `srt:status` | → `Record<povId, SrtStatus>` |
   | main → renderer | `srt:data` | `{ povId, chunk: Uint8Array }` raw MPEG-TS |
   | main → renderer | `srt:status` | `{ povId, state, bitrateKbps, lastError }` |

   `state: 'idle' | 'connecting' | 'live' | 'error'`.

   At ~8 Mbps a stream is ~1 MB/s over IPC — negligible even at 4 streams. Do not invent a SharedArrayBuffer scheme; it is not needed and adds risk.

4. **Preload** (`desktop/preload.cjs`): expose `srt` on `window.broadcastStudio` alongside `ndi` / `races` / `config`. `onSrtData` / `onSrtStatus` return unsubscribe functions, matching `onStudioTick`.

5. **Renderer bridge** (`src/output/srtBridge.ts`, new): types + `getSrtBridge()` detection, mirroring `src/output/studioBridge.ts`. **Must degrade cleanly in a plain browser** (no Electron → bridge absent → callers no-op). The SPA is still the default product; a browser tab must not throw.

6. Tests for whatever is pure (status normalisation, URL validation, the bridge-absent path). The child-process and socket layers are not unit-testable here — say so in your report rather than writing theatre.

7. Docs: `desktop/README.md`, `src/output/README.md`.

## Out of scope

- **Any parsing of the TS bytes.** No demux, no PES, no PTS extraction, no decode. That is OUT-06. If you find yourself reading byte 0x47, stop.
- `whepUnderlay.ts` — untouched.
- Compositing, textures, the render loop — OUT-04/06.
- `src/output/types.ts`, `main.ts` wiring — OUT-04 owns those this wave.
- NDI, the frame clock, `studio:tick`.
- Per-POV SRT URL config UI — OUT-07. Take the URL as a parameter; do not build the UI.

## Likely files

- `desktop/srtReader.cjs` (new)
- `desktop/main.cjs` (IPC handlers)
- `desktop/preload.cjs` (bridge surface)
- `desktop/package.json` (dependency, if native)
- `src/output/srtBridge.ts` (+ test, new)
- `src/output/index.ts` (append export)
- `desktop/README.md`, `src/output/README.md`

## Inputs provided

- IPC + preload precedent: `desktop/main.cjs` `ndi:*` handlers, `desktop/preload.cjs` L9–71
- Renderer bridge precedent: `src/output/studioBridge.ts`
- Sender precedent for a main-process subsystem: `desktop/ndiSender.cjs`
- Unsubscribe convention: `onStudioTick` in `preload.cjs`

## Acceptance criteria

- [ ] Dependency choice documented with the reasoning, and `npm run desktop:dev` starts cleanly on Windows with it installed.
- [ ] `srt:open` against a reachable SRT source moves status `connecting` → `live` and delivers TS chunks to the renderer.
- [ ] **PTS-safety is argued explicitly in the report** — if `ffmpeg`, show the exact argv and confirm `-c copy`. A transcode fails this dispatch.
- [ ] Unreachable URL → `error` state with a useful `lastError`; retries with backoff; does not spin the CPU or flood logs.
- [ ] `srt:close` fully tears down; no orphan child process (verify in Task Manager after closing the app).
- [ ] 4 concurrent sessions run without crosstalk — chunks carry the right `povId`.
- [ ] Plain browser (`npm run dev`, no Electron): `getSrtBridge()` returns absent and nothing throws.
- [ ] Renderer backpressure drops and counts rather than growing memory.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary — **dependency chosen and why**, and how you verified PTS is not rewritten
2. Files touched
3. Tests run / how verified; be explicit about what you could not test without a live source
4. Follow-ups / blockers — packaging implications for PLT, and the SRT URL scheme you assumed
5. Suggested OUT memo bullets
