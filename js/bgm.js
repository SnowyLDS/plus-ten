// =====================================================================
// bgm.js — 배경음악 (6-6, v1.2)
// - <audio> 요소로 재생, loop. Web Audio(createMediaElementSource)에 연결하지 않는다 (file://에서 무음 위험).
// - 첫 클릭·키 입력 때 재생 시작. 실패는 조용히 무시.
// - 탭이 숨겨지면 일시정지, 돌아오면 이어서. 디버그 배속과 무관하게 정상 속도. QA 실행 중에는 재생하지 않는다.
// - 덕킹: 강화 버튼 순간부터 결과 후 1초까지 40%(0.2초에 걸쳐), 그 뒤 0.5초에 걸쳐 복구.
//         파괴는 0.3초 동안 0% → 같은 방식으로 복구. 볼륨은 requestAnimationFrame에서 조금씩 바꾼다.
// state를 바꾸지 않는다.
// =====================================================================
const Bgm = {
  audio: null,
  volume: 0,          // 설정 창 값 반영 (슬라이더 ÷ 100 × 0.5)
  muted: false,
  wanted: false,      // 첫 입력 이후 재생해야 하는 상태
  duck: 1,            // 덕킹 배율 (1 = 원래 볼륨)
  ramp: null,         // { from, to, t0, dur }
  pending: null,      // { at, fn } 예약된 다음 단계

  init() {
    const B = CONFIG.BGM;
    if (!B.file) return;   // TODO(기획확인): 곡 파일을 못 찾으면 BGM 없이 진행
    const a = new Audio();
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    a.addEventListener('error', () => { this.audio = null; });   // 파일 없음 → 조용히 BGM 없이
    a.src = encodeURI(B.file);
    this.audio = a;
    const unlock = () => { this.wanted = true; this.sync(); };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', () => this.sync());
    Events.on('enhanceStart', () => this.duckEnhance());
    Events.on('enhanceResult', (e) => (e.result === 'destroy' ? this.duckDestroy() : this.duckRelease()));
  },
  now() { return performance.now() / 1000; },

  // 재생해야 하면 재생, 아니면 일시정지 (탭 숨김·QA 실행 중)
  sync() {
    const a = this.audio;
    if (!a) return;
    const play = this.wanted && !document.hidden && !(typeof QA !== 'undefined' && QA.running);
    if (play && a.paused) {
      const p = a.play();
      if (p && p.catch) p.catch(() => {});      // 자동재생 거부 등은 조용히 무시
    } else if (!play && !a.paused) {
      a.pause();
    }
  },
  setVolume(v, muted) { this.volume = v; this.muted = muted; this.apply(); },
  apply() {
    if (!this.audio) return;
    const v = this.muted ? 0 : this.volume * this.duck;
    this.audio.volume = Math.max(0, Math.min(1, v));
  },

  // ---- 덕킹 ----
  rampTo(to, dur) {
    this.ramp = dur > 0 ? { from: this.duck, to, t0: this.now(), dur } : null;
    if (dur <= 0) this.duck = to;
  },
  duckEnhance() {
    const B = CONFIG.BGM;
    this.pending = null;                       // 결과 기다리는 동안 40% 유지
    this.rampTo(B.duckLevel, B.duckDown);
  },
  duckRelease() {
    const B = CONFIG.BGM;
    this.pending = { at: this.now() + B.duckHold, fn: () => this.rampTo(1, B.duckUp) };
  },
  duckDestroy() {
    const B = CONFIG.BGM;
    this.rampTo(0, 0);
    this.pending = { at: this.now() + B.destroyHold, fn: () => this.rampTo(1, B.duckUp) };
  },

  // 매 프레임 (requestAnimationFrame)
  update() {
    if (!this.audio) return;
    const t = this.now();
    if (this.pending && t >= this.pending.at) { const f = this.pending.fn; this.pending = null; f(); }
    if (this.ramp) {
      const k = Math.min(1, (t - this.ramp.t0) / this.ramp.dur);
      this.duck = this.ramp.from + (this.ramp.to - this.ramp.from) * k;
      if (k >= 1) this.ramp = null;
    }
    this.apply();
    this.sync();
  },
};
