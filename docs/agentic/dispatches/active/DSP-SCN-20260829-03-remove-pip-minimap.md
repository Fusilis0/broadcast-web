# Dispatch DSP-SCN-20260829-03-remove-pip-minimap

## Meta
- From orchestrator: BW (route to SCN)
- Worker role: WORKER(DSP-SCN-20260829-03-remove-pip-minimap)
- Priority: P2
- Phase: 18.9 (+ the surviving part of 18.10)
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active** — wave 4. **Do not start until wave 3 lands.** Live dump 2026-08-29: 2D Send is 3 fps because the worker `getImageData`s a 1920×1080 canvas after upscaling the 520 map. `DSP-OUT-20260830-01` is fixing that to a native-size read + blit. If you enlarge the stream-map backing store to 1920×1080 before that lands, you make `2dGrab` worse. After `-01` lands, a 16:9 source in the 520–960 band is fine; a full 1080p source canvas is still the wrong answer.

## Goal

Remove the picture-in-picture minimap card from the screen. The standalone 2D map must keep working in every other role: the ops authoring map, the full-screen local 2D view, and above all the **`broadcast-web-2d` NDI channel**, which must keep sending.

Operator lock: **"we can remove pip minimap (keep 2d of course)"**, and for the removal style, **"delete ui elements but keep code maybe we use them later."**

## Background — the trap in this task

There are two separate `Map2dHandle` instances, and the one being removed from view is also the one feeding NDI.

| | Ops / authoring map | Stream map |
| --- | --- | --- |
| Created by | `createMap2d({ sizePx: 240 })` (`stubHud.ts` L969) | `createStreamMap2d()` (`streamMap.ts`, `stubHud.ts` L970) |
| Shown as | Sidebar panel | **The PiP card** — `.stream-map`, 520 px, top-left (`style.css` L1442–1462) |
| Toggle | none | `#ops-stream-map` checkbox (`stubHud.ts` L552–568, L983–985) |
| Feeds NDI | no | **yes** — channel `'2d'` via `startStreamMapNdiPump` sampling `hud.getStreamMap().getCanvas()` (`main.ts` L2301–2308) |
| Also used by | authoring editor | the full-screen local 2D view (`main.ts` L457–470 enlarges this same map) |

So deleting the PiP card naively takes the 2D NDI channel and the local 2D view with it. The canvas must keep existing and keep being redrawn while never being visible as a PiP overlay — the NDI pump already calls `ensureDrawn()`, and `streamMap.ts` L44–47 documents that the 2D channel is designed to work while the PiP is hidden. Confirm that holds when the card is gone rather than merely hidden.

## The 1920×1080 question — resolved

The operator originally noted "1080 1920 ratio 2d map" and then corrected it: **"2d should be 1920x1080. 1080x1920 was mistake. dont make it portrait make it 1920x1080 like 3d and ar."** So there is no portrait work. The channel is already 1920×1080.

What is worth fixing while you are in here: the source canvas is a **520×520 square** (`STREAM_MAP_SIZE_PX`, `streamMap.ts` L7), because it was sized to be a PiP card. `letterboxRect` then centres it in the 1920×1080 NDI frame, so the 2D channel currently sends a 1080×1080 square with wide matte bars either side. Once the PiP card is gone, that constraint is gone too. Make the stream map source **16:9** so the 2D NDI frame is filled edge to edge. The map view already derives its geographic aspect from the canvas (`map2dView.ts` L59–61), so a 16:9 canvas widens the view automatically — check that the resulting framing of the course still looks right, and report it.

Keep `letterboxRect` and its tests. It is the safety net for any future mismatch and costs nothing when the aspects agree.

## In scope

1. Remove the PiP overlay card from the UI: the `.stream-map` card and the `#ops-stream-map` checkbox that toggles it. Keep `streamMap.ts` and `map2d.ts` intact — this is a UI removal, not a feature deletion.
2. Keep the stream map canvas alive, off-screen, and redrawn, so the 2D NDI pump keeps sampling it. All three NDI channels must still send after this change.
3. Preserve the **full-screen local 2D view**. It currently works by enlarging the same PiP element (`main.ts` L457–470, `resolveLocal2dMapSizePx` L418–427). With the card removed it needs its own host to show in — the local 2D/3D/AR switcher must still be able to display the 2D map full-screen on the operator's screen.
4. Make the stream map source canvas 16:9 so the 2D NDI output fills 1920×1080 instead of pillarboxing a square.
5. Leave the ops sidebar authoring map completely alone. It is a different instance and the operator did not ask for it to change.
6. Note in the relevant docs that the PiP is removed from the UI while the 2D channel and the local 2D view continue, and how the PiP could be brought back.

## Out of scope

- Any portrait / 1080×1920 work. Cancelled by the operator.
- The 2D map's visual redesign — the operator said details are coming in a **next iteration**, and that the current real-map background and fit are fine for now. Do not restyle, recolour, or re-lay-out the map.
- Deleting `streamMap.ts`, `map2d.ts`, `letterboxRect`, or their tests.
- The ops sidebar authoring map, and the world authoring workspace map.
- The 2D NDI capture mechanism (worker grab, transferables) — that is `DSP-OUT-20260829-02`. If both are in flight, coordinate on `streamMapNdiPump.ts` and say so.

## Likely files

- `src/scene/stubHud.ts` — the `#ops-stream-map` checkbox and the PiP host
- `src/scene/streamMap.ts` — size constant, off-screen hosting
- `src/style.css` — `.stream-map` card rules
- `src/main.ts` — local 2D focus view host (L457–470), stream map wiring (L2301–2308)
- `src/scene/map2dView.ts` — verify the aspect change reads correctly
- `src/output/streamMapNdiPump.ts` — only where the source aspect meets `letterboxRect`
- tests alongside; `docs/architecture/multi-output-streaming.md`

## Inputs provided

- Separation is already documented and intended: `streamMap.ts` L44–47 states the 2D channel samples `getCanvas()` and works while the PiP is hidden.
- Current constants: `STREAM_MAP_SIZE_PX = 520` (`streamMap.ts` L7); output lock 1920×1080 (`studioOutput.ts` L5–6); `letterboxRect` (`streamMapNdiPump.ts` L49–68); matte `#0a1018` (`ndi2dAsyncCapture.ts` L41).
- The 2D NDI enable toggle lives in the NDI tab (`ndiControllerPanel.ts` L215–241) and is separate from the PiP toggle — it stays.

## Acceptance criteria

- [ ] No PiP minimap card appears over the 3D/AR view, and its ops checkbox is gone.
- [ ] `broadcast-web-2d` still sends; all three NDI sources are live in OBS or vMix after the change.
- [ ] The 2D NDI frame is filled 16:9 with no matte bars, and the course framing still looks sensible.
- [ ] The full-screen local 2D view still works from the channel switcher.
- [ ] The ops sidebar authoring map is unchanged.
- [ ] `streamMap.ts`, `map2d.ts`, and `letterboxRect` remain, with their tests passing.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human smoke:** in Electron, the 3D/AR view has no minimap card in the corner; switching to local 2D still shows the map full-screen; OBS still lists and displays `broadcast-web-2d`, now filling the frame. A problem would look like the 2D NDI source going black or frozen, or the map view stretched.

## Report back

1. What was removed from the UI and what is now hosting the canvas off-screen
2. How the local 2D full-screen view is hosted now
3. What the 16:9 source did to the map framing
4. Files touched and tests run, including confirmation all three NDI channels still send
5. Suggested memo bullets for SCN
