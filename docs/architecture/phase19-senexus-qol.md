# Phase 19 — Senexus studio QoL (design)

**Status:** Locked (BW) — 2026-09-01  
**Owner:** BW (this document) → domain orchestrators plan + dispatch  
**Source notes:** operator file `senexus.md` (2026-09-01) + answers in BW chat  
**Roadmap:** [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) Phase 19  
**Orchestrator briefs:** [`../agentic/briefs/phase19/`](../agentic/briefs/phase19/)

This is the product contract. Orchestrators do **not** implement `src/` in their chats. They read this file + their brief, write a domain roadmap, then issue worker dispatches.

Nothing from the notes is dropped. Terrain **provider replacement** is the only item **parked** (operator: return later). Sea-over-assets and the Cesium commercial / `ion load failed` symptoms are still recorded here.

---

## 1. Operator locks (2026-09-01)

| Topic | Lock |
| --- | --- |
| 2D output | **1920×1080 landscape (16:9)**. Not portrait. In-app 2D may still **fit the screen**. Real map background stays. |
| Timecode / qlock | **Hide the barcode** on preview and NDI. **Keep modules, tests, and `timecodeEnabled` logic.** Default off. Packs that set `timecodeEnabled: true` may still show it. |
| PiP | Remove the **PiP minimap card**. Keep **local 2D view**, ops/authoring maps, and **2D NDI sender**. |
| Boat wakes | Short foam-like VFX on the water, **few metres**, fade out. **Not** coupled to Gerstner. 3D + AR (same scene). Not 2D. |
| Terrain provider | **Parked.** Do not switch globe service until BW reopens Q5. Options in §8. |
| Calib sliders | Yaw, pitch, **and roll** all **±200°**. FOV / alt / sync unchanged. |
| 3D NDI stripes | P0. Operator is **not sure** whether AR is clean. Diagnose **both** AR and 3D. FPS is a separate track. |
| Project switch | Switching the project in the list must feel **instant** for **UI + 2D map + boat list**. 3D models may fill in a moment later. |
| Ghost leak | Treat as **save/reload** bug (operator guess). Per-boat, no shared material/state. |
| Boat 3D off | Hull/mesh off, **tag stays**. Ghost/hidden **must not** change 2D map dots. |
| Start / finish | **Both** larger, **same ratio** (not a thicker stroke). |
| Billboard vanish | No known repro. Instrument + cheap hardening; if still unknown, wait for the next live case. |
| World Authoring chrome | **Remove** the World accordion under Race setup. **Small toggle** next to the Race setup header. **No Close** on the overlay — click the same button again. |
| NDI hand toggles | Independent **AR / 3D / 2D** on/off in Broadcast → Output. **Not** saved on `project.json`. Session (process / `sessionStorage`) is OK. Default: all on (today). |
| Billboard plate | Default **bluish TV plate** + **colour picker**. |
| Billboard weights | Integer weights per logo. Default sequence = **weighted fair interleave** (3+2 → **AABAB**), not clustered AAA BB. |
| Height | Most types: **uniform scale**, ratio locked. **Billboard chain only:** height = **vertical** size; logos grow; logo **ratio locked**. |
| Drones | Editable: name/label + **telemetry id**. Lat/lon/alt and other pose fields **read-only** from telemetry. |
| Library | Seed from **existing in-repo** sponsor PNGs. **New Library uploads must be git-trackable** (other studio PCs get them on pull). |
| Place | Map-click **or** lat/lon/alt + Add. Selecting an existing asset turns **Add → Edit**. |
| Priority | BW sequence in §9. |

---

## 2. Inventory → owners

| ID | Note | Owner | Phase item |
| --- | --- | --- | --- |
| N1 | Hide barcode; keep code | OUT | 19.1 |
| N2 | Remove PiP; keep 2D | SCN (+ OUT must not break 2D pump) | 19.2 |
| N3 | 16:9 1920×1080 2D + better on-air UI | SCN | 19.2 / 19.2b |
| N4 | Boat traces / foam wakes | SCN | 19.13 |
| N5 | Cesium “upgrade for commercial use” + ion fetch fail | GEO+SCN **parked provider**; SCN may still improve land-only clip | 19.18 / 19.15 |
| N6 | Sea waves over assets / terrain (image 2) | SCN | 19.15 |
| N7 | Yaw/pitch(/roll) ±200 | CAL | 19.5 |
| N8 | 3D NDI green/purple stripes (image 1) | OUT | 19.3 |
| N9 | Project switch too slow | PLT + SCN | 19.17 |
| N10 | World Authoring Close vs 2D/3D/AR | SCN — **Close removed**; toggle instead | 19.6 |
| N11 | Ghost/solid leaks to other boats after reload | SCN | 19.8 |
| N12 | Loading/saving/loaded/saved under Save/Load | SCN | 19.9 |
| N13 | 3D off hides tags | SCN | 19.8 |
| N14 | Finish (and start) not wide enough | SCN | 19.10 |
| N15 | Billboard chains disappear on AR/3D | SCN | 19.14 |
| N16 | World tab → small button beside Race setup | SCN | 19.6 |
| N17 | Manual NDI on/off | OUT | 19.4 |
| N18 | Authoring inspector = name + label + type fields | SCN | 19.7 |
| N19 | Type attributes in authoring (same as Assets → Details) | SCN | 19.7 |
| N20 | New authoring assets instant in Assets list | SCN | 19.7 |
| N21 | Every type: lat/lon/alt/height; telem ids; drone RO; sponsor logo; billboard icons; start/finish lat/lon | SCN (+ GEO convert, TEL id contract) | 19.7 |
| N22 | Place by coordinates + Add | SCN | 19.7 |
| N23 | Library tab real logos + picker popup | PLT seed + SCN picker | 19.16 / 19.11 |
| N24 | Logos not gitignored; uploads persist across machines | PLT | 19.16 |
| N25 | Billboard bluish default + picker | SCN | 19.11 |
| N26 | Logo weights / sequence | SCN | 19.11 |
| N27 | Billboard height = vertical only | SCN | 19.11 |
| N28 | OSM overlay buggy on zoom | SCN | 19.12 |

---

## 3. Output (OUT)

### 19.1 Hide visual timecode

Already drafted as [`../agentic/dispatches/active/DSP-OUT-20260829-03-remove-timecode-ui.md`](../agentic/dispatches/active/DSP-OUT-20260829-03-remove-timecode-ui.md). Adopt it into Phase 19; do not duplicate.

- Default `timecodeEnabled: false`.
- Do **not** delete `visualTimecodeOverlay.ts` / encode / tests.
- Verify SRT underlay wrap + NDI pumps still stack without the barcode pass.
- Operator-facing barcode gone from preview **and** NDI. Logic stays.

### 19.3 3D NDI green / purple stripes

Image 1 is the classic **YUV 4:2:2 bytes shown as RGB** (or FourCC advertised ≠ bytes sent). Recent GPU UYVY pack on the **3D** path is the first suspect. AR is UYVA (alpha). Operator cannot confirm AR is clean — **compare both** in OBS.

**Acceptance:** OBS/vMix 3D source looks like the in-app 3D view (right-side up, no stripes). AR still keys if it is an alpha plate. Do not “fix” by stretching or reinterpreting in OBS as the product answer.

**Likely checks (worker, not orchestrator):** FourCC sent vs packed buffer size/stride; GPU pack dest `NoColorSpace`; AR vs 3D code paths; do not reintroduce a CPU per-pixel walk on the tick.

### 19.4 Manual NDI channel toggles

Today the NDI tab documents start/stop as session-lifecycle only (`ndiControllerPanel.ts`). Operator wants **hand** on/off per channel.

| Channel | Switch | Persist |
| --- | --- | --- |
| AR | on/off | **Not** `project.json`. Session OK. |
| 3D | on/off | same |
| 2D | on/off | same (2D toggle may already exist — make AR/3D match) |

Off = that sender stops (or stops capturing/sending). On = resumes. Independent. Default all **on**.

---

## 4. Calibration (CAL)

### 19.5 Slider range

`OFFSET_SLIDER_SPECS` today: yaw/pitch/roll **±45°**. Change yaw, pitch, **roll** to **min −200, max 200**. Step stays 0.1. FOV, alt, `syncTrimMs` unchanged. Typed values must be able to reach the new ends (slider + any number field). Tests that hard-code ±45 must update.

---

## 5. Scene & authoring (SCN)

### 19.2 PiP off + 16:9 2D

Adopt [`../agentic/dispatches/active/DSP-SCN-20260829-03-remove-pip-minimap.md`](../agentic/dispatches/active/DSP-SCN-20260829-03-remove-pip-minimap.md) for PiP removal + 16:9 stream-map **source** (not a 1080p backing store). Local 2D view must keep a host. 2D NDI must keep sending.

### 19.2b 2D on-air UI

Operator: in-app map **fit-to-screen** and **real map background** are fine. Improve the **on-air / NDI 2D** graphic: fill 16:9, readable chrome, less PiP-era square layout. Do not invent a new art language without a reference still.

### 19.6 World Authoring launcher

- Delete the **World** accordion section from the Race setup list (`world-map` as a full section).
- Put a **small** World Authoring **toggle** on the Race setup **header** (beside the list title).
- Overlay has **no Close control**. Second click on the same button closes/opens.
- That removes the collision with LOCAL / 2D / 3D / AR.

### 19.7 Authoring inspector + coordinate place + instant list

**Hide** from the authoring form: project id, project name, and any other pack metadata. Show:

1. **Name**, **label** (all types).
2. **Type-specific** fields — the same as Race setup → Assets → Details.

| Type | Always | Extra |
| --- | --- | --- |
| All world features | lat, lon, alt (MSL), height (see §5 height rules) | |
| `buoy` / `mark` / gates | telemetry id (buoy), rounding | |
| `sponsor` | logo (library picker) | |
| `billboardChain` | logo list + weights; panel colour; height = vertical | |
| `start` / `finish` | lat/lon for **both** ends (or span); height scales the band uniformly | |
| Fleet **boat** | lat, lon, alt, height (uniform), telemetry id, visibility | |
| **Drone** | telemetry id, name/label. Lat/lon/alt **read-only** from telem | |

**Place by coordinates:** type + fields + **Add** → appears on map **and** Assets list **immediately** (no “wait for remount” gap).

**Map click** remains. After select: **Add becomes Edit**; saving edits the selected feature in place.

GEO: use existing `gpsToEnu` / inverse. Do not fork a second frame.

**Instant Assets list:** the list is a projection of the in-memory feature/fleet store. Adding in authoring must mutate that store on the same tick, not wait for disk or a deferred 3D rebuild.

### 19.8 Boat visibility

Today `hidden` turns **tag off** (`applyBoatVisibilityMode`). Change:

| Mode | 3D hull | Tag | 2D map |
| --- | --- | --- | --- |
| `solid` | on | on | unchanged (always tracks unless a **separate** 2D visibility exists) |
| `ghost` | translucent + ring | **on** | **unchanged** |
| `hidden` (3D off) | off | **on** | **unchanged** |

Ghost/solid/hidden must be **per boat id** after save/load. Shared hull materials are a likely leak — clone per instance.

### 19.9 Save / Load logs

Under the Save / Load controls, show last action text: `loading` → `loaded`, `saving` → `saved`, plus a short error line on failure. No modal required.

### 19.10 Start / finish size

Not a thicker underline. **Uniform scale ×2** of the water band:

- `LINE_SIGN_BAND_DEPTH_M` 12 → **24**
- `DEFAULT_LINE_SIGN_WIDTH_M` 50 → **100** (single-point default span only)
- Authored A–B GPS span **unchanged**; depth + text scale with the band (ratio kept vs the old 12:50 graphic)
- Same treatment for **start and finish**

### 19.11 Billboards

- Default `panelColor` = bluish TV plate **`#2A6FA6`** (locked default; picker can change).
- Empty logo list → solid plate (bluish), still framed.
- After a chain exists, Assets details: **logo rows** from Library + **integer weight** each.
- Sequence: **weighted fair interleave** along the chain (example weights A=3, B=2 → repeating **AABAB**). Deterministic, not random.
- `heightM` after placement: **vertical only**. Logos scale with height; **aspect ratio of each logo stays**. Horizontal tiling/spacing uses existing `spacingM` unless the operator changes it separately.

**Library picker:** small modal/window when choosing a logo from authoring or details. Catalogue from `public/assets/library/` (PLT seeds it).

### 19.12 OSM

World Authoring OSM toggle: full coverage of the visible map; tiles must **not** vanish on zoom in/out. Ops map if it shares the same tile helper should get the same fix. Stream/NDI 2D does not require OSM.

### 19.13 Boat wakes

Per moving boat, a short **foam ribbon / decal** on the water plane (`y ≈ 0.05`), length on the order of **~8–12 m**, opacity fade toward the tail over **~2–3 s**. Not Gerstner displacement, not a physics wake. Cheap (one strip or few quads). 3D + AR. Respect `hidden` (no wake if hull off is OK; tag-only boats may skip wake).

### 19.14 Billboard vanish

No repro. First worker: log why a chain is skipped (no points, `visible3d false`, texture error, frustum, parent hidden). Cheap hardening only if a cause is obvious (e.g. shared dispose). Otherwise **stop** and wait for the operator’s next capture.

### 19.15 Sea over assets

Image 2: Gerstner overlapping platforms / land. **Do not** wait for a new globe vendor.

- Keep Phase 16.1: terrain **land only**, our ocean is the water.
- Tighten so **authored platforms / sponsors / line signs** are not buried in clipmap waves (bias, stencil, or local ocean suppress — worker picks the cheapest that does not break NDI).
- Environment **water discard m** stays the operator knob for terrain.

---

## 6. Platform (PLT)

### 19.16 Library content + git

`public/assets/library/index.json` is **empty**. Logos already in repo:

- `public/textures/sponsors/rolex.png`
- `public/textures/sponsors/senexus.png`
- `public/textures/sponsors/vodafone.png`

Copy (or shared-stable filenames) into `public/assets/library/image/` and list them in `index.json`. **Not gitignored.**

**Uploads:** API / Electron write must land files + manifest under `public/assets/library/` so `git status` shows them and other machines get them on pull. Document the operator step (Save/commit). Do not put library binaries in a gitignored cache.

### 19.17 Instant project switch

Switching the Load/list selection must paint **project chrome, 2D map, fleet/asset lists** before Cesium/tiles/glTF finish. 3D fill-in is allowed. Coordinate with SCN on the remount sequence; PLT owns Electron `races.read` / blocking I/O if that is the stall.

---

## 7. Telemetry (TEL)

No protocol change. SCN will show/edit **telemetry ids** on boats, buoys, drones.

- Boat / buoy ids remain the existing allow-list / buoy channel contract.
- Drones: id editable; pose fields stay **TEL-owned live data** (read-only in UI).
- If the inspector needs a “does this id exist on the bus?” helper, TEL may dispatch a **tiny** pure helper — no new packet types.

---

## 8. Terrain provider (GEO) — PARKED (Q5)

**Do not issue a provider-switch worker until BW reopens this section.**

Cesium **used to work** with the existing token and now shows commercial-use / `ion load failed (failed to fetch)`. That can be licence watermark, token/asset, network, or ion API — unknown until diagnosed.

When BW reopens, compare (GEO + SCN, still no silent Google Photorealistic — logo burn-in already rejected):

| Option | What | Sea cut-out | Risk |
| --- | --- | --- | --- |
| **A. Fix Cesium ion** | Paid commercial ion / token / asset IDs / fetch errors | Already have watermask + height discard (16.1) | Fastest if the account is the only break |
| **B. Keep Cesium, land-only harder** | Improve mask so Cesium water never draws | Yes (current design) | No new vendor |
| **C. MapTiler / Mapbox Terrain-RGB** | Heightmap in Three, our ocean in holes | Easy (`height ≤ 0` drop) | New key, attribution, cost |
| **D. Local DEM / GeoTIFF for the venue** | Offline, no ion | Cut sea in the mesh | Per-venue art; PLT size/LFS |
| **E. Google Photorealistic 3D Tiles** | Looks best in cities | Not a sea mesh | **Rejected** for on-air logo/attribution |

**Until then:** SCN 19.15 only. GEO may *write an options note* in `GEO_MEMO` if asked, but no `src/` terrain vendor change.

---

## 9. Human / orchestrator sequence (BW)

File-disjoint work may run in parallel **inside** a wave. Do not start SCN authoring workers that need Library files before PLT 19.16 seeds them.

| Wave | Open | Why |
| --- | --- | --- |
| **A** | **OUT** (19.3 P0, 19.1, 19.4) + **CAL** (19.5) | Air picture + tiny calib |
| **B** | **SCN** chrome (19.2, 19.6, 19.9, 19.10) | Safe UI, little schema |
| **C** | **PLT** 19.16 then **SCN** 19.7 / 19.11 / 19.8 / 19.12 | Library before picker |
| **D** | SCN 19.13, 19.15, 19.14; **PLT+SCN** 19.17 | Look-dev + load |
| **Hold** | **GEO** 19.18 | Until operator returns to Q5 |
| **Anytime small** | **TEL** 19.x id contract if SCN is blocked on ids | |

After **each worker** reports to its orchestrator, that orchestrator tells the human: **test now**, **next dispatch**, **next orchestrator**, or **return to BW**. See [`../agentic/briefs/phase19/README.md`](../agentic/briefs/phase19/README.md).

---

## 10. Out of Phase 19

- NDI **fps** 30×3 (Phase 18 / PRF+OUT) — not this notes set except that 19.3 must not make fps worse on purpose.
- Cesium **vendor replacement**.
- Console repo, Hetzner, in-browser NDI.
- Worker prompts in orchestrator chats.
