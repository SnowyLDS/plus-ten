// =====================================================================
// sfx.js — 효과음 (6-5, v1.1). 오디오 파일 없이 Web Audio API로 합성한다.
// 로직 이벤트를 듣기만 하고 state는 바꾸지 않는다.
// - 첫 클릭(또는 키 입력) 때 AudioContext를 만들고, 그 전 소리는 조용히 건너뛴다.
// - 같은 소리는 0.08초 안에 두 번 울리지 않는다. ×4 이상 배속에서는 전투 소리를 끈다.
// - 모든 소리: 0.005초 페이드인, 끝에서 0까지 페이드아웃.
// =====================================================================
const Sfx = {
  ctx: null,
  master: null,
  muted: false,
  last: {},
  stats: {},          // 소리별 재생 횟수 (검증용)
  lastTick: null,

  init() {
    if (this._inited) return;          // 리스너 중복 등록 방지 (M키 한 번에 두 번 토글되는 문제)
    this._inited = true;
    const unlock = () => this.ensure();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    // v1.2: 음소거 버튼·M키는 설정 창(settings.js)으로 옮김. 볼륨은 Settings가 setVolume으로 넣는다
    // 스탯 강화·UI 클릭 (스탯 버튼은 pointerdown 구매라 statBought로 처리)
    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.btn:not(.statBtn), .roundBtn, .cell.filled')) this.play('click');
    }, true);
    this.bind();
  },

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.ctx.resume) { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.attach(new AC()); } catch (e) { this.ctx = null; }
  },
  attach(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.gainValue();
    this.master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.5), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.last = {};
  },

  // 효과음 마스터 볼륨 = 설정 창 슬라이더 ÷ 100 (기본 50%). 전체 음소거면 0
  volume: CONFIG.SFX.master,
  gainValue() { return this.muted ? 0 : this.volume; },
  setVolume(v, muted) {
    this.volume = v; this.muted = muted;
    if (this.master) {
      const g = this.master.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setValueAtTime(this.gainValue(), this.ctx.currentTime);
      g.value = this.gainValue();
    }
  },
  toggleMute() { this.setVolume(this.volume, !this.muted); },

  now() { return this.ctx ? this.ctx.currentTime : 0; },

  // ---------------------------------------------------------------
  // 합성 기본 단위
  // ---------------------------------------------------------------
  // 0.005초 페이드인 → 유지 → 끝에서 0까지 페이드아웃
  envelope(t0, dur, vol) {
    const S = CONFIG.SFX, g = this.ctx.createGain(), rel = Math.min(S.release, dur * 0.5);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + S.fadeIn);
    g.gain.setValueAtTime(vol, Math.max(t0 + S.fadeIn, t0 + dur - rel));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    g.connect(this.master);
    return g;
  },
  tone(o) {   // { type, f0, f1, t0, dur, vol, lp, vibrato:{rate, depth} }
    const ctx = this.ctx, osc = ctx.createOscillator(), env = this.envelope(o.t0, o.dur, o.vol);
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f0, o.t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, o.t0 + o.dur);
    let out = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; out.connect(f); out = f; }
    out.connect(env);
    if (o.vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vibrato.rate; lg.gain.value = o.vibrato.depth;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(o.t0); lfo.stop(o.t0 + o.dur + 0.02);
    }
    osc.start(o.t0); osc.stop(o.t0 + o.dur + 0.02);
  },
  noise(o) {  // { t0, dur, vol, lp }
    const ctx = this.ctx, src = ctx.createBufferSource(), env = this.envelope(o.t0, o.dur, o.vol);
    src.buffer = this.noiseBuf;
    let out = src;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; out.connect(f); out = f; }
    out.connect(env);
    src.start(o.t0); src.stop(o.t0 + o.dur + 0.02);
  },
  chord(freqs, t0, dur, vol) {
    // 여러 음을 동시에: 합쳐서 상대 볼륨이 되도록 음당 vol/√n
    const v = vol / Math.sqrt(freqs.length);
    for (const f of freqs) this.tone({ type: 'triangle', f0: f, t0, dur, vol: v });
  },
  seq(freqs, type, t0, step, vol, lp) {
    freqs.forEach((f, i) => this.tone({ type, f0: f, t0: t0 + i * step, dur: step, vol, lp }));
  },

  // ---------------------------------------------------------------
  // 6-5 표의 소리. 반환값 = 소리 길이(초)
  // ---------------------------------------------------------------
  SOUNDS: {
    hit:     { combat: true,  fn(t) { Sfx.tone({ type: 'square', f0: 220, f1: 110, t0: t, dur: 0.06, vol: 0.3 }); return 0.06; } },
    hurt:    { combat: true,  fn(t) { Sfx.noise({ t0: t, dur: 0.05, vol: 0.2, lp: 800 }); return 0.05; } },
    kill:    { combat: true,  fn(t) { Sfx.tone({ type: 'triangle', f0: 440, f1: 880, t0: t, dur: 0.10, vol: 0.4 }); return 0.1; } },
    gold:    { combat: true,  fn(t) { Sfx.seq([1320, 1760], 'sine', t, 0.05, 0.2); return 0.1; } },
    bossTick:{ combat: true,  fn(t) { Sfx.tone({ type: 'sine', f0: 1000, t0: t, dur: 0.03, vol: 0.3 }); return 0.03; } },
    drop: { fn(t, grade) {
      const N = CONFIG.SFX.notes, notes = [N.C5, N.E5, N.G5, N.C6, N.E6].slice(0, grade + 1);   // 일반 1음 ~ 전설 5음
      Sfx.seq(notes, 'sine', t, 0.07, 0.5);
      let len = notes.length * 0.07;
      if (grade >= CONFIG.GLOW_GRADE_MIN) {           // 영웅·전설: 0.1초 뒤 성공 장화음 한 번 더
        Sfx.chord([N.C5, N.E5, N.G5], t + len + 0.1, 0.3, 0.7);
        len += 0.4;
      }
      return len;
    } },
    charge: { fn(t, speed) {
      const dur = CONFIG.ENHANCE_DELAY / Math.max(1, speed || 1);   // 배속에서는 연출 길이에 맞춤
      Sfx.tone({ type: 'sine', f0: 300, f1: 900, t0: t, dur, vol: 0.4, vibrato: { rate: 6, depth: CONFIG.SFX.vibratoDepth } });
      return dur;
    } },
    success: { fn(t, to) {
      const N = CONFIG.SFX.notes, big = to >= CONFIG.FX.bigSuccessFromLevel;
      Sfx.chord(big ? [N.C5, N.E5, N.G5, N.C6] : [N.C5, N.E5, N.G5], t, big ? 0.6 : 0.3, 0.7);
      return big ? 0.6 : 0.3;
    } },
    keep:    { fn(t) { Sfx.tone({ type: 'sine', f0: 220, t0: t, dur: 0.15, vol: 0.4 }); return 0.15; } },
    levelDown: { fn(t) { Sfx.tone({ type: 'sawtooth', f0: 400, f1: 200, t0: t, dur: 0.25, vol: 0.5, lp: 1200 }); return 0.25; } },
    destroy: { fn(t) {
      Sfx.noise({ t0: t, dur: 0.4, vol: 0.8 });
      Sfx.tone({ type: 'sine', f0: 80, t0: t, dur: 0.4, vol: 0.8 });
      return 0.4;
    } },
    bossAppear: { fn(t) { Sfx.seq([110, 98], 'sawtooth', t, 0.4, 0.6, 600); return 0.8; } },
    clear:   { fn(t) { const N = CONFIG.SFX.notes; Sfx.seq([N.G5, N.C6], 'triangle', t, 0.08, 0.4); return 0.16; } },
    defeat:  { fn(t) { const N = CONFIG.SFX.notes; Sfx.seq([N.E4, N.C4, N.A3], 'triangle', t, 0.15, 0.5); return 0.45; } },
    click:   { fn(t) { Sfx.tone({ type: 'sine', f0: 600, t0: t, dur: 0.02, vol: 0.2 }); return 0.02; } },
  },

  play(name, arg) {
    const s = this.SOUNDS[name];
    if (!s || !this.ctx || this.muted || this.volume <= 0) return false;   // 첫 입력 전·음소거·0%: 건너뜀
    if (s.combat && Game.speed >= CONFIG.SFX.combatOffSpeed) return false;  // ×4 이상 전투 소리 끔
    const now = this.now();
    if (this.last[name] !== undefined && now - this.last[name] < CONFIG.SFX.throttle) return false;
    this.last[name] = now;
    this.stats[name] = (this.stats[name] || 0) + 1;
    s.fn(now + 0.005, arg);
    return true;
  },

  bind() {
    Events.on('playerAttack', () => this.play('hit'));
    Events.on('monsterAttack', () => this.play('hurt'));
    Events.on('monsterKilled', () => { this.play('kill'); this.play('gold'); });
    Events.on('weaponDropped', (e) => this.play('drop', e.weapon.grade));
    Events.on('enhanceStart', () => this.play('charge', Game.speed));
    Events.on('enhanceResult', (e) => {
      if (e.result === 'success') this.play('success', e.to);
      else if (e.result === 'keep') this.play('keep');
      else if (e.result === 'drop') this.play('levelDown');
      else this.play('destroy');
    });
    Events.on('stageStart', (e) => { if (e.isBoss) this.play('bossAppear'); });
    Events.on('stageClear', () => this.play('clear'));
    Events.on('defeat', () => this.play('defeat'));
    Events.on('statBought', () => this.play('click'));
  },

  // 매 프레임: 보스 타이머 마지막 5초 1초마다 틱 (state 읽기만)
  update() {
    const bt = state.battle;
    if (!bt.isBoss || bt.phase !== 'fight') { this.lastTick = null; return; }
    const s = Math.ceil(bt.bossTimeLeft - CONFIG.FLOAT_EPS);
    if (s <= CONFIG.SFX.bossTickFrom && s >= 1 && s !== this.lastTick) { this.lastTick = s; this.play('bossTick'); }
    else if (s > CONFIG.SFX.bossTickFrom) this.lastTick = null;
  },
};
