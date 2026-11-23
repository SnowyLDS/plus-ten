// =====================================================================
// debug.js — 디버그 패널과 플레이 로그 (7-5). ` (백쿼트) 키로 켜고 끈다.
// =====================================================================
const Debug = {
  open: false,
  refresh: 0,
  lastGrip: 0,
  lastBest: 1,

  init() {
    const p = document.getElementById('debug');
    const gradeOpts = STR.gradeNames.map((n, i) => `<option value="${i}">${n}</option>`).join('');
    const speedBtns = CONFIG.SPEEDS.map(s => `<button class="btn small" data-speed="${s}">×${s}</button>`).join('');
    p.innerHTML = `
      <h3>${STR.dbgTitle}</h3>
      <div class="row">${STR.dbgSpeed} ${speedBtns}</div>
      <div class="row">
        <button class="btn small" id="dbgGold">${STR.dbgGold}</button>
        ${STR.dbgStage} <input type="number" id="dbgStageIn" min="1" value="10"><button class="btn small" id="dbgGo">${STR.dbgGo}</button>
      </div>
      <div class="row">
        <select id="dbgGrade">${gradeOpts}</select> <input type="number" id="dbgLv" min="0" max="10" value="0" title="+단계">
        <button class="btn small" id="dbgGive">${STR.dbgGive}</button>
        ${STR.dbgSeed} <input type="number" id="dbgSeedIn" value="1"><button class="btn small" id="dbgSeed">OK</button>
      </div>
      <h3>${STR.dbgStats}</h3>
      <div id="dbgStats"></div>
      <h3>${STR.dbgSim}</h3>
      <div class="row">
        <select id="dbgSimN"><option value="10000">10,000</option><option value="1000000">1,000,000</option></select>
        <button class="btn small" id="dbgSim">${STR.dbgSim}</button>
      </div>
      <div id="dbgSimOut"></div>
      <h3>3-7 / 4-4 (v1.4)</h3>
      <div class="row"><button class="btn small" id="dbgOptGen">${STR.dbgOptGen}</button><button class="btn small" id="dbgDropSim">${STR.dbgDropSim}</button></div>
      <div id="dbgOptOut"></div>
      <h3>${STR.dbgLog}</h3>
      <div class="row"><button class="btn small" id="dbgCopy">${STR.dbgCopy}</button><span id="dbgCopyMsg" class="sub"></span></div>
      <textarea id="dbgCopyBox" rows="6" style="width:100%" hidden></textarea>
      <pre id="dbgLog"></pre>
      <h3>${STR.qaTitle}</h3>
      <div class="row"><button class="btn small" id="dbgQa">${STR.qaRun}</button>
        <button class="btn small" id="dbgQaCopy" disabled>${STR.qaCopy}</button><span id="dbgQaMsg" class="sub"></span></div>
      <div id="dbgQaOut"></div>`;

    p.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { Game.speed = +b.dataset.speed; this.render(); }));
    document.getElementById('dbgGold').addEventListener('click', () => { state.gold += 10000; });
    document.getElementById('dbgGo').addEventListener('click', () => this.gotoStage(+document.getElementById('dbgStageIn').value));
    document.getElementById('dbgGive').addEventListener('click', () => {
      const w = Loot.createWeapon(+document.getElementById('dbgGrade').value);
      w.level = Math.max(0, Math.min(CONFIG.MAX_LEVEL, Math.floor(+document.getElementById('dbgLv').value || 0)));
      Loot.addWeapon(w);
    });
    document.getElementById('dbgSeed').addEventListener('click', () => RNG.setSeed(+document.getElementById('dbgSeedIn').value));
    document.getElementById('dbgSim').addEventListener('click', () => this.runSim(+document.getElementById('dbgSimN').value));
    document.getElementById('dbgCopy').addEventListener('click', () => this.copyLog());
    document.getElementById('dbgOptGen').addEventListener('click', () => this.renderCheck(this.optionGen(10000)));
    document.getElementById('dbgDropSim').addEventListener('click', () => this.renderCheck(this.dropSim(10000)));
    document.getElementById('dbgQa').addEventListener('click', () => this.runQa());
    document.getElementById('dbgQaCopy').addEventListener('click', () => {
      if (QA.last) this.copyText(JSON.stringify({ summary: QA.last.summary, runs: QA.last.runs }, null, 1), document.getElementById('dbgQaMsg'));
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote' || e.key === '`') {
        e.preventDefault();
        this.open = !this.open;
        p.hidden = !this.open;
        if (this.open) this.render();
      }
    });
    this.resetWatch();
  },

  gotoStage(s) {
    if (!(s >= 1)) return;
    Stage.debugGoto(s);
    this.resetWatch();      // 디버그 이동은 H4 감소 횟수에 세지 않는다
  },

  // ---- H4 검증: 장착 깡스탯·최고 스테이지 감소 횟수 (0이어야 함). 로직 스텝마다 호출 ----
  resetWatch() { this.lastGrip = Combat.grip(state.equipped); this.lastBest = state.bestStage; },
  watch() {
    const g = Combat.grip(state.equipped);
    if (g < this.lastGrip) state.log.equippedGripDecreases++;
    if (state.bestStage < this.lastBest) state.log.bestStageDecreases++;
    this.lastGrip = g; this.lastBest = state.bestStage;
  },

  // ---- 강화 시뮬 ----
  // TODO(기획확인): 1만 회 표본에서 칸별 표준편차가 최대 0.5%p라 무작위 시드로는
  //   전 단계 ±1%p 통과 확률이 약 50%다. 판정 로직 자체는 100만 회 옵션으로 확인할 수 있다.
  runSim(n) {
    const rows = Enhance.simulate(n);
    const h = STR.dbgSimHead;
    let html = `<table><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>`;
    for (const r of rows) {
      html += `<tr><td>+${r.target}</td>${r.got.map(v => `<td>${v.toFixed(2)}</td>`).join('')}` +
        `<td>${r.exp.join('/')}</td><td class="${r.ok ? 'ok' : 'ng'}">${r.ok ? STR.dbgOk : STR.dbgNg} (${r.maxDiff.toFixed(2)})</td></tr>`;
    }
    html += `</table><div class="sub">n=${n.toLocaleString('en-US')} / 단계</div>`;
    document.getElementById('dbgSimOut').innerHTML = html;
    return rows;
  },

  // ---- 3-7 옵션 생성 검사: 전설 n개 → 소켓당 상/중/하 10/40/50, 종류 각 33.3 (±1%p) ----
  // 실제 게임 상태·난수를 건드리지 않도록 QA 격리 실행 안에서 (시드 고정이면 같은 결과)
  optionGen(n, seed) {
    return QA.sandbox(() => {
      state = createState(); RNG.setSeed(seed === undefined ? Date.now() : seed);
      const O = CONFIG.OPTIONS, tier = { high: 0, mid: 0, low: 0 }, type = { aspd: 0, crit: 0, def: 0 };
      let sockets = 0, badCount = 0;
      for (let i = 0; i < n; i++) {
        const w = Loot.createWeapon(4);
        if (w.options.length !== O.sockets[4]) badCount++;
        for (const o of w.options) { tier[o.tier]++; type[o.type]++; sockets++; }
      }
      const rows = [];
      O.tiers.forEach((t, i) => rows.push({ name: `등급 ${STR.optTierNames[t]}`, got: tier[t] / sockets * 100, exp: O.tierWeights[i] }));
      O.types.forEach(t => rows.push({ name: `종류 ${STR.optNames[t]}`, got: type[t] / sockets * 100, exp: 100 / O.types.length }));
      rows.forEach(r => { r.diff = Math.abs(r.got - r.exp); r.ok = r.diff <= 1; });
      return { title: `${STR.dbgOptGen}: 무기 ${n}개, 소켓 ${sockets}개 (소켓 수 어긋남 ${badCount})`, rows, ok: rows.every(r => r.ok) && !badCount };
    });
  },
  // ---- 4-4 구간별 드롭 검사: 구간마다 일반 몬스터·보스 n회씩 등급 판정 (±1%p) ----
  dropSim(n, seed) {
    return QA.sandbox(() => {
      state = createState(); RNG.setSeed(seed === undefined ? Date.now() : seed);
      const cases = [[3, false], [8, false], [13, false], [18, false], [25, false], [5, true], [10, true], [15, true], [20, true]];
      const rows = [];
      for (const [stage, boss] of cases) {
        const exp = Loot.dropWeights(stage, boss), c = [0, 0, 0, 0, 0];
        for (let i = 0; i < n; i++) c[RNG.pickWeighted(exp)]++;
        const got = c.map(x => x / n * 100), diff = Math.max(...got.map((g, i) => Math.abs(g - exp[i])));
        rows.push({ name: `s${stage} ${boss ? '보스' : '일반'}`, got, exp, diff, ok: diff <= 1 });
      }
      return { title: `${STR.dbgDropSim} (구간·보스별 ${n}회)`, rows, ok: rows.every(r => r.ok) };
    });
  },
  renderCheck(res) {
    const f = (v) => (Array.isArray(v) ? v.map(x => (+x).toFixed(1)).join('/') : (+v).toFixed(2));
    document.getElementById('dbgOptOut').innerHTML = `<div>${res.title}</div><table>` +
      res.rows.map(r => `<tr><th>${r.name}</th><td>${f(r.got)}</td><td>${f(r.exp)}</td><td class="${r.ok ? 'ok' : 'ng'}">${r.ok ? STR.dbgOk : STR.dbgNg} (${r.diff.toFixed(2)})</td></tr>`).join('') + '</table>';
    return res;
  },

  // ---- 플레이 로그 ----
  mmss(t) {
    if (t === undefined) return null;
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  },
  buildLog() {
    const L = state.log, spent = L.goldSpent.stat + L.goldSpent.enhance;
    const times = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { sec: +v.toFixed(1), mmss: this.mmss(v) }]));
    return {
      seed: RNG.seed,
      gameTimeSec: +state.time.toFixed(1),
      stage: state.stage, bestStage: state.bestStage, farming: state.farming,
      bossReached: times(L.bossReached),
      bossKilled: times(L.bossKilled),
      enhanceCount: L.enhanceCount,
      destroyCount: L.destroyCount,
      enhanceResults: L.resultCount,
      maxEnhanceLevel: L.maxEnhanceLevel,
      goldSpent: { stat: Math.round(L.goldSpent.stat), enhance: Math.round(L.goldSpent.enhance),
        enhanceRatio: spent ? +(L.goldSpent.enhance / spent).toFixed(3) : 0 },
      goldEarned: { kill: Math.round(L.goldEarned.kill), sell: Math.round(L.goldEarned.sell) },
      kills: L.kills, drops: L.drops,
      dropRate: { mob: L.kills.mob ? +(L.drops.mob / L.kills.mob).toFixed(4) : null, boss: L.kills.boss ? +(L.drops.boss / L.kills.boss).toFixed(4) : null },
      heroicOrBetterDrops: L.drops.byGrade[3] + L.drops.byGrade[4],
      defeats: L.defeats, autoSold: L.autoSold,
      equippedGripDecreases: L.equippedGripDecreases,
      bestStageDecreases: L.bestStageDecreases,
      statLv: { ...state.statLv },
      equipped: state.equipped ? { ...state.equipped, grip: Combat.grip(state.equipped) } : null,
    };
  },
  copyLog() {
    this.copyText(JSON.stringify(this.buildLog(), null, 2), document.getElementById('dbgCopyMsg'));
  },

  // ---- QA 봇 (9-4) ----
  runQa() {
    if (QA.running) return;
    const msg = document.getElementById('dbgQaMsg'), btn = document.getElementById('dbgQa');
    btn.disabled = true;
    QA.runAll((s, n) => { msg.textContent = STR.qaProgress(s, n); }).then((res) => {
      btn.disabled = false;
      document.getElementById('dbgQaCopy').disabled = false;
      msg.textContent = STR.qaDone(res.elapsedSec);
      document.getElementById('dbgQaOut').innerHTML = QA.tableHtml(res.summary);
    });
  },

  copyText(text, msg) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      msg.textContent = ok ? STR.dbgCopied : STR.dbgCopyFail;
      if (!ok) {
        const box = document.getElementById('dbgCopyBox');
        box.hidden = false; box.value = text; box.select();
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => { msg.textContent = STR.dbgCopied; }, fallback);
    } else fallback();
  },

  // ---- 현재 수치 ----
  render() {
    if (!this.open) return;
    document.querySelectorAll('#debug [data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === Game.speed));
    const bt = state.battle, mon = bt.monster || Combat.monsterStats(state.stage, bt.isBoss);
    const dps = Combat.dps();
    const n = Combat.monsterStats(state.stage, false), b = Combat.monsterStats(state.stage, true);
    const r = (x) => fmtRound(x);
    document.getElementById('dbgStats').innerHTML = `
      <table>
        <tr><th>${STR.dbgFinalAtk}</th><td>${Combat.finalAttack().toFixed(2)}</td><th>${STR.dbgDps}</th><td>${dps.toFixed(2)}</td></tr>
        <tr><th>${STR.dbgMobHp}</th><td>${r(mon.hp)} / ${r(mon.maxHp)}</td><th>${STR.dbgTtk}</th><td>${(mon.maxHp / dps).toFixed(2)}s</td></tr>
        <tr><th>s=${state.stage} 일반 체력/공격/골드</th><td colspan="3">${r(n.maxHp)} / ${r(n.atk)} / ${r(n.gold)}</td></tr>
        <tr><th>s=${state.stage} 보스 체력/공격/골드</th><td colspan="3">${r(b.maxHp)} / ${r(b.atk)} / ${r(b.gold)}</td></tr>
        <tr><th>받는 피해/타</th><td>${Combat.damageTaken(mon.atk).toFixed(2)}</td><th>보스 남은 시간</th><td>${bt.isBoss ? bt.bossTimeLeft.toFixed(1) + 's' : '-'}</td></tr>
      </table>`;
    const L = this.buildLog();
    document.getElementById('dbgLog').textContent =
      `게임 시간 ${this.mmss(state.time)} (×${Game.speed}) · 최고 ${state.bestStage}\n` +
      `보스 도달 ${JSON.stringify(Object.fromEntries(Object.entries(L.bossReached).map(([k, v]) => [k, v.mmss])))}\n` +
      `보스 처치 ${JSON.stringify(Object.fromEntries(Object.entries(L.bossKilled).map(([k, v]) => [k, v.mmss])))}\n` +
      `강화 ${L.enhanceCount}회 · 파괴 ${L.destroyCount}회 · 최고 +${L.maxEnhanceLevel}\n` +
      `골드 사용 스탯 ${fmt(L.goldSpent.stat)} / 강화 ${fmt(L.goldSpent.enhance)} (강화 ${(L.goldSpent.enhanceRatio * 100).toFixed(1)}%)\n` +
      `처치 일반 ${L.kills.mob} / 보스 ${L.kills.boss} · 드롭률 일반 ${L.dropRate.mob === null ? '-' : (L.dropRate.mob * 100).toFixed(1) + '%'} / 보스 ${L.dropRate.boss === null ? '-' : (L.dropRate.boss * 100).toFixed(1) + '%'}\n` +
      `영웅 이상 드롭 ${L.heroicOrBetterDrops} · 패배 ${L.defeats} · 자동 판매 ${L.autoSold}\n` +
      `H4 장착 무기 공격력 감소 ${L.equippedGripDecreases}회 · 최고 스테이지 감소 ${L.bestStageDecreases}회`;
  },

  update(dt) {
    if (!this.open) return;
    this.refresh -= 1;
    if (this.refresh <= 0) { this.refresh = 15; this.render(); }
  },
};
