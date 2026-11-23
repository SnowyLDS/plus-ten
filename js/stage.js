// =====================================================================
// stage.js — 스테이지 진행·파밍·도전 (2장 "스테이지 진행 규칙", 3-2)
// =====================================================================
const Stage = {
  isBossStage(s) { return s % CONFIG.BOSS_EVERY === 0; },
  farmStage() { return Math.max(1, state.bestStage - 1); },

  // 스테이지 시작: 체력은 이때만 최대로 회복
  startStage(s) {
    const bt = state.battle;
    state.stage = s;
    bt.isBoss = this.isBossStage(s);
    bt.kills = 0;
    bt.playerHp = Combat.maxHp();
    if (bt.isBoss && state.log.bossReached[s] === undefined) state.log.bossReached[s] = state.time;
    Events.emit('stageStart', { stage: s, isBoss: bt.isBoss, farming: state.farming });
    this.spawn();
  },

  spawn() {
    const bt = state.battle;
    bt.monster = Combat.monsterStats(state.stage, bt.isBoss);
    bt.playerAtkTimer = 0;     // 첫 공격은 양쪽 모두 각자의 간격이 지난 뒤
    bt.monsterAtkTimer = 0;
    if (bt.isBoss) bt.bossTimeLeft = CONFIG.BOSS.timeLimit;
    bt.phase = 'fight';
    Events.emit('monsterSpawn', { monster: bt.monster, stage: state.stage });
  },

  // 도전 버튼: 파밍 중일 때만. 다음 전투부터 최고 도달 스테이지에 도전
  // TODO(기획확인): "다음 전투" = 지금 싸우는 몬스터가 끝난 뒤 다음 몬스터가 나올 때로 해석
  requestChallenge() {
    if (!state.farming) return false;
    state.challengePending = true;
    Events.emit('challengeQueued', {});
    return true;
  },

  update(dt) {
    const bt = state.battle;
    if (bt.phase === 'fight') {
      const r = Combat.tick(dt);
      if (r === 'kill') return this.onKill();
      if (r === 'dead') return this.defeat('dead');
      if (bt.isBoss) {
        bt.bossTimeLeft -= dt;
        if (bt.bossTimeLeft <= 0) { bt.bossTimeLeft = 0; return this.defeat('timeout'); }
      }
    } else if (bt.phase === 'spawnWait' || bt.phase === 'defeatWait') {
      bt.timer -= dt;
      if (bt.timer <= 0) this.afterWait();
    }
  },

  onKill() {
    const bt = state.battle, mon = bt.monster;
    state.gold += mon.gold;                       // 처치 즉시 지급
    state.log.goldEarned.kill += mon.gold;
    state.log.kills[mon.isBoss ? 'boss' : 'mob']++;
    if (mon.isBoss && state.log.bossKilled[state.stage] === undefined) state.log.bossKilled[state.stage] = state.time;
    Events.emit('monsterKilled', { gold: mon.gold, isBoss: mon.isBoss });
    Loot.rollDrop(mon);
    bt.kills++;
    bt.monster = null;
    bt.phase = 'spawnWait';
    bt.timer = CONFIG.SPAWN_DELAY;
    bt.nextStage = 0;
    if (bt.isBoss || bt.kills >= CONFIG.MOBS_PER_STAGE) this.onClear();
  },

  onClear() {
    const bt = state.battle;
    Events.emit('stageClear', { stage: state.stage });
    if (state.farming) {
      bt.nextStage = state.stage;                 // 파밍 중에는 자동으로 올라가지 않는다
    } else {
      bt.nextStage = state.stage + 1;             // 깨면 자동으로 다음 스테이지
      if (bt.nextStage > state.bestStage) state.bestStage = bt.nextStage;
    }
  },

  // 패배: 체력 0 또는 보스 제한시간 초과 → "최고 도달 − 1" 파밍
  defeat(reason) {
    const bt = state.battle;
    state.log.defeats++;
    state.farming = true;
    state.challengePending = false;
    bt.phase = 'defeatWait';
    bt.timer = CONFIG.DEFEAT_DELAY;
    bt.nextStage = this.farmStage();
    Events.emit('defeat', { reason, stage: state.stage });
  },

  afterWait() {
    const bt = state.battle;
    if (state.challengePending) {               // 도전: 다음 전투부터 최고 도달 스테이지
      state.challengePending = false;
      state.farming = false;
      return this.startStage(state.bestStage);
    }
    if (bt.nextStage) return this.startStage(bt.nextStage);
    this.spawn();                               // 같은 스테이지 다음 몬스터 (체력 회복 없음)
  },

  // 디버그: 스테이지 이동
  debugGoto(s) {
    s = Math.max(1, Math.floor(s));
    state.bestStage = s;
    state.farming = false;
    state.challengePending = false;
    this.startStage(s);
  },
};
