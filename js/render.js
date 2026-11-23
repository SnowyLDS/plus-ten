// =====================================================================
// render.js — Canvas 전투 화면과 연출 (6-3, 6-4), Tiny Swords 스프라이트 (6-1, v1.2)
// state를 읽고 이벤트를 받아 그리기만 한다. 로직(state)은 바꾸지 않는다.
// 연출 시계는 게임 시간으로 흐른다 → 연출 중에도 전투 로직은 독립적으로 계속 돈다.
// 배경(나무·덤불·구름)과 대기 애니메이션은 실제 시간으로 흐른다.
// 이미지가 없으면(assets/tiny-swords 없음) 예전처럼 대체 도형으로 그린다.
// =====================================================================
const Render = {
  init() {
    this.cv = document.getElementById('battle');
    this.ctx = this.cv.getContext('2d');
    this.fxCv = document.getElementById('fx');
    this.fx = this.fxCv.getContext('2d');
    this.popCv = document.getElementById('popIcon');
    this.pop = this.popCv.getContext('2d');
    [this.ctx, this.fx, this.pop].forEach(c => { c.imageSmoothingEnabled = false; });
    this.shakeEls = [document.getElementById('shake'), document.getElementById('popupLayer')];

    Sprites.preloadUnits();
    Scenery.init();
    Sprites.loadUi(CONFIG.SKIN.icons.weapon);

    this.t = 0;
    this.rt = 0;                  // 실제 시간(초)
    this._rtLast = performance.now();
    this.hero = { lunge: 99, flash: 99, atk: this.newAnim() };
    this.mob = { flash: 99, atk: this.newAnim() };
    this.dying = [];     // 처치 연출 중인 적
    this.floats = [];    // 데미지·골드 숫자 (전투 캔버스 좌표)
    this.flyers = [];    // 드롭 아이콘 (루트 좌표)
    this.parts = [];     // 파티클·조각 (루트 좌표)
    this.texts = [];     // 큰 글씨 (루트 좌표)
    this.flashes = [];   // 화면 전체 플래시
    this.anims = [];     // 시트 이펙트 (전투 캔버스 좌표): 먼지·폭발
    this.fxAnims = [];   // 시트 이펙트 (루트 좌표): 파괴 폭발
    this.arrows = [];    // 궁수 화살 (연출만)
    this.shakeQ = { px: 0, t: 0 };
    this.dim = 99;
    this.popFx = { bounce: 99 };
    this.enhPos = null;

    this.bind();
  },
  // 게임 초기화 때 남은 연출 지우기 (튜토리얼 건너뛰기·다시 보기)
  clearFx() {
    this.dying = []; this.floats = []; this.flyers = []; this.parts = []; this.texts = [];
    this.flashes = []; this.anims = []; this.fxAnims = []; this.arrows = [];
    this.hero.atk = this.newAnim(); this.mob.atk = this.newAnim(); this.dim = 99;
  },
  newAnim() { return { on: false, t: 0, dur: 0, idx: -1, arrowDone: true }; },

  // ---------------------------------------------------------------
  // 이벤트 → 연출
  // ---------------------------------------------------------------
  bind() {
    const F = CONFIG.FX, C = CONFIG.COLORS, L = CONFIG.LAYOUT;
    Events.on('playerAttack', (e) => {
      this.hero.lunge = 0;
      this.startAttack(this.hero.atk, this.heroUnit(), Combat.attackInterval());
      this.mob.flash = 0;
      if (e.crit) {
        // 3-7 치명타: #E8B04B, 1.5배 크게, 옆에 "치명!", 화면 흔들림 2px 0.06초
        this.addFloat(L.mobX, this.headY('enemy') - 22, `${fmtRound(e.dmg)} ${STR.critFloat}`, F.critColor, Math.round(24 * F.critScale));
        this.shake(F.critShakePx, F.critShakeTime);
      } else {
        this.addFloat(L.mobX, this.headY('enemy') - 22, fmtRound(e.dmg), C.white);
      }
      if (e.isBoss) this.shake(F.bossShakePx, F.bossShakeTime);
    });
    Events.on('monsterAttack', (e) => {
      this.hero.flash = 0;
      const mon = state.battle.monster;
      this.startAttack(this.mob.atk, this.enemyUnit(state.stage), mon ? mon.interval : 1);
      this.addFloat(L.heroX, this.headY('hero') - 22, fmtRound(e.dmg), C.danger);
    });
    Events.on('monsterSpawn', () => { this.mob.atk = this.newAnim(); this.mob.flash = 99; });
    Events.on('monsterKilled', (e) => {
      const isBoss = state.battle.isBoss, stage = state.stage, A = CONFIG.ART;
      this.dying.push({ isBoss, stage, t: 0 });
      this.addFloat(L.mobX, this.headY('enemy') - 50, '+' + fmtRound(e.gold), C.gold, 26);
      // 발밑 먼지 1회, 보스는 폭발 1회 추가
      this.anims.push({ file: A.dust.file, size: A.dust.size, frames: A.dust.frames, x: L.mobX, y: L.groundY - A.dust.size / 2 + 12, scale: isBoss ? 2 : 1, t: 0 });
      if (isBoss) {
        const cy = (L.groundY + this.headY('enemy')) / 2;
        this.anims.push({ file: A.explosion.file, size: A.explosion.size, frames: A.explosion.frames, x: L.mobX, y: cy, scale: 1, t: 0 });
      }
      this.mob.atk = this.newAnim();
    });
    Events.on('weaponDropped', (e) => {
      const w = e.weapon, color = CONFIG.GRADES[w.grade].color;
      const from = { x: L.mobX, y: L.hudH + (L.groundY + this.headY('enemy')) / 2 };
      const to = this.domCenter(state.equipped ? 'invTitle' : 'equipCard');   // 첫 무기는 장착 슬롯으로
      this.flyers.push({ from, to, t: 0, color, grade: w.grade, trail: [] });
      if (w.grade >= CONFIG.GLOW_GRADE_MIN) {
        this.flashes.push({ color, t: 0, dur: F.bigDropFlashTime, alpha: F.bigDropFlashAlpha });
        this.texts.push({ x: CONFIG.BASE_W / 2, y: CONFIG.BASE_H * 0.36, text: STR.bigDrop(w.grade), color, size: 36, t: 0, dur: F.bigDropTextTime, rise: 0 });
      }
    });
    Events.on('defeat', () => { this.dim = 0; });

    // ---- 강화 (6-4) ----
    Events.on('enhanceStart', () => { this.enhPos = this.domCenter('popIcon'); });
    Events.on('enhanceResult', (e) => {
      const p = this.enhPos || { x: CONFIG.BASE_W / 2, y: CONFIG.BASE_H / 2 };
      if (e.result === 'success') {
        this.burst(p.x, p.y, F.successBurst, [C.success, C.gold]);
        this.texts.push({ x: p.x, y: p.y - 70, text: STR.resSuccess(e.to), color: C.gold, size: 48, t: 0, dur: F.resultTextTime, rise: 30 });
        if (e.to >= F.bigSuccessFromLevel) {
          this.shake(F.bigSuccessShakePx, F.bigSuccessShakeTime);
          this.burst(p.x, p.y, F.bigSuccessParticles, [C.success, C.gold, C.white], 1.6);
        }
      } else if (e.result === 'keep') {
        this.texts.push({ x: p.x, y: p.y - 66, text: STR.resKeep, color: C.keep, size: 24, t: 0, dur: F.resultTextTime, rise: 12 });
      } else if (e.result === 'drop') {
        this.popFx.bounce = 0;
        this.texts.push({ x: p.x, y: p.y - 66, text: STR.resDrop(e.from, e.to), color: C.drop, size: 24, t: 0, dur: F.resultTextTime, rise: 18 });
      } else {
        this.flashes.push({ color: C.danger, t: 0, dur: F.destroyFlashTime, alpha: F.destroyFlashAlpha });
        this.shards(p.x, p.y, CONFIG.GRADES[e.grade].color);
        this.shake(F.destroyShakePx, F.destroyShakeTime);
        const X = CONFIG.ART.explosion;   // 파괴: 무기 아이콘 위에 폭발 1회
        this.fxAnims.push({ file: X.file, size: X.size, frames: X.frames, x: p.x, y: p.y, scale: 1, t: 0 });
        this.texts.push({ x: p.x, y: p.y - 40, text: STR.resDestroy, color: C.danger, size: 48, t: 0, dur: F.resultTextTime, rise: 10 });
      }
    });
  },

  // ---------------------------------------------------------------
  // 유닛 (6-1 유닛 스프라이트)
  // ---------------------------------------------------------------
  heroUnit() { return { kind: 'hero', color: CONFIG.ART.heroColor }; },
  enemyUnit(stage) {
    const kind = Sprites.enemyKind(stage);
    return { kind, color: kind === 'boss' ? CONFIG.ART.bossColor : Sprites.enemyColor(stage) };
  },
  unitScale(kind) { return kind === 'boss' ? CONFIG.ART.bossScale : CONFIG.ART.unitScale; },
  // 머리 꼭대기 y (전투 캔버스). 스프라이트가 없으면 대체 도형 크기
  headY(who) {
    const L = CONFIG.LAYOUT;
    const u = who === 'hero' ? this.heroUnit() : this.enemyUnit(state.stage);
    if (Sprites.unit(u.kind, u.color)) {
      const d = CONFIG.ART.units[u.kind];
      return L.groundY - (d.foot[1] - d.top) * this.unitScale(u.kind);
    }
    return L.groundY - (who === 'hero' ? CONFIG.SIZE.hero : this.mobSize());
  },
  // 공격 이벤트마다 1회 재생. 공격 간격이 애니메이션보다 짧으면 재생 시간 = 간격 × 0.9
  startAttack(a, u, interval) {
    const s = Sprites.unit(u.kind, u.color);
    const d = CONFIG.ART.units[u.kind];
    a.idx = (a.idx + 1) % d.attacks.length;          // Attack1·Attack2 번갈아
    const frames = s ? Sprites.frameCount(s.attacks[a.idx], d.size) : d.attacks[a.idx][1];
    const natural = frames / CONFIG.ART.fps;
    a.dur = interval < natural ? interval * CONFIG.ART.attackShrink : natural;
    a.t = 0; a.on = true;
    a.arrowDone = !d.arrow;
  },
  // 스프라이트로 유닛을 그린다. 이미지가 없으면 false (대체 도형으로)
  drawUnit(u, footX, footY, flip, a, flash, shrink, alpha) {
    const s = Sprites.unit(u.kind, u.color);
    if (!s) return false;
    const d = s.def, fps = CONFIG.ART.fps, sc = this.unitScale(u.kind) * (shrink === undefined ? 1 : shrink);
    let img = s.idle, f;
    if (a && a.on && a.t < a.dur) {
      img = s.attacks[Math.max(0, a.idx)];
      f = Math.min(Sprites.frameCount(img, d.size) - 1, Math.floor(a.t / a.dur * Sprites.frameCount(img, d.size)));
    } else {
      f = Math.floor(this.rt * fps) % Sprites.frameCount(img, d.size);
    }
    Sprites.drawFrame(this.ctx, img, d.size, f, d.foot, footX, footY, sc, flip, flash, alpha);
    return true;
  },

  // ---------------------------------------------------------------
  addFloat(x, y, text, color, size) {
    this.floats.push({ x: x + (Math.random() - 0.5) * 30, y, text, color, size: size || 22, t: 0 });
  },
  shake(px, dur) {
    if (px >= this.shakeQ.px || this.shakeQ.t <= 0) this.shakeQ = { px, t: dur };
  },
  burst(x, y, n, colors, speed) {
    const sp = speed || 1;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (120 + Math.random() * 220) * sp;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 120, color: colors[i % colors.length],
        size: 3 + Math.random() * 4, t: 0, life: CONFIG.FX.particleLife * (0.7 + Math.random() * 0.5) });
    }
  },
  shards(x, y, color) {
    const n = CONFIG.FX.destroyShards;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, v = 180 + Math.random() * 160;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 600, color, shard: true,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, size: 10 + Math.random() * 8, t: 0, life: 0.9 });
    }
  },
  // DOM 요소 중심의 루트(1280×720) 좌표
  domCenter(id) {
    const el = document.getElementById(id), root = document.getElementById('root');
    const r = el.getBoundingClientRect(), rr = root.getBoundingClientRect(), s = UI.scale || 1;
    return { x: (r.left - rr.left + r.width / 2) / s, y: (r.top - rr.top + r.height / 2) / s };
  },
  mobSize() { return state.battle.isBoss ? CONFIG.SIZE.boss : CONFIG.SIZE.mob; },

  // ---------------------------------------------------------------
  // 대체 도형 (이미지가 없을 때)
  // ---------------------------------------------------------------
  drawBlock(ctx, color, size, cx, footY, flash, scale, alpha) {
    const s = size * (scale === undefined ? 1 : scale);
    const x = Math.round(cx - s / 2), y = Math.round(footY - s);
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color; ctx.fillRect(x, y, s, s);
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.85 * flash})`; ctx.fillRect(x, y, s, s); }
    ctx.restore();
  },

  // 무기 아이콘 (캔버스). v1.3: 등급마다 다른 fantasy.png 아이콘 (1배 32 / 2배 64).
  // 시트가 없으면 예전 Icon_05 → 그것도 없으면 칼 모양 대체 도형
  drawWeaponIcon(ctx, grade, x, y, s) {
    if (Sprites.icon(ctx, CONFIG.UI13.weaponIcons[grade], x, y, s)) return;
    const img = Sprites.ui(CONFIG.SKIN.icons.weapon);
    if (img) ctx.drawImage(img, x, y, s, s);
    else this.drawSwordShape(ctx, x, y, s);
  },
  // 무기 아이콘 대체 도형: 흰 칼 모양(선 3개) — 칼날, 가드, 손잡이
  drawSwordShape(ctx, x, y, s) {
    ctx.save();
    ctx.strokeStyle = CONFIG.COLORS.white;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, s / 12);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.78, y + s * 0.22); ctx.lineTo(x + s * 0.36, y + s * 0.64);  // 칼날
    ctx.moveTo(x + s * 0.28, y + s * 0.56); ctx.lineTo(x + s * 0.44, y + s * 0.72);  // 가드
    ctx.moveTo(x + s * 0.36, y + s * 0.64); ctx.lineTo(x + s * 0.20, y + s * 0.80);  // 손잡이
    ctx.stroke();
    ctx.restore();
  },
  // DOM용 아이콘 주소 (이미지가 있으면 그 파일, 없으면 대체 도형)
  // 대체 도형 캔버스는 로컬 이미지를 그리지 않으므로 toDataURL이 file://에서도 안전하다.
  weaponIconURL() {
    if (Sprites.ui(CONFIG.SKIN.icons.weapon)) return Sprites.uiURL(CONFIG.SKIN.icons.weapon);
    if (!this._swordURL) {
      const s = CONFIG.SIZE.weapon, c = document.createElement('canvas');
      c.width = s; c.height = s;
      this.drawSwordShape(c.getContext('2d'), 0, 0, s);
      this._swordURL = c.toDataURL();
    }
    return this._swordURL;
  },

  // ---------------------------------------------------------------
  // 프레임
  // ---------------------------------------------------------------
  draw(dt) {
    const now = performance.now();
    this.rt += Math.min(1, Math.max(0, (now - this._rtLast) / 1000));
    this._rtLast = now;
    this.t += dt;
    this.tick(dt);
    this.drawWorld();
    this.drawBattle();
    this.drawOverlay();
    this.drawPopupIcon();
    this.applyShake();
  },

  // v1.4 6-8: 창 전체 배경. 게임 영역과 같은 배율·같은 원점으로 그려 픽셀 크기와 잔디 격자를 맞춘다
  drawWorld() {
    const cv = this.worldCv || (this.worldCv = document.getElementById('world'));
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1, W = window.innerWidth, H = window.innerHeight;
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const ctx = cv.getContext('2d'), root = document.getElementById('root');
    const s = UI.scale || 1, ox = parseFloat(root.style.left) || 0, oy = parseFloat(root.style.top) || 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
    ctx.imageSmoothingEnabled = false;
    Scenery.drawWorld(ctx, this.rt, { x0: -ox / s, y0: -oy / s, x1: (W - ox) / s, y1: (H - oy) / s });
  },

  tick(dt) {
    this.hero.lunge += dt; this.hero.flash += dt; this.mob.flash += dt; this.dim += dt;
    this.popFx.bounce += dt;
    for (const a of [this.hero.atk, this.mob.atk]) {
      if (!a.on) continue;
      a.t += dt;
      if (!a.arrowDone && a.t >= a.dur / 2) { a.arrowDone = true; this.fireArrow(); }
      if (a.t >= a.dur) a.on = false;               // 끝나면 대기로
    }
    const age = (arr, life) => {
      for (const o of arr) o.t += dt;
      return arr.filter(o => o.t < (o.life || o.dur || life));
    };
    this.dying = age(this.dying, CONFIG.FX.deathTime);
    this.floats = age(this.floats, CONFIG.FX.dmgTime);
    this.flyers = age(this.flyers, CONFIG.FX.dropFlyTime);
    this.texts = age(this.texts);
    this.flashes = age(this.flashes);
    this.arrows = age(this.arrows, CONFIG.ART.arrowTime);
    const sheetLife = (o) => o.frames / CONFIG.ART.fps;
    for (const o of this.anims) o.t += dt;
    for (const o of this.fxAnims) o.t += dt;
    this.anims = this.anims.filter(o => o.t < sheetLife(o));
    this.fxAnims = this.fxAnims.filter(o => o.t < sheetLife(o));
    for (const p of this.parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.97; if (p.rot !== undefined) p.rot += p.vr * dt;
    }
    this.parts = age(this.parts);
    this.shakeQ.t -= dt;
  },
  // 궁수 화살: 적에서 플레이어까지 0.15초 (연출만, 피해 판정과 무관)
  fireArrow() {
    const u = this.enemyUnit(state.stage), s = Sprites.unit(u.kind, u.color);
    if (!s || !s.arrow) return;
    const L = CONFIG.LAYOUT, y = L.groundY - CONFIG.ART.arrowChestPx;
    this.arrows.push({ img: s.arrow, x0: L.mobX - 30, x1: L.heroX + 20, y, t: 0 });
  },

  applyShake() {
    let tr = '';
    if (this.shakeQ.t > 0) {
      const px = this.shakeQ.px;
      tr = `translate(${((Math.random() * 2 - 1) * px).toFixed(1)}px, ${((Math.random() * 2 - 1) * px).toFixed(1)}px)`;
    }
    if (tr !== this._lastShake) { this._lastShake = tr; this.shakeEls.forEach(el => { el.style.transform = tr; }); }
  },

  drawSheet(ctx, o) {
    const img = Sprites.get(o.file);
    if (!img) return;
    const f = Math.min(o.frames - 1, Math.floor(o.t * CONFIG.ART.fps)), s = o.size * o.scale;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, f * o.size, 0, o.size, o.size, Math.round(o.x - s / 2), Math.round(o.y - s / 2), s, s);
    ctx.restore();
  },

  drawBattle() {
    const ctx = this.ctx, L = CONFIG.LAYOUT, C = CONFIG.COLORS, F = CONFIG.FX, bt = state.battle;
    // v1.4 6-8: 배경(잔디·나무·덤불·바위·구름)은 창 전체 배경 캔버스(#world)가 그린다. 전투 캔버스는 투명.
    // 이미지가 없을 때만 예전 그라데이션
    ctx.clearRect(0, 0, L.battleW, L.battleH);
    if (!Scenery.ok()) {
      const g = ctx.createLinearGradient(0, 0, 0, L.battleH);
      g.addColorStop(0, C.bg); g.addColorStop(1, C.bg2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, L.battleW, L.battleH);
    }

    // 플레이어: 오른쪽을 봄(원본 방향 그대로). 스프라이트가 있으면 공격 애니메이션, 없으면 12px 튀어나가기
    const hf = this.hero.flash < F.hitFlashTime ? 1 : 0;
    if (!this.drawUnit(this.heroUnit(), L.heroX, L.groundY, false, this.hero.atk, hf)) {
      const lunge = this.hero.lunge < F.lungeTime ? F.lungePx * Math.sin(Math.PI * this.hero.lunge / F.lungeTime) : 0;
      this.drawBlock(ctx, C.hero, CONFIG.SIZE.hero, L.heroX + lunge, L.groundY, hf);
    }

    // 처치 연출: 0.3초 동안 작아지며 투명해짐
    for (const d of this.dying) {
      const k = Math.max(0, 1 - d.t / F.deathTime);
      const u = this.enemyUnit(d.stage);
      if (!this.drawUnit(u, L.mobX, L.groundY, true, null, 0, Math.max(0.05, k), k)) {
        this.drawBlock(ctx, d.isBoss ? C.boss : C.mob, d.isBoss ? CONFIG.SIZE.boss : CONFIG.SIZE.mob, L.mobX, L.groundY, 0, Math.max(0.05, k), k);
      }
    }

    // 적: 좌우 반전해서 왼쪽을 봄
    const mon = bt.monster;
    if (mon) {
      const mf = this.mob.flash < F.hitFlashTime ? 1 : 0;
      if (!this.drawUnit(this.enemyUnit(state.stage), L.mobX, L.groundY, true, this.mob.atk, mf)) {
        this.drawBlock(ctx, mon.isBoss ? C.boss : C.mob, this.mobSize(), L.mobX, L.groundY, mf);
      }
    }

    // 화살·먼지·폭발
    for (const a of this.arrows) {
      const k = Math.min(1, a.t / CONFIG.ART.arrowTime), x = a.x0 + (a.x1 - a.x0) * k;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(x), a.y); ctx.scale(-1, 1);       // 왼쪽(플레이어 쪽)을 향함
      ctx.drawImage(a.img, -32, -32);
      ctx.restore();
    }
    for (const o of this.anims) this.drawSheet(ctx, o);

    // 체력바 (플레이어 / 적)
    this.hpBar(L.heroX, this.headY('hero') - 14, bt.playerHp / Combat.maxHp(), C.success,
      `${fmtRound(bt.playerHp)} / ${fmtRound(Combat.maxHp())}`);
    if (mon) {
      this.hpBar(L.mobX, this.headY('enemy') - 14, mon.hp / mon.maxHp, C.danger, `${fmtRound(mon.hp)} / ${fmtRound(mon.maxHp)}`);
    }

    // 스테이지 내 진행 / 보스 30초 타이머 바
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    if (bt.isBoss) {
      const w = L.bossTimerW, x = (L.battleW - w) / 2, y = L.bossTimerY;
      const r = Math.max(0, bt.bossTimeLeft / CONFIG.BOSS.timeLimit);
      let labelY = y + L.bossTimerH + 6;
      // BigBar_Base 틀 + 안쪽 #FFD54F (없으면 예전 단색 막대)
      if (Skin.bar(ctx, 'bossBar', L.battleW / 2, y + 12, w, r, CONFIG.SKIN.timerBar)) {
        labelY = y + 32;
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 2, y - 2, w + 4, L.bossTimerH + 4);
        ctx.fillStyle = r < 0.3 ? C.danger : C.gold; ctx.fillRect(x, y, w * r, L.bossTimerH);
      }
      this.outlinedText(ctx, `${STR.bossTag}  ${bt.bossTimeLeft.toFixed(1)}s`, L.battleW / 2, labelY, CONFIG.FONTS.title, C.text);
    } else {
      const n = Math.min(bt.kills + (bt.monster ? 1 : 0), CONFIG.MOBS_PER_STAGE);
      this.outlinedText(ctx, `${Math.max(1, n)} / ${CONFIG.MOBS_PER_STAGE}`, L.battleW / 2, L.bossTimerY, CONFIG.FONTS.title, C.text);
    }

    // 데미지·골드 숫자: 40px 위로 떠오르며 0.6초에 사라짐
    ctx.textBaseline = 'alphabetic';
    for (const f of this.floats) {
      const k = f.t / F.dmgTime;
      ctx.globalAlpha = 1 - k;
      ctx.font = f.size >= 36 ? CONFIG.FONTS.big : CONFIG.FONTS.title;   // 데미지·골드 숫자 24px, 치명타 1.5배 = 36px
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';   // v1.4 6-8: 잔디 위 글자 = 2px 검은 외곽선
      ctx.strokeText(f.text, f.x, f.y - F.dmgRisePx * k);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - F.dmgRisePx * k);
    }
    ctx.globalAlpha = 1;
  },
  outlinedText(ctx, text, x, y, font, color) {
    ctx.font = font; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';   // v1.4 6-8: 잔디 위 글자 = 2px 검은 외곽선
    ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  },

  hpBar(cx, y, ratio, color, label) {
    const ctx = this.ctx, L = CONFIG.LAYOUT;
    const w = L.hpBarW, x = cx - w / 2;
    // SmallBar_Base 틀 + 안쪽 단색 (플레이어 #66BB6A, 적 #E53935). 없으면 예전 단색 막대
    const S = CONFIG.SKIN, skinColor = color === CONFIG.COLORS.success ? S.heroBar : S.enemyBar;
    if (Skin.bar(ctx, 'hpBar', cx, y + L.hpBarH / 2, w, ratio, skinColor)) {
      y -= 3;
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 1, y - 1, w + 2, L.hpBarH + 2);
      ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), L.hpBarH);
    }
    if (label) {
      ctx.font = CONFIG.FONTS.small; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.strokeText(label, cx, y - 2);
      ctx.fillStyle = CONFIG.COLORS.text; ctx.fillText(label, cx, y - 2);
    }
  },

  drawOverlay() {
    const ctx = this.fx, F = CONFIG.FX, W = CONFIG.BASE_W, H = CONFIG.BASE_H;
    ctx.clearRect(0, 0, W, H);

    // 패배: 화면 어둑게 0.5초
    if (this.dim < F.defeatDimTime) {
      ctx.fillStyle = `rgba(0,0,0,${F.defeatDimAlpha * Math.sin(Math.PI * this.dim / F.defeatDimTime)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // 화면 전체 플래시 (영웅·전설 드롭: 등급 색 0.2초 / 파괴: 빨강)
    for (const f of this.flashes) {
      ctx.globalAlpha = f.alpha * (1 - f.t / f.dur);
      ctx.fillStyle = f.color; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;

    // 무기 드롭: 적 자리에서 튀어 올라 인벤토리 쪽으로 0.5초, 등급 색 빛줄
    for (const fl of this.flyers) {
      const k = Math.min(1, fl.t / F.dropFlyTime), e = k * k * (3 - 2 * k);
      const cx = (fl.from.x + fl.to.x) / 2, cy = Math.min(fl.from.y, fl.to.y) - F.dropHopPx;
      const x = (1 - e) * (1 - e) * fl.from.x + 2 * (1 - e) * e * cx + e * e * fl.to.x;
      const y = (1 - e) * (1 - e) * fl.from.y + 2 * (1 - e) * e * cy + e * e * fl.to.y;
      fl.trail.push({ x, y }); if (fl.trail.length > 10) fl.trail.shift();
      ctx.save();
      ctx.strokeStyle = fl.color; ctx.lineCap = 'round'; ctx.shadowColor = fl.color; ctx.shadowBlur = 16;
      for (let i = 1; i < fl.trail.length; i++) {
        ctx.globalAlpha = i / fl.trail.length; ctx.lineWidth = 2 + i;
        ctx.beginPath(); ctx.moveTo(fl.trail[i - 1].x, fl.trail[i - 1].y); ctx.lineTo(fl.trail[i].x, fl.trail[i].y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // 6-7 #17: 칸과 같은 모양 — 40×40 #F3D3A3 + 등급 색 3px 테두리 + 무기 아이콘 32px
      const U = CONFIG.UI13, b = U.flyCell, bx = Math.round(x - b / 2), by = Math.round(y - b / 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = U.slot; ctx.fillRect(bx, by, b, b);
      ctx.lineWidth = 3; ctx.strokeStyle = fl.color; ctx.strokeRect(bx + 1.5, by + 1.5, b - 3, b - 3);
      this.drawWeaponIcon(ctx, fl.grade, bx + (b - U.iconSize) / 2, by + (b - U.iconSize) / 2, U.iconSize);
      ctx.restore();
    }

    // 파괴 폭발 (무기 아이콘 위)
    for (const o of this.fxAnims) this.drawSheet(ctx, o);

    // 파티클 & 파괴 조각
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      if (p.shard) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.moveTo(-p.size / 2, -p.size / 4); ctx.lineTo(p.size / 2, 0); ctx.lineTo(-p.size / 3, p.size / 3); ctx.closePath();
        ctx.fill(); ctx.strokeStyle = CONFIG.COLORS.white; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;

    // 큰 글씨 (드롭 문구, 강화 결과)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.t / t.dur;
      const pop = Math.min(1, t.t / 0.12);
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      ctx.font = CONFIG.FONTS.result(Math.round(t.size * (0.7 + 0.3 * pop)));   // 24·36·48px(강화 결과 예외) + 크기 연출
      ctx.lineWidth = Math.max(3, t.size / 8); ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      const y = t.y - t.rise * k;
      ctx.strokeText(t.text, t.x, y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, y);
    }
    ctx.globalAlpha = 1;
  },

  // 무기 상세 팝업 아이콘: 강화 대기 중 점점 빠르게 떨리고 빛이 모인다
  drawPopupIcon() {
    if (UI.popId === null) return;
    const w = Loot.find(UI.popId);
    if (!w) return;
    const ctx = this.pop, W = this.popCv.width, H = this.popCv.height, F = CONFIG.FX;
    const s = CONFIG.UI13.iconSize * 2, color = CONFIG.GRADES[w.grade].color;   // 팝업 아이콘 2배(64px)
    ctx.clearRect(0, 0, W, H);
    let ox = 0, oy = 0, p = 0;
    const e = state.enhancing;
    if (e && e.id === w.id) {
      p = 1 - Math.max(0, e.timer) / CONFIG.ENHANCE_DELAY;         // 0 → 1
      const amp = F.chargeShakeMaxPx * p * p;
      ox = Math.sin(this.t * (25 + 90 * p)) * amp;
      oy = Math.cos(this.t * (31 + 80 * p)) * amp * 0.6;
      // 빛이 모임: 점들이 중심으로 수렴 + 커지는 광륜
      const g = ctx.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, 20 + 40 * p);
      g.addColorStop(0, `rgba(255,213,79,${0.65 * p})`); g.addColorStop(1, 'rgba(255,213,79,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = CONFIG.COLORS.gold;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + this.t * 3, d = 60 * (1 - p) + 6;
        ctx.globalAlpha = p; ctx.fillRect(W / 2 + Math.cos(a) * d - 2, H / 2 + Math.sin(a) * d - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
    }
    // 단계 하락: 아이콘 아래로 튀기
    if (this.popFx.bounce < F.dropBounceTime) {
      const k = this.popFx.bounce / F.dropBounceTime;
      oy += F.dropBouncePx * Math.abs(Math.sin(Math.PI * 2 * k)) * (1 - k);
    }
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 12 + 20 * p;
    this.drawWeaponIcon(ctx, w.grade, Math.round((W - s) / 2 + ox), Math.round((H - s) / 2 + oy), s);
    ctx.restore();
  },
};
