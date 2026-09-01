// ui-indicator: 개발자도구 인스펙터식 요소 이름표 오버레이 (주입용 · 페이지 소스 무변경)
// 하단 툴바: Inspect(클릭=속성 판넬) · Annotate(클릭/드래그=다중 선택→주석 Add) · 프롬프트 복사 · 끄기
// 기록: window.__uiSelections(선택) · window.__uiAnnotations(주석) — Claude가 직접 판독
(() => {
  if (window.__uiIndicator) { window.__uiIndicator.enable(); return '이미 주입됨 — 재활성화'; }

  const ROOT_Z = 2147483640;
  const box = document.createElement('div');      // hover 대상 테두리
  const badge = document.createElement('div');    // 이름표
  const panel = document.createElement('div');    // 우측 속성 판넬
  const toolbar = document.createElement('div');  // 하단 툴바
  const markers = document.createElement('div');  // 확정 주석 뱃지(페이지 좌표)
  const pendMarks = document.createElement('div');// 선택 중 테두리(페이지 좌표)
  const annPanel = document.createElement('div'); // 우측하단 "N elements selected" 판넬
  const band = document.createElement('div');     // 드래그 영역 사각형
  Object.assign(box.style, {
    position: 'fixed', zIndex: ROOT_Z, pointerEvents: 'none',
    border: '2px solid #4f8ef7', background: 'rgba(79,142,247,0.08)',
    borderRadius: '2px', display: 'none',
  });
  Object.assign(badge.style, {
    position: 'fixed', zIndex: ROOT_Z + 1, pointerEvents: 'none',
    font: '12px/1.5 monospace', color: '#fff', background: '#1c2333',
    border: '1px solid #4f8ef7', borderRadius: '4px', padding: '4px 8px',
    maxWidth: '480px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', display: 'none',
  });
  Object.assign(panel.style, {
    position: 'fixed', top: '0', right: '0', width: '320px', height: '100vh',
    zIndex: ROOT_Z + 2, background: '#0e111a', color: '#e8ecf5',
    font: '12px/1.6 monospace', borderLeft: '1px solid #2a3350',
    padding: '10px', overflowY: 'auto', display: 'none', boxSizing: 'border-box',
  });
  Object.assign(toolbar.style, {
    position: 'fixed', bottom: '14px', left: '50%', transform: 'translateX(-50%)',
    zIndex: ROOT_Z + 3, display: 'flex', gap: '6px', alignItems: 'center',
    background: '#0e111a', border: '1px solid #2a3350', borderRadius: '999px',
    padding: '6px 10px', font: '12px/1 monospace', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  });
  Object.assign(markers.style, { position: 'absolute', left: '0', top: '0', zIndex: ROOT_Z + 1 });
  Object.assign(pendMarks.style, { position: 'absolute', left: '0', top: '0', zIndex: ROOT_Z, pointerEvents: 'none' });
  Object.assign(annPanel.style, {
    position: 'fixed', right: '14px', bottom: '60px', width: '300px',
    zIndex: ROOT_Z + 4, display: 'none', background: '#171b28',
    border: '1px solid #e35d5d', borderRadius: '8px', padding: '10px 12px',
    font: '12px/1.6 monospace', color: '#e8ecf5', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  });
  Object.assign(band.style, {
    position: 'fixed', zIndex: ROOT_Z + 1, pointerEvents: 'none', display: 'none',
    border: '1.5px dashed #e35d5d', background: 'rgba(227,93,93,0.06)',
  });
  document.body.append(box, badge, panel, toolbar, markers, pendMarks, annPanel, band);
  [box, badge, panel, toolbar, markers, pendMarks, annPanel, band].forEach((n) => { n.dataset.uiind = '1'; });

  const seg = (el) => {
    if (el.id) return '#' + CSS.escape(el.id);
    const dt = el.getAttribute('data-testid');
    if (dt) return `[data-testid="${dt}"]`;
    let s = el.tagName.toLowerCase();
    s += [...el.classList].slice(0, 2).map((c) => '.' + CSS.escape(c)).join('');
    const p = el.parentElement;
    if (p) {
      const sib = [...p.children].filter((c) => c.tagName === el.tagName);
      if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(el) + 1})`;
    }
    return s;
  };
  // 짧고 유일한 선택자: 뒤에서부터 조합해 문서 내 1개로 좁혀지는 최단 경로 채택
  const selector = (el) => {
    const parts = [];
    for (let cur = el; cur && cur !== document.body && parts.length < 6; cur = cur.parentElement) {
      const s = seg(cur);
      parts.unshift(s);
      if (s.startsWith('#') || s.startsWith('[data-testid')) break;
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const cand = parts.slice(i).join(' > ');
      try { if (document.querySelectorAll(cand).length === 1) return cand; } catch { /* 비정상 클래스명 */ }
    }
    return parts.join(' > ');
  };

  // 디자인 용어 판별: 태그·role·스타일로 현장 용어 + 한 줄 설명
  const designTerm = (el, cs) => {
    const t = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    if (t === 'button' || role === 'button') return ['BUTTON', '누르면 동작이 실행되는 버튼'];
    if (t === 'a' || role === 'link') return ['LINK', '다른 화면·위치로 이동하는 링크'];
    if (t === 'input' || t === 'textarea' || t === 'select') return ['INPUT', '값을 입력하거나 고르는 입력 필드'];
    if (t === 'label') return ['LABEL', '입력 필드에 붙는 이름표'];
    if (t === 'img' || t === 'svg' || t === 'canvas' || t === 'video') return ['IMAGE', '이미지·그림·아이콘 표시 영역'];
    if (/^h[1-6]$/.test(t)) return ['HEADING', '구획의 제목 텍스트'];
    if (t === 'nav') return ['NAV', '화면 이동 메뉴 묶음'];
    if (t === 'table' || t === 'thead' || t === 'tbody' || t === 'tr' || t === 'td' || t === 'th') return ['TABLE', '행·열로 정리된 표'];
    if (t === 'ul' || t === 'ol' || t === 'li') return ['LIST', '같은 성격 항목의 나열'];
    if (t === 'p' || t === 'span' || t === 'strong' || t === 'em' || t === 'code') return ['TEXT', '본문 텍스트'];
    if (cs.borderRadius !== '0px' && (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0))
      return ['CARD', '관련 정보를 시각적으로 그룹화한 컨테이너. 테두리·배경으로 본문과 구분'];
    return ['CONTAINER', '다른 요소를 담는 배치용 상자'];
  };

  const STYLE_KEYS = ['background-color', 'color', 'font-size', 'font-weight', 'padding',
    'margin', 'display', 'width', 'height', 'border-radius', 'border', 'gap', 'position', 'overflow'];

  const el2 = (tag, style, text) => {
    const d = document.createElement(tag);
    Object.assign(d.style, style);
    if (text != null) d.textContent = text;
    return d;
  };
  const copyBtn = (label, getText, extra) => {
    const b = el2('button', {
      font: 'inherit', fontSize: '11px', color: '#9db8ef', background: '#232c42',
      border: '1px solid #3a4a72', borderRadius: '3px', padding: '1px 8px',
      cursor: 'pointer', marginRight: '6px', ...extra,
    }, label);
    b.onclick = (e) => {
      e.stopPropagation();
      try { navigator.clipboard.writeText(getText()); b.textContent = '복사됨✓'; } catch { b.textContent = '복사 실패'; }
      setTimeout(() => { b.textContent = label; }, 1200);
    };
    return b;
  };

  const renderPanel = (rec) => {
    panel.textContent = '';
    const section = (label) => {
      const s = el2('div', {
        background: '#171b28', border: '1px solid #262e47', borderRadius: '8px',
        padding: '10px 12px', marginBottom: '10px',
      });
      s.append(el2('div', { color: '#e35d5d', fontSize: '10px', letterSpacing: '2px', marginBottom: '6px' }, '▮ ' + label));
      panel.append(s);
      return s;
    };
    const pill = (text) => el2('span', {
      background: '#e35d5d', color: '#14090b', fontSize: '10px', fontWeight: '700',
      borderRadius: '999px', padding: '1px 8px', letterSpacing: '1px', verticalAlign: 'middle',
    }, text);

    const name = section('NAME');
    const last = rec.selector.split(' > ').pop();
    const kind = rec.id ? 'ID' : last.startsWith('[data-testid') ? 'TESTID' : rec.classes.length ? 'CLASS' : 'TAG';
    const h = el2('div', { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' });
    h.append(el2('span', { fontSize: '16px', fontWeight: '700', color: '#fff', wordBreak: 'break-all' }, last), pill(kind));
    name.append(h, el2('div', { color: '#8291b0', wordBreak: 'break-all', marginBottom: '8px' }, rec.selector));
    const btnRow = el2('div', {});
    btnRow.append(copyBtn('선택자 복사', () => rec.selector), copyBtn('JSON 복사', () => JSON.stringify(rec, null, 2)));
    name.append(btnRow);
    const close = el2('button', {
      position: 'absolute', top: '10px', right: '12px', font: 'inherit',
      color: '#8291b0', background: 'none', border: 'none', cursor: 'pointer',
    }, '✕');
    close.onclick = (e) => { e.stopPropagation(); panel.style.display = 'none'; };
    panel.append(close);

    const term = section('DESIGN TERM');
    const th = el2('div', { marginBottom: '4px' });
    th.append(pill(rec.term[0]));
    term.append(th, el2('div', { color: '#aab6d0', fontSize: '11px' }, rec.term[1]));

    const spec = section('SPEC');
    const sh = el2('div', { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' });
    sh.append(el2('span', { color: '#c9e08f', fontWeight: '700' }, `<${rec.tag}>`),
      el2('span', { color: '#fff', fontWeight: '700' }, rec.size));
    spec.append(sh);
    if (rec.classes.length) spec.append(el2('div', {
      color: '#8fa3c9', wordBreak: 'break-all', borderBottom: '1px solid #262e47',
      paddingBottom: '6px', marginBottom: '6px', fontSize: '11px',
    }, rec.classes.join(' ')));
    if (rec.text) spec.append(el2('div', {
      color: '#6d7a96', fontSize: '11px', borderBottom: '1px solid #262e47',
      paddingBottom: '6px', marginBottom: '6px',
    }, '"' + rec.text + '"'));
    for (const [k, v] of Object.entries(rec.styles)) {
      const r = el2('div', { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '1px 0' });
      r.append(el2('span', { color: '#8291b0', flexShrink: '0' }, k),
        el2('span', {
          background: 'rgba(122,162,247,0.16)', color: '#cdd6f4', borderRadius: '2px',
          padding: '0 5px', wordBreak: 'break-all', textAlign: 'right',
        }, v));
      spec.append(r);
    }
    panel.style.display = 'block';
  };

  // ── 주석(Annotate): 클릭할 때마다 선택 누적 → 우측하단 판넬에서 메모 1개로 Add
  const anns = (window.__uiAnnotations = window.__uiAnnotations || []);
  let pending = []; // [{el, selector, term}]
  const drawMarker = (a, t) => {
    const m = el2('div', {
      position: 'absolute', left: t.page.x - 9 + 'px', top: t.page.y - 9 + 'px',
      width: '18px', height: '18px', borderRadius: '50%', background: '#e35d5d',
      color: '#fff', font: '700 11px/18px monospace', textAlign: 'center',
      cursor: 'pointer', boxShadow: '0 0 0 2px #0e111a',
    }, String(a.n));
    m.title = `#${a.n} ${t.selector}\n"${a.note}"  (클릭=주석 삭제)`;
    m.dataset.ann = String(a.n);
    m.onclick = (e) => {
      e.stopPropagation(); e.preventDefault();
      const i = anns.indexOf(a);
      if (i >= 0) anns.splice(i, 1);
      [...markers.children].filter((c) => c.dataset.ann === String(a.n)).forEach((c) => c.remove());
      syncAnns();
    };
    markers.append(m);
  };
  const renderPending = () => {
    pendMarks.textContent = '';
    for (const p of pending) {
      const r = p.el.getBoundingClientRect();
      pendMarks.append(el2('div', {
        position: 'absolute', left: r.left + scrollX + 'px', top: r.top + scrollY + 'px',
        width: r.width + 'px', height: r.height + 'px',
        border: '2px solid #e35d5d', borderRadius: '2px', background: 'rgba(227,93,93,0.07)',
      }));
    }
    if (!pending.length) { annPanel.style.display = 'none'; return; }
    annPanel.textContent = '';
    annPanel.append(el2('div', { color: '#e35d5d', fontSize: '11px', fontWeight: '700', marginBottom: '6px' },
      `▮ ${pending.length} elements selected`));
    const list = el2('div', { maxHeight: '110px', overflowY: 'auto', marginBottom: '8px', color: '#aab6d0', fontSize: '11px' });
    pending.forEach((p, i) => list.append(el2('div', { wordBreak: 'break-all' },
      `${i + 1}. ${p.selector.split(' > ').pop()} · ${p.term[0]}`)));
    annPanel.append(list);
    const ta = el2('textarea', {
      width: '100%', boxSizing: 'border-box', height: '54px', resize: 'none',
      font: 'inherit', color: '#e8ecf5', background: '#0e111a',
      border: '1px solid #3a4a72', borderRadius: '4px', padding: '4px 6px', marginBottom: '8px',
    });
    ta.placeholder = '수정 요청 메모…';
    ta.onkeydown = (e) => e.stopPropagation();
    annPanel.append(ta);
    const row = el2('div', { display: 'flex', justifyContent: 'flex-end', gap: '6px' });
    const cancel = el2('button', {
      font: 'inherit', fontSize: '11px', color: '#9db8ef', background: '#232c42',
      border: '1px solid #3a4a72', borderRadius: '999px', padding: '3px 12px', cursor: 'pointer',
    }, 'Cancel');
    cancel.onclick = (e) => { e.stopPropagation(); pending = []; renderPending(); };
    const add = el2('button', {
      font: 'inherit', fontSize: '11px', color: '#fff', background: '#e35d5d',
      border: '1px solid #e35d5d', borderRadius: '999px', padding: '3px 12px', cursor: 'pointer', fontWeight: '700',
    }, 'Add');
    add.onclick = (e) => {
      e.stopPropagation();
      if (!ta.value.trim()) { ta.focus(); return; }
      const a = {
        n: (anns[anns.length - 1]?.n || 0) + 1,
        note: ta.value.trim(),
        url: location.pathname,
        targets: pending.map((p) => {
          const r = p.el.getBoundingClientRect();
          return { selector: p.selector, term: p.term[0], page: { x: r.left + scrollX, y: r.top + scrollY } };
        }),
        at: new Date().toISOString(),
      };
      anns.push(a);
      a.targets.forEach((t) => drawMarker(a, t));
      syncAnns();
      pending = [];
      renderPending();
    };
    row.append(cancel, add);
    annPanel.append(row);
    annPanel.style.display = 'block';
    ta.focus();
  };
  const buildPrompt = () => anns.length
    ? '다음 화면 주석을 확인해 수정해줘:\n' + anns.map((a) =>
      `${a.n}. [${a.targets.map((t) => t.selector).join(', ')}] — ${a.note}`).join('\n')
    : '(주석 없음)';
  // 주석 변경 시 백엔드로 동기화 — 어느 브라우저에서 달았든 Claude가 GET으로 판독 가능.
  // 수집 엔드포인트 없는 사이트(외부)는 조용히 스킵.
  const syncAnns = () => {
    try {
      fetch('/api/dev/ui-annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotations: anns, url: location.pathname }),
      }).catch(() => {});
    } catch { /* fetch 불가 환경 */ }
  };

  // ── 툴바
  let mode = 'inspect'; // inspect | annotate
  let active = true;
  const tbBtn = (label, onclick) => {
    const b = el2('button', {
      font: 'inherit', color: '#9db8ef', background: 'transparent',
      border: '1px solid transparent', borderRadius: '999px', padding: '4px 10px', cursor: 'pointer',
    }, label);
    b.onclick = (e) => { e.stopPropagation(); onclick(b); };
    return b;
  };
  const setMode = (m) => {
    mode = m;
    active = true;
    [inspectB, annotateB].forEach((b) => Object.assign(b.style, { color: '#9db8ef', background: 'transparent', border: '1px solid transparent' }));
    const on = m === 'inspect' ? inspectB : annotateB;
    Object.assign(on.style, { color: '#fff', background: '#e35d5d', border: '1px solid #e35d5d' });
    if (m === 'inspect') { pending = []; renderPending(); }
  };
  const inspectB = tbBtn('Inspect', () => setMode('inspect'));
  const annotateB = tbBtn('Annotate', () => setMode('annotate'));
  const promptB = copyBtn('Copy Prompt', buildPrompt, { borderRadius: '999px', padding: '4px 10px', marginRight: '0', background: 'transparent', border: '1px solid transparent' });
  const offB = tbBtn('✕', () => window.__uiIndicator.disable());
  toolbar.append(inspectB, annotateB, promptB, offB);
  setMode('inspect');

  let target = null;
  const ours = (el) => el instanceof Element && !!el.closest('[data-uiind]');

  // ── 드래그 영역 선택(Annotate): 사각형에 완전히 포함된 "최상위" 요소만(자식 중복 제외)
  let dragStart = null;
  let dragging = false;
  let suppressClick = false;
  const bandRect = (e) => ({
    left: Math.min(dragStart.x, e.clientX), top: Math.min(dragStart.y, e.clientY),
    right: Math.max(dragStart.x, e.clientX), bottom: Math.max(dragStart.y, e.clientY),
  });
  const pickInBand = (b) => {
    const within = new Set();
    for (const el of document.body.querySelectorAll('*')) {
      if (ours(el)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left >= b.left && r.right <= b.right && r.top >= b.top && r.bottom <= b.bottom) within.add(el);
    }
    return [...within].filter((el) => !within.has(el.parentElement));
  };
  const onDown = (e) => {
    if (!active || mode !== 'annotate' || e.button !== 0 || ours(e.target)) return;
    dragStart = { x: e.clientX, y: e.clientY };
    dragging = false;
  };
  const onUp = (e) => {
    if (!dragging) { dragStart = null; return; }
    e.preventDefault(); e.stopPropagation();
    for (const el of pickInBand(bandRect(e))) {
      if (!pending.some((p) => p.el === el))
        pending.push({ el, selector: selector(el), term: designTerm(el, getComputedStyle(el)) });
    }
    renderPending();
    band.style.display = 'none';
    document.body.style.userSelect = '';
    dragStart = null;
    dragging = false;
    suppressClick = true; // 드래그 종료 직후의 click 이벤트 무시
  };

  const show = (el, x, y) => {
    const r = el.getBoundingClientRect();
    Object.assign(box.style, {
      display: 'block', left: r.left + 'px', top: r.top + 'px',
      width: r.width + 'px', height: r.height + 'px',
      borderColor: mode === 'annotate' ? '#e35d5d' : '#4f8ef7',
    });
    badge.textContent = `${selector(el)}\n${Math.round(r.width)}×${Math.round(r.height)}`;
    badge.style.display = 'block';
    const bw = badge.offsetWidth, bh = badge.offsetHeight;
    badge.style.left = Math.min(x + 14, innerWidth - bw - 8) + 'px';
    badge.style.top = (y + 18 + bh > innerHeight ? y - bh - 8 : y + 18) + 'px';
  };
  const hide = () => { box.style.display = badge.style.display = 'none'; target = null; };

  const onMove = (e) => {
    if (!active) return;
    if (dragStart && (dragging || Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 6)) {
      dragging = true;
      hide();
      document.body.style.userSelect = 'none';
      const b = bandRect(e);
      Object.assign(band.style, {
        display: 'block', left: b.left + 'px', top: b.top + 'px',
        width: b.right - b.left + 'px', height: b.bottom - b.top + 'px',
      });
      e.preventDefault();
      return;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || ours(el) || el === document.documentElement || el === document.body) return hide();
    target = el;
    show(el, e.clientX, e.clientY);
  };
  const onClick = (e) => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
    if (!active || ours(e.target)) return; // 판넬·툴바·마커·입력 클릭은 통과
    if (!target) return;
    e.preventDefault(); e.stopPropagation();
    if (mode === 'annotate') {
      const i = pending.findIndex((p) => p.el === target);
      if (i >= 0) pending.splice(i, 1); // 재클릭=선택 해제
      else pending.push({ el: target, selector: selector(target), term: designTerm(target, getComputedStyle(target)) });
      renderPending();
      return;
    }
    const r = target.getBoundingClientRect();
    const cs = getComputedStyle(target);
    const rec = {
      selector: selector(target),
      tag: target.tagName.toLowerCase(),
      id: target.id || null,
      classes: [...target.classList],
      term: designTerm(target, cs),
      text: (target.textContent || '').trim().slice(0, 40),
      size: `${Math.round(r.width)} × ${Math.round(r.height)}px`,
      styles: Object.fromEntries(STYLE_KEYS.map((k) => [k, cs.getPropertyValue(k)]).filter(([, v]) => v && v !== 'none' && v !== 'normal')),
      at: new Date().toISOString(),
    };
    (window.__uiSelections = window.__uiSelections || []).push(rec);
    if (window.__uiSelections.length > 20) window.__uiSelections.shift();
    try { navigator.clipboard.writeText(rec.selector); } catch { /* http 등 비보안 컨텍스트 */ }
    renderPanel(rec);
    badge.textContent = `✓ 기록됨\n${rec.selector}`;
  };
  const onKey = (e) => {
    // Ctrl+Shift+U = 온오프 토글(off는 새로고침에도 유지 — sessionStorage 게이트 연동)
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyU') {
      e.preventDefault();
      if (toolbar.style.display === 'none') window.__uiIndicator.enable();
      else window.__uiIndicator.disable();
      return;
    }
    if (e.key !== 'Escape') return;
    if (pending.length) { pending = []; renderPending(); return; }
    active = !active;
    if (!active) hide();
  };

  addEventListener('mousedown', onDown, true);
  addEventListener('mouseup', onUp, true);
  addEventListener('mousemove', onMove, true);
  addEventListener('click', onClick, true);
  addEventListener('keydown', onKey, true);

  window.__uiIndicator = {
    enable: () => {
      active = true; toolbar.style.display = 'flex'; markers.style.display = '';
      try { sessionStorage.setItem('ui-indicator', '1'); } catch { /* 저장 불가 환경 */ }
    },
    disable: () => {
      active = false; hide(); pending = []; renderPending();
      panel.style.display = toolbar.style.display = band.style.display = markers.style.display = 'none';
      document.body.style.userSelect = '';
      dragStart = null; dragging = false;
      try { sessionStorage.removeItem('ui-indicator'); } catch { /* 저장 불가 환경 */ }
    },
    get selections() { return window.__uiSelections || []; },
    get annotations() { return anns; },
    prompt: buildPrompt,
  };
  return '주입 완료 — 툴바: Inspect(속성 판넬)·Annotate(클릭/드래그 다중 선택→Add 주석)·프롬프트 복사 · Esc=선택 취소/일시정지';
})();
