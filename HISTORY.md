# History

Notable changes, newest first. Dates are commit dates. Short hashes refer to the current `master`.

## 2026-09-10

- Docs are bilingual now: `README.md` is English, `README.ko.md` is Korean. Both are kept in sync; the code blocks are identical in each.
- Doc review against `scripts/inspector.js` corrected four points that had drifted:
  - the `?ui=1` / `?ui=0` URL gate is handled by the autoload loader snippet, not by the injected script (the script never reads `location.search`)
  - `Ctrl+Shift+U` inside the script toggles an already-injected overlay; cold start from the shortcut needs the loader's key listener
  - the public API also exposes the `selections` and `annotations` getters, which the docs omitted
  - the annotation `url` field is `location.pathname`, and `page` coordinates are page-space rects
- Added this history file.

## 2026-09-09

- Repository went **public** under MIT.
- History rewritten twice, so every commit hash changed. Anyone with an older clone should re-clone.
  - `CLAUDE.md` removed from every commit and untracked; it stays local only.
  - Commit author and committer addresses normalized to a single personal address.
  - `Co-Authored-By` / `Claude-Session` trailers stripped from all commit messages.
- `.gitignore` removed from the repository; ignore rules moved to `.git/info/exclude` so the tree stays down to the four files that matter (`LICENSE`, `README.md`, `SKILL.md`, `scripts/`). `4cec099`

## 2026-09-08

- **Fix: annotations could not be typed while a modal was open.** `438b5a9`

  Modal libraries (MUI, Bootstrap, Radix, focus-trap) watch `focusin` / `focusout` at the document level and pull focus back into the dialog. The Comment panel's textarea lives outside the dialog, so every keystroke went to the modal's own input instead. The overlay now intercepts focus events at the window capture phase and stops propagation when the overlay is involved, which runs before any document-level trap. Verified with Playwright against three trap styles: document `focusin`, `focusout` + `relatedTarget`, and window capture.

## 2026-09-01

- **v0.1** — inspector overlay with Indicator and Comment modes, the AI-readable contract (`window.__uiSelections`, `window.__uiAnnotations`, `Copy Prompt`), and the autoload guide. `47732ec`
- **Glass pane input model.** `3f8954a` A transparent full-viewport layer takes every mouse event and resolves the target by coordinates, so disabled buttons and open dropdowns can be selected too. Wheel events are forwarded to the nearest scrollable ancestor to avoid double scrolling.
- Toolbar labels settled on text buttons: `Indicator · Comment · Copy Prompt · ✕`. `80a301e` `2653ca7` `adeada9`
- Autoload guides for webpack, Next.js, Express, Flask, and FastAPI, restructured around one shared gate snippet instead of repeating it per stack. `efcb7ef` `8b4735c`
