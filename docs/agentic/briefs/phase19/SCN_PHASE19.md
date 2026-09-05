# SCN — Phase 19 brief

**Role:** SCN — Scene & Visuals Orchestrator  
**Design (must read all of it):** [`../../../architecture/phase19-senexus-qol.md`](../../../architecture/phase19-senexus-qol.md)  
**Also:** charter, `SCN_MEMO.md`, `world-authoring-workspace.md`, this file.

You do **not** implement. This is the largest Phase 19 domain. Split into **small** dispatches. Do not one-shot the whole brief.

## Owns in Phase 19

| Item | What |
| --- | --- |
| **19.2** | Remove PiP card; keep local 2D + 2D NDI canvas alive; 16:9 stream source. Adopt [`../../dispatches/active/DSP-SCN-20260829-03-remove-pip-minimap.md`](../../dispatches/active/DSP-SCN-20260829-03-remove-pip-minimap.md) (phase → 19). |
| **19.2b** | Better **on-air 2D** UI (16:9, readable). In-app map may still fit the screen; keep real map background. Separate DSP after 19.2. |
| **19.6** | Remove World accordion. Small **toggle** on Race setup header. **No Close** on the overlay. |
| **19.7** | Authoring inspector: name + label + **type fields** (not project id/name). Lat/lon/alt/height all types. Coordinate **Add**. Select → **Edit**. Instant Assets list. |
| **19.8** | `hidden` = hull off, **tag on**. Ghost/hidden **do not** change 2D. Ghost leak after save/reload. |
| **19.9** | Save/Load status text under the buttons. |
| **19.10** | Start **and** finish band ×2 uniform (`LINE_SIGN_BAND_DEPTH_M` 12→24, default width 50→100). |
| **19.11** | Billboard default `#2A6FA6` + picker; library logo picker; **weights** → fair interleave **AABAB** for 3:2; height = vertical only. |
| **19.12** | OSM tiles missing / vanish on zoom (World Authoring). |
| **19.13** | Boat foam wakes ~8–12 m, fade, not Gerstner, 3D+AR. |
| **19.14** | Billboard vanish: diagnose; no speculative rewrite. |
| **19.15** | Sea/waves covering assets — clip/suppress, **not** a new globe vendor. |
| **19.17** (with PLT) | Project switch: lists + 2D first; 3D may lag. |

## Does not own

NDI FourCC/pumps (OUT), slider degrees (CAL), library **file seeding** (PLT — **block 19.11 picker on empty library** until PLT 19.16), terrain **provider switch** (GEO parked).

## Suggested waves (file-disjoint inside a wave)

**B1 chrome (parallel OK if files don’t overlap):** 19.2 PiP · 19.6 launcher · 19.9 save logs · 19.10 line signs  

**B2/B3:** 04-08 **Pass**. **19.2b Human Pass** (05-02). **19.17 Human Pass** (05-03). Return to **BW**.

**B3 look:** 19.13 wakes · 19.15 sea/assets · 19.2b 2D graphic · 19.17 remount with PLT.  

## Field contract (19.7) — do not skip a type

Every placed type exposes **lat, lon, alt, height** in authoring **and** Assets details.

- **Boats / buoys:** also telemetry id. Buoys: rounding.  
- **Drones:** telemetry id + name/label editable; **lat/lon/alt and other pose fields read-only**.  
- **Sponsors:** logo via Library picker. Height = **uniform** scale.  
- **Billboard chain:** logo list + weights; panel colour; height **vertical only**.  
- **Start / finish:** lat/lon (both ends). Height scales the band, not stroke thickness.  
- Map click still works; coordinate Add is additional. Add → Edit when a feature is selected.

## Height / ratio (locked)

- Default: height scales the object **uniformly** (ratio locked).  
- **Exception — billboardChain:** vertical only; logos keep aspect.

## After worker report

Follow [`README.md`](./README.md).

- After **19.2**: human tests: no PiP; local 2D still works; OBS 2D still sends.  
- After **19.6**: toggle World Authoring twice; 2D/3D/AR still clickable.  
- After **19.7**: place a sponsor by lat/lon **and** by map click; Assets list updates immediately; Edit path.  
- After **19.8**: ghost boat 2 only; save; reload; boat 1 still solid; 3D-off boat still has tag; 2D dots unchanged.  
- After **19.11**: empty chain = bluish plate; two logos weighted 3 and 2 → **AABAB** along the chain.  
- After **19.17**: Load pack A then B (button). Lists + 2D show B before 3D finishes. Then **BW**.  
- When SCN is waiting on Library files: **open PLT** (`PLT_PHASE19.md`).  
- When SCN is done or blocked on NDI: **OUT**. Terrain vendor: **BW / GEO**, do not start MapTiler.

## Paste-ready chat starter

```
Role: SCN — Scene & Visuals Orchestrator

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/ORCHESTRATORS.md
3. docs/agentic/orchestrators/SCN_Scene_Visuals_Orchestrator.md
4. docs/agentic/memos/SCN_MEMO.md
5. docs/architecture/phase19-senexus-qol.md
6. docs/agentic/briefs/phase19/SCN_PHASE19.md
7. docs/agentic/briefs/phase19/README.md
8. docs/architecture/world-authoring-workspace.md

Phase 19 SCN is the bulk of the Senexus notes. Do not implement src/. Write a domain roadmap in SCN_MEMO.md with small DSP splits (start with 19.2 / 19.6 / 19.9 / 19.10). Do not issue the library picker until PLT has seeded public/assets/library. After each worker reports, tell me to test (exact steps) or which dispatch/orchestrator is next. Do not switch Cesium to another globe vendor.
```
