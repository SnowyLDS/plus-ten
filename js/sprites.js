// =====================================================================
// sprites.js — Tiny Swords 이미지 로딩·애니메이션·조각 그리기 (6-1, v1.2)
// - 파일이 없으면 null을 돌려주고, 호출하는 쪽이 대체 도형으로 그린다.
// - file:// 제약: 캔버스 픽셀을 읽지 않는다(getImageData·toDataURL 금지). 그리기만 한다.
// - state를 읽거나 바꾸지 않는다.
// =====================================================================
const Sprites = {
  imgs: {},       // rel → Image (로드 성공)
  state: {},      // rel → 'loading' | 'ok' | 'fail'

  url(rel) { return encodeURI(CONFIG.ART.dir + rel); },
  load(rel, absPath) {
    if (this.state[rel]) return;
    this.state[rel] = 'loading';
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0) { this.imgs[rel] = img; this.state[rel] = 'ok'; Events.emit('assetLoaded', { key: rel }); }
      else this.state[rel] = 'fail';
    };
    img.onerror = () => { this.state[rel] = 'fail'; };
    img.src = absPath ? encodeURI(absPath) : this.url(rel);
  },
  // 프로젝트 기준 경로 (v1.3: assets/ui, assets/icons)
  loadPath(path) { this.load(path, path); },
  get(rel) { return this.imgs[rel] || null; },
  // UI 스킨 이미지 (CONFIG.SKIN.dir 기준)
  loadUi(file) { this.load(CONFIG.SKIN.dir + file); },
  ui(file) { return this.get(CONFIG.SKIN.dir + file); },
  uiURL(file) { return this.url(CONFIG.SKIN.dir + file); },
  done() { return Object.values(this.state).every(s => s !== 'loading'); },

  // ---------------------------------------------------------------
  // 유닛
  // ---------------------------------------------------------------
  enemyColor(stage) {
    const A = CONFIG.ART;
    return A.enemyColors[Math.floor((stage - 1) / A.colorEvery) % A.enemyColors.length];
  },
  enemyKind(stage) {
    if (stage % CONFIG.BOSS_EVERY === 0) return 'boss';
    return CONFIG.ART.enemyByDigit[stage % 10];
  },
  unitDir(kind, color) { return `Units/${color} Units/${CONFIG.ART.units[kind].folder}/`; },
  // 유닛 정의 + 이미지. 시트 하나라도 없으면 null (대체 도형)
  unit(kind, color) {
    const key = kind + '|' + color;
    this._units = this._units || {};
    let u = this._units[key];
    if (!u) {
      const d = CONFIG.ART.units[kind], dir = this.unitDir(kind, color);
      u = this._units[key] = { kind, color, def: d, idleRel: dir + d.idle[0], atkRels: d.attacks.map(a => dir + a[0]),
        arrowRel: d.arrow ? dir + d.arrow : null };
    }
    const idle = this.get(u.idleRel);
    if (!idle) return null;
    const attacks = u.atkRels.map(r => this.get(r));
    if (attacks.some(a => !a)) return null;
    return { def: u.def, idle, attacks, arrow: u.arrowRel ? this.get(u.arrowRel) : null };
  },
  // 쓰일 수 있는 모든 시트를 미리 불러온다 (색 3종 × 적 4종 + 플레이어 + 보스)
  preloadUnits() {
    const A = CONFIG.ART, load = (kind, color) => {
      const d = A.units[kind], dir = this.unitDir(kind, color);
      this.load(dir + d.idle[0]);
      d.attacks.forEach(a => this.load(dir + a[0]));
      if (d.arrow) this.load(dir + d.arrow);
    };
    load('hero', A.heroColor);
    load('boss', A.bossColor);
    for (const c of A.enemyColors) for (const k of ['pawn', 'archer', 'lancer', 'warrior']) load(k, c);
  },

  // 가로로 이어진 시트의 idx번째 정사각 프레임을, 발 기준점이 (footX, footY)에 오도록 그린다.
  // flipX: 좌우 반전(적은 왼쪽을 봄). flash 0~1: 하얗게 번쩍임 (오프스크린 + source-atop, 픽셀 읽기 없음)
  drawFrame(ctx, img, size, idx, foot, footX, footY, scale, flipX, flash, alpha) {
    const frames = Math.max(1, Math.round(img.naturalWidth / size));
    const sx = (((idx % frames) + frames) % frames) * size;
    let src = img, ssx = sx;
    if (flash > 0) {
      const t = this._tint || (this._tint = document.createElement('canvas'));
      if (t.width !== size || t.height !== size) { t.width = size; t.height = size; }
      const tc = t.getContext('2d');
      tc.globalCompositeOperation = 'source-over';
      tc.clearRect(0, 0, size, size);
      tc.imageSmoothingEnabled = false;
      tc.drawImage(img, sx, 0, size, size, 0, 0, size, size);
      tc.globalCompositeOperation = 'source-atop';
      tc.fillStyle = `rgba(255,255,255,${0.85 * flash})`;
      tc.fillRect(0, 0, size, size);
      tc.globalCompositeOperation = 'source-over';
      src = t; ssx = 0;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(footX), Math.round(footY));
    ctx.scale(flipX ? -scale : scale, scale);
    ctx.drawImage(src, ssx, 0, size, size, -foot[0], -foot[1], size, size);
    ctx.restore();
  },
  frameCount(img, size) { return Math.max(1, Math.round(img.naturalWidth / size)); },

  // ---------------------------------------------------------------
  // 조각 그리기 (UI 스킨용, T12)
  // cuts = [a0,a1, b0,b1, c0,c1]: 앞 조각 / 반복 조각 / 뒤 조각의 원본 구간 (가로·세로 동일)
  // 모서리는 그대로(정수 배율 아님이어도 가로세로 같은 배율), 변과 가운데는 조각을 반복해서 채운다.
  // ---------------------------------------------------------------
  // 원본 구간 [s0,s1)을 목표 길이 len 만큼 반복해서 놓을 위치 목록 [{dst, len, srcLen}]
  tileRuns(srcLen, len, scale) {
    const step = srcLen * scale, runs = [];
    if (len <= 0 || step <= 0) return runs;
    for (let p = 0; p < len - 0.01; p += step) {
      const l = Math.min(step, len - p);
      runs.push({ dst: p, len: l, srcLen: l / scale });
    }
    return runs;
  },
  // fill: 가운데 면을 반복 대신 단색으로 (v1.3: 이음새 티끌 제거)
  nine(ctx, img, cuts, scale, x, y, w, h, fill) {
    const [a0, a1, b0, b1, c0, c1] = cuts;
    const L = (a1 - a0) * scale, R = (c1 - c0) * scale, T = (a1 - a0) * scale, B = (c1 - c0) * scale;
    const mw = w - L - R, mh = h - T - B;
    if (fill) {
      // 가운데 단색을 먼저(변과 조금 겹치게) 깔고, 테두리 조각만 그린다
      ctx.fillStyle = fill; ctx.fillRect(x + L - 1, y + T - 1, Math.max(0, mw) + 2, Math.max(0, mh) + 2);
      const cols = [{ s: a0, dst: 0, len: L, sl: a1 - a0 }, { s: c0, dst: L + Math.max(0, mw), len: R, sl: c1 - c0 }];
      const rows = [{ s: a0, dst: 0, len: T, sl: a1 - a0 }, { s: c0, dst: T + Math.max(0, mh), len: B, sl: c1 - c0 }];
      for (const r of rows) for (const c of cols) ctx.drawImage(img, c.s, r.s, c.sl, r.sl, x + c.dst, y + r.dst, c.len, r.len);
      for (const t of this.tileRuns(b1 - b0, mw, scale)) for (const r of rows) ctx.drawImage(img, b0, r.s, t.srcLen, r.sl, x + L + t.dst, y + r.dst, t.len, r.len);
      for (const t of this.tileRuns(b1 - b0, mh, scale)) for (const c of cols) ctx.drawImage(img, c.s, b0, c.sl, t.srcLen, x + c.dst, y + T + t.dst, c.len, t.len);
      return;
    }
    const cols = [{ s: a0, dst: 0, len: L, srcLen: a1 - a0 }]
      .concat(this.tileRuns(b1 - b0, mw, scale).map(r => ({ s: b0, dst: L + r.dst, len: r.len, srcLen: r.srcLen })))
      .concat([{ s: c0, dst: L + Math.max(0, mw), len: R, srcLen: c1 - c0 }]);
    const rows = [{ s: a0, dst: 0, len: T, srcLen: a1 - a0 }]
      .concat(this.tileRuns(b1 - b0, mh, scale).map(r => ({ s: b0, dst: T + r.dst, len: r.len, srcLen: r.srcLen })))
      .concat([{ s: c0, dst: T + Math.max(0, mh), len: B, srcLen: c1 - c0 }]);
    for (const r of rows) for (const c of cols) {
      ctx.drawImage(img, c.s, r.s, c.srcLen, r.srcLen, x + c.dst, y + r.dst, c.len, r.len);
    }
  },
  // 가로 3조각 (체력바·리본). sy~sy+sh 줄을 높이 sh*scale로 그린다
  three(ctx, img, cuts, sy, sh, scale, x, y, w) {
    const [a0, a1, b0, b1, c0, c1] = cuts;
    const L = (a1 - a0) * scale, R = (c1 - c0) * scale, H = sh * scale, mw = w - L - R;
    ctx.drawImage(img, a0, sy, a1 - a0, sh, x, y, L, H);
    for (const r of this.tileRuns(b1 - b0, mw, scale)) ctx.drawImage(img, b0, sy, r.srcLen, sh, x + L + r.dst, y, r.len, H);
    ctx.drawImage(img, c0, sy, c1 - c0, sh, x + L + Math.max(0, mw), y, R, H);
  },

  // v1.3 액자 (books.png): 모서리 그대로, 변은 지정 구간(hRep·vRep, 원본 영역 기준·양끝 포함)을 반복,
  // 가운데는 단색(fill) 또는 투명. 정수 배율 + 정수 좌표만 쓰고, 마지막 조각은 잘라내기(clip)로 맞춰 틈이 없다.
  frame(ctx, img, f, w, h) {
    const s = f.scale, c = f.corner, C = c * s;
    w = Math.round(w); h = Math.round(h);
    const right = f.sx + f.sw - c, bottom = f.sy + f.sh - c;
    if (f.fill) { ctx.fillStyle = f.fill; ctx.fillRect(C, C, Math.max(0, w - 2 * C), Math.max(0, h - 2 * C)); }
    const rw = f.hRep[1] - f.hRep[0] + 1, rh = f.vRep[1] - f.vRep[0] + 1;
    // 위·아래 변
    ctx.save(); ctx.beginPath(); ctx.rect(C, 0, Math.max(0, w - 2 * C), h); ctx.clip();
    for (let x = C; x < w - C; x += rw * s) {
      ctx.drawImage(img, f.sx + f.hRep[0], f.sy, rw, c, x, 0, rw * s, C);
      ctx.drawImage(img, f.sx + f.hRep[0], bottom, rw, c, x, h - C, rw * s, C);
    }
    ctx.restore();
    // 왼·오른 변
    ctx.save(); ctx.beginPath(); ctx.rect(0, C, w, Math.max(0, h - 2 * C)); ctx.clip();
    for (let y = C; y < h - C; y += rh * s) {
      ctx.drawImage(img, f.sx, f.sy + f.vRep[0], c, rh, 0, y, C, rh * s);
      ctx.drawImage(img, right, f.sy + f.vRep[0], c, rh, w - C, y, C, rh * s);
    }
    ctx.restore();
    // 모서리
    ctx.drawImage(img, f.sx, f.sy, c, c, 0, 0, C, C);
    ctx.drawImage(img, right, f.sy, c, c, w - C, 0, C, C);
    ctx.drawImage(img, f.sx, bottom, c, c, 0, h - C, C, C);
    ctx.drawImage(img, right, bottom, c, c, w - C, h - C, C, C);
  },
  // v1.3 아이콘 시트 (fantasy.png) 한 칸을 캔버스에 (1배 32px 또는 2배 64px)
  icon(ctx, cell, x, y, size) {
    const U = CONFIG.UI13, img = this.get(U.icons);
    if (!img) return false;
    const n = U.iconSize;
    ctx.drawImage(img, cell[0] * n, cell[1] * n, n, n, Math.round(x), Math.round(y), size, size);
    return true;
  },
};

// =====================================================================
// UI 스킨 (6-1 UI 스킨 표, T12)
// 9조각 아틀라스는 CSS border-image로 쓸 수 없으므로, 패널·버튼 안 맨 뒤에 <canvas class="skin">를 깔고
// 조각을 drawImage로 그린다. 요소 크기·화면 배율·눌림·색이 바뀌면 다시 그린다.
// 이미지가 없으면 캔버스를 숨기고 예전(6-2) 모습 그대로 둔다.
// =====================================================================
const Skin = {
  list: [],
  init() {
    const S = CONFIG.SKIN;
    // v1.3: 나무 테이블·종이(RegularPaper)는 더 쓰지 않는다 → books.png 액자
    ['blue', 'red', 'hpBar', 'bossBar', 'ribbon', 'round'].forEach(k => {
      Sprites.loadUi(S[k].file);
      if (S[k].pressed) Sprites.loadUi(S[k].pressed);
    });
    ['gold', 'gear', 'close'].forEach(k => Sprites.loadUi(S.icons[k]));
    Sprites.loadPath(CONFIG.UI13.books);
    Sprites.loadPath(CONFIG.UI13.icons);
  },
  // 스킨 이미지가 준비됐는지 (#root.skin 클래스로 CSS 전환)
  ready() {
    const S = CONFIG.SKIN;
    return !!(Sprites.get(CONFIG.UI13.books) && Sprites.ui(S.blue.file) && Sprites.ui(S.red.file));
  },
  // type: 'paper' | 'battle' | 'button' | 'ribbon' | 'round'. opt.icon: round 버튼 위 아이콘
  attach(el, type, opt) {
    if (!el || el._skin) return;
    const cv = document.createElement('canvas');
    cv.className = 'skin';
    cv.hidden = true;
    el.insertBefore(cv, el.firstChild);
    el.classList.add('skinHost');
    el._skin = { el, cv, type, opt: opt || {}, key: '' };
    this.list.push(el._skin);
  },
  // 버튼 색: 파괴 가능 강화·판매는 빨강, 나머지 파랑
  buttonCfg(el) {
    const S = CONFIG.SKIN;
    const red = el.dataset.skin === 'red' || (el.dataset.skin === 'danger' && el.classList.contains('danger'));
    return red ? S.red : S.blue;
  },
  update() {
    const on = this.ready();
    const root = document.getElementById('root');
    if (root.classList.contains('skin') !== on) root.classList.toggle('skin', on);
    const icons = !!Sprites.get(CONFIG.UI13.icons);                // fantasy.png 아이콘이 있으면 #root.icons
    if (root.classList.contains('icons') !== icons) { root.classList.toggle('icons', icons); UI.layoutInventory(); }
    if (!on) return;
    const k = (UI.scale || 1) * (window.devicePixelRatio || 1);
    for (const s of this.list) {
      const el = s.el;
      if (!el.offsetParent && el.id !== 'root') continue;           // 숨겨진 요소
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) continue;
      let cfg, file, img;
      if (s.type === 'button') {
        cfg = this.buttonCfg(el);
        const pressed = el.matches(':active') && !el.disabled;
        file = pressed && cfg.pressed ? cfg.pressed : cfg.file;
        img = Sprites.ui(file);
      } else if (s.type === 'paper' || s.type === 'battle') {
        cfg = s.type === 'paper' ? CONFIG.UI13.paperFrame : CONFIG.UI13.battleFrame;
        file = CONFIG.UI13.books; img = Sprites.get(file);
      } else {
        cfg = CONFIG.SKIN[s.type]; file = cfg.file; img = Sprites.ui(file);
      }
      if (!img) { s.cv.hidden = true; continue; }
      const key = `${file}|${w}|${h}|${k}`;
      if (key === s.key) continue;
      s.key = key;
      s.file = file;
      s.cv.hidden = false;
      this.paint(s, cfg, img, w, h, k);
    }
  },
  paint(s, cfg, img, w, h, k) {
    const cv = s.cv;
    let x0 = 0, y0 = 0, W = w, H = h, draw;
    if (s.type === 'round') {
      draw = (ctx) => {
        ctx.drawImage(img, 0, 0, W, H);
        const ic = s.opt.icon && Sprites.ui(CONFIG.SKIN.icons[s.opt.icon]);
        if (ic) { const p = Math.round(W * 0.18); ctx.drawImage(ic, p, p - 2, W - 2 * p, H - 2 * p); }
      };
    } else if (s.type === 'ribbon') {
      const [r0, r1] = cfg.rowY, sh = r1 - r0, sc = h / sh;            // 높이에 맞춘 배율(가로세로 같음)
      draw = (ctx) => Sprites.three(ctx, img, cfg.cuts, r0, sh, sc, 0, 0, W);
    } else if (s.type === 'paper' || s.type === 'battle') {
      // v1.3 액자: 캔버스를 CSS 픽셀 1:1로 두고 정수 배율·정수 좌표로만 그린다 (화면 확대는 #root 전체 배율이 맡음)
      k = 1;
      draw = (ctx) => Sprites.frame(ctx, img, cfg, W, H);
    } else {
      // 9조각: 투명 여백(bleed)만큼 바깥으로 넓혀, 보이는 테두리가 요소 경계에 맞게
      const c = cfg.cuts, b = cfg.bleed, corner = c[1] - c[0];
      let sc = cfg.scale;
      sc = Math.min(sc, h / (2 * corner - b[1] - b[3]), w / (2 * corner - b[0] - b[2]));   // 작은 버튼: 모서리를 줄이되 늘리지 않음
      x0 = -b[0] * sc; y0 = -b[1] * sc; W = w + (b[0] + b[2]) * sc; H = h + (b[1] + b[3]) * sc;
      const fill = CONFIG.UI13.buttonFill[s.file];
      draw = (ctx) => Sprites.nine(ctx, img, c, sc, 0, 0, W, H, fill);
    }
    cv.style.left = x0 + 'px'; cv.style.top = y0 + 'px';
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.max(1, Math.round(W * k)); cv.height = Math.max(1, Math.round(H * k));
    const ctx = cv.getContext('2d');
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    draw(ctx);
  },

  // 캔버스용: 가로 3조각 막대(체력바·보스 타이머). 틀을 그리고 안쪽(fillY 구간)을 단색으로 채운다.
  // (cx, cy) = 막대 중심. w = 전체 폭. 이미지가 없으면 false
  bar(ctx, cfgKey, cx, cy, w, ratio, color) {
    const cfg = CONFIG.SKIN[cfgKey], img = Sprites.ui(cfg.file);
    if (!img) return false;
    const [r0, r1] = cfg.rowY, sh = r1 - r0, sc = cfg.scale, c = cfg.cuts;
    const H = sh * sc, x = Math.round(cx - w / 2), y = Math.round(cy - H / 2);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    Sprites.three(ctx, img, c, r0, sh, sc, x, y, w);
    // 안쪽: 왼쪽 끝조각 안쪽 가장자리 ~ 오른쪽 끝조각 안쪽 가장자리
    const capL = (c[1] - c[0]) * sc - cfg.capInner * sc, capR = (c[5] - c[4]) * sc - cfg.capInner * sc;
    const ix = x + capL, iw = w - capL - capR;
    ctx.fillStyle = color;
    ctx.fillRect(ix, y + cfg.fillY[0] * sc, Math.max(0, Math.min(1, ratio)) * iw, (cfg.fillY[1] - cfg.fillY[0]) * sc);
    ctx.restore();
    return true;
  },
};

// =====================================================================
// 전투 배경: 잔디 + 나무 + 덤불 + 바위 + 구름 (6-1 배경 표)
// 장식물 위치는 고정 시드로 한 번만 정해 매 판 같다. 게임 RNG는 쓰지 않는다.
// =====================================================================
const Scenery = {
  init() {
    const A = CONFIG.ART;
    Sprites.load(A.grass.file);
    A.trees.files.forEach(f => Sprites.load(f));
    A.bushes.files.forEach(f => Sprites.load(f));
    A.rocks.files.forEach(f => Sprites.load(f));
    A.clouds.files.forEach(f => Sprites.load(f));
    Sprites.load(A.explosion.file);
    Sprites.load(A.dust.file);
    this.layout();
  },
  layout() {
    const A = CONFIG.ART, L = CONFIG.LAYOUT, r = RNG.create(A.decoSeed), rnd = () => r.next();
    const [k0, k1] = A.keepOutX, gy = L.groundY;
    // 나무: 윗변에 한 줄
    const T = A.trees, tw = T.w * T.scale;
    this.trees = [];
    const gap = (L.battleW + tw) / T.count;
    for (let i = 0; i < T.count; i++) {
      this.trees.push({ file: T.files[i % T.files.length], x: -tw / 2 + i * gap + (rnd() - 0.5) * gap * 0.4,
        y: T.y + Math.round(rnd() * 14), f0: Math.floor(rnd() * T.frames) });
    }
    // 덤불(땅 선 뒤쪽)·바위(땅): 플레이어·적 구간(x 280~1000)을 피해 좌우에 나눠 둔다
    const sideX = (i, n, halfW) => {
      const left = i % 2 === 0;
      const lo = left ? halfW : k1 + halfW, hi = left ? k0 - halfW : L.battleW - halfW;
      return lo + rnd() * Math.max(0, hi - lo);
    };
    const B = A.bushes;
    this.bushes = [];
    for (let i = 0; i < B.count; i++) {
      this.bushes.push({ file: B.files[Math.floor(rnd() * B.files.length)], x: sideX(i, B.count, 40), y: gy - 30 - Math.round(rnd() * 30), f0: Math.floor(rnd() * B.frames) });
    }
    const R = A.rocks;
    this.rocks = [];
    for (let i = 0; i < R.count; i++) {
      this.rocks.push({ file: R.files[Math.floor(rnd() * R.files.length)], x: sideX(i + 1, R.count, 24), y: gy + 8 + Math.round(rnd() * 40) });
    }
    const C = A.clouds;
    this.clouds = [];
    for (let i = 0; i < C.count; i++) {
      this.clouds.push({ file: C.files[Math.floor(rnd() * C.files.length)], x0: i * (L.battleW + C.w) / C.count, y: -60 + Math.round(rnd() * 120) });
    }
  },
  ok() { return !!Sprites.get(CONFIG.ART.grass.file); },
  // 잔디 64×64 타일 한 장 → 반복 패턴 (패턴 채우기는 조각 사이 이음새가 생기지 않는다)
  grassPattern(ctx) {
    if (this._pat) return this._pat;
    const A = CONFIG.ART, img = Sprites.get(A.grass.file);
    if (!img) return null;
    const s = A.grass.size, c = document.createElement('canvas'); c.width = s; c.height = s;
    c.getContext('2d').drawImage(img, A.grass.sx, A.grass.sy, s, s, 0, 0, s, s);
    return (this._pat = ctx.createPattern(c, 'repeat'));
  },
  // 고정 시드 해시 (게임 RNG와 별개): 바깥 영역 칸마다 같은 장식이 같은 자리에 나온다
  hash(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + CONFIG.ART.decoSeed) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return RNG.create((h ^ (h >>> 16)) >>> 0);
  },

  // ---------------------------------------------------------------
  // v1.4 6-8: 화면 전체 배경. ctx는 창 전체 캔버스, 변환은 "게임 영역 논리 좌표(1280×720)"로 맞춰져 있다.
  // v = { x0, y0, x1, y1 } 창이 보여주는 논리 좌표 범위. rt = 실제 시간(초)
  // 게임 영역 안 배치(나무 줄·덤불·바위)는 예전 전투 캔버스 좌표 + HUD 높이 그대로다.
  // ---------------------------------------------------------------
  drawWorld(ctx, rt, v) {
    const A = CONFIG.ART, L = CONFIG.LAYOUT, fps = A.fps, oy = L.hudH;
    const pat = this.grassPattern(ctx);
    if (!pat) return false;
    // 잔디: 창 전체. 패턴 원점 = 게임 영역 (0, 0)
    ctx.fillStyle = pat;
    ctx.fillRect(Math.floor(v.x0) - 1, Math.floor(v.y0) - 1, Math.ceil(v.x1 - v.x0) + 2, Math.ceil(v.y1 - v.y0) + 2);

    // 장식 (게임 영역 안: 예전 배치 그대로)
    const B = A.bushes, R = A.rocks, T = A.trees, C = A.clouds;
    const bush = (file, x, y, f0) => {
      const img = Sprites.get(file); if (!img) return;
      const f = (f0 + Math.floor(rt * fps)) % B.frames;
      ctx.drawImage(img, f * B.size, 0, B.size, B.size, Math.round(x - B.size / 2), Math.round(y - B.size * 0.62), B.size, B.size);
    };
    const rock = (file, x, y) => {
      const img = Sprites.get(file); if (!img) return;
      ctx.drawImage(img, Math.round(x - R.size / 2), Math.round(y - R.size * 0.78));
    };
    for (const b of this.bushes) bush(b.file, b.x, b.y + oy, b.f0);
    for (const r of this.rocks) rock(r.file, r.x, r.y + oy);

    // 바깥 영역 장식: 논리 200×200 칸마다 1개 (게임 영역과 겹치는 칸은 건너뜀). 유닛 주변 금지 구역은 지킨다
    const cell = A.outerDecoCell, [k0, k1] = A.keepOutX, gy = L.groundY + oy, band = A.keepOutGroundBand;
    for (let cy = Math.floor(v.y0 / cell); cy * cell < v.y1; cy++) {
      for (let cx = Math.floor(v.x0 / cell); cx * cell < v.x1; cx++) {
        const x0 = cx * cell, y0 = cy * cell;
        if (x0 < CONFIG.BASE_W && x0 + cell > 0 && y0 < CONFIG.BASE_H && y0 + cell > 0) continue;
        const g = this.hash(cx, cy), x = x0 + 40 + g.next() * (cell - 80), y = y0 + 60 + g.next() * (cell - 90);
        if (x > k0 && x < k1 && Math.abs(y - gy) < band) continue;
        if (g.next() < 0.5) bush(B.files[Math.floor(g.next() * B.files.length)], x, y, Math.floor(g.next() * B.frames));
        else rock(R.files[Math.floor(g.next() * R.files.length)], x, y);
      }
    }

    // 구름 그림자: 창 전체 폭을 가로질러 흐름 (불투명도 0.35, 초당 8px 왼쪽)
    const spacing = (CONFIG.BASE_W + C.w) / C.count, span = (v.x1 - v.x0) + C.w;
    const n = Math.ceil(span / spacing);
    ctx.save(); ctx.globalAlpha = C.alpha;
    for (let i = 0; i < n; i++) {
      const c = i < this.clouds.length ? this.clouds[i] : (() => { const g = this.hash(i, 777); return { file: C.files[Math.floor(g.next() * C.files.length)], y: -60 + Math.round(g.next() * 120) }; })();
      const img = Sprites.get(c.file); if (!img) continue;
      const x = v.x0 + (((i * spacing - rt * C.speed) % (n * spacing)) + n * spacing) % (n * spacing) - C.w;
      ctx.drawImage(img, Math.round(x), c.y + oy);
    }
    ctx.restore();

    // 나무 줄: 창 너비 전체로 반복 (예전 12그루 배치를 주기 1280 + 나무 폭으로 되풀이). 뿌리 높이는 예전 그대로
    const tw = T.w * T.scale, period = CONFIG.BASE_W + tw;
    const kFrom = Math.floor((v.x0 - tw) / period), kTo = Math.ceil((v.x1 + tw) / period);
    for (let k = kFrom; k <= kTo; k++) {
      for (const t of this.trees) {
        const x = t.x + k * period;
        if (x + tw < v.x0 || x > v.x1) continue;
        const img = Sprites.get(t.file); if (!img) continue;
        const f = (t.f0 + Math.floor(rt * fps)) % T.frames;
        ctx.drawImage(img, f * T.w, 0, T.w, T.h, Math.round(x), t.y + oy, tw, T.h * T.scale);
      }
    }
    return true;
  },
};
