// =====================================================================
// ui.js — DOM 패널·팝업·토스트. state를 읽고 이벤트를 받아 표시만 한다.
// v1.3 (6-7 UI 리뉴얼): 종이 액자 패널 3개, 칸 스타일, 갈무리 글꼴, 종이용 글자 색
// =====================================================================
const $ = (id) => document.getElementById(id);

// 숫자 표기: 1,000 단위 콤마. 100,000 이상 K, 100,000,000 이상 M (예: 295.1K)
// TODO(기획확인): K/M 소수 첫째 자리는 버림으로 처리 (295,150 → 295.1K 예시와 일치)
// TODO(기획확인): 몬스터 골드 공식 때문에 보유 골드는 내부에서 실수로 쌓인다. 표시는 버림 정수
//   (반올림하면 "10"이 보이는데 비용 10을 못 사는 경우가 생김). 몬스터 수치 표시는 fmtRound(반올림).
function fmt(n) {
  n = Math.floor(n + CONFIG.FLOAT_EPS);
  if (n >= CONFIG.NUM_M) return (Math.floor(n / 100000) / 10).toFixed(1) + 'M';
  if (n >= CONFIG.NUM_K) return (Math.floor(n / 100) / 10).toFixed(1) + 'K';
  return n.toLocaleString('en-US');
}
// 몬스터 수치 등 "표시할 때 반올림" 값
function fmtRound(n) { return fmt(Math.round(n)); }

const UI = {
  scale: 1,
  popId: null,          // 열려 있는 무기 상세 팝업의 무기 id
  invDirty: true,
  layoutWarnings: 0,    // 6-7 인벤토리 레이아웃 디버그 검사 결과

  init() {
    $('statTitle').textContent = STR.panelStats;
    $('equipTitle').textContent = STR.panelEquip;
    $('invTitle').textContent = STR.panelInventory;
    $('equipNote').textContent = STR.equipProtected;   // 5장 v1.1 안내 5번: 카드 아래 항상 표시
    $('btnChallenge').textContent = STR.challenge;
    $('btnBulk').textContent = STR.bulkSell;
    $('btnCredits').textContent = STR.credits;
    $('btnChallenge').addEventListener('click', () => Stage.requestChallenge());
    $('btnBulk').addEventListener('click', () => Loot.bulkSell());

    this.buildStats();
    this.buildInventory();
    this.buildPopup();
    this.buildCredits();
    this.buildEquipDetail();
    document.querySelectorAll('img.coin').forEach(img => this.setIcon(img, 'gold'));

    const dirty = () => { this.invDirty = true; };
    ['inventoryChanged', 'equipChanged', 'enhanceStart', 'enhanceResult', 'assetLoaded'].forEach(e => Events.on(e, dirty));
    // 경고성 토스트(인벤토리 가득, 장착 불가)는 왼쪽 빨간 띠
    Events.on('autoSold', (e) => this.toast(STR.toastAutoSell(Loot.name(e.weapon), e.weapon.level, fmt(e.price)), true));
    Events.on('bulkSold', (e) => this.toast(e.count ? STR.toastBulkSell(e.count, fmt(e.total)) : STR.toastBulkNone));
    Events.on('defeat', () => this.toast(STR.toastDefeat));
    // 3-7: 상옵이 1개 이상 붙은 무기를 얻으면 드롭 토스트에 "상급 옵션!" + 금색 테두리 번쩍
    // TODO(기획확인): 일반 드롭 토스트는 원래 없어서, 상급 옵션 무기일 때만 드롭 토스트를 띄운다
    Events.on('weaponDropped', (e) => { if (Loot.hasHighOption(e.weapon)) this.toast(STR.highOptToast(Loot.name(e.weapon)), 'high'); });
    Events.on('toast', (e) => this.toast(e.text));
    Events.on('enhanceStart', () => this.setResult(STR.enhancing, CONFIG.UI13.sub));
    Events.on('enhanceResult', (e) => {
      if (e.id !== this.popId) return;
      const P = CONFIG.UI13.probText;    // 종이용 결과 색: 성공 / 하락 / 파괴 / 유지
      if (e.result === 'success') this.setResult(STR.resSuccess(e.to), P[0]);
      else if (e.result === 'keep') this.setResult(STR.resKeep, P[3]);
      else if (e.result === 'drop') this.setResult(STR.resDrop(e.from, e.to), P[1]);
      else { this.setResult(STR.resDestroy, P[2]); this.renderPopup(); }   // 파괴: 팝업 닫고 인벤토리로
    });

    Skin.init();
    this.applySkin();
    window.addEventListener('resize', () => UI.fit());
    UI.fit();
  },

  fit() {
    const s = Math.min(window.innerWidth / CONFIG.BASE_W, window.innerHeight / CONFIG.BASE_H);
    const r = $('root');
    r.style.transform = `scale(${s})`;
    r.style.left = ((window.innerWidth - CONFIG.BASE_W * s) / 2) + 'px';
    r.style.top = ((window.innerHeight - CONFIG.BASE_H * s) / 2) + 'px';
    UI.scale = s;
    // v1.4 6-8: 창 전체 사각형(논리 좌표). HUD는 창 가장자리 12px에, 팝업 뒤 어두운 배경은 창 전체에
    const ox = (window.innerWidth - CONFIG.BASE_W * s) / 2, oy = (window.innerHeight - CONFIG.BASE_H * s) / 2;
    r.style.setProperty('--wl', (-ox / s) + 'px');
    r.style.setProperty('--wt', (-oy / s) + 'px');
    r.style.setProperty('--ww', (window.innerWidth / s) + 'px');
    r.style.setProperty('--wh', (window.innerHeight / s) + 'px');
    UI.layoutInventory();
  },

  // 같은 값이면 DOM을 건드리지 않는다. 스킨 캔버스가 깔린 요소는 글자 칸(label)만 바꾼다
  lbl(el) { return (el._skin && el._skin.label) || el; },
  setText(el, t) { if (el._t !== t) { el._t = t; this.lbl(el).textContent = t; } },
  setHtml(el, h) { if (el._h !== h) { el._h = h; this.lbl(el).innerHTML = h; } },

  // 6-7 UI 리뉴얼: 하단 패널 3개·모든 팝업 = 이중선 종이 액자, 전투 화면 = 어두운 나무 액자,
  // 버튼 = Tiny Swords 파랑/빨강 그대로 (판매 확인 창의 "판매"는 빨강)
  applySkin() {
    ['statPanel', 'equipPanel', 'invPanel', 'popup', 'guideBox', 'confirmBox', 'settingsBox', 'creditsBox', 'tutAskBox', 'equipBox'].forEach(id => Skin.attach($(id), 'paper'));
    // v1.4: 전투 화면 테두리는 그리지 않는다 (6-8)
    Skin.attach($('stageRibbon'), 'ribbon');
    $('btnSell').dataset.skin = 'red';
    $('btnConfirmYes').dataset.skin = 'red';
    $('btnEnhance').dataset.skin = 'danger';           // 파괴 가능 단계(.danger)일 때만 빨강
    document.querySelectorAll('#root .btn').forEach(b => {
      if (b.closest('#debug') || b.classList.contains('roundBtn')) return;
      Skin.attach(b, 'button');
    });
    // 버튼 글자는 스킨 캔버스 위 span에 둔다 (textContent로 캔버스가 지워지지 않게)
    for (const s of Skin.list) {
      if (s.type !== 'button' && s.type !== 'ribbon') continue;
      const span = document.createElement('span'); span.className = 'lbl';
      while (s.cv.nextSibling) span.appendChild(s.cv.nextSibling);
      s.el.appendChild(span);
      s.label = span;
    }
    // 설정·닫기 버튼: TinyRoundBlueButton(40px) + 톱니바퀴 / X 아이콘 (Tiny Swords 그대로)
    Skin.attach($('btnSettings'), 'round', { icon: 'gear' });
    Skin.attach($('btnSetClose'), 'round', { icon: 'close' });
    this.setIcon($('musicIcon'), 'music');
    this.setIcon($('goldIcon'), 'gold');
    this.setIcon($('guideIcon'), 'info');
    $('guideTitleText').textContent = STR.guideTitle;
  },
  // 아이콘 <img>: 파일이 없으면 숨긴다 (CSS는 #root.skin일 때만 보여줌)
  setIcon(img, key) {
    if (!img) return;
    img.onerror = () => { img.hidden = true; };
    img.src = Sprites.uiURL(CONFIG.SKIN.icons[key]);
  },
  // fantasy.png 아이콘 (1배 32px / 2배 64px). 시트가 없으면 예전 아이콘(<img>)으로
  iconHtml(cell, size, fallbackSrc) {
    const n = CONFIG.UI13.iconSize, k = size / n;
    const ico = `<span class="ico ico${size}" style="background-position:${-cell[0] * n * k}px ${-cell[1] * n * k}px"></span>`;
    return ico + (fallbackSrc ? `<img class="icoFb" src="${fallbackSrc}" alt="">` : '');
  },
  weaponIcon(w, size) { return this.iconHtml(CONFIG.UI13.weaponIcons[w.grade], size, Render.weaponIconURL()); },

  gradeColor(g) { return CONFIG.GRADES[g].color; },
  gradeText(g) { return CONFIG.UI13.gradeText[g]; },    // 종이 위 등급 이름 글자 (진한 버전)
  applyGradeBorder(el, w) {
    el.style.setProperty('--grade', w ? this.gradeColor(w.grade) : 'transparent');
    el.classList.toggle('graded', !!w);
    el.classList.toggle('glow', !!w && w.grade >= CONFIG.GLOW_GRADE_MIN);
  },

  // ---------------------------------------------------------------
  // 스탯 패널: 아이콘, 이름, 현재값 → 다음값, 비용 버튼. 누르고 있으면 0.15초마다 연속 구매
  // ---------------------------------------------------------------
  statFmt(key, v) { return key === 'aspd' ? v.toFixed(CONFIG.ASPD_DECIMALS) : fmt(v); },
  buildStats() {
    const box = $('statRows');
    this.statEls = {};
    for (const key of CONFIG.STAT_ORDER) {
      const row = document.createElement('div'); row.className = 'statRow';
      // 6-12: 스탯 이름 바로 오른쪽에 "Lv.N" (Galmuri11 12px)
      row.innerHTML = `<span class="statIco">${this.iconHtml(CONFIG.UI13.statIcons[key], 32)}</span><div class="statName">${STR.statNames[key]} <span class="statLv"><span class="lvNum"></span><span class="lvMax"></span></span></div><div class="statVal num"></div><button class="btn statBtn num"></button>`;
      box.appendChild(row);
      const btn = row.querySelector('button');
      let timer = null;
      const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
      btn.addEventListener('pointerdown', (e) => {
        if (btn.disabled || e.button !== 0) return;
        Combat.buyStat(key);
        stop();
        timer = setInterval(() => { if (!Combat.buyStat(key)) stop(); }, CONFIG.HOLD_REPEAT_MS);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
      this.statEls[key] = { val: row.querySelector('.statVal'), btn, lv: row.querySelector('.lvNum'), max: row.querySelector('.lvMax'), lastLv: null };
    }
    // 3-7: 치명타는 옵션이 있을 때만 한 줄 추가 (구매 버튼 없음)
    const cr = document.createElement('div'); cr.className = 'statRow critRow'; cr.hidden = true;
    cr.innerHTML = `<span class="statIco"></span><div class="statName">${STR.critName}</div><div class="statVal num"></div><span></span>`;
    box.appendChild(cr);
    this.critRow = cr;
  },
  // 스탯 패널 값은 옵션을 더한 최종값, 옵션 분은 뒤에 작게 (예: "공격속도 1.38 (+15%)")
  statShown(key, lv) {
    const v = Combat.statValue(key, lv);
    if (key === 'aspd') return Math.min(CONFIG.OPTIONS.aspdFinalMax, v * (1 + Combat.optionSum('aspd') / 100));
    if (key === 'def') return v + Combat.optionSum('def');
    return v;
  },
  optSuffix(key) {
    const s = key === 'aspd' || key === 'def' ? Combat.optionSum(key) : 0;
    if (!s) return '';
    return `<span class="optS">${key === 'aspd' ? STR.optSuffixPct(s) : STR.optSuffixAdd(s)}</span>`;
  },
  updateStats() {
    for (const key of CONFIG.STAT_ORDER) {
      const el = this.statEls[key], lv = state.statLv[key];
      const cur = this.statShown(key, lv), suf = this.optSuffix(key);
      // 6-12: Lv.N, 최대면 " MAX"(#E8B04B). 레벨이 오르면 숫자가 0.2초 동안 1.3배 커졌다 돌아온다
      if (el.lastLv !== lv) {
        this.setText(el.lv, STR.statLv(lv));
        if (el.lastLv !== null && lv > el.lastLv) { el.lv.classList.remove('bump'); void el.lv.offsetWidth; el.lv.classList.add('bump'); }
        el.lastLv = lv;
      }
      this.setText(el.max, Combat.isStatMax(key) ? ' ' + STR.statMax : '');
      if (Combat.isStatMax(key)) {
        this.setHtml(el.val, `${this.statFmt(key, cur)}${suf}`);
        this.setText(el.btn, STR.statMax);
        el.btn.disabled = true;
      } else {
        const next = this.statShown(key, lv + 1);
        this.setHtml(el.val, `${this.statFmt(key, cur)}<span class="arrow">→</span><span class="next">${this.statFmt(key, next)}</span>${suf}`);
        this.setText(el.btn, fmt(Combat.statCost(key, lv)));
        el.btn.disabled = !Combat.canBuyStat(key);   // 골드 부족 시 회색 비활성
      }
    }
    const cc = Math.round(Combat.critChance() * 100);
    if (this.critRow.hidden !== !cc) { this.critRow.hidden = !cc; this.layoutInventory(); }
    if (cc) this.setText(this.critRow.querySelector('.statVal'), `${cc}%`);
  },
  // 옵션 뱃지 + 문구 (팝업 줄·툴팁)
  optLine(o) { return STR.optText(o.type, Loot.optionValue(o)); },
  optBadge(o) { return `<span class="tag optTier" style="background:${CONFIG.OPTIONS.tierColor[o.tier]}">${STR.optTierNames[o.tier]}</span>`; },
  // 6-10: "추가 옵션" 목록 — 장착 무기 상세 창과 인벤토리 무기 상세 팝업이 같은 코드를 쓴다
  optionsHtml(w) {
    const opts = (w && w.options) || [];
    const body = opts.length
      ? opts.map(o => `<div class="optLine">${this.optBadge(o)}<span>${this.optLine(o)}</span></div>`).join('')
      : `<div class="optNone">${STR.optNone}</div>`;
    return `<div class="optHead">${STR.optHeader}</div>${body}`;
  },
  optTooltip(w) { return (w.options || []).map(o => `[${STR.optTierNames[o.tier]}] ${this.optLine(o)}`).join('\n'); },
  optDots(w) {
    if (!w.options || !w.options.length) return '';
    return `<span class="optDots">${w.options.map(o => `<i style="background:${CONFIG.OPTIONS.tierColor[o.tier]}"></i>`).join('')}</span>`;
  },

  // ---------------------------------------------------------------
  // 장착 슬롯 + 인벤토리 (5×4)
  // ---------------------------------------------------------------
  buildInventory() {
    const grid = $('invGrid');
    this.cells = [];
    for (let i = 0; i < CONFIG.INVENTORY_SIZE; i++) {
      const c = document.createElement('div'); c.className = 'cell slot';
      c.addEventListener('click', () => { if (c._wid) this.openWeapon(c._wid); });
      grid.appendChild(c);
      this.cells.push(c);
    }
    // 장착 슬롯: 클릭해도 아무 버튼 없음 (강화·판매·해제 불가)
  },
  // 칸 = min(floor((격자 너비 − 4×간격) / 5), floor((격자 높이 − 3×간격) / 4)). 창 크기가 바뀌면 다시 계산
  layoutInventory() {
    const grid = $('invGrid');
    if (!grid) return;
    const g = CONFIG.UI13.cellGap, cols = CONFIG.INVENTORY_COLS, rows = CONFIG.INVENTORY_SIZE / cols;
    const gw = grid.clientWidth, gh = grid.clientHeight;
    if (!gw || !gh) return;
    const cell = Math.max(0, Math.min(Math.floor((gw - (cols - 1) * g) / cols), Math.floor((gh - (rows - 1) * g) / rows)));
    if (cell !== this.cellSize) {
      this.cellSize = cell;
      grid.style.gridTemplateColumns = `repeat(${cols}, ${cell}px)`;
      grid.style.gridTemplateRows = `repeat(${rows}, ${cell}px)`;
    }
    this.checkLayout();
  },
  renderInventory() {
    // 장착 카드: 칸 72×72, 아이콘 32px(1배)
    const eq = state.equipped, card = $('equipCard');
    card.classList.toggle('clickable', !!eq);      // 6-10: 누르면 장착 무기 상세 창
    this.applyGradeBorder(card, eq);
    if (eq) {
      card.innerHTML = this.weaponIcon(eq, 32);
      card.title = '';
      this.setText($('equipGrip'), STR.gripValue(Loot.grip(eq)));
      this.setHtml($('equipName'), `<span style="color:${this.gradeText(eq.grade)}">${Loot.name(eq)}</span> <span class="num">+${eq.level}</span>`);
    } else {
      card.innerHTML = '';
      this.setText($('equipGrip'), '');
      this.setText($('equipName'), STR.noWeapon);
    }
    // 격자 (state.inventory는 항상 정렬돼 있음). 깡스탯 %는 칸에 쓰지 않고 툴팁으로
    const enhId = state.enhancing ? state.enhancing.id : -1;
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i], w = state.inventory[i];
      c._wid = w ? w.id : null;
      c.classList.toggle('filled', !!w);
      c.classList.toggle('enh', !!w && w.id === enhId);
      this.applyGradeBorder(c, w);
      // 툴팁: 깡스탯 + 옵션 목록. 왼쪽 아래 소켓 수만큼 4×4 점(옵션 등급 색)
      c.title = w ? `${Loot.name(w)} +${w.level} · ${STR.gripLabel} ${STR.gripValue(Loot.grip(w))}` + (w.options && w.options.length ? '\n' + this.optTooltip(w) : '') : '';
      c.innerHTML = w ? this.weaponIcon(w, 32) + `<span class="lv num">+${w.level}</span>` + this.optDots(w) +
        (Loot.isBetter(w) ? '<span class="up">▲</span>' : '') : '';
    }
    $('invCount').textContent = `${state.inventory.length}/${CONFIG.INVENTORY_SIZE}`;
    $('invDot').hidden = !Loot.hasBetter();       // 더 좋은 무기가 있으면 제목에 빨간 점
    this.layoutInventory();
  },

  // 6-7 디버그 검사: 패널 안 모든 자식의 사각형이 패널 안쪽 영역(액자 두께 28px 안)을 벗어나면 콘솔 경고.
  // 패널에는 overflow: hidden을 걸지 않는다 (문제를 숨기지 않기 위해)
  checkLayout() {
    const inset = CONFIG.UI13.frameInset * this.scale, tol = 0.5, out = [];
    for (const id of ['statPanel', 'equipPanel', 'invPanel']) {
      const p = $(id);
      if (!p || !p.offsetParent) continue;
      const r = p.getBoundingClientRect();
      const L = r.left + inset - tol, T = r.top + inset - tol, R = r.right - inset + tol, B = r.bottom - inset + tol;
      p.querySelectorAll('*').forEach(el => {
        if (el.classList.contains('skin') || el.closest('canvas.skin')) return;
        const e = el.getBoundingClientRect();
        if (!e.width && !e.height) return;
        if (e.left < L || e.top < T || e.right > R || e.bottom > B) {
          out.push(`${id} > ${el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.')} ` +
            `[${Math.round((e.left - r.left) / this.scale)},${Math.round((e.top - r.top) / this.scale)} ${Math.round(e.width / this.scale)}×${Math.round(e.height / this.scale)}]`);
        }
      });
    }
    this.layoutWarnings = out.length;
    const key = out.join('|');
    if (key !== this._layoutKey) {
      this._layoutKey = key;
      out.forEach(m => console.warn('[레이아웃] 패널 안쪽 영역을 벗어남: ' + m));
    }
    return out;
  },

  // ---------------------------------------------------------------
  // 무기 상세 팝업: 깡스탯, 다음 단계 깡스탯, 4가지 확률, 강화 비용, 판매가 / 강화·장착·판매·닫기
  // ---------------------------------------------------------------
  buildPopup() {
    $('btnEnhance').textContent = STR.btnEnhance;
    $('btnEquip').textContent = STR.btnEquip;
    $('btnSell').textContent = STR.btnSell;
    $('btnClose').textContent = STR.btnClose;
    $('popGripLabel').textContent = STR.gripLabel;
    $('popCostLabel').textContent = STR.enhanceCost;
    $('popSellLabel').textContent = STR.sellPrice;
    // 확률 4칸: 같은 너비 격자. 위에 이름(12px), 아래 숫자(24px Bold, 종이용 확률 색)
    const names = [STR.probSuccess, STR.probDrop, STR.probDestroy, STR.probKeep];
    $('popProb').innerHTML = names.map((n, i) =>
      `<div class="pc"><span class="pn">${n}</span><span class="pv num" style="color:${CONFIG.UI13.probText[i]}"></span></div>`).join('');
    $('btnClose').addEventListener('click', () => this.closeWeapon());
    $('popupLayer').addEventListener('click', (e) => { if (e.target === $('popupLayer') && !state.enhancing) this.closeWeapon(); });
    $('btnEquip').addEventListener('click', () => {
      const w = Loot.find(this.popId);
      if (this.isWeaker(w)) { this.toast(STR.equipBlockedToast(Loot.grip(state.equipped)), true); return; }  // 무시하지 말고 안내
      if (Loot.equip(this.popId)) this.closeWeapon();
    });
    $('btnGuideOk').textContent = STR.guideOk;
    $('guideText').textContent = STR.guideText;
    $('btnGuideOk').addEventListener('click', () => { $('guideLayer').hidden = true; });
    $('btnSell').addEventListener('click', () => {
      const w = Loot.find(this.popId);
      if (!Loot.canSell(w)) return;
      const doSell = () => {
        const price = Loot.sell(w.id);
        if (price) this.toast(STR.toastSold(Loot.name(w), w.level, fmt(price)));
        this.closeWeapon();
      };
      // 확인 창은 3-6 경우에만: 희귀 이상 또는 +5 이상
      if (Loot.needsConfirm(w)) this.confirm(STR.confirmSell(Loot.name(w), w.level, fmt(Loot.sellPrice(w))), doSell);
      else doSell();
    });
    $('btnEnhance').addEventListener('click', () => { Enhance.start(this.popId); });
    $('btnConfirmYes').textContent = STR.yes;
    $('btnConfirmNo').textContent = STR.no;
    $('btnConfirmYes').addEventListener('click', () => { const f = this._confirmYes; this.closeConfirm(); if (f) f(); });
    $('btnConfirmNo').addEventListener('click', () => this.closeConfirm());
  },
  // ---------------------------------------------------------------
  // 6-10 장착 무기 상세 창 (읽기 전용). 강화·판매·해제 버튼은 없다
  // ---------------------------------------------------------------
  buildEquipDetail() {
    $('eqPowLabel').textContent = STR.eqDetailPower;
    $('eqEffHead').textContent = STR.effectHeader;
    $('eqNote').textContent = STR.eqDetailNote;
    $('btnEqClose').textContent = STR.btnClose;
    $('eqBar').innerHTML = '<span class="eqCells">' + '<i></i>'.repeat(CONFIG.MAX_LEVEL) + '</span><span id="eqBarText"></span>';
    $('equipCard').addEventListener('click', () => this.openEquipDetail());
    $('btnEqClose').addEventListener('click', () => this.closeEquipDetail());
    $('equipLayer').addEventListener('click', (e) => { if (e.target === $('equipLayer')) this.closeEquipDetail(); });   // 창 바깥
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('equipLayer').hidden) this.closeEquipDetail(); });
  },
  openEquipDetail() {
    if (!state.equipped) return;
    this.renderEquipDetail();
    $('equipLayer').hidden = false;
  },
  closeEquipDetail() { $('equipLayer').hidden = true; },
  renderEquipDetail() {
    const w = state.equipped;
    if (!w) return;
    // 제목: 등급 + 무기 이름 + 강화 수치 (등급 이름 색, 24px)
    $('eqTitle').innerHTML = `<span style="color:${this.gradeText(w.grade)}">${Loot.name(w)} +${w.level}</span>`;
    // 왼쪽: 칸 스타일 아이콘 96×96 (아이콘 2배)
    const ic = $('eqIcon');
    this.applyGradeBorder(ic, w);
    ic.innerHTML = this.iconHtml(CONFIG.UI13.weaponIcons[w.grade], 64, Render.weaponIconURL());
    // 오른쪽 큰 숫자: 무기 공격력 (36px)
    $('eqPow').textContent = STR.gripValue(Loot.grip(w));
    // 강화 수치 막대: 칸 10개 중 달성한 만큼 금색
    $('eqBar').querySelectorAll('.eqCells i').forEach((c, i) => c.classList.toggle('on', i < w.level));
    $('eqBarText').textContent = STR.eqDetailLevel(w.level, CONFIG.MAX_LEVEL);
    // 추가 옵션 (인벤토리 팝업과 같은 코드)
    $('eqOpts').innerHTML = this.optionsHtml(w);
    // 지금 적용 중인 효과: 이 무기 덕분에 실제로 바뀐 값
    const eff = [STR.effAtk(fmtRound(Combat.stat('atk')), fmtRound(Combat.finalAttack()))];
    if (Combat.optionSum('aspd')) eff.push(STR.effAspd(Combat.stat('aspd').toFixed(CONFIG.ASPD_DECIMALS), Combat.finalAspd().toFixed(CONFIG.ASPD_DECIMALS)));
    if (Combat.critChance()) eff.push(STR.effCrit(Math.round(Combat.critChance() * 100)));
    if (Combat.optionSum('def')) eff.push(STR.effDef(Combat.optionSum('def')));
    $('eqEffList').innerHTML = eff.map(t => `<div>${t}</div>`).join('');
  },

  // 크레딧 (6-7 출처 표기)
  buildCredits() {
    $('creditsTitle').textContent = STR.credits;
    $('creditsList').innerHTML = STR.creditsLines.map(t => `<li>${t}</li>`).join('');
    $('btnCreditsClose').textContent = STR.btnClose;
    $('btnCredits').addEventListener('click', () => { $('creditsLayer').hidden = false; });
    $('btnCreditsClose').addEventListener('click', () => { $('creditsLayer').hidden = true; });
    $('creditsLayer').addEventListener('click', (e) => { if (e.target === $('creditsLayer')) $('creditsLayer').hidden = true; });
  },
  // 장착 불가 판정은 Loot.canEquip과 같은 기준(깡스탯 숫자만 비교)
  isWeaker(w) { return !!w && !!state.equipped && Loot.grip(w) < Loot.grip(state.equipped); },
  openWeapon(id) {
    if (!Loot.find(id)) return;
    this.popId = id;
    $('popResult').textContent = '';
    $('popupLayer').hidden = false;
    // 4. 처음 한 번은 규칙 자체를 알려준다 (저장 없음 → 새로고침하면 다시 한 번)
    if (!this.guideShown) { this.guideShown = true; $('guideLayer').hidden = false; }
    this.renderPopup();
    Events.emit('popupOpened', { id });
  },
  closeWeapon() {
    if (state.enhancing && state.enhancing.id === this.popId) return;   // 결과 연출 중에는 잠김
    this.popId = null;
    $('popupLayer').hidden = true;
  },
  setResult(text, color) {
    const r = $('popResult');
    r.textContent = text; r.style.color = color || '';
  },
  renderPopup() {
    if (this.popId === null) return;
    const w = Loot.find(this.popId);
    if (!w) { this.popId = null; $('popupLayer').hidden = true; return; }  // 판매·파괴·자동 판매로 사라짐
    const locked = Loot.isLocked(w);
    this.applyGradeBorder($('popIcon'), w);
    this.setHtml($('popName'), `<span style="color:${this.gradeText(w.grade)}">${Loot.name(w)}</span> <span class="num">+${w.level}</span>`);
    this.setText($('popGrip'), STR.gripValue(Loot.grip(w)));
    // 3-7: 깡스탯 아래 소켓 수만큼 줄 (등급 뱃지 + 문구). 비교 줄은 깡스탯만 비교
    this.setHtml($('popOpts'), this.optionsHtml(w));   // 6-10: 장착 무기 상세 창과 같은 코드
    const maxed = w.level >= CONFIG.MAX_LEVEL;
    if (maxed) {
      this.setText($('popNext'), STR.maxLevel);
    } else {
      const next = Loot.grip({ grade: w.grade, level: w.level + 1 });
      this.setText($('popNext'), STR.nextGrip(next));
    }
    const probs = maxed ? null : Enhance.probs(w);
    const pvs = $('popProb').querySelectorAll('.pv');
    for (let i = 0; i < 4; i++) this.setText(pvs[i], probs ? probs[i] + '%' : '-');
    this.setText($('popCost'), maxed ? '-' : fmt(Enhance.cost(w)));
    this.setText($('popSell'), fmt(Loot.sellPrice(w)));

    const be = $('btnEnhance');
    be.disabled = locked || !Enhance.canEnhance(w);
    be.classList.toggle('danger', !maxed && w.level >= CONFIG.DANGER_FROM_LEVEL);   // 파괴 가능 단계는 빨간 버튼
    this.setText(be, locked ? STR.enhancing : STR.btnEnhance);
    // 장착 불가 안내 (5장 v1.1)
    // 1. 항상 보이는 비교: 낮으면 ▼ 빨강, 높거나 같으면 ▲ 초록 (종이용 색)
    const eq = state.equipped, weaker = this.isWeaker(w), U = CONFIG.UI13;
    if (eq) {
      const eg = Loot.grip(eq), mg = Loot.grip(w);
      this.setHtml($('popCmp'), `<span style="color:${weaker ? U.red : U.green}">${weaker ? '▼' : '▲'} ${STR.cmpLine(mg - eg)}</span>`);
    } else this.setHtml($('popCmp'), '');
    // 2. 버튼 문구 "장착 불가"(v1.3에서 줄임) / 3. 눌러도 안내 (클릭을 받기 위해 disabled 대신 soft-disabled)
    const bq = $('btnEquip');
    bq.disabled = locked;                          // 강화 연출 중에는 진짜 잠금
    bq.classList.toggle('soft-disabled', !locked && weaker);
    bq.setAttribute('aria-disabled', String(locked || weaker));
    this.setText(bq, weaker ? STR.equipWeaker : STR.btnEquip);
    bq.title = weaker ? STR.equipBlockedToast(Loot.grip(eq)) : '';
    $('btnSell').disabled = locked || !Loot.canSell(w);
    $('btnClose').disabled = locked;
  },

  // ---------------------------------------------------------------
  // yesLabel/noLabel을 주지 않으면 판매 확인 창 문구(판매/취소)
  confirm(text, onYes, yesLabel, noLabel) {
    this._confirmYes = onYes;
    $('confirmText').textContent = text;
    this.setText($('btnConfirmYes'), yesLabel || STR.yes);
    this.setText($('btnConfirmNo'), noLabel || STR.no);
    $('confirmLayer').hidden = false;
  },
  // 게임을 처음 상태로 (튜토리얼 건너뛰기·다시 보기)
  closeAllLayers() {
    this.popId = null;
    ['popupLayer', 'guideLayer', 'confirmLayer', 'settingsLayer', 'creditsLayer', 'equipLayer'].forEach(id => { $(id).hidden = true; });
    this._confirmYes = null;
    this.invDirty = true;
  },
  closeConfirm() { this._confirmYes = null; $('confirmLayer').hidden = true; },

  // 토스트: 뱃지 모양. warn = 경고성(장착 불가, 인벤토리 가득) → 왼쪽 4px 빨간 띠
  // kind: true/'warn' = 경고성, 'high' = 상급 옵션 드롭 (금색 테두리 한 번 번쩍)
  toast(text, kind) {
    const t = document.createElement('div');
    t.className = 'toast' + (kind === 'high' ? ' high' : kind ? ' warn' : ''); t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; }, CONFIG.TOAST_TIME * 1000);
    setTimeout(() => t.remove(), CONFIG.TOAST_TIME * 1000 + 400);
  },

  // ---------------------------------------------------------------
  update(dt) {
    // HUD: 스킨이 있으면 리본 위 "STAGE 12", 없으면 "스테이지 12". BOSS 뱃지는 리본 오른쪽
    const skinOn = $('root').classList.contains('skin');
    this.setText($('stageRibbon'), skinOn ? STR.stageRibbon(state.stage) : STR.stage(state.stage));
    $('stageBoss').hidden = !state.battle.isBoss;
    this.setText($('stageBoss'), STR.bossTag);
    $('hudFarm').hidden = !state.farming;
    this.setText($('hudFarm'), STR.farming);
    this.setText($('hudGold'), fmt(state.gold));
    const ch = $('btnChallenge');
    ch.disabled = !state.farming;
    ch.classList.toggle('queued', state.challengePending);
    this.setText(ch, state.challengePending ? STR.challengeQueued : STR.challenge);

    this.updateStats();
    if (this.invDirty) { this.invDirty = false; this.renderInventory(); }
    this.renderPopup();
  },
};
