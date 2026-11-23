// =====================================================================
// loot.js — 드롭·인벤토리·가득 참 처리·판매 (3-3, 3-4, 3-6)
// 불변 규칙: 장착 무기의 깡스탯은 절대 감소하지 않는다.
// =====================================================================
const Loot = {
  grip(w) { return Combat.grip(w); },
  sellPrice(w) { return CONFIG.SELL_PRICE[w.grade][w.level]; },   // 4-6 표 그대로
  name(w) { return w.label || STR.weaponName(w.grade); },   // label: 튜토리얼 "연습용 검"만
  suppressDrops: false,     // 튜토리얼 중에는 대본이 어긋나지 않게 드롭을 멈춘다 (tutorial.js만 설정)

  // v1.4 무기 객체: { id, grade, level, options: [{ type, tier }] }. 옵션 수치는 저장하지 않고 config에서 계산
  createWeapon(grade) {
    return { id: state.nextWeaponId++, grade, level: 0, options: this.rollOptions(grade) };
  },
  // 3-7: 무기를 얻는 순간 소켓마다 따로 — 종류 1/3씩(중복 가능), 등급 상 10 / 중 40 / 하 50. 이후 절대 바뀌지 않는다
  rollOptions(grade) {
    const O = CONFIG.OPTIONS, n = O.sockets[grade], out = [];
    for (let i = 0; i < n; i++) {
      const type = O.types[RNG.int(O.types.length)];
      const tier = O.tiers[RNG.pickWeighted(O.tierWeights)];
      out.push({ type, tier });
    }
    return out;
  },
  optionValue(o) { return CONFIG.OPTIONS.value[o.tier][o.type]; },
  hasHighOption(w) { return !!w && (w.options || []).some(o => o.tier === 'high'); },

  // 4-4 (v1.4): 스테이지 구간별 드롭 표. 보스는 한 구간 위의 표
  dropBand(stage, isBoss) {
    const B = CONFIG.DROP_BANDS;
    let k = B.findIndex(b => stage <= b.upTo);
    if (k < 0) k = B.length - 1;
    if (isBoss) k = Math.min(B.length - 1, k + CONFIG.BOSS_BAND_SHIFT);
    return k;
  },
  dropWeights(stage, isBoss) { return CONFIG.DROP_BANDS[this.dropBand(stage, isBoss)].w; },

  // 처치 시 드롭 판정 (파밍 중에는 실제로 싸우는 스테이지 = state.stage의 표)
  rollDrop(mon) {
    if (this.suppressDrops) return null;
    if (RNG.random() >= mon.dropRate) return null;
    const grade = RNG.pickWeighted(this.dropWeights(state.stage, mon.isBoss));
    const w = this.createWeapon(grade);
    state.log.drops[mon.isBoss ? 'boss' : 'mob']++;
    state.log.drops.byGrade[grade]++;
    Events.emit('weaponDropped', { weapon: w, isBoss: mon.isBoss });
    this.addWeapon(w);
    return w;
  },

  // 정렬: 깡스탯 내림차순 → 판매가 내림차순 → 먼저 얻은 순
  sort() {
    state.inventory.sort((a, b) =>
      (this.grip(b) - this.grip(a)) || (this.sellPrice(b) - this.sellPrice(a)) || (a.id - b.id));
  },

  changed() { this.sort(); Events.emit('inventoryChanged', {}); },

  find(id) { return state.inventory.find(w => w.id === id) || null; },

  addWeapon(w) {
    // 장착 무기가 없으면(게임 시작 직후) 자동 장착. 그 외에는 자동 장착하지 않는다.
    if (!state.equipped) {
      state.equipped = w;
      Events.emit('weaponAcquired', { weapon: w, autoEquipped: true });
      Events.emit('equipChanged', {});
      return;
    }
    if (state.inventory.length < CONFIG.INVENTORY_SIZE) {
      state.inventory.push(w);
      this.changed();
      Events.emit('weaponAcquired', { weapon: w });
      return;
    }
    this.handleFull(w);
  },

  // 가득 참 처리 (3-4): 21개 중 깡스탯 최저를 자동 판매
  handleFull(w) {
    // TODO(기획확인): 강화 연출(0.8초) 중인 무기는 자동 판매 후보에서 뺀다 (이미 골드를 낸 진행 중 행동 보호)
    const enhId = state.enhancing ? state.enhancing.id : -1;
    const pool = state.inventory.filter(x => x.id !== enhId);
    const minGrip = Math.min(this.grip(w), ...pool.map(x => this.grip(x)));
    let victim;
    if (this.grip(w) === minGrip) {
      victim = w;                                   // 방금 얻은 무기가 최저에 포함되면 그것을 판매
    } else {
      const ties = pool.filter(x => this.grip(x) === minGrip);
      ties.sort((a, b) => (this.sellPrice(a) - this.sellPrice(b)) || (a.id - b.id));  // 판매가 낮은 쪽 → 먼저 얻은 쪽
      victim = ties[0];
    }
    const price = this.sellPrice(victim);
    state.gold += price;
    state.log.goldEarned.sell += price;
    state.log.autoSold++;
    if (victim !== w) {
      state.inventory.splice(state.inventory.indexOf(victim), 1);
      state.inventory.push(w);
    }
    this.changed();
    Events.emit('weaponAcquired', { weapon: w, autoSold: victim });
    Events.emit('autoSold', { weapon: victim, price });
  },

  isLocked(w) { return !!state.enhancing && state.enhancing.id === w.id; },

  // 장착 교체 규칙: 인벤토리 무기의 깡스탯이 장착 무기 "이상"일 때만
  canEquip(w) {
    if (!w || !this.find(w.id) || this.isLocked(w)) return false;
    return !state.equipped || this.grip(w) >= this.grip(state.equipped);
  },
  equip(id) {
    const w = this.find(id);
    if (!this.canEquip(w)) return false;
    const old = state.equipped;
    state.inventory.splice(state.inventory.indexOf(w), 1);
    state.equipped = w;
    if (old) state.inventory.push(old);           // 기존 무기는 인벤토리로
    this.changed();
    Events.emit('equipChanged', {});
    return true;
  },

  // 판매는 인벤토리 무기만. 장착 무기는 팔 수 없다.
  canSell(w) { return !!w && !!this.find(w.id) && !this.isLocked(w); },
  needsConfirm(w) { return w.grade >= CONFIG.CONFIRM_SELL_GRADE || w.level >= CONFIG.CONFIRM_SELL_LEVEL; },
  sell(id) {
    const w = this.find(id);
    if (!this.canSell(w)) return 0;
    const price = this.sellPrice(w);
    state.inventory.splice(state.inventory.indexOf(w), 1);
    state.gold += price;
    state.log.goldEarned.sell += price;
    this.changed();
    Events.emit('weaponSold', { weapon: w, price });
    return price;
  },

  // 일괄 판매: 일반·고급 +0 전부. 강화된 무기는 포함하지 않는다.
  bulkTargets() {
    return state.inventory.filter(w => w.grade <= CONFIG.BULK_SELL_MAX_GRADE && w.level === 0 && !this.isLocked(w));
  },
  bulkSell() {
    const list = this.bulkTargets();
    let total = 0;
    for (const w of list) total += this.sell(w.id);
    Events.emit('bulkSold', { count: list.length, total });
    return { count: list.length, total };
  },

  // 장착 무기보다 깡스탯이 높은 무기가 있나 (알림 점)
  isBetter(w) { return !!state.equipped && this.grip(w) > this.grip(state.equipped); },
  hasBetter() { return state.inventory.some(w => this.isBetter(w)); },
};
