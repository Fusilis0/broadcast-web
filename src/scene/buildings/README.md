# buildings

Cesium **OSM Buildings** (ion asset **96188**) as a second `TilesRenderer` in the Three.js scene. Batched 3D Tiles city massing — not World Terrain, not CesiumJS, not Google Photorealistic.

Same ion token, `ReorientationPlugin` origin (`amslToHae` + 180° azimuth), opaque-clear gate, lock-tiles, and altitude nudge as `src/scene/terrain/`. Own VRAM budget (`UnloadTilesPlugin` **256 MiB**). **No** `QuantizedMeshPlugin`, Bing overlay, or watermask. Buildings path registers `GLTFExtensionsPlugin({ rtc: true })` (b3dm/glTF + `CESIUM_RTC`), sets `loadSiblings = false` and `errorTarget = 16` for the ADD+REGION globe, and skips occupancy shader patch when holes are `[]`.

**DSP-01 Human Fail:** checkbox on, terrain heights + aerial only — no extruded boxes. Root cause mix: 3DTILES load path had no GLTF RTC plugin, globe ADD queued siblings, occupancy `onBeforeCompile` ran even with empty holes (could break fade shaders). Follow-up DSP-03.

Ops: Environment **buildings** checkbox, default **on** (`bw.buildings.enabled`). Hidden on transparent/chroma AR. Credits merge into the existing 3D DOM overlay (ODbL fallback **© OpenStreetMap contributors**). Status: `Buildings: on · tiles N` / `ion load failed`. `setOccupancyHoles({x,z,radiusM}[])` clips ENU disks for hero glTF (DSP-02); empty default does not hide the city.
