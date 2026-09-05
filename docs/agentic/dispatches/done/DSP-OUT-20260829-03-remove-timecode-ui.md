# Dispatch DSP-OUT-20260829-03-remove-timecode-ui

## Meta
- From orchestrator: OUT (adopted from BW draft; Phase **19.1**)
- Worker role: WORKER(DSP-OUT-20260829-03-remove-timecode-ui)
- Priority: P2
- Phase: **19.1** Hide visual timecode (keep modules)
- Related: Phase 19 design §19.1 · `OUT_PHASE19.md` · was Phase 18.8
- Status: **DONE (code)** 2026-09-02 — suite **1047 + 23**. **Human smoke still open.**
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
## Goal

Take the timecode / qlock burn-in out of the picture. It sits in the bottom-right corner of every rendered frame and is no longer needed now that synchronisation happens in the app via the PTS→NTP match.

Operator lock, verbatim: **"delete ui elements but keep code maybe we use them later."** So this removes it from the output and from the operator's view, but the module, its tests, and its documentation stay in the repository, ready to be re-enabled.

## Background

The widget is `src/output/visualTimecodeOverlay.ts` with `visualTimecodeEncode.ts`: a Unity-compatible 8×8 LSB barcode drawn in an orthographic overlay pass, opaque, default corner bottom-right at 96 px. It is gated at boot:

```2239:2247:src/main.ts
  if (config.timecodeEnabled && scene) {
    visualTimecode = startVisualTimecode({
      renderer: sceneHandle.renderer,
      // ...
    })
  }
```

`timecodeEnabled` defaults to **`true`** in both `public/config.json` L28–30 and `loadConfig.ts` L49–51, L232–234. There is a runtime `setEnabled` (`visualTimecodeOverlay.ts` L197–199) but no ops UI toggle.

**The one real hazard in this dispatch is the render-wrap ordering.** Three things wrap or bind `renderer.render`, and they must stack in this order:

```
videoBackground.wrap   (pre-pass — draws the SRT underlay before the scene)
  └─ visualTimecode.wrap  (post-pass — draws the barcode after the scene)
       └─ NDI pumps bind renderer.render at pump start
```

`main.ts` L2184–2250 installs them in that order, and `videoBackground.ts` L267–271 skips re-entry for the timecode's orthographic camera. Removing the middle layer must leave the underlay and the NDI capture working. This ordering has bitten the project before — it is called out in the Phase 17 dispatch notes.

## In scope

1. Flip the default so the burn-in does not render: `timecodeEnabled` becomes `false` in `public/config.json` and in `DEFAULT_CONFIG`. The boot gate already skips installation when it is false, so the wrap should simply never be installed.
2. Verify the wrap stack is correct with the middle layer absent: the SRT video underlay still draws behind the scene, the AR/3D NDI captures still include everything they should, and `renderer.render` is left in a clean state on shutdown.
3. Remove the operator-facing surface. Check for any DOM timestamp or clock readout in the bottom-right of the app chrome and remove it too — the operator's description is "timestamp / qlock that on bottom right corner", which may cover more than the WebGL barcode. Report exactly what you found and removed.
4. **Keep the code.** `visualTimecodeOverlay.ts`, `visualTimecodeEncode.ts`, and their tests stay. Do not delete them, do not remove their exports, do not gut them into stubs. Setting `timecodeEnabled: true` must still bring the feature back intact.
5. Note the change where the feature is documented, including how to turn it back on, so the next person does not conclude it was lost.
6. Existing race project packs may carry `timecodeEnabled: true`. Decide and state whether a saved pack can still switch it on; BW's preference is yes — a pack that explicitly asks for the burn-in should get it, since the code is being kept deliberately.

## Out of scope

- Deleting the modules or their tests. Explicitly refused by the operator.
- Changing the barcode format, corner, or size.
- The video background wrap's own behaviour beyond verifying it still works.
- Any other overlay: the AR calibration coordinate overlay, wind pills, and the PiP minimap are not this dispatch (the PiP is `DSP-SCN-20260829-03`).
- NDI colour or frame rate.

## Likely files

- `public/config.json`, `src/config/loadConfig.ts` — default flip
- `src/main.ts` — boot gate, wrap install/teardown verification
- possibly a DOM element in `src/scene/stubHud.ts` or `style.css` if a separate on-screen timestamp exists
- `src/output/visualTimecodeOverlay.ts` — **unchanged**, unless teardown needs a fix
- documentation covering timecode burn-in

## Inputs provided

- Reason it is going: the PTS→NTP match in the app replaced the visual timecode as the sync mechanism (Phase 17, `ar-video-underlay-ntp-sync.md`).
- Wrap install order: `main.ts` L2184–2250; re-entry skip `videoBackground.ts` L267–271; teardown `main.ts` L2754–2755.

## Acceptance criteria

- [ ] No timecode burn-in appears in the preview, in the AR NDI channel, or in the 3D NDI channel by default.
- [ ] The SRT video underlay still renders correctly behind the scene with the timecode wrap absent.
- [ ] AR and 3D NDI captures are otherwise unchanged.
- [ ] Any bottom-right on-screen timestamp element in the app chrome is gone, and the report says what it was.
- [ ] `visualTimecodeOverlay.ts`, `visualTimecodeEncode.ts`, and their tests remain in the repo and still pass.
- [ ] Setting `timecodeEnabled: true` restores the feature exactly as before — verify this, do not assume it.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human smoke:** in Electron with AR background `video`, confirm the bottom-right corner is clean in both the app and the OBS NDI sources, and that the drone picture still shows behind the scene.

## Report back

1. What was removed from view versus what was only defaulted off
2. Exactly which on-screen elements you found in the bottom-right corner
3. Confirmation that the underlay and NDI capture still work without the middle wrap
4. Confirmation that re-enabling restores the feature
5. Suggested memo bullets for OUT

## Worker paste block

```
You are WORKER(DSP-OUT-20260829-03-remove-timecode-ui).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260829-03-remove-timecode-ui.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/architecture/phase19-senexus-qol.md §19.1
4. src/main.ts (timecode boot gate + wrap order vs videoBackground / NDI)
5. src/output/visualTimecodeOverlay.ts, visualTimecodeEncode.ts

Phase 19.1: default timecodeEnabled false; keep modules + tests; pack true still works.
Fix wrap stack with the middle layer absent. No NDI FourCC/fps. Report back per dispatch.
```

