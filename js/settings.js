// =====================================================================
// settings.js — 설정 창 (6-6, v1.2)
// - HUD 맨 오른쪽 톱니바퀴 버튼 → 화면 가운데 종이 팝업(420×260), 뒤는 검정 40%. 게임은 멈추지 않는다.
// - 닫기: X 버튼, ESC, 창 바깥 클릭.
// - 효과음 / 배경음악 슬라이더(0~100, 1 단위, 기본 50) + 전체 음소거(M). 0%면 "꺼짐".
// - 세 값만 localStorage에 저장 (try/catch, 실패하면 기본값). 게임 진행은 저장하지 않는다.
// =====================================================================
const Settings = {
  values: null,

  load() {
    const S = CONFIG.SETTINGS, v = Object.assign({}, S.defaults);
    try {
      const raw = window.localStorage.getItem(S.storageKey);
      if (raw) {
        const o = JSON.parse(raw);
        const num = (x, d) => (Number.isFinite(x) ? Math.max(S.min, Math.min(S.max, Math.round(x))) : d);
        v.sfx = num(o.sfx, v.sfx);
        v.bgm = num(o.bgm, v.bgm);
        v.mute = typeof o.mute === 'boolean' ? o.mute : v.mute;
      }
    } catch (e) { /* 저장소 사용 불가 → 기본값 */ }
    this.values = v;
  },
  save() {
    try { window.localStorage.setItem(CONFIG.SETTINGS.storageKey, JSON.stringify(this.values)); } catch (e) { /* 무시 */ }
  },

  init() {
    this.load();
    const $ = (id) => document.getElementById(id);
    $('setTitle').textContent = STR.setTitle;
    $('lblSfx').textContent = STR.setSfx;
    $('lblBgm').textContent = STR.setBgm;
    $('lblMute').textContent = STR.setMute;
    $('btnSettings').title = STR.setTitle;
    $('btnSetClose').title = STR.btnClose;
    for (const id of ['rngSfx', 'rngBgm']) { const r = $(id); r.min = CONFIG.SETTINGS.min; r.max = CONFIG.SETTINGS.max; r.step = 1; }

    $('btnSettings').addEventListener('click', () => this.open());
    // v1.6 [처음부터 다시하기] (빨간 버튼): 확인 후 게임 초기화 + tutorialDone 삭제 → 튜토리얼부터. 소리 설정은 유지
    $('btnRestart').textContent = STR.restart;
    $('btnRestart').addEventListener('click', () => {
      this.close();
      UI.confirm(STR.restartAsk, () => Tutorial.restartFromScratch(), STR.restartYes, STR.restartNo);
    });
    $('btnSetClose').addEventListener('click', () => this.close());
    // 창 바깥 클릭 (어두운 배경 + 화면 비율 때문에 생긴 바깥 여백까지)
    document.addEventListener('click', (e) => {
      if ($('settingsLayer').hidden || $('settingsBox').contains(e.target) || $('btnSettings').contains(e.target)) return;
      this.close();
    });
    // 효과음: 움직이는 즉시 반영, 손을 뗄 때 UI 클릭음으로 미리듣기
    $('rngSfx').addEventListener('input', (e) => { this.values.sfx = +e.target.value; this.apply(); this.save(); });
    $('rngSfx').addEventListener('change', () => Sfx.play('click'));
    // 배경음악: 움직이는 즉시 반영
    $('rngBgm').addEventListener('input', (e) => { this.values.bgm = +e.target.value; this.apply(); this.save(); });
    $('chkMute').addEventListener('change', (e) => { this.values.mute = e.target.checked; this.apply(); this.save(); });
    window.addEventListener('keydown', (e) => {
      const t = e.target || {}, tag = t.tagName || '';
      const typing = tag === 'TEXTAREA' || (tag === 'INPUT' && /^(text|number|search)$/.test(t.type));   // 디버그 입력칸에서는 무시
      if (e.key === 'Escape' && !$('settingsLayer').hidden) { this.close(); return; }
      // 단축키 M: 효과음·배경음악 전체 음소거 켜고 끄기
      if ((e.key === 'm' || e.key === 'M' || e.code === 'KeyM') && !typing) this.toggleMute();
    });
    this.apply();
  },

  open() { this.render(); document.getElementById('settingsLayer').hidden = false; },
  close() { document.getElementById('settingsLayer').hidden = true; },
  toggleMute() { this.values.mute = !this.values.mute; this.apply(); this.save(); },

  // 값 → 효과음·BGM 볼륨 + 화면
  apply() {
    const v = this.values;
    Sfx.setVolume(v.sfx / 100, v.mute);
    Bgm.setVolume(v.bgm / 100 * CONFIG.BGM.volScale, v.mute);
    this.render();
  },
  render() {
    const v = this.values, $ = (id) => document.getElementById(id);
    $('rngSfx').value = v.sfx; $('rngBgm').value = v.bgm; $('chkMute').checked = v.mute;
    // 6-7 #14: 트랙의 채워진 부분(#E8B04B) 길이
    $('rngSfx').style.setProperty('--fill', v.sfx + '%');
    $('rngBgm').style.setProperty('--fill', v.bgm + '%');
    $('valSfx').textContent = v.sfx === 0 ? STR.setOff : v.sfx + '%';
    $('valBgm').textContent = v.bgm === 0 ? STR.setOff : v.bgm + '%';
  },
};
