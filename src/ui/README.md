# ui

Shared DOM chrome that is **not** scene-specific (overlays usable from SCN, PLT, etc.).

## `promptModal`

```ts
import { promptModal } from './promptModal.ts'

const value = await promptModal('Boat id', '')
if (value === null) {
  // cancelled — same as native window.prompt Cancel
}
```

**Why:** Electron always throws on `window.prompt()` (`prompt() is not supported.`). `alert` /
`confirm` still work; only `prompt` is broken. This overlay is plain DOM (no Electron IPC) so it
works in the SPA tab and the studio Electron shell.

**Semantics:** OK / Enter → input string (raw, like native); Cancel / Escape / backdrop → `null`.
Message text preserves `\n` via `white-space: pre-wrap`. The value field is a real `<input>` so
existing editor `isTextInputTarget` guards ignore Enter/Delete while typing.
