# Telemetry replay fixtures

JSON fixtures for `telemetryMode: "replay"`. Format v1 is documented in `src/telemetry/README.md`.

| Fixture | Contents |
| --- | --- |
| [`spine-demo.json`](./spine-demo.json) | Drone `1` + boat `21` near Istanbul (~3 s, looping). **Default** `replayUrl`. |
| [`spine-fleet.json`](./spine-fleet.json) | Drone `1` + boats `21–24` + `stream_anchor` (~1.6 s, looping). Multi-id / SCN fleet-registry tests. |
| [`spine-pov.json`](./spine-pov.json) | Drones `1` + `2` (default `povIds`) + boat `21` + `stream_anchor` (~1.2 s, looping). Multi-POV / SCN camera-switch tests. |

Point `replayUrl` at `spine-fleet.json` when exercising multi-boat replay, or `spine-pov.json` for multi-POV; leave the committed default as `spine-demo` unless switching is intentional.
