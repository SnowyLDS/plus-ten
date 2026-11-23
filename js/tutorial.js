// =====================================================================
// tutorial.js — 따라 하며 배우기 (6-9, v1.4)
// - 강조된 것을 직접 눌러야 다음으로. 강조 대상 밖의 클릭·누름·키 입력은 document 캡처 단계에서 막는다.
// - "전투 진행" 단계(2단계)만 전투가 흐르고, 나머지 단계에서는 전투·드롭·골드 획득이 멈춘다(main.js).
// - 튜토리얼 예외: 단계별 지급(골드·무기), 강화 결과 고정 2회(7단계 성공, 12단계 파괴). 끝나면 4-5 표로 돌아간다.
// - 단계 정의는 아래 STEPS 배열 하나 (대상 선택자, 대사 키, 지급, 고정 결과, 진행 조건) → 순서를 바꾸기 쉽다.
// =====================================================================
const Tutorial = {
  active: false,
  i: -1,                  // 현재 단계 인덱스
  shown: 0,               // 타이핑된 글자 수
  waiting: false,         // 결과 연출 대기 중 (입력 모두 잠금)

  // 대상: 선택자 문자열 | 함수(→ 요소) | 배열(여러 개 합친 사각형). click: 눌러야 할 것. until: 진행 조건
  STEPS: [
    { say: 's1', target: null, until: 'next' },
    { say: 's2', target: '#battle', combat: true, until: 'kill' },
    { say: 's3', target: '#goldBadge', give: { gold: true }, until: 'next' },
    { say: 's4', target: '#statRows .statRow:first-child .statBtn', click: true, until: 'statAtk' },
    { say: 's5', target: '#equipCard', give: { weapon: { grade: 0, level: 0 }, drop: true }, until: 'next' },
    { say: 's6', target: () => UI.cells[0], give: { weapon: { grade: 0, level: 0 } }, click: true, until: 'popup' },
    { say: 's7', target: ['#btnEnhance', '#popProb'], clickSel: '#btnEnhance', give: { enhanceCost: true }, force: 'success', click: true, until: 'enhanced' },
    { say: 's8', target: '#btnEquip', click: true, until: 'equip' },
    { say: 's9', target: '#equipNote', until: 'next' },
    { say: 's10', target: () => Tutorial.cellOf(Tutorial.practiceId), give: { weapon: { grade: 1, level: 3, practice: true } }, click: true, until: 'popup' },
    { say: 's11', target: ['#popProb .pc:nth-child(2)', '#popProb .pc:nth-child(3)'], until: 'next' },
    { say: 's12', target: '#btnEnhance', give: { enhanceCost: true }, force: 'destroy', click: true, until: 'enhanced' },
    { say: 's13', target: '#equipCard', until: 'next' },
    { say: 's14', target: ['#popSellLabel', '#popSell'], open: 'invFirst', until: 'next', closeAfter: true },
    { say: 's15', target: '#stageRibbon', until: 'next' },
    { say: 's16', target: '#btnChallenge', until: 'next' },
    { say: 's17', target: null, until: 'start' },
  ],

  // ---------------------------------------------------------------
  isDone() {
    try { return window.localStorage.getItem(CONFIG.TUTORIAL.storageKey) === 'true'; } catch (e) { return false; }   // 실패하면 매번 튜토리얼
  },
  saveDone() {
    try { window.localStorage.setItem(CONFIG.TUTORIAL.storageKey, 'true'); } catch (e) { /* 무시 */ }
  },
  // main.js: 이 단계에서 전투가 흐르는가
  combatPaused() { return this.active && !(this.step() && this.step().combat); },
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
    Events.on('monsterKilled', () => this.cond('kill'));
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
      if (g.weapon.practice) { w.label = STR.tut.practiceSword; this.practiceId = w.id; }
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
  // 17단계 [시작]: 튜토리얼 종료, 전투 재개, tutorialDone 저장. 시간 지표는 여기서부터 잰다
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
  // 설정 창 [튜토리얼 다시 보기]: 게임 초기화 후 다시
  replay() {
    this.end();
    Game.restart();
    this.start();
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

    // 논리 좌표(#root 기준)로 바꾼 대상 사각형 (여러 개면 합친 것)
    const els = this.resolve(s.target).filter(el => el.getClientRects().length && el.offsetParent !== null);
    const sc = UI.scale || 1, rr = document.getElementById('root').getBoundingClientRect();
    let box = null;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const b = { l: (r.left - rr.left) / sc, t: (r.top - rr.top) / sc, r: (r.right - rr.left) / sc, b: (r.bottom - rr.top) / sc };
      box = box ? { l: Math.min(box.l, b.l), t: Math.min(box.t, b.t), r: Math.max(box.r, b.r), b: Math.max(box.b, b.b) } : b;
    }
    const hole = $('tutHole'), dim = $('tutDim'), arrow = $('tutArrow'), bub = $('tutBubble');
    if (box) {
      const p = C.holePad;
      Object.assign(hole.style, { left: (box.l - p) + 'px', top: (box.t - p) + 'px', width: (box.r - box.l + 2 * p) + 'px', height: (box.b - box.t + 2 * p) + 'px' });
      hole.hidden = false; dim.hidden = true; arrow.hidden = false;
      arrow.style.left = ((box.l + box.r) / 2 - 20) + 'px';
      arrow.style.top = (box.t - p - 34) + 'px';
    } else {
      hole.hidden = true; dim.hidden = false; arrow.hidden = true;
    }
    // 말풍선: 강조 대상을 가리지 않게 위 또는 아래, 대상이 없으면 화면 가운데
    const root = document.getElementById('root');
    const wl = parseFloat(root.style.getPropertyValue('--wl')) || 0, wt = parseFloat(root.style.getPropertyValue('--wt')) || 0;
    const ww = parseFloat(root.style.getPropertyValue('--ww')) || CONFIG.BASE_W, wh = parseFloat(root.style.getPropertyValue('--wh')) || CONFIG.BASE_H;
    const bw = bub.offsetWidth, bh = bub.offsetHeight, gap = 16;
    let x, y;
    if (!box) { x = wl + (ww - bw) / 2; y = wt + (wh - bh) / 2; }
    else {
      x = Math.max(wl + 12, Math.min(wl + ww - bw - 12, (box.l + box.r) / 2 - bw / 2));
      const below = box.b + C.holePad + gap, above = box.t - C.holePad - 40 - gap - bh;
      y = (below + bh <= wt + wh - 12) ? below : Math.max(wt + 12, above);
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
