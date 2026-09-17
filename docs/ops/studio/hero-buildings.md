# Hero buildings

Left rail **Race setup → Hero buildings**. Per-landmark pose for the Istanbul catalogue meshes (Maiden’s Tower, Galata, mosques, palaces, three bridges, …).

Master on/off is **[Environment](./environment.md) → heroes**. This panel has **no** per-building Hide. Uncheck Environment **heroes** to hide **all** landmark meshes (OSM occupancy holes under them restore).

3D dress is gated **off** when AR output is transparent/chroma. The SRT **AR** plate never draws heroes.

---

## Per landmark

| Control | Default | What it does |
| --- | --- | --- |
| **Focus** | — | Frame ops free cam on that hero |
| Texture chip | read-only | What the mesh is wearing (gltf / proxy / no image) |
| **X Y Z** | 0 | East / up / −North metres from catalogue GPS |
| **yaw pitch roll** | 0 | Degrees |
| **scale** | 1 | Uniform |

Nudges auto-save locally (`bw.landmarks.offsets`). **Project Save** embeds offsets when Electron/API can write.

---

## Catalogue (not editable here)

GPS in the catalogue are public starting points, not a survey. `altMsl` is 0. You offset from that with XYZ / rotation / scale.

Includes: Maiden’s Tower, Galata Tower, Rumeli Hisarı, Hagia Sophia, Sultan Ahmed, Topkapı, Süleymaniye, Hagia Irene, Dolmabahçe, Çırağan, 15 July Martyrs Bridge, Fatih Sultan Mehmet Bridge, Yavuz Sultan Selim Bridge.

Related: [all panels](./README.md) · [Environment](./environment.md) · [catalog](../studio-operator-manual.md)
