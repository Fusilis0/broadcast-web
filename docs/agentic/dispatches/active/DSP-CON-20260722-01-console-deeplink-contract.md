# Dispatch DSP-CON-20260722-01-console-deeplink-contract

## Meta
- From orchestrator: CON
- Worker role: WORKER(DSP-CON-20260722-01-console-deeplink-contract)
- Priority: P1
- Phase: Phase 0 — Foundations (console bridge design; integrate later)
- Related handoffs: none

## Goal

Expand `docs/contracts/console-deeplink.md` into a clear **proposed** URL / query-param contract that the console team can negotiate against. Documentation only — no SPA parser, no console repo access.

## Background

- Architecture: `docs/architecture/system-architecture.md` §5.4 (proposed shape), §6 (web console external), §7 (token validation later)
- Charter: `docs/agentic/orchestrators/CON_Console_Bridge_Orchestrator.md`
- A thin DRAFT stub already exists at `docs/contracts/console-deeplink.md` — **replace/expand it**, do not leave a one-page sketch
- Constraint (BW/RULES): console repository is discussion-only; **do not** clone, pull, or modify console code
- Telemetry mode values should stay aligned with PLT config stubs: `mock` | `replay` | `live` (default `mock` until live)
- Path in architecture example: `/overlay?...`

## In scope

1. **Rewrite** `docs/contracts/console-deeplink.md` as a proper draft contract including at least:
   - Status banner: Draft / not negotiated; owner CON; console repo not in scope
   - Intent (console button → opens broadcast-web overlay, same or new tab)
   - Canonical URL template matching architecture §5.4 (path `/overlay`, query params listed below)
   - Parameter table: name, required/optional, type, allowed values, default, notes
   - Explicit params (minimum set):
     - `race` — race / event id (recommended)
     - `token` — opaque auth handoff (TBD with console team; do not invent JWT claims)
     - `mode` — `mock` | `replay` | `live` (default `mock`)
     - `originLat` / `originLon` — optional georef override (degrees); note interaction with `public/config.json` `origin` as “URL wins when present” (design intent only)
   - Optional reserved params (document as future / negotiable, not required for V0): e.g. `outputMode` preview|chroma, `originAltMsl` — mark clearly as non-binding
   - Open questions for console team (token format, expiry, race id namespace, same-tab vs new-tab, CORS/postMessage later)
   - Explicit non-goals: no console UI, no auth server, no `postMessage` protocol in this doc beyond a one-line “later” pointer
   - Versioning note: document is proposed; breaking changes require CON + BW ack before claiming stable

2. Keep English; keep tone suitable to hand to another team.

## Out of scope

- Any code under `src/` (parser stub is a later CON+PLT dispatch)
- Cloning or reading the console repository
- Implementing auth validation
- Changing `system-architecture.md` (if §5.4 conflicts with a justified improvement, note it in report-back for CON/BW — do not edit architecture in this dispatch)
- `postMessage` / status-event full design (future CON dispatch)
- Unity / Three / telemetry / scene work

## Likely files

- `docs/contracts/console-deeplink.md` (primary)

## Inputs provided

- Workspace: `C:\Users\PC\Documents\GitHub\broadcast-web`
- Existing stub: `docs/contracts/console-deeplink.md`
- Architecture §5.4 URL sketch
- No console team contact yet — leave negotiation fields as open questions

## Acceptance criteria

- [ ] `docs/contracts/console-deeplink.md` is a self-contained proposed contract (not a stub)
- [ ] Parameter table covers `race`, `token`, `mode`, `originLat`, `originLon` with defaults/optionality
- [ ] `mode` values are `mock` | `replay` | `live`
- [ ] Status clearly says Draft / not negotiated; no claim of console-team agreement
- [ ] No secrets, sample JWTs, or live host URLs with credentials
- [ ] No `src/` or console-repo changes
- [ ] Open questions section present for the other team

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (doc review checklist vs acceptance)
4. Follow-ups / blockers (especially anything that needs BW or TEL/GEO alignment)
5. Suggested memo bullets for CON

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-CON-20260722-01-console-deeplink-contract).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-CON-20260722-01-console-deeplink-contract.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/architecture/system-architecture.md §5.4
4. docs/contracts/console-deeplink.md (existing stub)

Implement in scope only. Report back per the dispatch.
```
