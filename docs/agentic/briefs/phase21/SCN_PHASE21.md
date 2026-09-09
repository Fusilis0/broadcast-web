# SCN — Phase 21 brief (cinematic player + intro sequence)

**Role:** SCN — Scene & Visuals Orchestrator  
**You do not implement `src/`.** Plan, issue/run `DSP-SCN-*`, update `SCN_MEMO.md`.  
**Design:** [`../../../architecture/commercial-video.md`](../../../architecture/commercial-video.md)

Phase 21 is **MP4 authoring**, not air. Hide race chrome while playing/recording. Aerial + OSM + heroes on ENU shots. Globe shots: coarse terrain, no OSM, no Gerstner, fog off.

## Owns

| DSP | What |
| --- | --- |
| **21.1** | [`DSP-SCN-20260908-01-cinematic-player`](../../dispatches/active/DSP-SCN-20260908-01-cinematic-player.md) — JSON schema, 30 Hz player, hide-race, fog/ocean flags, cloud seam, Aerial for the take, ops play/scrub |
| **21.2** | [`DSP-SCN-20260908-02-intro-bosphorus`](../../dispatches/active/DSP-SCN-20260908-02-intro-bosphorus.md) — first sequence (**code-complete**) |
| **21.2b** | [`DSP-SCN-20260908-06-country-pins-spline`](../../dispatches/active/DSP-SCN-20260908-06-country-pins-spline.md) — country pins, no teleport |
| **21.3b** | [`DSP-SCN-20260908-07-cinematic-tile-warm`](../../dispatches/active/DSP-SCN-20260908-07-cinematic-tile-warm.md) — prefetch after PLT-01 |

Call GEO converters (`geodeticToEcefMeters`, `ecefLookAt`, `enuKeyframeToScene`). Do not invent ECEF. Do not Record (OUT). Do not mux audio.

**21.3b code-complete.** Human Pass: second Play, no pop.

**21.2c** [`DSP-SCN-20260909-01-intro-human-pass`](../../dispatches/active/DSP-SCN-20260909-01-intro-human-pass.md) — HD SSE, Canada→UK then Russia→Turkey→İstanbul, pins, 3rd-bridge hold, no ENU teleports, Çırağan GPS. **Start after the in-flight 07/quality worker reports.**

Studio boot (not MP4): [`DSP-SCN-20260909-02-studio-boot-defaults`](../../dispatches/active/DSP-SCN-20260909-02-studio-boot-defaults.md) **code-complete**. NDI Send off is in tree (`HO-SCN-OUT-20260909-01`).

Hero **meshes** (three bridges, peninsula, Çırağan, Galata, Maiden’s Tower): mount when files exist; proxies OK. **Do not** look at Rumeli Hisarı in this sequence.

## Does not own

GEO formulas. MP4 encode. SRT. NDI. CesiumJS. IBB. Google Photorealistic.

**After 06+07 Human Pass** → OUT (`OUT_PHASE21.md`). Then BW. Do not start Phase 22.
