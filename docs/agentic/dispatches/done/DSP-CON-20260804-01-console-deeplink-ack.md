# Dispatch DSP-CON-20260804-01-console-deeplink-ack

## Meta
- From orchestrator: BW → CON (Phase 10.2 / was 3.6)
- Worker role: WORKER(DSP-CON-20260804-01-console-deeplink-ack)
- Priority: P1
- Phase: Phase 10 — Cutover & console
- Related: `docs/contracts/console-deeplink.md`, SPA parser
- **Status: DONE** — SPA ack pack shipped 2026-08-04; console-team emit still pending

## Goal

Close the **console deep-link** loop: confirm SPA contract is still accurate; produce a short **ack pack** the console team can implement (example URLs for race load, mode, origin, air role); note any gaps.

## Background
- SPA parser exists (`parseConsoleDeeplink` / apply).
- Console team has not formally acked emitting URLs.

## In scope
1. Re-read contract + SPA implementation; fix docs if drifted.
2. Example URL matrix (editor load, air `?role=air`, race id, origin overrides).
3. Optional tiny SPA fixes if contract/docs mismatch (no new auth product).
4. Handoff note for console team (`docs/agentic/handoffs/HO-CON-console-team-*.md` or contract appendix).
5. CON_MEMO update.

## Out of scope
- Implementing changes inside the console repo (unless available — then separate)
- NDI smoke / Unity cutover
- Hetzner

## Acceptance criteria
- [x] Contract + examples ready for console team
- [x] SPA/docs aligned
- [x] CON_MEMO lists ack status (pending console / done)

## Worker report (2026-08-04)

### Summary
Aligned `docs/contracts/console-deeplink.md` with SPA boot (`config` → race pack → CON overrides; PLT `role` companion). Added example URL matrix + console-team handoff. Tiny SPA fix: unsafe `race` ids warn + omit (matches `isSafeRaceId`). Formal console emit still **pending**.

### Files touched
- `docs/contracts/console-deeplink.md`
- `docs/agentic/handoffs/HO-CON-console-team-20260804-01.md`
- `docs/agentic/memos/CON_MEMO.md`
- `src/console/parseConsoleDeeplink.ts` (+ test)
- `src/console/README.md`
- Roadmap / dispatches index notes

### Tests
- `npm test -- src/console/parseConsoleDeeplink.test.ts` (expected green)

### Gaps / follow-ups
- Console team must ack emit (open questions in contract)
- `/overlay` host document still PLT deploy
- No console-repo changes (out of scope)

### Suggested CON / BW memo bullets
- 10.2 SPA side done; ack status **Pending console**
- Handoff: `HO-CON-console-team-20260804-01`
- Gate to **stable** after console + CON + BW agreement

## Worker paste block

```
You are WORKER(DSP-CON-20260804-01-console-deeplink-ack).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-CON-20260804-01-console-deeplink-ack.md
2. docs/contracts/console-deeplink.md
3. src/console/*
4. docs/roadmap/phases-roadmap.md Phase 10.2

Align contract + SPA; ship example URL ack pack for console team. No NDI, no Unity cutover code.
Report back per dispatch.
```
