# Project

Left rail **Race setup → Project**. Load and save race packs, and set the geographic origin (ENU 0, 0, 0).

Layout: [`ui-map.md`](./ui-map.md). Catalog: [`../studio-operator-manual.md`](../studio-operator-manual.md).

---

## Packs

A **pack** is the race file: fleet, world features, origin, calibration. Boot with no `?race=` loads pack **`empty`**. `?race=<id>` loads that pack (miss → warn, keep `config.json`).

| Control | What it does |
| --- | --- |
| Name (id) | Active pack |
| Race picker | List of packs. **Picking a row does not load** until **Load** |
| Custom **id…** | Type a pack id, then Load |
| **Load** | Load selected or typed pack |
| **Save** | Overwrite current pack |
| **Save as** | New id + name |
| **Export…** | Download `project.json` only (not the full venue pack) |
| **Pack ↓** | Download offline venue pack (`*-venue-pack.json`) + cache |
| **Pack ↑** | Load a venue pack file (hidden file picker) |

**air** role (`config.projectsRole` or `?projectsRole=air` / `?role=air`): **Save**, **Save as**, and Library **Upload…** are disabled. Load still works.

If `projectsApiBase` is set (project manager):

| Control | What it does |
| --- | --- |
| **Refresh** | Reload the API list |
| Show archived | Include archived packs |
| **Dup** | Duplicate a row |
| **Rename** | Rename a row |
| **Archive** / **Unarchive** | Hide / restore |

Without API: use Load / Save only.

---

## Origin

Fields **lat** / **lon** / **altMsl**. Istanbul demo default: `41.0082`, `28.9784`, `0`.

**Apply** (or Enter in a field) sets the world anchor. Everything in 3D — terrain, buildings, boats — is relative to this point. Invalid numbers → hint `invalid`. After Apply, hint returns to `ENU 0,0,0`.

World tool **Set anchor** writes the same origin.

`takeoffAltitudeMSL` (drone relative → HAE) lives in config only, not this panel.

---

## What to Save

Edits in Fleet, Assets, World, Calibration, and origin apply **immediately** in this session. **Save** (or Save as) writes them into the pack for next boot.

Related: [all panels](./README.md) · [Fleet](./fleet-live.md) · [World](./world-authoring.md) · [catalog](../studio-operator-manual.md)
