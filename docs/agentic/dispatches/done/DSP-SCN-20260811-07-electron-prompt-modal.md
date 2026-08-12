# Dispatch DSP-SCN-20260811-07-electron-prompt-modal

## Meta
- From orchestrator: BW → SCN (P0 bug — reported: "finishing billboard chain doesn't work with
  both double mouse click or enter")
- Worker role: WORKER(DSP-SCN-20260811-07-electron-prompt-modal)
- Priority: **P0** — blocks billboard chain creation, boat/drone/buoy placement-by-id, and free-text
  texture URL entry in the **actual Electron app** (not the plain-browser dev server)
- Phase: Phase 11 follow-up #3
- Related: `DSP-SCN-20260811-05-authoring-workspace-fixes.md` (done — added the Enter-to-confirm
  path that also hits this bug), sibling `DSP-PLT-20260811-03-electron-prompt-fixes.md` (BW is
  issuing both together — **coordinating note**: same root cause, split by owner, see Sequencing)

## Goal

Replace every `window.prompt(...)` call in SCN-owned files with a small shared, promise-based DOM
modal, because **Electron always throws on `window.prompt()`** — it is not merely "unsupported UI",
it is a hard synchronous exception that silently aborts whatever async function called it. This is
the actual root cause of "finishing billboard chain doesn't work with both double mouse click or
Enter": both paths converge on `finishBillboardChain()`, which calls `promptStubTextureUrl()` →
`window.prompt(...)` → throws in Electron → the `async` function's promise rejects with nothing
visible to the user (no chain created, no toast, no console-visible-to-user error).

## Background — confirmed by BW (not just the user report)

1. **Electron's own source unconditionally overrides `window.prompt`** to throw
   (`lib/renderer/window-setup.ts`, all Electron versions, regardless of `contextIsolation`/sandbox
   settings):
   ```js
   window.prompt = function () {
     throw new Error('prompt() is not supported.')
   }
   ```
   `window.alert()` and `window.confirm()` are **not** affected — they still work as native blocking
   dialogs in Electron. Only `prompt()` is broken. Source: Electron team, closed as "won't fix"
   (github.com/electron/electron/issues/472) — this will never change upstream.
2. This explains why BW's own live browser testing of `DSP-SCN-20260811-05` did **not** catch this:
   BW verified via a plain Chromium tab pointed at the Vite dev server (`cursor-ide-browser` MCP),
   where `window.prompt` works fine. The user's daily driver is the **Electron app**, where it does
   not. Lesson for future SCN/BW smoke checks: anything touching `window.prompt` must be verified
   in the actual Electron shell, not just a browser tab.
3. Grepped every `window.prompt(` call site in the repo — this dispatch owns the **SCN** ones:
   - `src/scene/features/editor/editorPanel.ts`:
     - line ~642 — `finishBillboardChain()`: billboard chain spacing (meters) prompt (**the
       reported bug**, second of two prompts — `promptStubTextureUrl()` is the first, see next bullet)
     - line ~874 — `onMapClick()`, `FLEET_PLACE_TOOLS` branch: boat/drone id prompt
     - line ~922 — `onMapClick()`, `buoy` branch: optional live buoy id prompt
   - `src/scene/features/editor/stubTexturePicker.ts` line ~30 — `promptStubTextureUrl()`: billboard
     texture stub picker (called by `finishBillboardChain()` **before** the spacing prompt — this is
     actually the *first* prompt to throw when placing a billboard chain)
   - `src/scene/sidebar/texturePicker.ts` line ~45 — `promptTextureUrl()`: Library-aware texture
     picker free-text fallback (this function is already `async`, so swapping its internal
     `window.prompt` for `await someModal(...)` is a small, low-risk change)
   - **Not this dispatch's files** (sibling PLT dispatch owns these — same bug, different owner):
     `src/main.ts` (`promptSaveAsMeta` — Save as id/name), `src/projects/projectManagerPanel.ts`
     (`promptIdName` — Rename/Duplicate id/name)
4. `onMapClick` (editorPanel.ts) is currently a **synchronous** function
   (`(rawEast: number, rawNorth: number) => void`) wired via `options.map.onMapClick(onMapClick)`.
   Making the boat/drone-id and buoy-id prompts async means `onMapClick` itself needs to become
   `async` (or fire-and-forget the async continuation internally) — check `Map2dHandle.onMapClick`'s
   type signature and whether callers care about a return value (they should not; it is a plain
   event subscription).
5. `finishBillboardChain()` is already `async` — converting its two prompts to `await` is
   straightforward, no caller signature changes needed there (already called as
   `void finishBillboardChain()`).
6. The existing `isTextInputTarget()` keyboard guard (used by `onEditorKeyDown` for
   Enter/Delete/Escape, added in `DSP-SCN-20260811-05`) checks
   `target.tagName === 'INPUT' | 'SELECT' | 'TEXTAREA' | isContentEditable`. **Build the new modal's
   input as a real `<input>` element** so this existing guard keeps working automatically (Enter
   inside the modal's own input must submit the modal, not accidentally trigger the underlying
   map editor's Enter-to-confirm-placement handler).

## In scope

1. **New shared utility**, e.g. `src/ui/promptModal.ts` (+ `src/ui/README.md`) — a small DOM overlay
   modal that mimics `window.prompt(message, defaultValue)` semantics but is **promise-based**:
   ```ts
   export function promptModal(message: string, defaultValue?: string): Promise<string | null>
   ```
   - Resolves with the trimmed-or-raw string value on submit/Enter, `null` on Cancel/Escape/backdrop
     click (mirror native `prompt` cancel semantics exactly — callers already check `=== null`).
   - Real `<input type="text">` for the value (see Background #6) with `defaultValue` pre-filled and
     selected/focused on open.
   - Enter in the input submits; Escape cancels; also give it OK/Cancel buttons for mouse users.
   - Style it consistently with the existing dark/monospace overlay chrome (`.world-authoring`,
     sidebar panels) — this is a new, more polished replacement for an ugly native browser dialog,
     not just a bug fix; keep it simple (single-field) since none of today's call sites need more.
   - Must work identically in a plain browser tab and inside Electron (no Electron-specific IPC —
     plain DOM, same NDI-invariant "DOM overlay only" pattern as everything else in this app).
   - Support multi-line messages (today's prompts use `\n`-joined lists, e.g. the billboard texture
     picker) — render with `white-space: pre-wrap` or equivalent, don't collapse newlines.
2. Swap every SCN-owned `window.prompt(` call site listed in Background #3 for `await promptModal(...)`,
   adjusting enclosing function signatures to `async` where needed (see Background #4).
3. Keep exact existing behavior otherwise: `null` return → same "cancelled" hint text /
   early-return as today; empty string still means "procedural" for texture prompts; index-vs-URL
   parsing in `stubTexturePicker.ts`/`texturePicker.ts` unchanged.
4. Do **not** touch `window.confirm` / `window.alert` call sites — those already work correctly in
   Electron (see Background #1), leave them as-is.
5. Manual verification **must include the actual Electron app**, not only a browser tab (this bug
   was invisible in a browser tab — see Background #2). If you cannot launch Electron in your
   environment, say so explicitly in the report and give BW/the user a precise manual repro/verify
   checklist to run themselves.
6. Docs: `src/scene/features/README.md` / `src/scene/features/editor/` docs (billboard chain flow),
   new `src/ui/README.md`, `src/scene/README.md` if it references the old native-prompt behavior.

## Out of scope

- `src/main.ts` (Save as) and `src/projects/projectManagerPanel.ts` (Rename/Duplicate) —
  sibling dispatch `DSP-PLT-20260811-03-electron-prompt-fixes.md` owns these; it will import the
  `promptModal` utility you build here (see Sequencing).
- Any Electron main-process / preload / IPC-based prompt implementation — prefer the simpler
  DOM-only approach (consistent with the rest of this app's UI). Only escalate to BW if you find a
  concrete blocker that makes DOM-only infeasible.
- New texture/asset picker UX beyond swapping the prompt mechanism (Library picker polish is a
  separate, already-known backlog item).
- Anything from `DSP-SCN-20260811-05`/`-06` (already accepted) beyond what's needed to fix this bug.

## Likely files

- New: `src/ui/promptModal.ts` (+ test), `src/ui/README.md`
- Edit: `src/scene/features/editor/editorPanel.ts` (3 call sites + `onMapClick` async-ness),
  `src/scene/features/editor/stubTexturePicker.ts`, `src/scene/sidebar/texturePicker.ts`,
  `src/style.css` (modal styles), relevant READMEs

## Inputs provided

- This dispatch's Background section (root cause + exact call sites + Electron source citation
  already gathered — no need to re-diagnose)
- Existing overlay chrome for visual consistency: `.world-authoring`, `.ops-sidebar` styles in
  `src/style.css`

## Sequencing (coordinating BW note — reads across SCN + PLT)

This bug has **two owners** because it spans SCN-owned editor/texture-picker files and PLT-owned
project-save/rename files, but the fix is one shared utility. BW is issuing both dispatches now:
- **This one (SCN)** builds `promptModal` and fixes the reported billboard-chain bug + editor/texture
  call sites — **do this first**.
- `DSP-PLT-20260811-03-electron-prompt-fixes.md` (PLT) swaps its 2 files to use the same utility
  once it exists. **PLT should wait for this dispatch's `src/ui/promptModal.ts` to land** (or build
  against your in-progress branch/report if the two workers are running concurrently — coordinate
  via BW if timing is awkward). Keep the utility's exported signature stable
  (`promptModal(message, defaultValue?) => Promise<string | null>`) so PLT can wire it without churn.

## Acceptance criteria

- [ ] `promptModal(...)` exists, is promise-based, resolves `null` on cancel exactly like native
      `prompt`, and works in a plain browser tab
- [ ] **Verified in the actual Electron app** (not just a browser tab): place a billboard chain
      (≥2 points) via both the **Finish chain** button and **Enter** — texture + spacing modals
      appear, chain is created in both cases
- [ ] Place boat/drone by id via map click in Electron — id modal appears, fleet entry created
- [ ] Place a buoy with `knownBuoyIds` non-empty in Electron — live-id modal appears
- [ ] Texture picker free-text fallback (`texturePicker.ts`) works in Electron
- [ ] `window.confirm`/`window.alert` call sites untouched and still work
- [ ] `npm test` + `npm run build` green
- [ ] Report explicitly states whether Electron was actually launched and tested, or gives BW/user
      a precise manual repro checklist if the worker's environment can't run Electron

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (**explicitly say whether you tested inside Electron**)
4. Follow-ups / blockers
5. Suggested memo bullets for SCN

## Worker paste block

```
You are WORKER(DSP-SCN-20260811-07-electron-prompt-modal).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260811-07-electron-prompt-modal.md (this file —
   root cause already diagnosed: Electron always throws on window.prompt(), see Background)
2. src/scene/features/editor/editorPanel.ts (finishBillboardChain, onMapClick)
3. src/scene/features/editor/stubTexturePicker.ts
4. src/scene/sidebar/texturePicker.ts

Build a shared promise-based promptModal() DOM utility (src/ui/) and replace every window.prompt()
call in these SCN-owned files with it. This fixes the reported "billboard chain won't finish" bug
(root cause: window.prompt() throws unconditionally in Electron). Verify in the actual Electron
app if possible — a plain browser tab will NOT reproduce this bug. Do not touch src/main.ts or
src/projects/projectManagerPanel.ts (sibling PLT dispatch). Report back per dispatch.
```
