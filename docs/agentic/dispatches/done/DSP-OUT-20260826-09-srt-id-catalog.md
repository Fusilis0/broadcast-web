# Dispatch DSP-OUT-20260826-09-srt-id-catalog

## Meta
- From orchestrator: BW → OUT
- Worker role: WORKER(DSP-OUT-20260826-09-srt-id-catalog)
- Priority: P0
- Phase: Phase 17 follow-up — SRT id → URL catalog
- Design lock: `docs/architecture/ar-video-underlay-ntp-sync.md` L9 (amended 2026-08-26 pm)
- **Status: DONE** — worker complete + BW accepted 2026-08-26 (merged tree `npm test` **818 + 23**). Empty template → catalog 1–27 @ `127.0.0.1` (placeholder tokens). Electron `desktop/srtHelpers.cjs` redact still passphrase-only (log leak leftover).
- Do not touch decode, pose, NDI, or `videoBackground`.

## Goal

The operator still types an **SRT id** next to the telemetry id (UI unchanged). At Connect SRT, look that id up in a **hardcoded catalog** and open that URL. Stop requiring a shared `{srtId}` template.

User-supplied list used mixed public hosts; **BW lock: git catalog host is `127.0.0.1`**. Live relay host + tokens stay out of git (Fleet `{srtId}` template).

## Background

Today `buildSrtCallerUrl(template, srtId)` substitutes `{srtId}` into one template. Relays are not uniform: each camera has its **own token**. A template cannot express that.

List form, example id `18`:

```
srt://127.0.0.1:9000/publish:cam18:pub18:example
```

ffmpeg/libsrt wants `streamid` as a **query** param, not a URL path. If you pass the slash form as-is, the relay never sees `publish:cam18:…` and the socket sits in connecting/error. **Load-bearing open URL:**

```
srt://127.0.0.1:9000?mode=caller&streamid=publish:cam18:pub18:example
```

Keep **caller** (L3). “Listen” in the user note means consume that stream, not SRT `mode=listener`.

**Secrets:** live tokens are session credentials. Do not commit them. Never log the raw URL (`redactSrtUrl` must redact path-style `publish:…` tokens too). Do not print live tokens in README examples.

## Catalog (git placeholder)

| id | streamid |
| --- | --- |
| 1–27 | `read:camN:pubN:example` |

Host always `127.0.0.1`, port `9000`. **No cam 28+ and no cam 30** in this list — unknown id → clear error, do not invent a URL. Live host + per-cam tokens go in the Fleet `{srtId}` template, not this table.

Id match: trim; accept `"18"` and `"cam18"` as the same row (strip a leading `cam` / `CAM` if the remainder is the catalog key). `"1"` must not match cam10.

## In scope

1. New `src/output/srtStreamCatalog.ts` (or extend `srtCallerUrl.ts` if you can keep it small):
   - `SRT_RELAY_HOST = '127.0.0.1'`, `SRT_RELAY_PORT = '9000'`
   - Map id → streamid string from the table above
   - `resolveSrtUrlForId(srtId): SrtCallerUrlResult` → caller URL with `streamid` query + `mode=caller`
   - Unknown / empty id → `{ ok: false, error }` that names the id
2. Wire Connect SRT (`fleetLivePanel.ts` `applySrt`): **catalog first**. Do not require `srtUrlTemplate`. Keep the template field in the UI (frontend stays) as an **optional override**: if the template is non-empty, today’s `buildSrtCallerUrl(template, srtId)` still wins (escape hatch). Empty template → catalog only.
3. `redactSrtUrl`: redact the last colon-segment of `streamid` **and** of a pathname that looks like `publish:camN:pubN:token`. Tests for id 18 → host 127.0.0.1, streamid `read:cam18:pub18:example`, token not present in `redactSrtUrl` output.
4. Tests: every catalog id resolves; 18 is the fixture above; unknown `30` fails; `cam18` ≡ `18`; host is never a production VPS IP.
5. One line in `src/output/README.md` and L9 in the architecture doc.

## Out of scope

- Decoder, pose, NDI, Electron ffmpeg argv (already `-c copy` + merge `streamid`)
- Changing SRT id UI / Vid checkbox / cap 4
- Adding cam 28–30 unless they appear in this table
- SRT `mode=listener`

## Likely files

- `src/output/srtStreamCatalog.ts` (+ test, new) **or** `srtCallerUrl.ts` (+ test)
- `src/scene/fleetLivePanel.ts` (`applySrt` compose path)
- `src/output/index.ts`, `README.md`
- `docs/architecture/ar-video-underlay-ntp-sync.md` L9
- Fleet panel test if it currently asserts the old `{srtId}` template compose

## Acceptance criteria

- [ ] SRT id `18`, empty template → open URL host `127.0.0.1`, port `9000`, query `streamid=read:cam18:pub18:example`, `mode=caller`.
- [ ] No production VPS IPs anywhere in `src/`.
- [ ] Unknown id (e.g. `30`) does not open; status explains missing catalog entry.
- [ ] Empty SRT id still skips (existing).
- [ ] Non-empty template still composes as today (escape hatch).
- [ ] `redactSrtUrl` never includes the raw token.
- [ ] `npm test` + `npm run build` green.

## Report back
1. Summary (lookup + path→streamid)
2. Files touched
3. Tests / how verified — include the exact href for id 18 with token redacted
4. Follow-ups
5. Suggested OUT memo bullets
