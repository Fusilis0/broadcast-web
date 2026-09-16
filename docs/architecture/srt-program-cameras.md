# SRT program cameras + per-channel look (Phase 22.4)

**Status:** Locked **2026-09-15** (operator answers 1–10). Workers **code-complete**.  
**Human:** 3D world **Pass**. Open eye-check **E–I + A** in [`../agentic/briefs/phase22/SRT_HUMAN_PASS.md`](../agentic/briefs/phase22/SRT_HUMAN_PASS.md).  
**Owners:** **SCN** (rigs, visibility, bottom bar) · **OUT** (plate 1920×1080, AR plate chrome) · **SRT** (encode fps) · **PRF** (30×3 measure).  
**Does not replace:** [`srt-egress.md`](./srt-egress.md) (callers, URLs, ffmpeg).  
**Do not change** `STUDIO_TICK_FPS` (see §8).

---

## 1. What OBS is for

| Channel | Program picture | Ops studio window |
| --- | --- | --- |
| **3D** | **Program rig** (virtual camera) | **Ops rig** (free/follow). Different unless **Control 3D program** is on. |
| **AR** | AR program rig: **frozen** until valid telemetry, then **Follow** selected POV (Free optional) | Ops AR view is independent unless takeover |
| **2D** | 2D program rig (top-down). Studio **2D** local view **is** this picture | Ops mini-map stays a utility map |

NDI stays hidden. SRT still 1080p30 callers.

---

## 2. 3D — two cameras + takeover

**Ops rig:** what the operator looks at in local **3D** (orbit / pan / zoom / WASD as today). Moving it **must not** move OBS 3D.

**Program rig:** what the **3D SRT plate** renders. Always. Last pose holds when nobody is driving it.

**Control 3D program** (bottom bar, latching):

- **Off (default):** mouse/WASD drive **ops** rig. OBS 3D stays on program rig.
- **On:** mouse/WASD drive **program** rig. Studio 3D **shows the program rig** so aiming is not blind. Motion **damped** (smoother than ops) because this is air.

Same mapping as free cam; extra smoothing on the program path only. Optional **Frame boats** snap (visible boats with telemetry).

Do **not** keep sending ops free-cam IPC into the 3D plate (`srtOut:previewView` of ops view is retired for 3D).

---

## 3. AR — freeze, then follow

AR plate **must not** idle-orbit, cinematic, or Follow on empty/mock-without-poses.

- **No active telemetry** on the follow target: camera **frozen** (race origin or last good pose). No ease.
- **Active telemetry:** **Follow** the selected POV (same as today’s follow once data exists).
- Bottom bar: **Follow** | **Free** (Free = human aim, still no wander with no data).

**Active telemetry** = a boat/POV with a recent valid GPS pose (live or mock that is actually updating). **Planned-only** / map-dropped boats with no pose **do not** count.

AR plate **does not** copy the 3D world look packet. Terrain / sea / OSM buildings / heroes stay **off** on AR even if 3D has them on.

---

## 4. 2D — top-down program cam

Studio local **2D** = SRT 2D (may revisit later).

- Default: look **down**, **centroid** of boats that have **active telemetry**.
- Buttons: **Follow centroid** | **Follow boat** (one fleet boat with telemetry).
- If the set is empty: **freeze** last view (or course bounds). No drift.
- Offsets: east / north metres + **zoom** (metres across the frame). All editable on the bottom bar.
- OBS zoom/pan **is** this rig (studio 2D zoom must match OBS).
- Stream map must **draw those boats** (sail icons). Missing boats on OBS 2D is Fail.

---

## 5. Visibility — one preset per output, simultaneous

Presets are **per SRT channel**, not a single global scene flag. 3D SRT can show boat **meshes** while AR SRT shows **tags only** at the same time.

Switching local **AR / 3D / 2D** only **shows that channel’s** toggles on the bottom bar. It does not copy 3D onto AR.

### Defaults (locked)

| Layer | 3D SRT | AR SRT |
| --- | --- | --- |
| Terrain, sea, OSM buildings, heroes | **on** | **off** |
| Boat model | **on** | **off** |
| Boat tag | **on** | **on** |
| Boat heading arrow | **on** | **off** |
| Buoy model | **on** | **off** |
| Buoy tag | **on** | **on** |
| Buoy rounding arrows | **on** | **off** |
| Sponsors, billboards, start/finish | **on** | **on** |

Each of those rows is independently togglable **for that channel**. 2D uses the stream-map rules (boats as icons; no 3D meshes).

Per-feature authoring `visible3d` / mesh / tag still apply **inside** the channel preset (preset cannot force on a feature authored off).

---

## 6. Bottom bar (not side rails)

One bar, bottom of the studio window. Contents follow **local** AR / 3D / 2D:

- **3D:** Control 3D program · Frame boats · 3D layer toggles (boats/buoys/env as in §5).
- **AR:** Follow / Free ·  AR layer toggles.
- **2D:** Centroid / boat picker · offsets · zoom.

SRT plates always use **their** preset, even when the bar is showing another local view.

---

## 7. AR 1920×1080 (2K Fail)

OBS AR still looks **larger than 1080 / cropped 2K**. Same class of bug as HiDPI `toBitmap` vs `getSize()`. **3D Pass** means 3D scale is OK; **AR still Fail**. Worker: infer bitmap size, scale to 1920×1080, no crop. Plate window stays 1920×1080 CSS.

---

## 8. FPS — `STUDIO_TICK_FPS` is not SRT fps

`desktop/main.cjs` **`STUDIO_TICK_FPS = 60`** is the studio **preview / NDI pump clock** (how often Electron ticks). Preview is ~60 rAF. SRT air is **ffmpeg `-r 30`** from plate capture.

**Do not raise `STUDIO_TICK_FPS`.** Setting it to 60 “for SRT” was an old trap: it does not make OBS 30, it burns the renderer. Phase 22 Pass is OBS **~30 / 30 / 30** with three SRT on.

**16×3 is Fail.** 3D may land **27–30** if GPU-bound; AR/2D should hit ~30 once AR **does not** run Cesium. Measure after AR world layers off. Do not reopen NDI pack. Do not drop a channel silently.

---

## 9. Worker order

1. **OUT** — AR plate 1080 (2K). Can parallel 2.
2. **SCN** — AR look (no terrain/sea/heroes) + freeze until telemetry. Stops AR wander + Cesium on AR.
3. **SCN** — visibility presets + bottom bar layer toggles.
4. **SCN** — 3D program rig + Control 3D program + damping.
5. **SCN** — 2D program rig (centroid / boat / offsets / telemetry filter).
6. **PRF** (+ SRT if encode, not tick) — 30×3 after 2. Report which channel is short.

VPS **22.3** still after fps Pass. Ingest catalog untouched.
