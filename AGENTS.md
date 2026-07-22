# Agent instructions — broadcast-web

This repository uses a **multi-orchestrator agentic workflow**.

## If you are unsure who you are

Ask the user which role this chat is:

`BW` | `TEL` | `GEO` | `SCN` | `OUT` | `CON` | `CAL` | `PLT` | `WORKER`

Then open the matching bootstrap under `docs/agentic/dispatches/BOOTSTRAP_*.md` or the worker’s `DSP-*.md`.

## Canonical docs

| Doc | Path |
| --- | --- |
| Agentic overview | `docs/agentic/README.md` |
| Hard rules | `docs/agentic/RULES.md` |
| Registry | `docs/agentic/ORCHESTRATORS.md` |
| Architecture | `docs/architecture/system-architecture.md` |
| Roadmap | `docs/roadmap/phases-roadmap.md` |

## Hard constraint

Orchestrators **never** implement product code. Workers do, in new chats, from dispatches.
