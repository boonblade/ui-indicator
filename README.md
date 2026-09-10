# ui-indicator

*[한국어 문서](README.ko.md)*

A dev-tools-style inspector overlay you inject into any page. Point at a screen element to get its **unique selector**, or leave **annotations** that an AI coding tool (Claude Code and friends) reads and acts on.

> Instead of "shrink the image on the right side of the right panel" — click the element and say "shrink this". The AI knows exactly which node you mean.

One pure-DOM script (`scripts/inspector.js`). No framework assumptions, no build step, no dependencies. It never modifies the page source; everything it adds is overlay-only and tagged `data-uiind`.

## Features

- **Indicator mode**: hover outlines an element and shows its unique selector; click opens the property panel.
  - **NAME**: element name, kind badge (ID/CLASS/TESTID/TAG), full selector path, copy-selector / copy-JSON buttons
  - **DESIGN TERM**: role auto-detection across 12 kinds (BUTTON, LINK, INPUT, LABEL, IMAGE, HEADING, NAV, TABLE, LIST, TEXT, CARD, CONTAINER) with a one-line description
  - **SPEC**: tag and size, classes, text, computed-style table
- **Comment mode**: select many elements by clicking (click again to deselect) or by **dragging a region** (only the top-most elements fully inside the rectangle). Write a note in the "N elements selected" panel, press **Add**, and each element gets a numbered badge. Click a badge to delete that annotation.
- **Unique selectors**: `id` > `data-testid` > class + `:nth-of-type`, walking up only as far as needed to be unique in the document. Stays unambiguous in utility-class codebases.
- **AI-readable state**: selections and annotations accumulate on `window.__uiSelections` / `window.__uiAnnotations` for an AI to read directly. `Copy Prompt` turns the annotations into a ready-to-paste instruction.
- **Toggle**: `Ctrl+Shift+U` (persists for the tab session via `sessionStorage`), toolbar `✕`, or `Esc` to clear the pending selection and pause. With autoload installed you also get `?ui=1` / `?ui=0` on the URL — that gate lives in the loader snippet, not in the script.

## Quick start

### 1) No install (any page)

**Paste into the console** — fastest for one-off use:
1. Press `F12` on the target page, open the Console tab
2. Paste the entire contents of `scripts/inspector.js`, press Enter
3. The bottom toolbar (`Indicator · Comment · Copy Prompt · ✕`) appears

**Bookmarklet** — one click, reusable:
1. Create a new bookmark
2. In the URL field type `javascript:` by hand (some browsers strip a pasted prefix), then paste the whole of `scripts/inspector.js` after it and save
3. Click the bookmark on any page to inject

**From Claude Code** — run `/ui-indicator` and Claude injects it into the browser pane for you (see [SKILL.md](SKILL.md)).

Limits of manual injection: it **disappears on reload or navigation** (inject again), and there is no automatic annotation collection — use `Copy Prompt` and paste the instruction to your AI.

### 2) Autoload in Vite (recommended)

`vite.config.ts` — dev-only, never in a production build:

```ts
import { readFileSync } from 'node:fs'
import type { ViteDevServer } from 'vite'

const uiIndicatorDev = () => ({
  name: 'ui-indicator-dev',
  apply: 'serve' as const,
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/__ui-indicator.js', (_req, res) => {
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(readFileSync(new URL('./ui-indicator/scripts/inspector.js', import.meta.url)))
    })
  },
})
// plugins: [react(), uiIndicatorDev()]
```

Entry file (`main.tsx` or similar) — the `?ui=1` gate plus a cold-start shortcut:

```ts
if (import.meta.env.DEV) {
  const loadInspector = () => {
    const s = document.createElement('script')
    s.src = '/__ui-indicator.js'
    document.body.appendChild(s)
  }
  const q = new URLSearchParams(location.search).get('ui')
  if (q === '1') sessionStorage.setItem('ui-indicator', '1')
  else if (q === '0') sessionStorage.removeItem('ui-indicator')
  if (sessionStorage.getItem('ui-indicator') === '1') loadInspector()
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey && e.shiftKey && e.code === 'KeyU')) return
    if ((window as unknown as { __uiIndicator?: object }).__uiIndicator) return
    sessionStorage.setItem('ui-indicator', '1')
    loadInspector()
  })
}
```

Open `http://localhost:<port>/<path>?ui=1`, or hit `Ctrl+Shift+U` on any screen.

### 3) Autoload in Django

`urls.py` — serve the file only under DEBUG:

```python
from pathlib import Path
from django.conf import settings
from django.http import Http404, HttpResponse
from django.urls import path

def ui_indicator_js(request):
    if not settings.DEBUG:
        raise Http404
    js = (Path(settings.BASE_DIR) / "ui-indicator" / "scripts" / "inspector.js").read_text(encoding="utf-8")
    resp = HttpResponse(js, content_type="text/javascript; charset=utf-8")
    resp["Cache-Control"] = "no-store"
    return resp

urlpatterns = [
    path("__ui-indicator.js", ui_indicator_js),
    # ...your existing patterns
]
```

Base template (`base.html`), just before `</body>` — the `?ui=1` gate plus `Ctrl+Shift+U`:

```html
{% if debug %}
<script>
(function () {
  var q = new URLSearchParams(location.search).get('ui')
  if (q === '1') sessionStorage.setItem('ui-indicator', '1')
  else if (q === '0') sessionStorage.removeItem('ui-indicator')
  function load() { var s = document.createElement('script'); s.src = '/__ui-indicator.js'; document.body.appendChild(s) }
  if (sessionStorage.getItem('ui-indicator') === '1') load()
  window.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey && e.shiftKey && e.code === 'KeyU')) return
    if (window.__uiIndicator) return
    sessionStorage.setItem('ui-indicator', '1'); load()
  })
})()
</script>
{% endif %}
```

`{% if debug %}` needs `django.template.context_processors.debug` enabled and your IP in `INTERNAL_IPS`. If you skip the tag entirely the view is still DEBUG-gated, so production returns 404 either way. For automatic annotation collection, add the three `/api/dev/ui-annotations` endpoints from the [AI contract](#ai-contract) below as DEBUG-only views — an in-memory dict is enough.

### 4) Other stacks (webpack · Next.js · Express · Flask · FastAPI)

Two pieces, always the same: ① serve `scripts/inspector.js` at `/__ui-indicator.js` in dev only, with `Cache-Control: no-store`; ② insert the **shared gate** (the `<script>` block from the Django example) into your HTML, template, or entry file under a dev condition. Only ① differs per stack; reuse the same gate for ②.

**webpack** (`webpack.config.js`, webpack-dev-server v4+):

```js
const fs = require('node:fs')
const path = require('node:path')

devServer: {
  setupMiddlewares(middlewares, devServer) {
    devServer.app.get('/__ui-indicator.js', (_req, res) => {
      res.set({ 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' })
      res.send(fs.readFileSync(path.join(__dirname, 'ui-indicator/scripts/inspector.js'), 'utf8'))
    })
    return middlewares
  },
},
```

Gate goes in the entry file: `if (process.env.NODE_ENV === 'development') { /* shared gate */ }`.

**Next.js** (App Router, `app/__ui-indicator.js/route.ts`):

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 })
  const js = readFileSync(join(process.cwd(), 'ui-indicator/scripts/inspector.js'), 'utf8')
  return new Response(js, {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
```

Gate goes in the root `layout.tsx`: `{process.env.NODE_ENV === 'development' && <script dangerouslySetInnerHTML={{ __html: GATE_JS }} />}`, where `GATE_JS` is the shared gate as a string.

**Express** (backend also serving the frontend):

```js
const fs = require('node:fs')
const path = require('node:path')

if (process.env.NODE_ENV !== 'production') {
  app.get('/__ui-indicator.js', (_req, res) => {
    res.type('text/javascript').set('Cache-Control', 'no-store')
    res.send(fs.readFileSync(path.join(__dirname, 'ui-indicator/scripts/inspector.js'), 'utf8'))
  })
}
```

**Flask**:

```python
from pathlib import Path
from flask import Response, abort

@app.route("/__ui-indicator.js")
def ui_indicator_js():
    if not app.debug:
        abort(404)
    js = (Path(app.root_path) / "ui-indicator" / "scripts" / "inspector.js").read_text(encoding="utf-8")
    return Response(js, mimetype="text/javascript", headers={"Cache-Control": "no-store"})
```

Gate goes in the Jinja template: `{% if config.DEBUG %} … {% endif %}`.

**FastAPI** (serving templates or a static frontend):

```python
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import Response

@app.get("/__ui-indicator.js")
def ui_indicator_js():
    if not DEV_MODE:  # your project's dev flag, e.g. an env var
        raise HTTPException(404)
    js = Path("ui-indicator/scripts/inspector.js").read_text(encoding="utf-8")
    return Response(js, media_type="text/javascript; charset=utf-8", headers={"Cache-Control": "no-store"})
```

Any other stack needs the same two pieces. If you already use an AI coding tool, "install ui-indicator autoload" is usually enough of a prompt to port it. For sites you don't control, use the bookmarklet or Tampermonkey.

### 5) Install as a Claude Code skill

```bash
git clone https://github.com/boonblade/ui-indicator.git ~/.claude/skills/ui-indicator
```

Then call `/ui-indicator` from any project. Details in [SKILL.md](SKILL.md).

## AI contract

```js
window.__uiSelections         // Indicator clicks: [{selector, tag, id, classes, term, text, size, styles, at}], newest 20
window.__uiAnnotations        // annotations: [{n, note, url, targets: [{selector, term, page}], at}]
window.__uiIndicator.prompt() // annotations rendered as an instruction string
window.__uiIndicator.selections / .annotations   // same arrays, read-only getters
window.__uiIndicator.enable() / .disable()
```

`url` and the annotation `page` coordinates come from `location.pathname` and page-space rects, so an AI can tell which route and which spot on it a note refers to.

**Optional annotation collection.** Every time an annotation is added or deleted, the overlay pushes the whole list to `POST /api/dev/ui-annotations` on the same origin. If no such endpoint exists the request fails silently and nothing breaks. Implement these dev-only endpoints and an AI can read annotations over HTTP no matter which browser they were written in:

- `POST /api/dev/ui-annotations` — body `{annotations: [...], url}`, replaces the stored list (cap it at 100)
- `GET /api/dev/ui-annotations` — returns `{annotations, url, updated_at}`
- `DELETE /api/dev/ui-annotations` — clear once the requests are handled

In-memory storage is fine. Annotations are throwaway data, consumed as soon as the AI reads them.

## Example workflow (Claude Code)

1. On a `?ui=1` screen: Comment mode, drag over the elements, write "bump the font one step", press Add
2. Tell Claude: **"read the annotations and fix them"**
3. Claude reads each annotation (selector, role, note), finds the component in the source, edits it, and reports per annotation number

## License

MIT. Change history: [HISTORY.md](HISTORY.md).
