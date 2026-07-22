# Dispatch Protocol

A **dispatch** is an order from an orchestrator to a **new worker Cursor chat**.

## ID format

`DSP-<ORCH>-<YYYYMMDD>-<nn>-<slug>`

Example: `DSP-GEO-20260722-01-egm96-port`

## Required sections

```markdown
# Dispatch <ID>

## Meta
- From orchestrator: <ID>
- Worker role: WORKER(<ID>)
- Priority: P0 | P1 | P2
- Phase: <roadmap phase>
- Related handoffs: <HO-… or none>

## Goal
<one paragraph>

## Background
<links to architecture / Unity reference paths / prior decisions>

## In scope
- …

## Out of scope
- … (explicit)

## Likely files
- …

## Inputs provided
- config, fixtures, asset paths, …

## Acceptance criteria
- [ ] …
- [ ] …

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for <ORCH>
```

## Rules for issuers (orchestrators)

1. Prefer smallest dispatch that delivers a testable slice.
2. Never issue a dispatch that crosses two owners without splitting or a coordinating BW note.
3. Save important dispatches under `docs/agentic/dispatches/active/` (optional archive in `done/`).
4. Update your memo: “Issued DSP-…”

## Rules for workers

1. Paste the full dispatch at chat start; declare `WORKER(DSP-…)`.
2. Implement only in-scope items.
3. If you discover wrong domain work, stop and tell the user to return to the orchestrator.
4. Do not open new architectural debates — escalate via report-back.
5. Do not edit other orchestrators’ memos; suggest bullets only.
