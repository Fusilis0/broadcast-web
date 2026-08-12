# Dispatch DSP-PLT-20260811-03-electron-prompt-fixes

## Meta
- From orchestrator: BW → PLT (P0 bug — same root cause as `DSP-SCN-20260811-07`, split by owner)
- Worker role: WORKER(DSP-PLT-20260811-03-electron-prompt-fixes)
- Priority: **P0** — blocks **Save as**, **Rename**, and **Duplicate** in the actual Electron app
- Phase: Phase 11 follow-up #3
- Related: sibling `DSP-SCN-20260811-07-electron-prompt-modal.md` (SCN builds the shared
  `promptModal` utility this dispatch consumes — **read its Sequencing section**)

## Goal

`window.prompt()` throws unconditionally inside Electron (see Background) — swap the two PLT-owned
call sites (**Save as** id/name in `src/main.ts`, **Rename**/**Duplicate** id/name in
`src/projects/projectManagerPanel.ts`) to use the shared `promptModal()` utility being built in
`DSP-SCN-20260811-07`, so these core project-management flows actually work in Electron.

## Background — confirmed by BW (not just the user report)

1. **Electron's own source unconditionally overrides `window.prompt`** to throw
   (`lib/renderer/window-setup.ts`, all Electron versions, regardless of `contextIsolation`/sandbox
   settings): `window.prompt = function () { throw new Error('prompt() is not supported.') }`.
   `window.alert()` / `window.confirm()` are unaffected — leave those call sites alone.
   Source: Electron team, closed as "won't fix" (github.com/electron/electron/issues/472).
2. This means **Save as** (`src/main.ts`, `promptSaveAsMeta`, ~line 454) and **Rename**/**Duplicate**
   (`src/projects/projectManagerPanel.ts`, `promptIdName`, ~line 38) have likely never worked when
   run from the actual Electron shell — only from a plain browser tab pointed at the Vite dev server.
   The user found this via a different symptom (billboard chain), but the same defect exists here.
3. Both functions are today **synchronous**, returning `{ id, name } | null` directly:
   ```ts
   // src/main.ts
   function promptSaveAsMeta(defaults: { id: string; name: string }): { id: string; name: string } | null
   // src/projects/projectManagerPanel.ts
   function promptIdName(title: string, defaults: { id: string; name: string }): { id: string; name: string } | null
   ```
   Each calls `window.prompt(...)` twice (id, then name) with a `window.alert(...)` validation step
   (`isSafeRaceId`) in between — that `alert` call is fine, do not change it.
   Callers: `src/main.ts` line ~776 (`const meta = promptSaveAsMeta(defaults)`);
   `src/projects/projectManagerPanel.ts` lines ~219 and ~243 (Duplicate / Rename button handlers).
4. Converting to the promise-based `promptModal` means both `promptSaveAsMeta` and `promptIdName`
   become `async` (`Promise<{ id, name } | null>`), and their 3 call sites need `await` + their
   enclosing handlers need to tolerate/already be async (check each — button click handlers are
   usually fine to make async, just confirm nothing downstream assumes a synchronous return).

## In scope

1. Wait for (or coordinate with, if running concurrently — see Sequencing) `DSP-SCN-20260811-07`'s
   `src/ui/promptModal.ts`: `promptModal(message: string, defaultValue?: string): Promise<string | null>`.
2. Convert `promptSaveAsMeta` (`src/main.ts`) to `async`, replace its two `window.prompt` calls with
   `await promptModal(...)`, update the call site to `await promptSaveAsMeta(defaults)` (and make
   its enclosing function `async` if it isn't already).
3. Convert `promptIdName` (`src/projects/projectManagerPanel.ts`) the same way; update both call
   sites (Duplicate, Rename).
4. Keep exact existing behavior: `null` → same cancel handling; invalid id → same `window.alert` +
   `null` return; empty name → falls back to id, unchanged.
5. Manual verification **must include the actual Electron app** — this bug is invisible in a plain
   browser tab (see sibling dispatch's Background #2 for why). If your environment can't launch
   Electron, say so explicitly and give BW/the user a precise manual checklist.
6. Docs: `src/projects/README.md` / `docs/ops/projects-api.md` if they describe the prompt UX.

## Out of scope

- Building the modal utility itself — that's `DSP-SCN-20260811-07`'s job; import it, don't
  reimplement it.
- Any other `window.prompt` call sites (editor/texture picker) — SCN's dispatch.
- New project-management features beyond fixing this bug.

## Likely files

- `src/main.ts` (`promptSaveAsMeta` + its call site)
- `src/projects/projectManagerPanel.ts` (`promptIdName` + its 2 call sites)
- `src/projects/projectManagerPanel.test.ts` / `src/main` tests if they cover these functions

## Inputs provided

- This dispatch's Background section (root cause + exact call sites already diagnosed)
- `src/ui/promptModal.ts` from `DSP-SCN-20260811-07` (land after or coordinate concurrently)

## Sequencing (coordinating BW note — reads across SCN + PLT)

Same root cause as `DSP-SCN-20260811-07` (SCN), split by file ownership per dispatch protocol.
**Prefer starting this after `DSP-SCN-20260811-07`'s `src/ui/promptModal.ts` exists** so you're
importing a finished, stable API rather than guessing its shape. If both must run concurrently,
agree the exact exported signature with BW first:
`promptModal(message: string, defaultValue?: string): Promise<string | null>` — build against that
assumption and it should not require rework once SCN's file lands.

## Acceptance criteria

- [x] `promptSaveAsMeta` and `promptIdName` use `promptModal` instead of `window.prompt`; both are
      `async`; all call sites updated
- [ ] **Verified in the actual Electron app** (not just a browser tab): Save as → id/name modals
      appear → new project id/name persists correctly — **worker launched Electron (boots OK);
      interactive GUI checklist left for BW/user** (see worker report)
- [ ] Rename and Duplicate (Project sidebar section) work end-to-end in Electron — same as above
- [x] Invalid id still shows the existing alert and aborts (id/name unchanged behavior)
- [x] `npm test` + `npm run build` green
- [x] Report explicitly states whether Electron was actually launched and tested, or gives BW/user
      a precise manual repro checklist if the worker's environment can't run Electron

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (**explicitly say whether you tested inside Electron**)
4. Follow-ups / blockers
5. Suggested memo bullets for PLT

## Worker paste block

```
You are WORKER(DSP-PLT-20260811-03-electron-prompt-fixes).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260811-03-electron-prompt-fixes.md (this file —
   root cause already diagnosed: Electron always throws on window.prompt(), see Background)
2. docs/agentic/dispatches/active/DSP-SCN-20260811-07-electron-prompt-modal.md (sibling — read its
   Sequencing section; import src/ui/promptModal.ts from it, don't reimplement)
3. src/main.ts (promptSaveAsMeta + call site ~line 776)
4. src/projects/projectManagerPanel.ts (promptIdName + call sites ~lines 219, 243)

Swap window.prompt() for the shared promptModal() utility in these two PLT-owned files so Save as
/ Rename / Duplicate work in the actual Electron app (window.prompt() throws there unconditionally
— it's not a UI bug, it's an uncaught exception). Verify in Electron if possible. Report back per
dispatch.
```
