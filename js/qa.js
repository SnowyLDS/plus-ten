// =====================================================================
// qa.js — QA 봇 3종과 일괄 실행기 (9-4, v1.1)
// 화면을 그리지 않고 로직만 최대 속도로 돌린다. 게임 로직은 실제 게임과 같은 코드
// (Game.step → Stage/Combat/Loot/Enhance)를 그대로 쓴다. 게임 상태는 판마다 따로 만들고,
// 끝나면 실제 게임의 state·이벤트·난수를 원래대로 돌려놓는다.
// =====================================================================
const QA = {
  BOTS: ['A', 'B', 'C'],
  running: false,
  enhanceMode: 'onIncome',   // 'onIncome'(기본) | 'everyStep'(해석 비교용)

  // ---- 스탯 전략 ----
  pickStat(bot) {
    const lv = state.statLv;
    if (bot === 'B') return 'atk';                                   // 공격력만
    if (bot === 'C') {                                               // 공격력·공격속도 중 레벨 낮은 쪽, 같으면 공격력
      if (Combat.isStatMax('aspd')) return 'atk';
      return lv.aspd < lv.atk ? 'aspd' : 'atk';
    }
    // A 균등형: 레벨이 가장 낮은 스탯. 동률은 공격력 → 체력 → 방어력 → 공격속도. 공속 MAX면 나머지 3종
    const keys = CONFIG.STAT_ORDER.filter(k => !Combat.isStatMax(k));
    return keys.reduce((m, k) => (lv[k] < lv[m] ? k : m));
  },

  // ---- 세 봇의 공통 행동 (매 로직 스텝) ----
  act(bot, ctx) {
    const Q = CONFIG.QA;
    // 1. 무기 강화: "골드가 생기면" 먼저, 인벤토리에서 깡스탯이 가장 높고 +5 미만인 무기, 현재 골드의 30%까지
    // TODO(기획확인): 골드가 들어온 시점마다 1회, 비용 ≤ 현재 골드×30%일 때만 시도로 해석.
    //   (매 스텝 검사하면 모아 둔 골드에서 0.8초마다 30%씩 반복 지출돼 강화 비중이 50%를 넘음 → enhanceMode='everyStep')
    //   'incomeShare' = 누적 강화 지출 ≤ 누적 수입×30% (해석 비교용)
    const income = state.gold > ctx.lastGold + CONFIG.FLOAT_EPS;
    if (!state.enhancing && (income || this.enhanceMode === 'everyStep')) {
      const t = state.inventory.find(w => w.level < Q.enhanceBelowLevel);   // inventory는 깡스탯 내림차순 정렬
      if (t) {
        const c = Enhance.cost(t), L = state.log;
        const okBudget = this.enhanceMode === 'incomeShare'
          ? L.goldSpent.enhance + c <= (L.goldEarned.kill + L.goldEarned.sell) * Q.enhanceGoldRatio && c <= state.gold
          : c <= state.gold * Q.enhanceGoldRatio;
        if (okBudget) Enhance.start(t.id);
      }
    }
    // 2. 장착: 장착 무기 이상이면 즉시. 판매는 가득 참 자동 판매만
    // TODO(기획확인): 깡스탯이 "같은" 무기끼리는 매 스텝 맞바꾸게 되므로 더 높을 때만 교체 (전투력 동일)
    const best = state.inventory.find(w => !Loot.isLocked(w));
    if (best && Loot.grip(best) > Loot.grip(state.equipped)) Loot.equip(best.id);
    // 3. 남은 골드: 스탯 전략대로 살 수 있는 만큼. 모자라면 모은다
    for (;;) { if (!Combat.buyStat(this.pickStat(bot))) break; }
    ctx.lastGold = state.gold;
    // 4. 파밍 중이면 30초마다 도전
    if (state.farming) {
      if (ctx.farmT === null) ctx.farmT = state.time;
      if (state.time - ctx.farmT >= Q.challengeEvery) { Stage.requestChallenge(); ctx.farmT = state.time; }
    } else ctx.farmT = null;
  },

  // 실제 게임 상태를 건드리지 않도록 격리해서 실행
  sandbox(fn) {
    const saved = { state, h: Events._h, g: RNG._g, seed: RNG.seed, lg: Debug.lastGrip, lb: Debug.lastBest,
      sd: Loot.suppressDrops, fn: Enhance.forceNext };
    // v1.4: QA 헤드리스 실행은 튜토리얼을 건너뛴다 (튜토리얼의 드롭 멈춤·결과 고정·전투 멈춤이 섞이지 않게)
    Loot.suppressDrops = false; Enhance.forceNext = null; this.inSandbox = true;
    try { return fn(); } finally {
      state = saved.state; Events._h = saved.h; RNG._g = saved.g; RNG.seed = saved.seed;
      Debug.lastGrip = saved.lg; Debug.lastBest = saved.lb;
      Loot.suppressDrops = saved.sd; Enhance.forceNext = saved.fn; this.inSandbox = false;
    }
  },

  runOne(bot, seed) {
    return this.sandbox(() => {
      state = createState();
      Events._h = {};
      RNG.setSeed(seed);
      Debug.resetWatch();
      const defeats = { dead: 0, timeout: 0 };
      Events.on('defeat', (e) => { defeats[e.reason]++; });
      Stage.startStage(1);
      const ctx = { farmT: null, lastGold: state.gold };
      const steps = Math.round(CONFIG.QA.gameSec / CONFIG.STEP);
      for (let i = 0; i < steps; i++) {
        this.act(bot, ctx);
        Game.step(CONFIG.STEP);
      }
      const L = state.log, spent = L.goldSpent.stat + L.goldSpent.enhance;
      return {
        bot, seed,
        bossKilled: Object.fromEntries(CONFIG.QA.bossStages.map(s => [s, L.bossKilled[s] === undefined ? null : L.bossKilled[s]])),
        bestStage: state.bestStage,
        defeats,
        statLv: { ...state.statLv },
        finalAtk: Combat.finalAttack(), dps: Combat.dps(), maxHp: Combat.maxHp(),
        equippedGrip: Combat.grip(state.equipped),
        enhanceCount: L.enhanceCount, destroyCount: L.destroyCount,
        enhanceGoldRatio: spent ? L.goldSpent.enhance / spent : 0,
        h4: L.equippedGripDecreases + L.bestStageDecreases,
      };
    });
  },

  // ---- 집계 ----
  median(a) {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  },
  avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; },
  summarize(runs) {
    const out = {};
    for (const bot of this.BOTS) {
      const R = runs.filter(r => r.bot === bot), n = R.length;
      const boss = {};
      for (const s of CONFIG.QA.bossStages) {
        const t = R.map(r => r.bossKilled[s]).filter(x => x !== null).map(x => x / 60);
        boss[s] = { medianMin: this.median(t), rate: n ? t.length / n : 0 };
      }
      const best = R.map(r => r.bestStage);
      out[bot] = {
        runs: n,
        boss,
        bestStage: { median: this.median(best), min: Math.min(...best), max: Math.max(...best) },
        defeatsPerRun: { dead: this.avg(R.map(r => r.defeats.dead)), timeout: this.avg(R.map(r => r.defeats.timeout)) },
        statLv: Object.fromEntries(CONFIG.STAT_ORDER.map(k => [k, this.avg(R.map(r => r.statLv[k]))])),
        finalAtk: this.avg(R.map(r => r.finalAtk)), dps: this.avg(R.map(r => r.dps)), maxHp: this.avg(R.map(r => r.maxHp)),
        // 참고 (9-4 표 외)
        enhanceCount: this.avg(R.map(r => r.enhanceCount)), destroyCount: this.avg(R.map(r => r.destroyCount)),
        enhanceGoldRatio: this.avg(R.map(r => r.enhanceGoldRatio)), h4: R.reduce((x, r) => x + r.h4, 0),
      };
    }
    out.verdict = this.judge(out);
    return out;
  },

  // 판정 (9-4). 수치는 바꾸지 않고 신호만 보고한다
  judge(S) {
    const Q = CONFIG.QA, med = this.BOTS.map(b => [b, S[b].bestStage.median]);
    const top = med.reduce((m, x) => (x[1] > m[1] ? x : m)), low = med.reduce((m, x) => (x[1] < m[1] ? x : m));
    const gap = top[1] - low[1];
    const signals = [];
    const lagging = med.filter(x => top[1] - x[1] >= Q.problemGap).map(x => x[0]);
    if (lagging.length) signals.push({ type: 'gap', leader: top[0], lagging, text: STR.qaSigGap(top[0], lagging, gap) });
    const bDead = S.B.defeatsPerRun.dead;
    if (bDead < Q.rarelyDeadPerRun) signals.push({ type: 'bNoDeath', text: STR.qaSigBDead(bDead) });
    const status = gap <= Q.healthyGap ? 'healthy' : (lagging.length ? 'problem' : 'warn');
    return { gap, best: top[0], worst: low[0], status, signals };
  },

  // ---- 실행기 ----
  runAllSync(seeds) {
    const runs = [];
    for (let s = 1; s <= (seeds || CONFIG.QA.seeds); s++) for (const b of this.BOTS) runs.push(this.runOne(b, s));
    return { runs, summary: this.summarize(runs) };
  },
  // 디버그 패널용: 한 시드(3판)씩 나눠 돌려 화면이 멈추지 않게
  runAll(onProgress) {
    if (this.running) return Promise.reject(new Error('running'));
    this.running = true;
    const N = CONFIG.QA.seeds, runs = [], t0 = performance.now();
    return new Promise((resolve) => {
      let s = 1;
      const chunk = () => {
        for (const b of this.BOTS) runs.push(this.runOne(b, s));
        if (onProgress) onProgress(s, N);
        if (++s <= N) { setTimeout(chunk, 0); return; }
        this.running = false;
        this.last = { runs, summary: this.summarize(runs), elapsedSec: (performance.now() - t0) / 1000 };
        resolve(this.last);
      };
      setTimeout(chunk, 0);
    });
  },

  // ---- 결과 표 (디버그 패널) ----
  fmtMin(x) { return x === null ? '-' : x.toFixed(1); },
  tableHtml(S) {
    const B = this.BOTS, row = (label, f) => `<tr><th>${label}</th>${B.map(b => `<td>${f(S[b], b)}</td>`).join('')}</tr>`;
    let h = `<table><tr><th></th>${B.map(b => `<th>${STR.qaBotNames[b]}</th>`).join('')}</tr>`;
    for (const s of CONFIG.QA.bossStages) {
      h += row(STR.qaBossKill(s), (x) => `${this.fmtMin(x.boss[s].medianMin)}${STR.qaMin} · ${(x.boss[s].rate * 100).toFixed(0)}%`);
    }
    h += row(STR.qaBest, (x) => `${x.bestStage.median} (${x.bestStage.min}~${x.bestStage.max})`);
    h += row(STR.qaDefeats, (x) => `${x.defeatsPerRun.dead.toFixed(1)} / ${x.defeatsPerRun.timeout.toFixed(1)}`);
    h += row(STR.qaStats, (x) => CONFIG.STAT_ORDER.map(k => x.statLv[k].toFixed(1)).join(' / '));
    h += row(STR.qaPower, (x) => `${x.finalAtk.toFixed(0)} / ${x.dps.toFixed(0)} / ${x.maxHp.toFixed(0)}`);
    h += row(STR.qaH4, (x) => x.h4);
    h += '</table>';
    const v = S.verdict;
    h += `<div class="${v.status === 'healthy' ? 'ok' : 'ng'}">${STR.qaVerdict[v.status]} · ${STR.qaGap(v.gap)}</div>`;
    for (const sg of v.signals) h += `<div class="ng">⚠ ${sg.text}</div>`;
    return h;
  },
};
