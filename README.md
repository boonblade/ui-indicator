# ui-indicator

브라우저 화면에 개발자도구 인스펙터식 오버레이를 띄워, **화면 요소를 이름(고유 선택자)으로 특정**하고 **주석으로 수정 요청을 남겨 AI 코딩 도구(Claude Code 등)가 바로 판독·수정**하게 하는 개발 보조 도구.

> "우측 판넬의 오른쪽 이미지 줄여줘" 대신 — 요소를 찍고 "이거 줄여줘". AI가 정확한 위치를 즉시 안다.

순수 DOM 스크립트 1파일(`scripts/inspector.js`) — 프레임워크·사이트 무관, 페이지 소스 무변경(오버레이 전용).

## 기능

- **Indicator 모드**: hover = 요소 테두리 + 고유 선택자 이름표 · 클릭 = 우측 속성 판넬
  - **NAME**: 요소 이름 + 종류 배지(ID/CLASS/TESTID/TAG) + 전체 선택자 경로 + 선택자/JSON 복사
  - **DESIGN TERM**: 요소 역할 자동 판별(BUTTON·LINK·INPUT·CARD·TEXT 등 12종) + 한 줄 설명
  - **SPEC**: 태그·크기 + 클래스·텍스트 + computed style 표
- **Annotate 모드**: 클릭(재클릭=해제) 또는 **드래그 영역**(사각형에 완전 포함된 최상위 요소만)으로 다중 선택 → "N elements selected" 판넬에서 메모 → **Add** → 요소마다 번호 뱃지(뱃지 클릭=삭제)
- **고유 선택자 자동 생성**: id > data-testid > 클래스+nth-of-type 조합으로 문서 내 유일한 최단 경로 — 유틸 클래스 위주 코드베이스에서도 모호하지 않음
- **AI 연동 기록**: 선택·주석이 `window.__uiSelections` / `window.__uiAnnotations`에 쌓임 — AI가 직접 판독. `Copy Prompt` 버튼은 주석을 수정 지시문으로 조립
- **온오프**: `Ctrl+Shift+U` 토글(탭 세션 유지) · URL `?ui=1`/`?ui=0` · 툴바 ✕ · `Esc` = 선택 취소/일시정지

## 빠른 시작

### 1) 그냥 써보기 (아무 페이지)

브라우저 콘솔에 `scripts/inspector.js` 내용을 붙여넣어 실행 — 하단 툴바가 뜨면 끝. (북마클릿으로 저장해두면 클릭 1번.)

### 2) Vite 프로젝트에 자동로드 설치 (권장)

`vite.config.ts` — dev 전용 서빙(프로덕션 빌드 미포함):

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

엔트리(main.tsx 등) — `?ui=1` 게이트 + 콜드스타트 단축키:

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

접속: `http://localhost:<port>/<경로>?ui=1` 또는 아무 화면에서 `Ctrl+Shift+U`.

비-Vite: 같은 원리(dev 전용 서빙 + 게이트) — webpack `devServer.setupMiddlewares` · Next.js dev 전용 route handler · 백엔드 템플릿 서빙은 dev 라우트 1개 + 조건부 `<script>`. 손 못 대는 사이트는 북마클릿/Tampermonkey.

### 3) Claude Code 스킬로 설치

```bash
git clone https://github.com/boonblade/ui-indicator.git ~/.claude/skills/ui-indicator
```

이후 어느 프로젝트에서든 `/ui-indicator` 로 호출 — 상세 지침은 [SKILL.md](SKILL.md).

## AI 연동 규약

```js
window.__uiSelections        // Indicator 클릭 기록 [{selector, tag, id, classes, term, text, size, styles, at}] 최근 20개
window.__uiAnnotations       // 주석 [{n, note, url, targets:[{selector, term, page}], at}]
window.__uiIndicator.prompt() // 주석 → 수정 지시문 텍스트
window.__uiIndicator.enable() / .disable()
```

**주석 자동 수집(선택)**: 오버레이는 주석 Add/삭제마다 전체 목록을 `POST /api/dev/ui-annotations` 로 밀어넣는다(같은 오리진·엔드포인트 없으면 조용히 스킵). 백엔드에 아래 규약의 dev 전용 엔드포인트를 두면, 사용자가 어느 브라우저에서 주석을 달아도 AI가 API로 판독 가능:

- `POST /api/dev/ui-annotations` — body `{annotations: [...], url}` (전체 교체 저장, 상한 100)
- `GET /api/dev/ui-annotations` — `{annotations, url, updated_at}` 반환
- `DELETE /api/dev/ui-annotations` — 처리 완료 후 비움

인메모리면 충분(주석은 즉시 소비되는 임시 데이터).

## 워크플로 예시 (Claude Code)

1. `?ui=1` 화면에서 Annotate → 요소 드래그 → 메모 "글자 한 단계 키워줘" → Add
2. Claude에게: **"주석 확인해서 수정해줘"**
3. Claude가 주석(선택자·역할·메모)을 판독 → 소스에서 해당 컴포넌트 특정 → 수정 → 번호별 보고

## 라이선스

MIT
