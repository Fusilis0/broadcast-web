# Dispatch DSP-OUT-20260826-09-srt-id-catalog

## Meta
- From orchestrator: BW → OUT
- Worker role: WORKER(DSP-OUT-20260826-09-srt-id-catalog)
- Priority: P0
- Phase: Phase 17 follow-up — SRT id → URL catalog
- Design lock: `docs/architecture/ar-video-underlay-ntp-sync.md` L9 (amended 2026-08-26 pm)
- **Status: DONE** — worker complete + BW accepted 2026-08-26 (merged tree `npm test` **818 + 23**). Empty template → catalog 1–27 @ `49.13.20.49`. Electron `desktop/srtHelpers.cjs` redact still passphrase-only (log leak leftover).
- Do not touch decode, pose, NDI, or `videoBackground`.

## Goal

The operator still types an **SRT id** next to the telemetry id (UI unchanged). At Connect SRT, look that id up in a **hardcoded catalog** and open that URL. Stop requiring a shared `{srtId}` template.

User-supplied list used **91.98.150.21** on most rows; **BW lock: every host is `49.13.20.49`**. cam26 was already that host. Rest of path/token unchanged.

## Background

Today `buildSrtCallerUrl(template, srtId)` substitutes `{srtId}` into one template. Relays are not uniform: each camera has its **own token**. A template cannot express that.

List form (after IP rewrite), example id `18`:

```
srt://49.13.20.49:9000/publish:cam18:pub18:e8r4m3
```

ffmpeg/libsrt wants `streamid` as a **query** param, not a URL path. If you pass the slash form as-is, the relay never sees `publish:cam18:…` and the socket sits in connecting/error. **Load-bearing open URL:**

```
srt://49.13.20.49:9000?mode=caller&streamid=publish:cam18:pub18:e8r4m3
```

Keep **caller** (L3). “Listen” in the user note means consume that stream, not SRT `mode=listener`.

**Secrets:** these tokens are publish credentials. User asked them committed on this **private** studio repo (same class as the ion-token BW override). Never log the raw URL (`redactSrtUrl` must redact path-style `publish:…` tokens too). Do not print them in README examples.

## Catalog (copy exactly — host already rewritten)

| id | streamid |
| --- | --- |
| 1 | `publish:cam1:pub1:k3q9x7` |
| 2 | `publish:cam2:pub2:m8t2c4` |
| 3 | `publish:cam3:pub3:r7n1b5` |
| 4 | `publish:cam4:pub4:z2h8d6` |
| 5 | `publish:cam5:pub5:p4v9e1` |
| 6 | `publish:cam6:pub6:s6j3k8` |
| 7 | `publish:cam7:pub7:n1w5m2` |
| 8 | `publish:cam8:pub8:b9c2t7` |
| 9 | `publish:cam9:pub9:h5l4q3` |
| 10 | `publish:cam10:pub10:d8f1g6` |
| 11 | `publish:cam11:pub11:q2w8r4` |
| 12 | `publish:cam12:pub12:v7k3p9` |
| 13 | `publish:cam13:pub13:t6c1z5` |
| 14 | `publish:cam14:pub14:m4s9h2` |
| 15 | `publish:cam15:pub15:y3n7d8` |
| 16 | `publish:cam16:pub16:a9l2x6` |
| 17 | `publish:cam17:pub17:c5b1t9` |
| 18 | `publish:cam18:pub18:e8r4m3` |
| 19 | `publish:cam19:pub19:j1q6v2` |
| 20 | `publish:cam20:pub20:k7h9p1` |
| 21 | `publish:cam21:pub21:u2d5n7` |
| 22 | `publish:cam22:pub22:w3x8l4` |
| 23 | `publish:cam23:pub23:r9t2g6` |
| 24 | `publish:cam24:pub24:z4m7c1` |
| 25 | `publish:cam25:pub25:p6v3k8` |
| 26 | `publish:cam26:pub26:n8h1s4` |
| 27 | `publish:cam27:pub27:b2j9q5` |

Host always `49.13.20.49`, port `9000`. **No cam 28+ and no cam 30** in this list — unknown id → clear error, do not invent a URL.

Id match: trim; accept `"18"` and `"cam18"` as the same row (strip a leading `cam` / `CAM` if the remainder is the catalog key). `"1"` must not match cam10.

## In scope

1. New `src/output/srtStreamCatalog.ts` (or extend `srtCallerUrl.ts` if you can keep it small):
   - `SRT_RELAY_HOST = '49.13.20.49'`, `SRT_RELAY_PORT = '9000'`
   - Map id → streamid string from the table above
   - `resolveSrtUrlForId(srtId): SrtCallerUrlResult` → caller URL with `streamid` query + `mode=caller`
   - Unknown / empty id → `{ ok: false, error }` that names the id
2. Wire Connect SRT (`fleetLivePanel.ts` `applySrt`): **catalog first**. Do not require `srtUrlTemplate`. Keep the template field in the UI (frontend stays) as an **optional override**: if the template is non-empty, today’s `buildSrtCallerUrl(template, srtId)` still wins (escape hatch). Empty template → catalog only.
3. `redactSrtUrl`: redact the last colon-segment of `streamid` **and** of a pathname that looks like `publish:camN:pubN:token`. Tests for id 18 → host 49.13.20.49, streamid `publish:cam18:pub18:e8r4m3`, token not present in `redactSrtUrl` output.
4. Tests: every catalog id resolves; 18 is the fixture above; unknown `30` fails; `cam18` ≡ `18`; host is never `91.98.150.21`.
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

- [ ] SRT id `18`, empty template → open URL host `49.13.20.49`, port `9000`, query `streamid=publish:cam18:pub18:e8r4m3`, `mode=caller`.
- [ ] No `91.98.150.21` anywhere in `src/`.
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
