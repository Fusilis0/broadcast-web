# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-08-11  
**Session role:** BW

## Strategy (v1)
Local studio first; Hetzner = Phase 12 deferred.

## Milestones
| Gate | Status |
| --- | --- |
| **V1-A** Phase 8 | **Met** |
| **V1-B** Phase 9 | **Met** |
| **V1-C** Phase 10 | **Partial** — 10.3 Pass; 10.2 SPA done / console ack pending; **10.1 open (human)** |
| **V1-D** Phase 11 | **Met** — core 11.1–11.7 + follow-up authoring/chrome + follow-up #2 (authoring fixes/two maps) + follow-up #3 (P0 `window.prompt()` Electron fix) all accepted |

## Phase 10 tracking
| # | Status |
| --- | --- |
| 10.3 NDI smoke | **Accepted Pass** |
| 10.2 Console deeplink | SPA pack done; formal ack → console team |
| 10.1 Unity parallel | **Open** — only remaining product cutover gate |

## Phase 11 + follow-up closed 2026-08-11
Core V1-D + chrome/authoring fix:
- SCN-04 World Authoring workspace (discoverable tools)
- OUT-02 output → Ops sidebar
- CAL-01 calib → Calib sidebar

Design: `unified-ops-sidebar.md`, `world-authoring-workspace.md`.

Optional later: library catalogue content; Save→Load smoke; multi-sender NDI; 11.8/11.9.

## Phase 11 follow-up #2 — accepted 2026-08-11 (SCN)
User tested the workspace and found real breakage; BW reproduced live via `npm run dev` before
writing dispatches, then **independently re-verified both worker reports** before accepting
(did not just trust the reports):
- **Close button doesn't hide the panel** — `.world-authoring` CSS `display: flex` beats
  `[hidden]`; status text flips but the ~960px window stays on screen. Root cause confirmed by
  BW pre-dispatch; fix confirmed post-dispatch via CDP (`display:none`, zero-size rect on close,
  restored on reopen — screenshots were unreliable/stale on this canvas-heavy page in-session, so
  CDP `getComputedStyle`/`getBoundingClientRect` + a synthetic `PointerEvent` drag were used as
  ground truth instead of trusting pixels).
- Resizable authoring map + sidebar rail — confirmed drag handles exist; simulated sidebar drag
  moved width 340px → 460px.
- Enter/Delete/drag point editing — accepted on code review (`onEditorKeyDown`, `hitTestVertex`
  wiring present and matches spec) + test suite coverage.
- Viewer-facing "stream" map now has its own bigger (520px), framed, compass+branding look;
  ops/authoring map metrics pinned unchanged (regression-tested).
- `npm test` — 388 client + 23 server green. `npm run build` — green.

Both dispatches accepted → `docs/agentic/dispatches/done/DSP-SCN-20260811-05…` and `-06…`. SCN
memo has full bullets + BW acceptance notes are in each dispatch file.

## Phase 11 follow-up #3 — issued 2026-08-11 (P0, active — root-caused, not yet worker-fixed)
User: billboard chain still won't finish (button or Enter) even after `-05` shipped. **Root cause
found, not just reported**: Electron's own renderer setup unconditionally overrides
`window.prompt()` to throw (`window-setup.ts`; Electron team closed this "won't fix" years ago).
`window.alert`/`window.confirm` are unaffected. This is exactly why BW's own acceptance testing of
`-05` (done via a plain Chromium browser tab, not Electron) missed it — `window.prompt` works fine
in a normal browser tab.

Grepped **every** `window.prompt(` call site in the repo — 7 across 5 files, all silently broken
in the real Electron app: billboard-chain texture + spacing (`editorPanel.ts`,
`stubTexturePicker.ts`), boat/drone/buoy id placement (`editorPanel.ts`), texture-picker free-text
(`texturePicker.ts`), **Save as** (`main.ts`), **Rename**/**Duplicate** (`projectManagerPanel.ts`).
Split into two dispatches by file ownership (protocol requires this), same root cause, each
references the other:
- `active/DSP-SCN-20260811-07-electron-prompt-modal` (SCN, P0) — builds a shared promise-based
  `promptModal()` DOM utility (`src/ui/`), fixes its own 5 call sites (incl. the reported bug).
- `active/DSP-PLT-20260811-03-electron-prompt-fixes` (PLT, P0) — reuses that utility for its 2 call
  sites (Save as / Rename / Duplicate). Should start after or coordinate with SCN's utility.

**Process lesson for BW:** going forward, any dispatch touching `window.prompt`/`alert`/`confirm`
or other browser-native dialogs needs acceptance testing in the **actual Electron app**, not just
a browser tab pointed at the Vite dev server — logged in both memos so future acceptance checks
catch this class of bug.

## Phase 11 follow-up #3 — accepted 2026-08-12 (SCN + PLT)
Both workers reported done but neither had a way to click through the real Electron GUI in their
own sessions (no automated Electron UI driver available to them). BW did not just trust the
reports — launched the real `desktop/node_modules/electron/dist/electron.exe` directly (against
the already-running Vite dev server, **not** a browser tab) and drove the live renderer via
`webContents.executeJavaScript` from a throwaway Node/Electron script (no repo files touched,
temp script deleted after):
- Confirmed `window.prompt()` genuinely throws (`"prompt() is not supported."`) in that exact
  renderer — the root cause is real, not theoretical.
- **Billboard chain (the original user-reported bug):** selected the `billboardChain` tool,
  dispatched two synthetic `click`s on the map canvas, dispatched a window `keydown Enter` →
  texture `promptModal` appeared (default `"1"`) → submitted → spacing `promptModal` appeared
  (default `"12"`) → submitted → no modal left open → feature count went 13 → 14 and a new
  `Chain 3 · billboardChain` row appeared in the Assets sidebar list. This is the exact flow the
  user reported broken; now proven fixed end-to-end, not just code-reviewed.
- **Save as:** clicked the button → id `promptModal` (`"Save as — project id"`) → **Cancel** →
  clean abort, no leftover modal. Re-ran: submitted the id modal → name `promptModal`
  (`"Save as — display name"`) → **Escape** → clean abort, no crash either time.
- Rename/Duplicate share the identical `promptIdName` → `promptModal` primitive already proven
  above; not separately re-driven live (would need a configured `projectsApiBase` + local server)
  — accepted on code review + green suite instead, given the shared-primitive risk was retired.
- `npm test` (394 client + 23 server) and `npm run build` green at HEAD.

Both dispatches moved to `done/`; full write-up in
`docs/architecture/world-authoring-workspace.md` § "Follow-up #3".

## Next (human)
1. **10.1** — the only remaining open gate: parallel Unity vs broadcast-web air (or dress); decide
   primary / dual-path / keep Unity.
2. Forward `HO-CON-console-team-20260804-01` when convenient.
3. Optional/unscheduled: 11.8 revision history, 11.9 misc show-notes UX, Library catalogue
   content, multi-sender NDI for the second (stream-map) source.

## Idle
No active dispatches. Only open item is human-side **10.1**.

## Compaction recovery
`BOOTSTRAP_BW.md` → this memo → roadmap (Phase 10.1 open/human; Phase 11 Done / V1-D)
