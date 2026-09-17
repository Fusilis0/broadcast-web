# Flow

Right rail **Broadcast → Flow**. Per-entity **telemetry** and **SRT** JSON so you can see whether packets actually arrived.

Does not draw WebGL. Polls at most 4 Hz. Default **off**.

---

## Controls

| Control | What it does |
| --- | --- |
| **Live JSON** | Start/stop polling. Session `bw.flowPanel.liveJson` |
| Card ▸ / ▾ | Expand / collapse that id |
| **Pop out** / **Dock** | Float the card on the overlay, or put it back |

Each card: id, kind badge, **Telemetry** JSON, **SRT** JSON (or `null` / `no stream`). Empty list: *No entities yet (fleet empty and tap idle).*

Registry boats/POVs keep a card even when disconnected. Extra ids from the tap stay only while fresh (~5 s).

SRT URLs in the dump are redacted (no stream tokens).

Related: [all panels](./README.md) · [Fleet](./fleet-live.md) · [catalog](../studio-operator-manual.md)
