// =====================================================================
// combat.js — 전투 계산 (화면 코드 없음). state만 바꾸고 이벤트를 낸다.
// =====================================================================
const Combat = {
  // ---- 4-1 스탯 ----
  statValue(key, lv) {
    const c = CONFIG.STATS[key];
    let v = c.base + c.perLv * lv;
    if (key === 'aspd') {
      const p = Math.pow(10, CONFIG.ASPD_DECIMALS);
      v = Math.min(c.max, Math.round(v * p) / p);
    }
    return v;
  },
  stat(key) { return this.statValue(key, state.statLv[key]); },
  isStatMax(key) {
    const c = CONFIG.STATS[key];
    return c.max !== undefined && this.stat(key) >= c.max - CONFIG.FLOAT_EPS;
  },
  // 비용 = floor(costBase × costMul^현재레벨). FLOAT_EPS는 1.13^n 의 부동소수 오차로 1이 깎이는 것만 막는다.
  statCost(key, lv) {
    const c = CONFIG.STATS[key];
    return Math.floor(c.costBase * Math.pow(c.costMul, lv) + CONFIG.FLOAT_EPS);
  },

  // ---- 4-3 깡스탯 ----
  grip(w) {
    if (!w) return 0;
    const g = CONFIG.GRADES[w.grade];
    return g.base + g.perLv * w.level;
  },

  // ---- 3-1 ----
  // 최종 공격력 = (기본 공격력 + 강화 수치) × (1 + 장착 무기 깡스탯 / 100)
  finalAttack() { return this.stat('atk') * (1 + this.grip(state.equipped) / 100); },
  maxHp() { return this.stat('hp'); },

  // ---- 3-7 무기 추가 옵션 (v1.4): 장착한 무기의 것만 적용 ----
  optionSum(type) {
    const w = state.equipped;
    if (!w || !w.options) return 0;
    let s = 0;
    for (const o of w.options) if (o.type === type) s += CONFIG.OPTIONS.value[o.tier][o.type];
    return s;
  },
  // 최종 공격속도 = min(3.00, 스탯 공격속도 × (1 + 옵션 공속 합 / 100))
  finalAspd() { return Math.min(CONFIG.OPTIONS.aspdFinalMax, this.stat('aspd') * (1 + this.optionSum('aspd') / 100)); },
  // 치명타 확률(0~1) = 옵션 치명 합 (기본 0%, 최대 60%)
  critChance() { return Math.min(CONFIG.OPTIONS.critMax, this.optionSum('crit')) / 100; },
  // 최종 방어력 = 스탯 방어력 + 옵션 방어 합
  finalDef() { return this.stat('def') + this.optionSum('def'); },

  attackInterval() { return 1 / this.finalAspd(); },
  // 기대 DPS (치명타 기대값 포함)
  dps() { return this.finalAttack() * this.finalAspd() * (1 + this.critChance() * (CONFIG.OPTIONS.critMult - 1)); },
  // 받는 피해 = 몬스터 공격력 × 50 / (50 + 최종 방어력)
  damageTaken(mobAtk) { return mobAtk * CONFIG.DEF_K / (CONFIG.DEF_K + this.finalDef()); },

  // ---- 4-2 몬스터 ----
  monsterStats(s, isBoss) {
    const m = CONFIG.MONSTER, b = CONFIG.BOSS, k = s - 1;
    const hp = m.hpBase * Math.pow(m.hpMul, k);
    const atk = m.atkBase * Math.pow(m.atkMul, k);
    const gold = m.goldBase * Math.pow(m.goldMul, k);
    if (!isBoss) return { hp, maxHp: hp, atk, gold, isBoss: false, interval: m.attackInterval, dropRate: m.dropRate };
    return { hp: hp * b.hpMul, maxHp: hp * b.hpMul, atk: atk * b.atkMul, gold: gold * b.goldMul,
      isBoss: true, interval: b.attackInterval, dropRate: b.dropRate };
  },

  // 한 로직 틱. 반환: 'kill' | 'dead' | null
  tick(dt) {
    const bt = state.battle, mon = bt.monster;
    if (!mon) return null;
    // 플레이어: 1/공격속도 초마다. 첫 공격은 간격이 지난 뒤
    bt.playerAtkTimer += dt;
    let interval = this.attackInterval();
    while (bt.playerAtkTimer >= interval) {
      bt.playerAtkTimer -= interval;
      // 몬스터는 방어력이 없다. 치명타는 무기 옵션으로만 생기고, 공격마다 판정해 터지면 피해 × 2
      const cc = this.critChance();
      const crit = cc > 0 && RNG.random() < cc;
      const dmg = this.finalAttack() * (crit ? CONFIG.OPTIONS.critMult : 1);
      mon.hp -= dmg;
      Events.emit('playerAttack', { dmg, isBoss: mon.isBoss, crit });
      if (mon.hp <= 0) { mon.hp = 0; return 'kill'; }
      interval = this.attackInterval();
    }
    // 몬스터: 1.0초마다
    bt.monsterAtkTimer += dt;
    while (bt.monsterAtkTimer >= mon.interval) {
      bt.monsterAtkTimer -= mon.interval;
      const dmg = this.damageTaken(mon.atk);   // 소수점은 내부 유지, 표시만 반올림
      bt.playerHp -= dmg;
      Events.emit('monsterAttack', { dmg });
      if (bt.playerHp <= 0) { bt.playerHp = 0; return 'dead'; }
    }
    return null;
  },

  // ---- 스탯 강화 (T3) ----
  canBuyStat(key) {
    return !this.isStatMax(key) && state.gold >= this.statCost(key, state.statLv[key]);
  },
  buyStat(key) {
    if (!this.canBuyStat(key)) return false;
    const cost = this.statCost(key, state.statLv[key]);
    const before = this.stat(key);
    state.gold -= cost;
    state.log.goldSpent.stat += cost;
    state.statLv[key]++;
    // 최대 체력이 늘면 현재 체력도 같은 양만큼 늘어난다 (3-2)
    if (key === 'hp') state.battle.playerHp += this.stat('hp') - before;
    Events.emit('statBought', { key });
    return true;
  },
};
