# Dispatch DSP-OUT-20260902-05-ndi-pbo-bind-spy

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260902-05-ndi-pbo-bind-spy)
- Priority: P0
- Phase: Send checked must send — PBO from the FBO Three actually binds
- Related: `done/DSP-OUT-20260902-04-ndi-send-when-checked.md` · `HO-OUT-BW-20260902-07`
- Status: **Human Pass 2026-09-02.** Operator parked 30×3 / three-on preview ~11. Next OUT fps is later OUT/PRF (BW).
- Product: **Send checked ⇒ send.** v1 still AR+3D+2D. Not 30×3. Not skip-forever. Not `fallToSync` as live path.

## Goal

Live Electron AR/3D must send when Send is checked. Spy `gl.bindFramebuffer` for the DRAW FBO Three binds; PBO that handle. Keep hitch wins. Never pack the default canvas FB.

## Human result (2026-09-02)

No yellow banner on any row.

| NDI | Preview | Send |
| --- | --- | --- |
| All off | **60** | — |
| 3D only | ~**30** | **20–25** live |
| AR only | ~**30** | **17–20** live |
| 2D only | **60** | **10** |
| Three on | **11–12** (not this gate; operator parked) | AR **14** · 3D **14** · 2D **5** · Status **live** |

Send-when-checked **Pass**. Hitch-not-~15 **Pass**. Banner **Pass**. 30×3 leftover parked by operator.

## Worker report (code)

Wrap `gl.bindFramebuffer` once on the context + during `begin`’s `setRenderTarget`. PBO READ from last non-null DRAW bind. Suite **1065 + 23**.
