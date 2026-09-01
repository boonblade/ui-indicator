---
name: ui-indicator
description: Use when 사용자가 화면 요소를 이름으로 특정하거나 주석으로 수정 요청하려 할 때 — "이 요소 이름이 뭐야", "인스펙터 켜줘", "/ui-indicator", "주석 확인해서 수정해줘", "내가 찍은/클릭한 요소", UI 수정 지시 전에 요소를 정확히 지목하려 할 때.
---

# ui-indicator

개발자도구 인스펙터식 오버레이를 화면에 주입한다. 어느 사이트든 동작(순수 DOM). 페이지 소스는 건드리지 않는다(주입 전용).
- **Indicator 모드**: hover=요소 테두리+고유 선택자 이름표, 클릭=우측 속성 판넬(NAME/DESIGN TERM/SPEC + 선택자·JSON 복사).
- **Comment 모드**: 클릭(재클릭=해제) 또는 **드래그 영역**(사각형에 완전 포함된 최상위 요소들)으로 다중 선택 → 우측하단 "N elements selected" 판넬에서 메모 입력 → Add = 주석 확정 + 각 요소에 번호 뱃지(뱃지 클릭=삭제).

## 켜기

프로젝트에 자동로드가 설치돼 있으면(dev 서버가 `/__ui-indicator.js` 서빙 + `?ui=1` 게이트 — 설치법은 README.md) 기본 동작 = 사용자 기본 브라우저로 바로 띄움: `Start-Process "<dev서버>/<경로>?ui=1"`(macOS/Linux는 `open`/`xdg-open`). 온오프 = **Ctrl+Shift+U**. 아래 수동 주입은 자동로드 없는 프로젝트·외부 사이트용.

1. 브라우저 팬으로 대상 URL 이동(URL 미지정이면 현재 열린 탭 또는 프로젝트 dev 서버 주소 사용, 없으면 질문).
2. `scripts/inspector.js` 파일 내용을 **그대로** `javascript_tool`로 실행(수정·요약 금지). 반환값 "주입 완료" 확인.
3. 사용자 안내(3줄): 하단 툴바 Indicator/Comment 전환 · Comment=클릭·드래그로 여러 개 선택 후 메모 Add · Esc=선택 취소/일시정지(끄면 앱 정상 조작).

## 판독 (핵심)

```js
window.__uiSelections    // Indicator 클릭 기록 [{selector, tag, id, classes, term, text, size, styles, at}] 최근 20개
window.__uiAnnotations   // 주석 [{n, note, url, targets:[{selector, term, page}], at}]
window.__uiIndicator.prompt()  // 주석을 수정 지시문으로 조립한 텍스트
```

- "내가 찍은 요소" → `__uiSelections` 마지막 항목의 selector로 특정. 사용자가 이름을 타이핑할 필요 없음.
- **"주석 확인해서 수정해줘"** → ① 주석 읽기(**소스 수정 전에** — HMR 리로드가 기록을 지움): 프로젝트에 수집 엔드포인트가 있으면(`GET /api/dev/ui-annotations` — 주석 변경마다 자동 POST 동기화, 규약은 README.md) 그걸 정본으로(사용자 본인 브라우저 주석도 읽힘), 없으면 브라우저 팬 `__uiAnnotations` 직접 판독 ② 각 target의 selector·term으로 소스에서 해당 컴포넌트 특정(클래스명 grep) ③ note대로 수정 ④ 주석 번호별로 반영 결과 보고 ⑤ 처리 후 비움(DELETE 또는 배열 초기화).

## 자동로드 설치 ("ui-indicator 자동로드 설치해줘" 요청 시)

README.md의 스니펫대로: ① dev 전용으로 `scripts/inspector.js`를 `/__ui-indicator.js`로 서빙(`Cache-Control: no-store`) ② 엔트리에 `?ui=1`/`?ui=0` 게이트(sessionStorage `ui-indicator`) + Ctrl+Shift+U 콜드스타트 리스너(`window.__uiIndicator` 없을 때만 로드) ③ (선택) 주석 수집 API `POST/GET/DELETE /api/dev/ui-annotations`(인메모리·상한 100) ④ 검증: `?ui=1` 접속 → 툴바 → Indicator 클릭 판넬·Comment Add·단축키 토글.

비-Vite도 같은 원리: webpack=`devServer.setupMiddlewares` · Next.js=dev 전용 route handler(프로덕션 404) · 백엔드 템플릿 서빙=dev 라우트 1개 + 조건부 script 태그. dev 서버가 없거나 손 못 대는 사이트=북마클릿(inspector.js 전체를 북마크 URL로) 또는 Tampermonkey, 최후 폴백=브라우저 팬 수동 주입.

## 주의

- **새로고침·HMR 풀리로드 시 오버레이 메모리 기록 소실** → 판독을 소스 수정보다 먼저(수집 엔드포인트가 있으면 백엔드에 남아 안전).
- 활성 모드 중엔 클릭이 앱으로 전달되지 않음(캡처). 앱 조작은 Esc·Ctrl+Shift+U·툴바 ✕.
- 유틸 클래스 위주 코드베이스는 클래스명 단독이 모호 — 스크립트가 id > data-testid > 클래스+nth-of-type 조합으로 문서 내 유일한 최단 선택자를 자동 생성함. 그래도 긴 선택자가 나오는 요소는 소스에 의미 있는 id/data-testid 부여를 제안할 것(강제 아님).
