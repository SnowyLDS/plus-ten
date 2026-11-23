// =====================================================================
// enhance.js — 무기 강화 (3-5, 4-5)
// 판정은 연출 시작 시점에 미리 결정하고, 0.8초 뒤 state에 반영한다. 골드는 누른 즉시 차감.
// 장착 무기는 인벤토리에 없으므로 강화할 수 없다.
// =====================================================================
const Enhance = {
  RESULTS: ['success', 'drop', 'destroy', 'keep'],
  forceNext: null,          // 튜토리얼 전용 (tutorial.js만 설정). 다음 강화 1회의 결과


  probs(w) { return CONFIG.ENHANCE_PROB[w.level]; },           // [성공, 단계 하락, 파괴, 유지] 전체 기준
  cost(w) { return w.level >= CONFIG.MAX_LEVEL ? null : CONFIG.ENHANCE_COST[w.grade][w.level]; },

  // 0~100 실수 하나를 뽑아 성공 → 단계 하락 → 파괴 → 유지 순서로 구간을 자른다
  roll(level, rnd) {
    const p = CONFIG.ENHANCE_PROB[level];
    const r = rnd * 100;
    if (r < p[0]) return 'success';
    if (r < p[0] + p[1]) return 'drop';
    if (r < p[0] + p[1] + p[2]) return 'destroy';
    return 'keep';
  },

  canEnhance(w) {
    if (!w || !Loot.find(w.id)) return false;                  // 인벤토리 무기만
    if (state.enhancing) return false;                         // 결과 연출 중 잠김 (더블 클릭 방지)
    if (w.level >= CONFIG.MAX_LEVEL) return false;
    return state.gold >= this.cost(w);                         // 골드 부족 시 비활성
  },

  start(id) {
    const w = Loot.find(id);
    if (!this.canEnhance(w)) return false;
    const cost = this.cost(w);
    state.gold -= cost;
    state.log.goldSpent.enhance += cost;
    state.log.enhanceCount++;
    // 6-9 튜토리얼 예외: 튜토리얼의 강화 1회(6단계)만 성공으로 정해 둔다(1회용). 그 밖에는 항상 4-5 표 판정
    let result;
    if (this.forceNext) { result = this.forceNext; this.forceNext = null; }
    else result = this.roll(w.level, RNG.random());
    state.enhancing = { id: w.id, result, timer: CONFIG.ENHANCE_DELAY, from: w.level, grade: w.grade };
    Events.emit('enhanceStart', { weapon: w });
    return true;
  },

  update(dt) {
    const e = state.enhancing;
    if (!e) return;
    e.timer -= dt;
    if (e.timer > 0) return;
    state.enhancing = null;
    const w = Loot.find(e.id);
    if (!w) return;   // 다른 경로로 사라진 경우 (현재 규칙상 발생하지 않음: 연출 중 판매·자동 판매 잠김)
    let to = w.level;
    if (e.result === 'success') to = w.level + 1;
    else if (e.result === 'drop') to = w.level - 1;            // 강화 단계만 −1. 등급은 그대로
    if (e.result === 'destroy') {
      state.inventory.splice(state.inventory.indexOf(w), 1);   // 골드는 돌려주지 않음
      state.log.destroyCount++;
    } else {
      w.level = to;
    }
    state.log.resultCount[e.result]++;
    if (e.result === 'success' && to > state.log.maxEnhanceLevel) state.log.maxEnhanceLevel = to;
    Loot.changed();
    // 강화에 성공해 장착 무기 이상이 되어도 자동 장착하지 않는다
    Events.emit('enhanceResult', { id: e.id, grade: e.grade, result: e.result, from: e.from, to });
  },

  // 디버그: 단계별 n회 판정 비율 (state를 바꾸지 않음)
  simulate(n, seed) {
    const g = RNG.create(seed === undefined ? Date.now() : seed);
    const rows = [];
    for (let lv = 0; lv < CONFIG.MAX_LEVEL; lv++) {
      const c = { success: 0, drop: 0, destroy: 0, keep: 0 };
      for (let i = 0; i < n; i++) c[this.roll(lv, g.next())]++;
      const got = this.RESULTS.map(k => c[k] / n * 100);
      const exp = CONFIG.ENHANCE_PROB[lv];
      const maxDiff = Math.max(...got.map((v, i) => Math.abs(v - exp[i])));
      rows.push({ target: lv + 1, got, exp, maxDiff, ok: maxDiff <= 1 });
    }
    return rows;
  },
};
