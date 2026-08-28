# Agentic Development System — broadcast-web

English-only operating manual for multi-session Cursor development.

## Roles

| Role | Does | Does not |
| --- | --- | --- |
| **BW — Broadcast-Web Master Orchestrator** | Own roadmap, architecture, cross-domain routing, approve phase gates | Write app feature code |
| **Domain orchestrator** (`TEL` `GEO` `SCN` `OUT` `CON` `CAL` `PLT` `PRF` `SRT`) | Own domain plan, write worker dispatches, handoffs, update `MEMO.md` | Implement code in the orchestrator chat |
| **Worker** | Execute exactly one dispatch (code, tests, assets) | Expand scope; act as another orchestrator |

## Session types

1. **Orchestrator session** — separate Cursor chat. Sticky context = that orchestrator’s rule + charter + memo.  
2. **Worker session** — new chat created by the human from a dispatch file. Implements, then reports back via handoff notes.

Orchestrators **never** implement. When work is needed, they produce a **dispatch** for a new worker chat.

## Core files

```
docs/agentic/
  README.md                 ← this file
  RULES.md                  ← hard rules for all agents
  ORCHESTRATORS.md          ← registry + full names
  DISPATCH_PROTOCOL.md
  HANDOFF_PROTOCOL.md
  BW_ORCHESTRATOR.md
  orchestrators/            ← per-domain charters
  memos/                    ← compaction-safe memory
  dispatches/               ← paste-ready bootstrap + templates
docs/architecture/
  system-architecture.md
docs/roadmap/
  phases-roadmap.md
.cursor/rules/              ← always-on Cursor rules
```

## Wrong-domain protocol

If a dispatch or user request is **outside** this session’s domain:

1. **Stop** — do not implement.
2. Tell the user: wrong orchestrator / wrong worker type.
3. Name the correct orchestrator ID and suggest a handoff or re-dispatch.
4. Optionally draft a handoff stub for BW or the target orchestrator.

## Compaction survival

Before any long break or when context feels thin:

1. Read your `docs/agentic/memos/<ID>_MEMO.md`.
2. Read `ORCHESTRATORS.md` + your charter.
3. Update the memo with: current goal, decisions, open dispatches, blockers, last handoff IDs.

## How a piece of work flows

```
User / need
    → BW (route, prioritize)
        → Domain orchestrator (plan)
            → Worker dispatch (new chat)
                → Worker implements
                    → Handoff report
                        → Domain memo update
                            → BW memo / roadmap tick
```

## Bootstrap order (greenfield)

1. Open **BW** chat with [`dispatches/BOOTSTRAP_BW.md`](./dispatches/BOOTSTRAP_BW.md).  
2. Open domain orchestrators as needed with their `BOOTSTRAP_<ID>.md`.  
3. First implementation wave: **PLT** (scaffold) → **GEO** + **TEL** → **SCN** → others. Open **PRF** when fps / hitch work starts. Open **SRT** when DJI SRT ingest work starts (`BOOTSTRAP_SRT.md`).
