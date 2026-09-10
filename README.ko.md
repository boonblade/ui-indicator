# ui-indicator

*[English](README.md)*

아무 페이지에나 주입하는 개발자도구식 인스펙터 오버레이. 화면 요소를 찍어 **고유 선택자**를 얻거나, **주석**을 남겨 AI 코딩 도구(Claude Code 등)가 읽고 바로 고치게 한다.

> "우측 판넬의 오른쪽 이미지 줄여줘" 대신 — 요소를 찍고 "이거 줄여줘". AI가 어느 노드인지 정확히 안다.

순수 DOM 스크립트 한 개(`scripts/inspector.js`). 프레임워크 전제 없음, 빌드 없음, 의존성 없음. 페이지 소스는 건드리지 않는다 — 추가하는 노드는 전부 오버레이 전용이고 `data-uiind` 표식이 붙는다.

## 기능

- **Indicator 모드**: hover하면 요소 테두리와 고유 선택자가 뜨고, 클릭하면 속성 판넬이 열린다.
  - **NAME**: 요소 이름, 종류 배지(ID/CLASS/TESTID/TAG), 전체 선택자 경로, 선택자·JSON 복사 버튼
  - **DESIGN TERM**: 역할 자동 판별 12종(BUTTON·LINK·INPUT·LABEL·IMAGE·HEADING·NAV·TABLE·LIST·TEXT·CARD·CONTAINER)과 한 줄 설명
  - **SPEC**: 태그·크기, 클래스, 텍스트, computed style 표
- **Comment 모드**: 클릭(재클릭=해제)하거나 **드래그 영역**(사각형에 완전히 포함된 최상위 요소만)으로 여러 개를 고른다. "N elements selected" 판넬에 메모를 쓰고 **Add**를 누르면 요소마다 번호 뱃지가 붙는다. 뱃지를 클릭하면 그 주석이 삭제된다.
- **고유 선택자**: `id` > `data-testid` > 클래스+`:nth-of-type` 순으로, 문서 내에서 유일해질 만큼만 위로 올라간다. 유틸 클래스 위주 코드베이스에서도 모호하지 않다.
- **AI 판독 기록**: 선택과 주석이 `window.__uiSelections` / `window.__uiAnnotations`에 쌓여 AI가 직접 읽는다. `Copy Prompt`는 주석을 그대로 붙여넣을 수 있는 지시문으로 만든다.
- **온오프**: `Ctrl+Shift+U`(탭 세션 동안 `sessionStorage`로 유지), 툴바 `✕`, `Esc`(선택 중이던 것 취소 + 일시정지). 자동로드를 설치하면 URL `?ui=1` / `?ui=0`도 쓸 수 있다 — 이 게이트는 스크립트가 아니라 로더 스니펫이 처리한다.

## 빠른 시작

### 1) 설치 없이 쓰기 (아무 페이지)

**콘솔 붙여넣기** — 일회용으로 가장 빠르다:
1. 대상 페이지에서 `F12` → Console 탭
2. `scripts/inspector.js` 내용 전체를 붙여넣고 Enter
3. 하단 툴바(`Indicator · Comment · Copy Prompt · ✕`)가 뜬다

**북마클릿** — 클릭 한 번으로 재사용:
1. 새 북마크를 만든다
2. URL 칸에 `javascript:`를 직접 타이핑하고(붙여넣은 접두어를 지우는 브라우저가 있다) 그 뒤에 `scripts/inspector.js` 전체를 붙여넣어 저장한다
3. 아무 페이지에서 그 북마크를 클릭하면 주입된다

**Claude Code에서** — `/ui-indicator`를 부르면 Claude가 브라우저 팬에 대신 주입한다([SKILL.md](SKILL.md) 참조).

수동 주입의 한계: **새로고침·페이지 이동 시 사라진다**(다시 주입). 주석 자동 수집도 없으니 `Copy Prompt`로 지시문을 복사해 AI에게 붙여넣는다.

### 2) Vite에 자동로드 설치 (권장)

`vite.config.ts` — dev 전용이라 프로덕션 빌드에는 절대 들어가지 않는다:

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

엔트리(`main.tsx` 등) — `?ui=1` 게이트 + 콜드스타트 단축키:

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

`http://localhost:<port>/<경로>?ui=1`로 접속하거나, 아무 화면에서 `Ctrl+Shift+U`.

### 3) Django에 자동로드 설치

`urls.py` — DEBUG일 때만 서빙:

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
    # ...기존 패턴
]
```

공통 템플릿(`base.html`) `</body>` 직전 — `?ui=1` 게이트 + `Ctrl+Shift+U`:

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

`{% if debug %}`를 쓰려면 `django.template.context_processors.debug`가 켜져 있고 접속 IP가 `INTERNAL_IPS`에 있어야 한다. 태그를 아예 빼도 뷰가 DEBUG로 막혀 있어 프로덕션에서는 어차피 404다. 주석 자동 수집을 원하면 아래 [AI 연동 규약](#ai-연동-규약)의 `/api/dev/ui-annotations` 엔드포인트 3개를 DEBUG 전용 뷰로 추가한다 — 인메모리 dict면 충분하다.

### 4) 기타 스택 (webpack · Next.js · Express · Flask · FastAPI)

조각은 항상 둘이다. ① dev 전용으로 `scripts/inspector.js`를 `/__ui-indicator.js`에 서빙(`Cache-Control: no-store`), ② **공통 게이트**(위 Django 예시의 `<script>` 블록)를 HTML·템플릿·엔트리에 dev 조건으로 삽입. 스택마다 다른 건 ①뿐이고 ②는 그대로 재사용한다.

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

게이트는 엔트리에서 `if (process.env.NODE_ENV === 'development') { /* 공통 게이트 */ }`.

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

게이트는 루트 `layout.tsx`에서 `{process.env.NODE_ENV === 'development' && <script dangerouslySetInnerHTML={{ __html: GATE_JS }} />}` (`GATE_JS`는 공통 게이트 문자열).

**Express** (백엔드가 프론트도 서빙하는 경우):

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

게이트는 Jinja 템플릿에서 `{% if config.DEBUG %} … {% endif %}`.

**FastAPI** (템플릿이나 정적 프론트를 함께 서빙하는 경우):

```python
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import Response

@app.get("/__ui-indicator.js")
def ui_indicator_js():
    if not DEV_MODE:  # 환경변수 등 프로젝트의 dev 판별값
        raise HTTPException(404)
    js = Path("ui-indicator/scripts/inspector.js").read_text(encoding="utf-8")
    return Response(js, media_type="text/javascript; charset=utf-8", headers={"Cache-Control": "no-store"})
```

여기 없는 스택도 같은 두 조각이면 된다. AI 코딩 도구를 쓰고 있다면 "ui-indicator 자동로드 설치해줘" 정도로 이식된다. 손댈 수 없는 사이트는 북마클릿이나 Tampermonkey.

### 5) Claude Code 스킬로 설치

```bash
git clone https://github.com/boonblade/ui-indicator.git ~/.claude/skills/ui-indicator
```

이후 어느 프로젝트에서든 `/ui-indicator`로 부른다. 상세는 [SKILL.md](SKILL.md).

## AI 연동 규약

```js
window.__uiSelections         // Indicator 클릭 기록: [{selector, tag, id, classes, term, text, size, styles, at}] 최근 20개
window.__uiAnnotations        // 주석: [{n, note, url, targets: [{selector, term, page}], at}]
window.__uiIndicator.prompt() // 주석을 지시문 문자열로 조립
window.__uiIndicator.selections / .annotations   // 같은 배열, 읽기 전용 getter
window.__uiIndicator.enable() / .disable()
```

`url`은 `location.pathname`, 주석의 `page`는 페이지 좌표계 사각형이다. 어느 경로의 어느 지점을 가리키는 메모인지 AI가 알 수 있다.

**주석 자동 수집(선택)**. 주석을 추가하거나 삭제할 때마다 오버레이가 같은 오리진의 `POST /api/dev/ui-annotations`로 전체 목록을 보낸다. 엔드포인트가 없으면 요청은 조용히 실패하고 아무것도 깨지지 않는다. 아래 dev 전용 엔드포인트를 두면 사용자가 어느 브라우저에서 주석을 달았든 AI가 HTTP로 읽을 수 있다:

- `POST /api/dev/ui-annotations` — body `{annotations: [...], url}`, 저장된 목록을 통째로 교체(상한 100)
- `GET /api/dev/ui-annotations` — `{annotations, url, updated_at}` 반환
- `DELETE /api/dev/ui-annotations` — 처리가 끝나면 비운다

인메모리로 충분하다. 주석은 AI가 읽는 즉시 소비되는 임시 데이터다.

## 워크플로 예시 (Claude Code)

1. `?ui=1` 화면에서 Comment 모드로 요소를 드래그하고 "글자 한 단계 키워줘"라고 쓴 뒤 Add
2. Claude에게 **"주석 확인해서 수정해줘"**
3. Claude가 주석마다 선택자·역할·메모를 읽고 소스에서 컴포넌트를 찾아 고친 뒤 번호별로 보고한다

## 라이선스

MIT. 변경 이력: [CHANGELOG.md](CHANGELOG.md).
