# Agentic Rules — broadcast-web

Hard rules. All BW, domain orchestrators, and workers must follow.

## 1. Identity

1. Every session declares its role at the start: `BW` | `TEL` | `GEO` | `SCN` | `OUT` | `CON` | `CAL` | `PLT` | `PRF` | `SRT` | `WORKER(<dispatch-id>)`.
2. If role is unclear, ask once, then stop productive work until assigned.

## 2. Orchestrators do not implement

1. Orchestrator chats may: read code/docs, plan, write dispatches, write handoffs, update memos, update roadmap checkboxes (via dispatch to PLT/BW if preferred), reject wrong-domain asks.
2. Orchestrator chats may **not**: create/modify application source under `src/`, add dependencies for features, “quickly fix” product bugs in-session.
3. Exception: orchestrators may edit **only** files under `docs/agentic/` and their own memo/charter, plus architecture/roadmap when BW authorizes.
4. Implementation always happens in a **new worker chat** using a dispatch document.

## 3. Domain boundaries

1. Work only inside your charter (`docs/agentic/orchestrators/<ID>_*.md`).
2. On wrong-domain request: refuse, name the correct ID, offer handoff text. Do not silently do it.
3. Cross-cutting changes require a **handoff** to the owning orchestrator (or BW if ownership unclear).

## 4. BW authority

1. BW owns phase gates, priority, and conflict resolution between orchestrators.
2. Domain orchestrators may not change global architecture decisions without BW acknowledgment recorded in `BW_MEMO.md`.
3. BW does not implement product code either.

## 5. Dispatches

1. Every worker task has a dispatch file or a clearly pasted dispatch block with: ID, owner orchestrator, goal, out-of-scope, files likely touched, acceptance criteria, inputs, report-back format.
2. Workers must not expand scope. If blocked, stop and report.
3. One dispatch ≈ one worker session. Prefer small dispatches.

## 6. Handoffs

1. Use `HANDOFF_PROTOCOL.md` format.
2. Handoff IDs: `HO-<from>-<to>-<YYYYMMDD>-<nn>`.
3. Receiving orchestrator updates their memo; does not start implementing.

## 7. Memos (compaction memory)

1. Each orchestrator maintains `docs/agentic/memos/<ID>_MEMO.md`.
2. Update memo when: decision made, dispatch issued, handoff received, phase gate moved, blocker found.
3. After compaction / new session: **read memo first** before planning.

## 8. Source of truth

| Concern | Doc |
| --- | --- |
| System design | `docs/architecture/system-architecture.md` |
| Phases | `docs/roadmap/phases-roadmap.md` |
| Who owns what | `docs/agentic/ORCHESTRATORS.md` |
| Runtime contracts | architecture + domain charters |

Unity sibling `../broadcast` is **reference only** until assets/contracts are copied. Do not modify Unity from broadcast-web workers unless a dispatch explicitly says so.

## 9. Language & repos

1. All agentic docs and dispatches: **English**.
2. This repo is local until `fusilis/broadcast-web` (private) is created. Do not assume GitHub remote exists.
3. Console repo: **discussion only** for now — no clone/pull unless BW opens a later phase.

## 10. Output stack decision (locked by BW — updated 2026-09-09)

| Priority | Path |
| --- | --- |
| 1 | **SRT egress ×3** (AR/3D/2D) — Phase **22 open**; local OBS 30×3 first, VPS later ([`../architecture/srt-egress.md`](../architecture/srt-egress.md)) |
| 2 | **Chroma** (green clear) → vMix window/screen capture — fallback |
| 3 | **WebRTC underlay** (MediaMTX WHEP) for preview + future CV |
| 4 | **NDI** — hidden on air (code kept). 30×3 **closed**. |

No **in-browser** NDI without a native bridge. Electron is the studio shell. Phase 17 SRT is **ingest** (caller), not egress.

## 11. Safety

1. No secrets in git. Use `.env.example` only.
   **Exception (BW 2026-08-17):** Cesium ion access token MAY be committed in
   `public/config.json` (`cesiumIonToken`) so studio machines share the Unity
   ion account. Enter it in Ops or paste that field, then commit. Never log it.
   Do not ship a filled token on a public Hetzner SPA.
2. Do not commit large binaries without BW/PLT decision on Git LFS.
3. Do not call production VPS destructively; live telemetry is opt-in via config.
