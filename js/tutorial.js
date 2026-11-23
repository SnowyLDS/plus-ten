// =====================================================================
// tutorial.js — 따라 하며 배우기 (6-9, v1.7: 11단계)
// - 강조된 것을 직접 눌러야 다음으로. 강조 대상 밖의 클릭·누름·키 입력은 document 캡처 단계에서 막는다.
// - (v1.7) 튜토리얼 내내 전투·드롭·골드 획득이 멈춰 있고, 끝나면 시작된다(main.js).
// - 튜토리얼 예외: 단계별 지급(골드·무기), 강화 결과 고정 1회(6단계 성공). 파괴는 없다. 끝나면 4-5 표로 돌아간다.
// - 단계 정의는 아래 STEPS 배열 하나 (대상 선택자, 대사 키, 지급, 고정 결과, 진행 조건) → 순서를 바꾸기 쉽다.
// =====================================================================
const Tutorial = {
  active: false,
  i: -1,                  // 현재 단계 인덱스
  shown: 0,               // 타이핑된 글자 수
  waiting: false,         // 결과 연출 대기 중 (입력 모두 잠금)

  // 대상: 선택자 문자열 | 함수(→ 요소) | 배열(여러 칸이면 칸마다 따로 구멍). click: 눌러야 할 것. until: 진행 조건
  STEPS: [
    { say: 's1', target: null, until: 'next' },
    { say: 's2', target: '#goldBadge', give: { gold: true }, until: 'next' },
    { say: 's3', target: '#statRows .statRow:first-child .statBtn', click: true, until: 'statAtk' },
    { say: 's4', target: '#equipCard', give: { weapon: { grade: 0, level: 0 }, drop: true }, until: 'next' },
    { say: 's5', target: () => UI.cells[0], give: { weapon: { grade: 0, level: 0 } }, click: true, until: 'popup' },
    // v1.6 스포트라이트 규칙: 밝게 뚫는 것은 강조 대상 요소 하나만 (6단계는 [강화] 버튼만). v1.7: 결과 성공 고정
    { say: 's6', target: '#btnEnhance', give: { enhanceCost: true }, force: 'success', click: true, until: 'enhanced' },
    { say: 's7', target: '#btnEquip', click: true, until: 'equip' },
    { say: 's8', target: '#equipNote', until: 'next' },
    { say: 's9', target: '#stageRibbon', until: 'next' },
    { say: 's10', target: '#btnChallenge', until: 'next' },
    { say: 's11', target: null, until: 'start' },
  ],

  // ---------------------------------------------------------------
  isDone() {
    try { return window.localStorage.getItem(CONFIG.TUTORIAL.storageKey) === 'true'; } catch (e) { return false; }   // 실패하면 매번 튜토리얼
  },
  saveDone() {
    try { window.localStorage.setItem(CONFIG.TUTORIAL.storageKey, 'true'); } catch (e) { /* 무시 */ }
  },
  // main.js: (v1.7) 튜토리얼 내내 전투가 멈춘다
  combatPaused() { return this.active; },
  step() { return this.STEPS[this.i] || null; },
  cellOf(id) { const k = state.inventory.findIndex(w => w.id === id); return k >= 0 ? UI.cells[k] : null; },

  init() {
    const T = STR.tut, $ = (id) => document.getElementById(id);
    $('tutSkip').textContent = T.skip;
    $('tutAskText').textContent = T.skipAsk;
    $('tutAskYes').textContent = T.skipYes;
    $('tutAskNo').textContent = T.skipNo;
    const av = $('tutAvatar');
    av.onerror = () => { av.hidden = true; };
    av.src = Sprites.uiURL(CONFIG.TUTORIAL.avatar);
    $('tutNext').addEventListener('click', () => this.onNext());
    $('tutBubble').addEventListener('click', (e) => { if (e.target.closest('#tutNext')) return; this.shown = 1e9; });   // 누르면 대사 끝까지
    $('tutSkip').addEventListener('click', () => { $('tutAsk').hidden = false; });
    $('tutAskNo').addEventListener('click', () => { $('tutAsk').hidden = true; });
    $('tutAskYes').addEventListener('click', () => { $('tutAsk').hidden = true; this.skip(); });

    // 입력 잠금: 허용 대상 밖의 클릭·누름·키 입력을 캡처 단계에서 막는다 (M·ESC·백쿼트 포함)
    const block = (e) => {
      if (!this.active) return;
      if (e.type.startsWith('key') || !this.allowed(e.target)) { e.stopImmediatePropagation(); e.preventDefault(); }
    };
    ['pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu', 'touchstart', 'keydown', 'keyup', 'keypress'].forEach(t =>
      document.addEventListener(t, block, { capture: true, passive: false }));

    // 진행 조건
    Events.on('statBought', (e) => { if (e.key === 'atk') this.cond('statAtk'); });
    Events.on('popupOpened', () => this.cond('popup'));
    Events.on('equipChanged', () => this.cond('equip'));
    Events.on('enhanceStart', () => { const s = this.step(); if (this.active && s && s.until === 'enhanced') this.waiting = true; });
    Events.on('enhanceResult', () => {
      const s = this.step();
      if (!this.active || !s || s.until !== 'enhanced') return;
      this.waiting = true;
      setTimeout(() => { this.waiting = false; this.go(this.i + 1); }, CONFIG.TUTORIAL.afterResultSec * 1000);
    });
  },
  // 이 요소를 눌러도 되는가
  allowed(el) {
    if (!el || !el.closest) return false;
    if (el.closest('#tutAsk')) return true;
    if (el.closest('#tutSkip')) return !this.waiting;
    if (el.closest('#tutBubble')) return true;
    const s = this.step();
    if (!s || !s.click || this.waiting) return false;
    const t = this.resolve(s.clickSel || s.target)[0];
    return !!t && (t === el || t.contains(el));
  },
  resolve(target) {
    if (!target) return [];
    const list = Array.isArray(target) ? target : [target];
    return list.map(t => (typeof t === 'function' ? t() : document.querySelector(t))).filter(Boolean);
  },

  // ---------------------------------------------------------------
  start() {
    UI.closeAllLayers();
    UI.guideShown = true;                 // 첫 팝업 안내 박스 대신 튜토리얼이 설명한다
    Loot.suppressDrops = true;            // 대본이 어긋나지 않게 튜토리얼 중 드롭 없음
    this.active = true;
    document.getElementById('tut').hidden = false;
    this.go(0);
  },
  go(k) {
    if (k >= this.STEPS.length) return this.finish();
    this.i = k; this.shown = 0; this.waiting = false;
    const s = this.step();
    // 지급 (플레이 로그·KPI에 세지 않는다: 골드는 log를 거치지 않고, 끝날 때 log·시간을 새로 시작)
    const g = s.give || {};
    if (g.gold) state.gold += CONFIG.TUTORIAL.gold;
    if (g.weapon) {
      const w = Loot.createWeapon(g.weapon.grade);       // 일반·고급 → 옵션 없음 (3-7)
      w.level = g.weapon.level;
      if (g.drop) Events.emit('weaponDropped', { weapon: w, isBoss: false });   // 드롭 연출 재생
      Loot.addWeapon(w);
    }
    if (g.enhanceCost) {
      const w = Loot.find(UI.popId);
      if (w) state.gold += Enhance.cost(w);
    }
    if (s.force) Enhance.forceNext = s.force;
    if (s.open === 'invFirst' && state.inventory[0]) { UI.popId = null; UI.openWeapon(state.inventory[0].id); }
    const T = STR.tut, nx = document.getElementById('tutNext');
    nx.hidden = !(s.until === 'next' || s.until === 'start');
    UI.setText(nx, s.until === 'start' ? T.start : T.next);
    UI.invDirty = true;
  },
  cond(name) {
    const s = this.step();
    if (this.active && s && s.until === name) this.go(this.i + 1);
  },
  onNext() {
    const s = this.step();
    if (!s || !(s.until === 'next' || s.until === 'start')) return;
    if (s.closeAfter) UI.closeWeapon();
    this.go(this.i + 1);
  },
  // 11단계 [시작]: 튜토리얼 종료, 전투 재개, tutorialDone 저장. 시간 지표는 여기서부터 잰다
  finish() {
    this.end();
    this.saveDone();
    Enhance.forceNext = null;
    state.log = createState().log;       // 지급·튜토리얼 강화는 로그·KPI에 넣지 않는다
    state.time = 0;
    Debug.resetWatch();
  },
  // 건너뛰기: 튜토리얼에서 준 것을 모두 되돌리고 평소처럼 시작
  skip() {
    this.end();
    this.saveDone();
    Game.restart();
    UI.guideShown = false;               // 평소처럼: 첫 팝업 안내 박스가 다시 뜬다
  },
  end() {
    this.active = false; this.i = -1; this.waiting = false;
    Loot.suppressDrops = false;
    Enhance.forceNext = null;
    document.getElementById('tut').hidden = true;
    document.getElementById('tutAsk').hidden = true;
  },
  // v1.6 설정 창 [처음부터 다시하기]: 게임 초기화 + tutorialDone 삭제 → 튜토리얼부터 다시. 소리 설정(별도 저장)은 그대로
  restartFromScratch() {
    this.end();
    try { window.localStorage.removeItem(CONFIG.TUTORIAL.storageKey); } catch (e) { /* 무시 */ }
    Game.restart();
    this.start();
  },

  // 논리 사각형 b 안에 화면 글자가 있는가 (화살표가 글자를 가리는지). 튜토리얼 자신·배경·빈 틀은 무시
  coversText(b, rr, sc) {
    // 화면 좌표의 화살표 사각형
    const S = { l: rr.left + b.l * sc, t: rr.top + b.t * sc, r: rr.left + b.r * sc, b: rr.top + b.b * sc };
    const pts = [[0.5, 0.5], [0.1, 0.2], [0.9, 0.2], [0.1, 0.85], [0.9, 0.85], [0.5, 0.1], [0.5, 0.9]];
    const seen = new Set();
    for (const [fx, fy] of pts) {
      const x = S.l + (S.r - S.l) * fx, y = S.t + (S.b - S.t) * fy;
      // 실제로 보이는 맨 위 요소만 본다 (팝업 아래에 깔린 패널 글자는 가려져 있으므로 세지 않음)
      const top = document.elementsFromPoint(x, y).find(el => !el.closest('#tut'));
      if (!top || seen.has(top) || top.tagName === 'CANVAS' || top === document.body || top === document.documentElement) continue;
      seen.add(top);
      // 요소 상자가 아니라 실제 글자 영역(Range)과 겹치는지
      for (const n of top.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) if (q.left < S.r && q.right > S.l && q.top < S.b && q.bottom > S.t) return true;
      }
    }
    return false;
  },
  // 디버그 검사 (6-9 검수): 밝은 영역이 대상 요소 사각형 + 여백 8px보다 크지 않은가, 구멍 수 = 대상 수, 화살표가 글자·대상을 가리지 않는가
  debugCheck() {
    const s = this.step(); if (!s) return null;
    const els = this.resolve(s.target).filter(el => el.getClientRects().length && el.offsetParent !== null);
    const sc = UI.scale || 1, rr = document.getElementById('root').getBoundingClientRect(), p = CONFIG.TUTORIAL.holePad;
    const holes = this.holes || [];
    const sizeOk = holes.length === els.length && els.every((el, i) => {
      const r = el.getBoundingClientRect(), h = holes[i];
      const w = (r.width / sc) + 2 * p, hh = (r.height / sc) + 2 * p;
      return (h.r - h.l) <= w + 0.5 && (h.b - h.t) <= hh + 0.5;
    });
    const a = this.arrowBox;
    const arrowOk = !a || (!this.coversText(a, rr, sc) && !holes.some(h => a.l < h.r && a.r > h.l && a.t < h.b && a.b > h.t));
    return { step: this.i + 1, targets: els.length, holes: holes.length, sizeOk, arrowOk };
  },

  // ---------------------------------------------------------------
  // 매 프레임: 구멍·화살표·말풍선 위치를 다시 맞추고 대사를 타이핑 (실제 시간)
  update(realDt) {
    if (!this.active) return;
    const s = this.step(); if (!s) return;
    const $ = (id) => document.getElementById(id), C = CONFIG.TUTORIAL;
    this.shown = Math.min(1e9, this.shown + C.typeCps * realDt);
    const text = STR.tut[s.say];
    UI.setText($('tutText'), text.slice(0, Math.floor(this.shown)));

    // v1.6 스포트라이트 규칙: 강조 대상 요소마다 따로 (부모 영역·합친 사각형 없음). 논리 좌표(#root 기준)
    const els = this.resolve(s.target).filter(el => el.getClientRects().length && el.offsetParent !== null);
    const sc = UI.scale || 1, rr = document.getElementById('root').getBoundingClientRect(), p = C.holePad;
    const toLogic = (r) => ({ l: (r.left - rr.left) / sc, t: (r.top - rr.top) / sc, r: (r.right - rr.left) / sc, b: (r.bottom - rr.top) / sc });
    const holes = els.map(el => { const b = toLogic(el.getBoundingClientRect()); return { l: b.l - p, t: b.t - p, r: b.r + p, b: b.b + p }; });
    this.holes = holes;
    const root = document.getElementById('root');
    const wl = parseFloat(root.style.getPropertyValue('--wl')) || 0, wt = parseFloat(root.style.getPropertyValue('--wt')) || 0;
    const ww = parseFloat(root.style.getPropertyValue('--ww')) || CONFIG.BASE_W, wh = parseFloat(root.style.getPropertyValue('--wh')) || CONFIG.BASE_H;

    // 어둡게 덮기: 창 전체 검정 60%를 그리고 구멍마다 지운다
    const dim = $('tutDim'), dpr = window.devicePixelRatio || 1, cw = Math.round(ww * sc * dpr), ch = Math.round(wh * sc * dpr);
    if (dim.width !== cw || dim.height !== ch) { dim.width = cw; dim.height = ch; }
    const g = dim.getContext('2d'), k = sc * dpr;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch);
    g.fillStyle = `rgba(0,0,0,${C.dim})`; g.fillRect(0, 0, cw, ch);
    g.setTransform(k, 0, 0, k, -wl * k, -wt * k);
    for (const h of holes) g.clearRect(h.l, h.t, h.r - h.l, h.b - h.t);
    // 구멍 테두리 (#E8B04B 3px, 1초 주기)
    const hb = $('tutHoles');
    while (hb.children.length < holes.length) { const d = document.createElement('div'); d.className = 'tutHole'; hb.appendChild(d); }
    [...hb.children].forEach((d, i) => {
      const h = holes[i]; d.hidden = !h;
      if (h) Object.assign(d.style, { left: h.l + 'px', top: h.t + 'px', width: (h.r - h.l) + 'px', height: (h.b - h.t) + 'px' });
    });

    // 화살표: 밝은 대상의 위쪽 바깥 가운데(▼). 다른 글자를 가리면 아래쪽 바깥(▲)
    const arrow = $('tutArrow'), bub = $('tutBubble'), AW = 28, AH = 20;   // 화살표 글자 크기만큼
    let arrowBox = null;
    if (holes.length) {
      const u = holes.reduce((a, h) => ({ l: Math.min(a.l, h.l), t: Math.min(a.t, h.t), r: Math.max(a.r, h.r), b: Math.max(a.b, h.b) }));
      // 후보: 위 가운데(▼) → 아래 가운데(▲) → 대상 왼쪽·오른쪽 끝의 위·아래. 글자·구멍을 가리지 않는 첫 자리
      const at = (cx, down) => ({ l: cx - AW / 2, t: down ? u.b + 1 : u.t - AH - 1, r: cx + AW / 2, b: down ? u.b + 1 + AH : u.t - 1, down });
      const cx = (u.l + u.r) / 2, lx = u.l + AW / 2 + 4, rx = u.r - AW / 2 - 4;
      const cands = [at(cx, false), at(cx, true), at(lx, false), at(rx, false), at(lx, true), at(rx, true)];
      const free = (b) => !this.coversText(b, rr, sc) && !holes.some(h => b.l < h.r && b.r > h.l && b.t < h.b && b.b > h.t);
      arrowBox = cands.find(free) || cands[0];
      arrow.textContent = arrowBox.down ? '▲' : '▼';
      arrow.style.left = arrowBox.l + 'px'; arrow.style.top = arrowBox.t + 'px';
      arrow.hidden = false;
    } else arrow.hidden = true;
    this.arrowBox = arrowBox;

    // 말풍선: 대상과 화살표를 가리지 않는 쪽(아래 또는 위), 대상이 없으면 화면 가운데
    const bw = bub.offsetWidth, bh = bub.offsetHeight, gap = 12;
    let x, y;
    if (!holes.length) { x = wl + (ww - bw) / 2; y = wt + (wh - bh) / 2; }
    else {
      const occ = [...holes, arrowBox].reduce((a, h) => ({ l: Math.min(a.l, h.l), t: Math.min(a.t, h.t), r: Math.max(a.r, h.r), b: Math.max(a.b, h.b) }));
      x = Math.max(wl + 12, Math.min(wl + ww - bw - 12, (occ.l + occ.r) / 2 - bw / 2));
      const below = occ.b + gap, above = occ.t - gap - bh;
      if (below + bh <= wt + wh - 12) y = below;
      else if (above >= wt + 12) y = above;
      else { y = Math.max(wt + 12, Math.min(wt + wh - bh - 12, (occ.t + occ.b) / 2 - bh / 2)); x = occ.l - bw - gap >= wl + 12 ? occ.l - bw - gap : occ.r + gap; }
    }
    // [건너뛰기] 버튼과 겹치면 말풍선을 버튼 왼쪽으로 비켜 놓는다 (안 되면 버튼 아래로)
    const sk = $('tutSkip').getBoundingClientRect();
    const sb = { l: (sk.left - rr.left) / sc - 8, t: (sk.top - rr.top) / sc - 8, r: (sk.right - rr.left) / sc + 8, b: (sk.bottom - rr.top) / sc + 8 };
    if (x < sb.r && x + bw > sb.l && y < sb.b && y + bh > sb.t) {
      if (sb.l - bw >= wl + 12) x = sb.l - bw;
      else y = sb.b;
    }
    bub.style.left = Math.round(x) + 'px'; bub.style.top = Math.round(y) + 'px';
  },
};
