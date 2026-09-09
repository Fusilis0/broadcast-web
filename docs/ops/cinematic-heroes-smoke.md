# Smoke — cinematic player + hero meshes

**When:** after SCN-01 (player) **and** DSP-03 (glTF pack) report code-complete. **A** = 2 s fixture. **C** = 60 s film (DSP-02 **code-complete**). **B** waits for hero pack Human Pass.  
**Local 3D.** Realistic env. Terrain **on**. Buildings **on**. Heroes **on**. Map overlay **aerial** for these looks.  
**Not:** AR for heroes. **Record** is Electron (`npm run desktop:dev`) — smoke **E**.

`npm run dev` → `?race=19eylul-bosphorus-cup` (or your Istanbul pack). Click **3D**.

---

## A — Cinematic player (`DSP-SCN-20260908-01`)

Sequence is **`_empty`** (~2 s). Dummy path: high globe then a short ENU hop. It will look wrong as a film. We only care that the **machine** works.

| Step | Click | Good | Fail |
| --- | --- | --- | --- |
| 1 | Right rail **Cinematics** → select **`_empty`** (not Off) | Camera leaves follow/free | Still drone POV |
| 2 | **Play** | Camera moves for ~2 s; boats/course/sponsors/flags/2D map/credit line **gone** | Race chrome still on; camera stuck |
| 3 | Watch the 2 s | First ~1 s: globe/aerial moving, **no** Gerstner, no OSM. At **t≈1 s** the screen goes **solid pale white** — that is `_empty` shot 2 `cloud01: 1` (flat cloud quad `#e8eef4`, not a crash). DSP-02 will only hold full cover across the Marmara cut, then ease out. | First second also white (tiles/camera dead); two globes; fog soup; chrome still on |
| 4 | **Pause** / scrub the slider | Same time → same pose if you scrub back | Jitter / different pose at same t |
| 5 | Select **Off** (or stop) | Follow/free cam back; boats/course/HUD return | Stuck in cinematic; chrome gone forever |
| 6 | **AR** | Still **no** terrain/buildings/heroes (opaque gate) | Heroes on the AR plate |
| 7 | **Record** | Enabled (OUT). Do not use in this 2 s fixture Pass — see **E** | Encodes `_empty` by accident — stop, pick intro |

**Pass A:** 1–5. 6–7 are gates, not the film.

---

## B — Hero glTF pack (`DSP-SCN-20260908-03`)

Cinematics **Off**. **Free cam** + **Frame boats** or Focus a landmark. Terrain + buildings + heroes **on**.

| What | Good | Fail |
| --- | --- | --- |
| Maiden’s Tower | Textured Sketchfab mesh at Kız Kulesi, not a terracotta box | Box, missing, or 100 km wide |
| Galata | Small SKP tower, not cream box, **not** a 419 MB photogrammetry dump | Missing / cream box / hitch from huge mesh |
| Rumeli Hisarı | **Still a proxy box** (no file) | Accidental huge Galata mesh here |
| Peninsula | Ayasofya, Sultanahmet, Topkapı, Süleymaniye, Aya İrini sit on the Historic Peninsula at street scale | Floating km up, buried, or OSM double-drawn |
| Palaces | Dolmabahçe, Çırağan on the European shore | Wrong shore / wrong scale |
| Three bridges | Yavuz Selim, FSM, 15 July — span the strait; OSM hole **~80 m**, not a crater through Beşiktaş | Shore erased; bridge as a cube at origin |
| Heroes **off** | Meshes gone; OSM boxes fill the holes | Holes stay empty or meshes stay |
| **AR** | No heroes | Meshes on AR |

**Bury/float** (whole pack metres off terrain): **GEO**, do not scale by eye.  
**One mesh centimetres or tens of km:** report AABB — do not invent HAE.

---

## C — `intro-bosphorus` 60 s (after **09-01**)

Right rail **Cinematics** → **`intro-bosphorus (72 s)`** → **Play**. After one Play, **Save tile list** again (finer SSE). Record is OUT — see **E**.

| t | Shot | Good | Fail |
| --- | --- | --- | --- |
| 0–5 | World + pins | Earth; labeled **USA / Canada / UK / Russia / Turkey / İstanbul** (needle pins). Drift Atlantic/Europe — **not** a Moscow look | Label Moscow; gold-dot pills; pins on ENU |
| 5–10 | Transit → **Canada** hold | Camera **flies** west; whole Canada + pin | USA hold; jump |
| 10–15 | Transit → **UK** hold | Smooth; whole UK + pin | Teleport; London street |
| 15–21 | East to **Russia** hold | Label **Russia**; country-scale (not a street) | Label Moscow; city zoom |
| 21–26 | **Turkey** hold | Whole country + pin `Turkey` | City-only Anatolia |
| 26–32 | Fly → İstanbul / cloud | İstanbul pin on the globe fly; short pale cloud; then ENU | Teleport into the strait; 6 s white plate |
| 32–36.5 | 3rd bridge | Cloud out, then **2–3 s parked** on Yavuz | Instant south fly |
| 36.5–45 | South → Maiden’s | Camera **moves** from 15 July into Maiden’s — no pop | Scrub 39.9 vs 40.1 jumps |
| 45–60 | Peninsula → Galata → Çırağan | Continuous; Çırağan look **41.04342388464562, 29.01532600006871** | Teleport; wrong palace look |
| Off | | Pins gone; follow/free + chrome back | Stuck cinematic |

Country holds and the strait should look like **sharp Bing Aerial** (ion **2**), not mush, not Google Photorealistic.

**Known, not Fail:** cloud is still 0.5 s steps. Globe at 4–18 Mm will never be street-sharp.

**Tell BW:** C Pass or which row still teleports / looks like a city. Then **Save tile list**, then **E** (Record).

---

## D — tile warm (`DSP-SCN-20260908-07`)

Needs ion token. **3D**, not AR. First load after start: status **`tiles: warming N/M`** — wait (can be minutes; tens–hundreds of MB into `.cache/cinematic-tiles/`, not git).

| Step | Good | Fail |
| --- | --- | --- |
| 1. Warm finishes | Status leaves warming; Play enabled | Throw loop; stuck warming forever |
| 2. **First** Play | Path as §C; some pop on the *first* take is OK if warm was still filling | Empty globe the whole minute |
| 3. **Second** Play (same session) | Country holds (Canada/UK/Russia/Turkey) stay **filled** — no grey/empty flash as you arrive | Pops empty every time you zoom a country |
| 4. Optional: airplane mode after warm, Play again | Still shows cached globe/Aerial | Goes black/empty → cache miss |
| 5. Off | Operator **lock tiles** checkbox restored | Stuck locked forever |
| 6. `git status` | No files under `.cache/cinematic-tiles/` | Binaries staged |

Optional: Cinematics **Save tile list** → downloads `intro-bosphorus.json` with `tileWarm.contentUrls`. Commit that file (URLs only). Next machine uses it to know which tiles to cache. **Do not** commit `.cache/cinematic-tiles/`.

**Tell BW:** D Pass or Fail (which step). Then **E** (Record).

---

## E — silent MP4 (`DSP-OUT-20260908-01`)

**Electron only:** `npm run desktop:dev`. Not plain Chrome (`desktop only`). **3D**, not AR.

| Step | Click | Good | Fail |
| --- | --- | --- | --- |
| 1 | Cinematics → **intro-bosphorus (72 s)** | Sequence selected; wait if `tiles: warming` | Off / `_empty` |
| 2 | **Record** → Save-as (default Videos `intro-bosphorus.mp4`) | Status `recording…` then `saving…` then `saved <path>` | `cancelled` (dialog abort is OK); throw loop |
| 3 | Open the file in vMix or a desktop player | Silent **1080p ~60 s**; no HUD / boats / credits | Duration way off; HUD in frame; won't play |
| 4 | After save | This app still waits — it does **not** go live | App starts NDI/SRT by itself |

**Tell BW:** E Pass or Fail (which step). Then Phase 22 is still later.

---

## After Pass

1. Tell BW: **A** / **B** / **C** / **D** / **E** Pass or Fail (which row).  
2. Phase 22 SRT only after BW opens it.
