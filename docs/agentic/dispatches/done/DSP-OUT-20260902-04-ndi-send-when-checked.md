# Dispatch DSP-OUT-20260902-04-ndi-send-when-checked

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260902-04-ndi-send-when-checked)
- Priority: P0
- Phase: Send checked must send — AR/3D PBO pack, not skip-forever
- Related: `done/DSP-OUT-20260902-03-ndi-hitch-skip-not-sync.md` · `HO-OUT-BW-20260902-05`
- Status: **Human 2026-09-02 Fail** — live still `live · no send` / OBS black on AR+3D. Stub packed; live Three does not expose `__webglTexture`. Next: `DSP-OUT-20260902-05-ndi-pbo-bind-spy`.
- Product: **Send on NDI checked ⇒ that channel sends.** Skip is one missed tick, not a black plate. v1 still **AR + 3D + 2D**. This slice is **not** 30×3.

## Goal

When the operator checks **Send** on AR or 3D, frames must leave the native sender: HUD **Send** is a moving number, OBS is **not** black. Keep the hitch wins from 02-03. **Do not** bring back `fallToSync` / `readRenderTargetPixels` as the always-on live path.

## Human result (2026-09-02)

| NDI | Result |
| --- | --- |
| All Send off | **Pass** — no banner, preview **60** |
| 3D only | **Fail send** — `live · no send`, Send **0**, preview ~**30**. No banner. |
| AR only | Same as 3D |
| 2D only | **Pass** — Send **10**, preview **60** |
| Three on | Not this gate — preview **9–10**; AR/3D no send / OBS black; 2D Send **1–2** |

No yellow banner (skip, not sync). Texture-attach PBO never ran live — Three r178 does not hang `__webglTexture` / public FBO on the objects we query. Worker predicted this blocker. Do **not** restore skip-forever or `beginSync`.

## Worker report (code)

PBO via owned READ FBO + RT color texture when public FBO/DRAW are null. Electron stub packs; `syncReads === 0`; no `function fallToSync`. Suite **1063 + 23**.
