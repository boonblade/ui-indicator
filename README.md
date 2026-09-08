# ui-indicator

A development aid that overlays a DevTools-style inspector on any web page so you can **pinpoint a screen element by name (a unique selector)** and **leave change requests as annotations that an AI coding tool (Claude Code, etc.) reads and acts on directly**.

> Instead of "make the right-hand image in the side panel smaller" — click the element and say "make this smaller". The AI knows the exact spot immediately.

A single pure-DOM script (`scripts/inspector.js`) — framework- and site-agnostic, never modifies the page source (overlay only).

## Features

- **Indicator mode**: hover = element outline + unique-selector label · click = property panel on the right
  - **NAME**: element name + kind badge (ID/CLASS/TESTID/TAG) + full selector path + copy selector / copy JSON
  - **DESIGN TERM**: automatic role detection (12 kinds: BUTTON, LINK, INPUT, CARD, TEXT, …) with a one-line description
  - **SPEC**: tag and size, classes and text, computed-style table
- **Comment mode**: multi-select by click (click again to deselect) or by **drag region** (only the top-most elements fully inside the rectangle) → write a note in the "N elements selected" panel → **Add** → a numbered badge on each element (click a badge to delete)
- **Automatic unique selectors**: id > data-testid > class + nth-of-type, the shortest path that is unique in the document — unambiguous even in utility-class-heavy codebases
- **AI-readable records**: selections and annotations accumulate in `window.__uiSelections` / `window.__uiAnnotations` for the AI to read directly. The `Copy Prompt` button assembles the annotations into a change instruction
- **On/off**: `Ctrl+Shift+U` toggle (persists for the tab session) · URL `?ui=1` / `?ui=0` · toolbar ✕ · `Esc` = cancel selection / pause

## Quick start

### 1) Without autoload (zero install · any page)

**Paste into the console** — fastest for one-off use:
1. On the target page, `F12` → Console tab
2. Paste the entire contents of `scripts/inspector.js` and press Enter
3. When the bottom toolbar (`Indicator · Comment · Copy Prompt · ✕`) appears, you're done

**Bookmarklet** — reusable with one click:
1. Create a new bookmark in your browser
2. In the URL field, type `javascript:` by hand first (some browsers strip the prefix when pasting), then paste the entire contents of `scripts/inspector.js` and save
3. Click that bookmark on any page = injected

**From Claude Code** — invoke `/ui-indicator` and Claude injects it into the browser pane for you (see SKILL.md).

Shared limits of manual injection: **gone on reload or navigation** (inject again), and no automatic annotation collection → use the `Copy Prompt` button to copy the instruction and paste it to the AI.

### 2) Autoload in a Vite project (recommended)

`vite.config.ts` — dev-only serving (not included in production builds):

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

Entry point (`main.tsx` etc.) — `?ui=1` gate + cold-start shortcut:

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

Open `http://localhost:<port>/<path>?ui=1`, or press `Ctrl+Shift+U` on any screen.

### 3) Autoload in Django

`urls.py` — serve the file only when DEBUG:

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
    # ...existing patterns
]
```

Shared template (`base.html`), just before `</body>` — `?ui=1` gate + Ctrl+Shift+U:

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

`{% if debug %}` requires `django.template.context_processors.debug` to be enabled and your client IP to be in `INTERNAL_IPS` (if you skip the tag, the view is still DEBUG-gated, so production returns 404 anyway). For automatic annotation collection, implement the three `/api/dev/ui-annotations` endpoints from "AI integration contract" below as DEBUG-only views (an in-memory dict is enough).

### 4) Other stacks (webpack · Next.js · Express · Flask · FastAPI)

The principle is always the same: ① serve `scripts/inspector.js` at `/__ui-indicator.js` in dev only (`Cache-Control: no-store`) ② insert the **shared gate** (the `<script>` block from the Django example above) into your HTML/template/entry under a dev condition. Below is only ① (serving) per stack — reuse the shared gate for ②.

**webpack** (`webpack.config.js` · webpack-dev-server v4+):

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

Gate in the entry: `if (process.env.NODE_ENV === 'development') { /* shared gate */ }`.

**Next.js** (App Router · `app/__ui-indicator.js/route.ts`):

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

Gate in the root `layout.tsx`: `{process.env.NODE_ENV === 'development' && <script dangerouslySetInnerHTML={{ __html: GATE_JS }} />}` (GATE_JS = the shared gate as a string).

**Express** (when the backend also serves the frontend):

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

Gate in Jinja templates: `{% if config.DEBUG %} … {% endif %}`.

**FastAPI** (when serving templates / a static frontend too):

```python
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import Response

@app.get("/__ui-indicator.js")
def ui_indicator_js():
    if not DEV_MODE:  # your project's dev flag (env var, etc.)
        raise HTTPException(404)
    js = Path("ui-indicator/scripts/inspector.js").read_text(encoding="utf-8")
    return Response(js, media_type="text/javascript; charset=utf-8", headers={"Cache-Control": "no-store"})
```

Any stack not listed here needs the same two pieces — if you use an AI coding tool, ask it to "install ui-indicator autoload" and it will port them. For sites you cannot touch, use the bookmarklet or Tampermonkey.

### 5) Install as a Claude Code skill

```bash
git clone https://github.com/boonblade/ui-indicator.git ~/.claude/skills/ui-indicator
```

Then invoke `/ui-indicator` from any project — detailed instructions in [SKILL.md](SKILL.md).

## AI integration contract

```js
window.__uiSelections        // Indicator click log [{selector, tag, id, classes, term, text, size, styles, at}], last 20
window.__uiAnnotations       // annotations [{n, note, url, targets:[{selector, term, page}], at}]
window.__uiIndicator.prompt() // annotations → change-instruction text
window.__uiIndicator.enable() / .disable()
```

**Automatic annotation collection (optional)**: on every annotation Add/delete, the overlay pushes the full list to `POST /api/dev/ui-annotations` (same origin; silently skipped when the endpoint does not exist). Provide the dev-only endpoints below on your backend and the AI can read annotations over the API no matter which browser the user annotated in:

- `POST /api/dev/ui-annotations` — body `{annotations: [...], url}` (replaces the whole list; cap 100)
- `GET /api/dev/ui-annotations` — returns `{annotations, url, updated_at}`
- `DELETE /api/dev/ui-annotations` — clear after processing

In-memory storage is enough (annotations are transient data consumed immediately).

## Example workflow (Claude Code)

1. On a `?ui=1` screen: Comment → drag over elements → note "make the text one step larger" → Add
2. Tell Claude: **"check the annotations and apply them"**
3. Claude reads the annotations (selector, role, note) → locates the component in the source → edits → reports per annotation number

## License

MIT
