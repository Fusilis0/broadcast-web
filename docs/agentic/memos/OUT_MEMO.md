# OUT_MEMO

**Last updated:** 2026-08-12  
**Status:** Idle — Phase 13 complete + OUT-06 perf **accepted**

## Phase 13 follow-up — OUT-06 accepted 2026-08-12
- `done/DSP-OUT-20260812-06-ndi-capture-perf` — AR **30** / 3D **10** / 2D **off@10**;
  `tryClaimNdiHeavyCapture` stagger (AR wins shared tick, yields next). Suite 476+23.
  Soft escalate: default **3D NDI off** only if UI still unusable after smoke.

## Phase 13 — wave 3 accepted 2026-08-12
- `done/DSP-OUT-20260812-04` — local 2D/3D/AR switcher; never stops NDI; 3D local opaque + AR air-FBO
- `done/DSP-OUT-20260812-05` — per-channel delay; default 0 / max 30000 / warn &gt;3s; AR+3D+2D pumps
- Suite **461 + 23** green at wave-3 accept. Phase 13 OUT scope closed (perf follow-up above).

## Phase 13 — wave 3 issued 2026-08-12 (parallel) — accepted; see above
- Was: `DSP-OUT-20260812-04` + `-05`

## Phase 13 — wave 2 accepted 2026-08-12
- `done/DSP-OUT-20260812-02` — continuous `3d` / `broadcast-web-3d`; `ndiOpaquePass` restore for AR;
  start order 3D→AR; soft follow-up: water may look static on 3D when AR is transparent (env only
  mounted during 3D FBO). Human vMix smoke recommended.
- `done/DSP-OUT-20260812-03` — `startStreamMapNdiPump` → `2d` / `broadcast-web-2d`;
  `STREAM_MAP_NDI_BRIDGE_SUPPORTED === true`; default on; **1920×1080 letterbox**; PiP-independent.
- Suite **439 + 23** green. Next held: **13.5** switcher · **13.6** delay.

## Phase 13 — wave 1 accepted / wave 2 issued 2026-08-12 — wave 2 done; see above
- **Accepted:** `done/DSP-OUT-20260812-01-multi-sender-ndi-bridge` — Map of `ar`/`3d`/`2d`; omit→`ar`;
  AR name still `broadcast-web`; preload API locked for pumps.

## Phase 13 — wave 1 issued 2026-08-12 — superseded
BW wrote [`docs/architecture/multi-output-streaming.md`](../../architecture/multi-output-streaming.md)
covering OUT's future scope: multi-sender NDI bridge (today's `desktop/ndiSender.cjs` is a single
`grandi` sender — this is the blocking prereq, 13.1), a bigger local 2D/3D/AR switcher that only
changes on-screen focus (never gates NDI — all channels always send), a per-channel NDI delay
buffer up to 30000 ms (memory cost flagged: ~7.5 GB/channel for a full 30 s buffer at 1080p —
needs a mitigation decision before dispatch, see doc §4), and the resolution ask (`1080×1920` —
literally portrait, opposite of today's `1920×1080` lock — flagged for confirmation). Note: the
"3D channel" (13.2/13.3) is **not** a new render pipeline — SCN adds a sea/sky model to the
existing scene, OUT just wires that same render (opaque clear variant) to its own NDI sender;
13.3 is OUT-only, no joint SCN dependency beyond 13.2 landing first.

## Phase 11 (accepted)
- **11.5** `done/DSP-OUT-20260811-01` — NDI controller tab (2nd map source stubbed)
- **Follow-up** `done/DSP-OUT-20260811-02` — output mode in Ops sidebar (`mountAt: 'start'`); fixed canvas chrome removed; WHEP status co-located; NDI air lock unchanged

## Standing decisions
- NDI / transparent plate = **active POV** only (dual-render)
- Air-target readback: `bottomUp: true`
- Preferred air: Electron + alpha NDI
- Stream map not burned into primary AR NDI; own channel `'2d'` instead
- Three studio sources: `broadcast-web` (AR) · `broadcast-web-3d` · `broadcast-web-2d`

## Soft follow-up (optional)
Realistic water `tick` while AR is transparent (env only mounted during 3D FBO today → static water
on `broadcast-web-3d`) — SCN visibility/mask follow-up if needed.

## Phase 10
10.3 NDI studio smoke — **Pass**. V1-C still needs BW **10.1** human cutover.
