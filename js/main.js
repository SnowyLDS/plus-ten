// =====================================================================
// main.js — 게임 루프. 고정 간격(1/60초) 로직 + 매 프레임 1회 렌더 (7-3)
// =====================================================================
const Game = {
  speed: 1,
  acc: 0,
  last: 0,

  step(dt) {
    state.time += dt;
    // 6-9: 튜토리얼의 "전투 진행" 단계가 아니면 전투·드롭·골드 획득이 멈춘다 (강화 연출 0.8초는 흐름). QA 격리 실행은 예외
    if (!(Tutorial.combatPaused() && !QA.inSandbox)) Stage.update(dt);
    Enhance.update(dt);
    Debug.watch();
  },

  // 게임을 처음 상태로 (튜토리얼 건너뛰기·다시 보기). 진행 저장은 없으므로 새 상태로 바꾸기만 한다
  restart() {
    state = createState();
    UI.closeAllLayers();
    Render.clearFx();
    Debug.resetWatch();
    Stage.startStage(1);
  },

  // 로직만 seconds 만큼 진행 (디버그·테스트용)
  advance(seconds) {
    const n = Math.round(seconds / CONFIG.STEP);
    for (let i = 0; i < n; i++) this.step(CONFIG.STEP);
  },

  frame(now) {
    // 탭이 백그라운드에서 돌아와도 최대 1초까지만 인정 (오프라인 보상 없음)
    const real = Math.min((now - Game.last) / 1000, CONFIG.MAX_FRAME_TIME);
    Game.last = now;
    Game.acc += real * Game.speed;
    let simulated = 0;
    while (Game.acc >= CONFIG.STEP) {
      Game.step(CONFIG.STEP);
      Game.acc -= CONFIG.STEP;
      simulated += CONFIG.STEP;
    }
    Render.draw(simulated);
    Sfx.update();
    Bgm.update();          // 덕킹 볼륨을 rAF에서 조금씩 (배속과 무관하게 실제 시간)
    UI.update(simulated);
    Skin.update();
    Debug.update(simulated);
    Tutorial.update(real);
    requestAnimationFrame(Game.frame);
  },

  start() {
    Tutorial.init();       // 입력 잠금 리스너를 가장 먼저 등록 (막힌 클릭에 효과음도 나지 않게)
    UI.init();
    Render.init();
    Sfx.init();
    Bgm.init();
    Settings.init();       // 저장된 소리 설정을 불러와 Sfx·Bgm에 반영
    Debug.init();
    Stage.startStage(1);
    if (!Tutorial.isDone()) Tutorial.start();   // 처음 실행할 때만
    Game.last = performance.now();
    requestAnimationFrame(Game.frame);
  },
};

// 6-7 글꼴: 갈무리. assets/fonts 파일이 있으면 그것을, 없으면 CDN CSS, 그것도 안 되면 sans-serif.
// 캔버스 글자도 같은 글꼴을 쓰므로 폰트 로딩이 끝난 뒤(document.fonts) 게임을 시작한다 (최대 FONTS.waitMs).
const Fonts = {
  inject() {
    const F = CONFIG.FONTS;
    if (F.local) {
      const L = F.localFiles, st = document.createElement('style');
      st.textContent =
        `@font-face{font-family:Galmuri11;font-weight:400;src:url('${encodeURI(L.Galmuri11)}') format('truetype');}` +
        `@font-face{font-family:Galmuri11;font-weight:700;src:url('${encodeURI(L.Galmuri11Bold)}') format('truetype');}` +
        `@font-face{font-family:Galmuri14;font-weight:400;src:url('${encodeURI(L.Galmuri14)}') format('truetype');}`;
      document.head.appendChild(st);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = F.cdn;
      link.onload = resolve; link.onerror = resolve;          // 실패해도 sans-serif로 진행
      document.head.appendChild(link);
    });
  },
  ready() {
    const F = CONFIG.FONTS;
    const wait = this.inject()
      .then(() => (document.fonts ? Promise.all([F.small, F.body, F.title].map(f => document.fonts.load(f).catch(() => null))) : null))
      .then(() => (document.fonts ? document.fonts.ready : null));
    return Promise.race([wait, new Promise(r => setTimeout(r, F.waitMs))]).catch(() => null);
  },
};

if (!window.PT_NO_AUTOSTART) window.addEventListener('load', () => { Fonts.ready().then(() => Game.start()); });
