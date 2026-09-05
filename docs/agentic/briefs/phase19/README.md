# Phase 19 orchestrator briefs

**BW locked:** 2026-09-01  
**Design:** [`../../../architecture/phase19-senexus-qol.md`](../../../architecture/phase19-senexus-qol.md)  
**Roadmap:** [`../../../roadmap/phases-roadmap.md`](../../../roadmap/phases-roadmap.md) Phase 19

| File | Orchestrator |
| --- | --- |
| [`OUT_PHASE19.md`](./OUT_PHASE19.md) | OUT |
| [`CAL_PHASE19.md`](./CAL_PHASE19.md) | CAL |
| [`SCN_PHASE19.md`](./SCN_PHASE19.md) | SCN |
| [`PLT_PHASE19.md`](./PLT_PHASE19.md) | PLT |
| [`GEO_PHASE19.md`](./GEO_PHASE19.md) | GEO (parked provider) |
| [`TEL_PHASE19.md`](./TEL_PHASE19.md) | TEL |

Paste-ready chat starters: BW will give them in the BW session; they are also at the bottom of each brief.

## Rules for every Phase 19 orchestrator

1. Declare your role. **Plan and dispatch only.** No `src/` product code in this chat.
2. Read: `RULES.md`, `ORCHESTRATORS.md`, your charter, your `MEMO.md`, the architecture doc above, **your** brief.
3. Write a **short domain roadmap** in your memo (waves + proposed `DSP-…` ids). Then write **worker** dispatch files under `docs/agentic/dispatches/active/`.
4. Do **not** invent worker prompts in the orchestrator chat beyond the dispatch document the human pastes into a **new** worker chat.
5. Wrong domain → refuse, name the owner, offer a handoff. Do not silently do their work.
6. Update your memo after every dispatch issued and every worker report.

## After a worker reports back (mandatory script)

Tell the human **one** next action, in this order of preference:

1. **Test now** — if the slice is visible in Electron/OBS (exact clicks + what “good” looks like).
2. **Next worker (same orchestrator)** — paste the next `DSP-…` path if files are free.
3. **Open / return to orchestrator X** — if you are blocked or the next wave is another domain (name the brief).
4. **Return to BW** — phase gate, conflict, or Q5 terrain.

Do not start the next domain’s implementation. Do not say “we’re done” until your brief’s acceptance list is ticked or explicitly parked.

## Human open order (BW)

**Updated 2026-09-05:** SCN Phase 19 **Human Pass** (19.2b + 19.17). CAL / PLT idle. Do not send SCN a MapTiler worker.

1. **OUT** — NDI fps / 19.3 live proof (`HO-BW-OUT-20260905-01`)  
2. GEO only when the operator reopens terrain provider (Q5)  
3. TEL only if a new id-contract block appears  
4. SCN only if look-dev or Load is reopened
