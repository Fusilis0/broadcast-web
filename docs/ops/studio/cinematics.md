# Cinematics

Right rail **Broadcast → Cinematics**. Fly a pre-authored camera sequence (tile warm + optional silent MP4). Not SRT, not NDI.

---

## Controls

| Control | What it does |
| --- | --- |
| **sequence** | **Off (race view)** · intro-bosphorus (~72 s) · `_empty` fixture |
| **Play** | GPU-uploads tiles for the sequence camera (disk cache ≠ skip GPU). Status `tiles: warming` → `tiles: warm`. Then plays |
| **Pause** | Pause transport |
| **Record** | Electron silent **1080p30 MP4** (file for vMix). Not program out |
| **Save tile list** | Download sequence JSON with `tileWarm.contentUrls` (IDs, not binaries) |
| Scrub + time | Seek |

Selecting **Off** returns to race view and restores Environment **lock tiles** if cinematic had forced a lock.

No ion token → warm skipped. Boot does **not** auto-warm; **Play** still warms.

While cinematic is active, race chrome (boats / course) can hide.

Related: [all panels](./README.md) · [Environment](./environment.md) · [catalog](../studio-operator-manual.md)
