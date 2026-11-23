// =====================================================================
// state.js — 게임 상태 객체 하나 + 로직→화면 이벤트 버스
// 무기 객체는 { id, grade, level, options: [{ type, tier }] } (v1.4 3-7). 깡스탯·옵션 수치·비용·판매가는 저장하지 않는다.
// =====================================================================
const Events = {
  _h: {},
  on(name, fn) { (this._h[name] || (this._h[name] = [])).push(fn); },
  emit(name, data) {
    const list = this._h[name];
    if (list) for (const fn of list) fn(data || {});
  },
};

function createState() {
  return {
    time: 0,                 // 게임 시간(초). 디버그 배속에 따라 빨라짐
    gold: 0,
    statLv: { atk: 0, hp: 0, def: 0, aspd: 0 },
    equipped: null,          // 무기 객체 또는 null (게임 시작 직후)
    inventory: [],           // 항상 정렬된 상태로 유지
    nextWeaponId: 1,
    stage: 1,
    bestStage: 1,            // 최고 도달 스테이지
    farming: false,
    challengePending: false,
    battle: {
      phase: 'idle',         // 'fight' | 'spawnWait' | 'defeatWait' | 'idle'
      timer: 0,              // spawnWait / defeatWait 남은 시간
      nextStage: 0,          // 대기 후 시작할 스테이지 (0이면 같은 스테이지의 다음 몬스터)
      isBoss: false,
      kills: 0,              // 스테이지 내 처치 수
      playerHp: 0,
      playerAtkTimer: 0,
      monsterAtkTimer: 0,
      bossTimeLeft: 0,
      monster: null,         // { hp, maxHp, atk, gold, isBoss }
    },
    enhancing: null,         // { id, result, timer, from }
    log: {
      bossReached: {},       // { 스테이지: 게임시간(초) }
      bossKilled: {},
      enhanceCount: 0,
      destroyCount: 0,
      resultCount: { success: 0, drop: 0, destroy: 0, keep: 0 },
      maxEnhanceLevel: 0,
      goldSpent: { stat: 0, enhance: 0 },
      goldEarned: { kill: 0, sell: 0 },
      defeats: 0,
      kills: { mob: 0, boss: 0 },
      drops: { mob: 0, boss: 0, byGrade: [0, 0, 0, 0, 0] },
      autoSold: 0,
      // H4 검증용: 0이어야 한다
      equippedGripDecreases: 0,
      bestStageDecreases: 0,
    },
  };
}

let state = createState();
