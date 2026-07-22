# Handoff Protocol

A **handoff** is orchestrator-to-orchestrator (or worker→orchestrator) communication. It is **not** permission to implement in the receiving orchestrator chat.

## ID format

`HO-<FROM>-<TO>-<YYYYMMDD>-<nn>`

Example: `HO-TEL-GEO-20260722-01`

## Template

```markdown
# Handoff HO-<FROM>-<TO>-<date>-<nn>

## From → To
<FROM_ID> → <TO_ID>

## Type
request | FYI | blocker | contract-change | completed-worker-summary

## Summary
<2–4 sentences>

## Decisions / facts
- …

## Asks of receiver
- [ ] …

## Artifacts
- paths, DSP IDs, URLs, fixture names

## Urgency
P0 | P1 | P2
```

## Rules

1. Receiver updates `memos/<TO>_MEMO.md` and may issue worker dispatches — **does not code**.
2. Contract changes (WS schema, ENU axes, URL params) must CC **BW** (FYI handoff or mention in BW memo).
3. If ownership is unclear: hand off to **BW** as `HO-*-BW-*`.
