// =====================================================================
// PLUS TEN — config.js
// 기획서 4장의 모든 수치. 다른 파일에 게임 수치를 직접 쓰지 않는다.
// 표(4-3 ~ 4-6)는 공식으로 재계산하지 않고 그대로 상수 배열로 넣는다.
// =====================================================================
const CONFIG = {
  // ---- 루프 (7-3) ----
  STEP: 1 / 60,              // 고정 로직 간격(초)
  MAX_FRAME_TIME: 1.0,       // 한 번에 처리하는 최대 시간(초). 오프라인 보상 없음
  SPEEDS: [1, 4, 16],        // 디버그 배속

  // ---- 4-1 플레이어 스탯 강화 ----
  // 비용 = floor(costBase × costMul^현재레벨)
  STAT_ORDER: ['atk', 'hp', 'def', 'aspd'],
  STATS: {
    atk:  { base: 10,  perLv: 3,    costBase: 10, costMul: 1.13 },
    hp:   { base: 100, perLv: 20,   costBase: 10, costMul: 1.13 },
    def:  { base: 0,   perLv: 2,    costBase: 12, costMul: 1.14 },
    aspd: { base: 1.0, perLv: 0.05, costBase: 20, costMul: 1.22, max: 3.0 },
  },
  ASPD_DECIMALS: 2,          // 공격속도 표기·부동소수 보정 자릿수 (1.00회/초)
  FLOAT_EPS: 1e-9,           // floor() 직전 부동소수 오차 보정용 (반올림 방식 변경 아님)

  // ---- 3-1 전투 ----
  DEF_K: 50,                 // 받는 피해 = 몬스터 공격력 × 50 / (50 + 방어력)
  SPAWN_DELAY: 0.4,          // 몬스터 사망 후 다음 몬스터까지(초)
  // TODO(기획확인): 패배 후 파밍 스테이지 시작까지의 대기. 6-3 "화면 어둑게 0.5초"에 맞춤
  DEFEAT_DELAY: 0.5,

  // ---- 3-2 / 4-2 스테이지·몬스터 ----
  BOSS_EVERY: 5,
  MOBS_PER_STAGE: 5,
  MONSTER: {
    hpBase: 25, hpMul: 1.18,
    atkBase: 6, atkMul: 1.17,
    goldBase: 4, goldMul: 1.17,
    attackInterval: 1.0,
    dropRate: 0.20,
  },
  BOSS: {
    hpMul: 5, atkMul: 1.5, goldMul: 10,
    attackInterval: 1.0,
    dropRate: 1.0,
    timeLimit: 30,
  },

  // ---- 4-3 무기 깡스탯 ----
  // grade: 0 일반 / 1 고급 / 2 희귀 / 3 영웅 / 4 전설
  GRADES: [
    { color: '#9E9E9E', base: 10, perLv: 5,  cost: 20 },
    { color: '#4CAF50', base: 12, perLv: 6,  cost: 50 },
    { color: '#2196F3', base: 14, perLv: 7,  cost: 150 },
    { color: '#9C27B0', base: 16, perLv: 8,  cost: 500 },
    { color: '#FF9800', base: 20, perLv: 10, cost: 2000 },  // 원가는 화면에 표시하지 않음
  ],
  GLOW_GRADE_MIN: 3,         // 영웅·전설은 테두리가 깜빡임
  MAX_LEVEL: 10,

  // ---- 4-4 드롭 등급 확률 (%) — v1.4: 스테이지 구간별. 일반 몬스터·보스 구분 표는 폐기 ----
  // [일반, 고급, 희귀, 영웅, 전설]. 21스테이지 이상은 마지막 표. 보스는 한 구간 위의 표.
  // 파밍 중에는 실제로 싸우는 스테이지의 표 (rollDrop이 state.stage를 쓴다)
  DROP_BANDS: [
    { upTo: 5,        w: [70, 20, 10, 0, 0] },
    { upTo: 10,       w: [50, 30, 15, 5, 0] },
    { upTo: 15,       w: [30, 40, 20, 9, 1] },
    { upTo: Infinity, w: [20, 20, 30, 25, 5] },   // 16~20 이상
  ],
  BOSS_BAND_SHIFT: 1,

  // ---- 3-7 무기 추가 옵션 (v1.4) ----
  OPTIONS: {
    sockets: [0, 0, 1, 2, 3],                 // 등급별 소켓 수: 일반·고급 0 / 희귀 1 / 영웅 2 / 전설 3
    types: ['aspd', 'crit', 'def'],           // 종류: 각 1/3 (중복 가능)
    tiers: ['high', 'mid', 'low'],
    tierWeights: [10, 40, 50],                // 상 10% / 중 40% / 하 50%
    value: {                                  // 공격속도 +% / 치명타 확률 +%p / 방어력 +
      high: { aspd: 20, crit: 20, def: 10 },
      mid:  { aspd: 10, crit: 10, def: 5 },
      low:  { aspd: 5,  crit: 5,  def: 3 },
    },
    tierColor: { high: '#E8B04B', mid: '#1565C0', low: '#8A6A4A' },
    critMax: 60,                              // 치명타 확률 최대 60%
    critMult: 2,                              // 치명타 피해 × 2
    aspdFinalMax: 3.0,                        // 상한 3.00은 옵션 포함 최종 공격속도에 적용
  },

  // ---- 4-5 강화 확률 (%), [성공, 단계 하락, 파괴, 유지]. 인덱스 = 현재 단계 (목표 = 인덱스+1) ----
  // 전체 기준 확률. 네 값의 합은 항상 100.
  ENHANCE_PROB: [
    [95, 0, 0, 5],    // +1
    [90, 0, 0, 10],   // +2
    [80, 0, 0, 20],   // +3
    [70, 6, 4, 20],   // +4
    [60, 12, 8, 20],  // +5
    [50, 18, 12, 20], // +6
    [40, 24, 16, 20], // +7
    [30, 30, 20, 20], // +8
    [20, 30, 20, 30], // +9
    [10, 30, 20, 40], // +10
  ],

  // ---- 4-5 강화 1회 비용 (골드). [등급][현재 단계] ----
  ENHANCE_COST: [
    [10, 14, 20, 27, 38, 54, 75, 105, 148, 207],
    [15, 21, 29, 41, 58, 81, 113, 158, 221, 310],
    [25, 35, 49, 69, 96, 134, 188, 264, 369, 517],
    [40, 56, 78, 110, 154, 215, 301, 422, 590, 826],
    [70, 98, 137, 192, 269, 376, 527, 738, 1033, 1446],
  ],
  ENHANCE_DELAY: 0.8,        // 강화 결과까지 대기(초). 이 동안 강화 버튼 잠김

  // ---- 4-6 판매가 (골드). [등급][강화 단계]. 공식으로 다시 계산하지 말 것 ----
  SELL_PRICE: [
    [15, 23, 35, 53, 87, 153, 295, 639, 1672, 5447, 29215],
    [38, 49, 67, 94, 146, 248, 465, 994, 2580, 8369, 44798],
    [112, 132, 161, 207, 297, 474, 853, 1775, 4540, 14609, 77912],
    [375, 407, 453, 527, 681, 994, 1669, 3305, 8200, 25955, 137329],
    [1500, 1555, 1637, 1766, 2083, 2761, 4232, 7796, 18401, 56584, 295150],
  ],
  // 3-6 확인 창: 희귀 이상 등급이거나 +5 이상
  CONFIRM_SELL_GRADE: 2,
  CONFIRM_SELL_LEVEL: 5,
  // 3-4 일괄 판매: 일반·고급(등급 ≤1) +0
  BULK_SELL_MAX_GRADE: 1,
  // 5장: 파괴 가능 단계(+3→+4 이상)에서 강화 버튼 빨간 테두리
  DANGER_FROM_LEVEL: 3,

  // ---- 3-4 인벤토리 ----
  INVENTORY_SIZE: 20,
  INVENTORY_COLS: 5,

  // ---- 5장 UI ----
  BASE_W: 1280,
  BASE_H: 720,
  HOLD_REPEAT_MS: 150,       // 스탯 버튼 누르고 있으면 0.15초마다 연속 구매
  NUM_K: 100000,             // 100,000 이상 K
  NUM_M: 100000000,          // 100,000,000 이상 M
  TOAST_TIME: 2.5,

  // ---- 9-4 QA 봇 (v1.1) ----
  QA: {
    gameSec: 1200,            // 게임 안 시간 20분 = 1판
    seeds: 100,               // 시드 1~100
    enhanceGoldRatio: 0.3,    // 무기 강화에 현재 골드의 30%까지
    enhanceBelowLevel: 5,     // 대상: +5 미만 중 깡스탯 최고
    challengeEvery: 30,       // 파밍 중 30초마다 도전
    bossStages: [5, 10, 15, 20],
    healthyGap: 3,            // 최고 스테이지 중앙값 차이 3 이내 = 건강
    problemGap: 5,            // 5 이상 앞서면 문제 신호
    // TODO(기획확인): "B가 체력 0으로 거의 지지 않으면"의 "거의" = 판당 평균 1회 미만으로 해석
    rarelyDeadPerRun: 1.0,
  },

  // ---- 6-5 효과음 (v1.1) ----
  SFX: {
    master: 0.5,              // 기본값. v1.2부터 실제 값은 설정 창 효과음 슬라이더 ÷ 100 (6-6)
    throttle: 0.08,           // 같은 소리는 0.08초 안에 두 번 울리지 않음
    combatOffSpeed: 4,        // 디버그 ×4 이상에서는 전투 소리 끔
    fadeIn: 0.005,
    release: 0.06,            // 끝에서 0까지 페이드아웃하는 최대 길이
    bossTickFrom: 5,          // 보스 타이머 마지막 5초
    // TODO(기획확인): 강화 대기 비브라토 깊이(Hz)가 표에 없음
    vibratoDepth: 12,
    notes: { A3: 220, C4: 261.63, E4: 329.63, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.51 },
  },

  // ---- 6-6 설정 창과 배경음악 (v1.2) ----
  SETTINGS: {
    storageKey: 'plusten.settings',   // localStorage. 소리 설정 3개만 저장 (게임 진행은 저장하지 않음)
    defaults: { sfx: 50, bgm: 50, mute: false },
    min: 0, max: 100,
  },
  BGM: {
    // 프로젝트 안에서 찾은 Humoresque_Band_Arrange_v4.mp3를 assets/bgm/으로 옮김
    file: 'assets/bgm/Humoresque_Band_Arrange_v4.mp3',
    volScale: 0.5,            // BGM 볼륨 = 슬라이더 ÷ 100 × 0.5
    duckLevel: 0.4,           // 강화: 현재 볼륨의 40%로
    duckDown: 0.2,            //   0.2초에 걸쳐 낮추고
    duckHold: 1.0,            //   결과 후 1초까지 유지한 뒤
    duckUp: 0.5,              //   0.5초에 걸쳐 복구
    destroyHold: 0.3,         // 파괴: 0.3초 동안 0%, 그 뒤 같은 방식(0.5초)으로 복구
  },

  // ---- 6-9 튜토리얼 (v1.4) ----
  TUTORIAL: {
    storageKey: 'tutorialDone',
    dim: 0.6,                 // 화면 전체 검정 60%
    holePad: 8,               // 강조 구멍 = 대상 사각형 + 여백 8px
    typeCps: 30,              // 대사 초당 30자
    avatar: 'Human Avatars/Avatars_01.png',   // Tiny Swords UI Elements 기준, 256px → 64px
    bubbleMaxW: 420,
    gold: 20,                 // 3단계 지급 골드
    afterResultSec: 1.2,      // 강화 결과 연출(결과 글씨 1.2초)이 끝나면 다음 단계로
  },

  // ---- 6장 아트·연출 ----
  COLORS: {
    bg: '#1B1E2B', bg2: '#2E3350',
    panel: '#262A3B', panelBorder: '#3A3F55',
    text: '#FFFFFF', sub: '#A0A6BE',
    gold: '#FFD54F', success: '#66BB6A', danger: '#E53935',
    hero: '#4FC3F7', mob: '#EF5350', boss: '#B71C1C',
    drop: '#FF9800', keep: '#A0A6BE', white: '#FFFFFF',
  },
  // ---- 6-1 이미지 에셋: Tiny Swords (v1.2) ----
  // 모든 경로는 ART.dir 기준. 띄어쓰기가 있어 encodeURI로 불러온다. 파일이 없으면 대체 도형.
  // file:// 에서는 픽셀을 읽을 수 없으므로(getImageData 금지) 발 기준점 등은 모두 상수로 둔다.
  ART: {
    dir: 'assets/tiny-swords/',
    fps: 10,                  // 프레임당 100ms
    attackShrink: 0.9,        // 공격 간격이 애니메이션보다 짧으면 재생 시간 = 간격 × 0.9
    unitScale: 1, bossScale: 2,
    // 적 색: 1~10 Red, 11~20 Purple, 21~30 Yellow, 이후 10스테이지마다 순환
    enemyColors: ['Red', 'Purple', 'Yellow'], colorEvery: 10,
    heroColor: 'Blue', bossColor: 'Black',
    // 스테이지 끝자리 → 적 종류 (5의 배수는 보스)
    enemyByDigit: { 1: 'pawn', 6: 'pawn', 2: 'archer', 7: 'archer', 3: 'lancer', 8: 'lancer', 4: 'warrior', 9: 'warrior' },
    // size = 프레임 한 변(시트 높이), foot = 발 기준점(프레임 안 px, 6-1 표)
    // top = 대기 첫 프레임의 머리 꼭대기 y (체력바·데미지 숫자 위치용). 개발 중 오프라인으로 잰 상수
    units: {
      hero:    { folder: 'Warrior', idle: ['Warrior_Idle.png', 8], attacks: [['Warrior_Attack1.png', 4], ['Warrior_Attack2.png', 4]], size: 192, foot: [102, 137], top: 48 },
      pawn:    { folder: 'Pawn',    idle: ['Pawn_Idle.png', 8],    attacks: [['Pawn_Interact Axe.png', 6]], size: 192, foot: [95, 135], top: 64 },
      archer:  { folder: 'Archer',  idle: ['Archer_Idle.png', 6],  attacks: [['Archer_Shoot.png', 8]], size: 192, foot: [93, 136], top: 48, arrow: 'Arrow.png' },
      lancer:  { folder: 'Lancer',  idle: ['Lancer_Idle.png', 12], attacks: [['Lancer_Right_Attack.png', 3]], size: 320, foot: [150, 198], top: 48 },
      warrior: { folder: 'Warrior', idle: ['Warrior_Idle.png', 8], attacks: [['Warrior_Attack1.png', 4]], size: 192, foot: [102, 137], top: 48 },
      boss:    { folder: 'Warrior', idle: ['Warrior_Idle.png', 8], attacks: [['Warrior_Attack1.png', 4], ['Warrior_Attack2.png', 4]], size: 192, foot: [102, 137], top: 48 },
    },
    arrowTime: 0.15,          // 궁수 화살: 공격 애니메이션 절반 지점에서 0.15초 비행 (연출만)
    arrowChestPx: 52,         // TODO(기획확인): 화살 높이(발에서 위로 px)가 기획서에 없음
    // 배경·이펙트 (6-1 배경 표)
    grass: { file: 'Terrain/Tileset/Tilemap_color1.png', sx: 64, sy: 64, size: 64 },
    trees: { files: ['Terrain/Resources/Wood/Trees/Tree1.png', 'Terrain/Resources/Wood/Trees/Tree2.png'], w: 192, h: 256, frames: 8, scale: 0.75, count: 12, y: -72 },
    bushes: { files: ['Terrain/Decorations/Bushes/Bushe1.png', 'Terrain/Decorations/Bushes/Bushe2.png', 'Terrain/Decorations/Bushes/Bushe3.png', 'Terrain/Decorations/Bushes/Bushe4.png'], size: 128, frames: 8, count: 4 },
    rocks: { files: ['Terrain/Decorations/Rocks/Rock1.png', 'Terrain/Decorations/Rocks/Rock2.png', 'Terrain/Decorations/Rocks/Rock3.png', 'Terrain/Decorations/Rocks/Rock4.png'], size: 64, count: 4 },
    clouds: { files: [1, 2, 3, 4, 5, 6, 7, 8].map(i => `Terrain/Decorations/Clouds/Clouds_0${i}.png`), w: 576, h: 256, alpha: 0.35, speed: 8, count: 3 },
    decoSeed: 20260101,       // 장식물 위치는 고정 시드로 한 번만 (게임 RNG와 별개)
    keepOutX: [280, 1000],    // 이 구간의 땅 선 주변에는 장식물 없음
    keepOutGroundBand: 80,    // v1.4 6-8: 금지 구역 = 논리 x 280~1000, 땅 선 ±80
    outerDecoCell: 200,       // v1.4 6-8: 게임 영역 바깥 잔디에 200×200px당 장식 1개
    explosion: { file: 'Particle FX/Explosion_01.png', size: 192, frames: 8 },
    dust: { file: 'Particle FX/Dust_01.png', size: 64, frames: 8 },
  },
  // ---- 6-1 UI 스킨 (v1.2). 경로는 ART.dir + SKIN.dir 기준 ----
  // cuts = 9조각(또는 가로 3조각)의 원본 구간 [앞 시작, 앞 끝, 반복 시작, 반복 끝, 뒤 시작, 뒤 끝] (가로·세로 동일)
  // bleed = 조각 바깥쪽 투명 여백(원본 px, [왼, 위, 오른, 아래]). 개발 중 오프라인으로 잰 상수.
  //   보이는 테두리가 요소 경계에 맞도록 스킨 캔버스를 그만큼 바깥으로 넓혀 그린다.
  SKIN: {
    dir: 'UI Elements/UI Elements/',
    wood:  { file: 'Wood Table/WoodTable.png', cuts: [0, 128, 192, 256, 320, 448], scale: 0.5, bleed: [45, 43, 44, 25] },
    paper: { file: 'Papers/RegularPaper.png', cuts: [0, 64, 128, 192, 256, 320], scale: 1.0, bleed: [12, 20, 12, 19] },
    blue:  { file: 'Buttons/BigBlueButton_Regular.png', pressed: 'Buttons/BigBlueButton_Pressed.png', cuts: [0, 64, 128, 192, 256, 320], scale: 0.5, bleed: [19, 17, 19, 17] },
    red:   { file: 'Buttons/BigRedButton_Regular.png', pressed: 'Buttons/BigRedButton_Pressed.png', cuts: [0, 64, 128, 192, 256, 320], scale: 0.5, bleed: [19, 17, 19, 17] },
    round: { file: 'Buttons/TinyRoundBlueButton.png', size: 40 },          // 통짜 64×64를 0.625배(40px)
    // 체력바: 가로 3조각 틀 + 안쪽(세로 fillY 구간) 단색. 보스 타이머도 같은 방식
    // TODO(기획확인): 체력바·보스 타이머·리본을 그리는 배율이 기획서에 없음 → 기존 크기에 가깝게 0.5 / 0.5 / 0.75
    // v1.3 6-7 #1: 채움이 틀 테두리를 가리지 않게 2px씩 안쪽으로 (작은 바 세로 24~38, 큰 바 11~57).
    //   가로는 양쪽 끝 조각의 테두리 안쪽에서만 (capInner = 끝조각 안쪽 가장자리부터 잰 안쪽 폭, 오프라인으로 잼)
    hpBar:   { file: 'Bars/SmallBar_Base.png', cuts: [0, 64, 128, 192, 256, 320], rowY: [0, 64], fillY: [24, 39], capInner: 5, scale: 0.5 },
    bossBar: { file: 'Bars/BigBar_Base.png', cuts: [0, 64, 128, 192, 256, 320], rowY: [0, 64], fillY: [11, 58], capInner: 13, scale: 0.5 },
    ribbon:  { file: 'Ribbons/SmallRibbons.png', cuts: [0, 64, 128, 192, 256, 320], rowY: [0, 64], scale: 0.75 },
    icons: {
      gold: 'Icons/Icon_03.png', weapon: 'Icons/Icon_05.png', gear: 'Icons/Icon_10.png',
      close: 'Icons/Icon_09.png', info: 'Icons/Icon_11.png', music: 'Icons/Icon_12.png',
    },
    paperText: '#3B2A1A',
    heroBar: '#66BB6A', enemyBar: '#E53935', timerBar: '#FFD54F',
  },
  // ---- 6-7 UI 리뉴얼 (v1.3). 6-1 UI 스킨보다 우선 ----
  UI13: {
    // 액자: assets/ui/books.png. 좌표 (x, y, 너비, 높이). 가운데 면은 반복하지 않고 단색(또는 투명)
    books: 'assets/ui/books.png',
    paperFrame: { sx: 611, sy: 83, sw: 42, sh: 58, corner: 14, hRep: [14, 27], vRep: [30, 43], scale: 2, fill: '#FEE1B8' },
    battleFrame: { sx: 721, sy: 65, sw: 46, sh: 46, corner: 8, hRep: [8, 37], vRep: [8, 37], scale: 3, fill: null },
    frameInset: 28,                 // 종이 액자 두께 14 × 2 = 안쪽 여백
    // 버튼 가운데 면도 반복 대신 단색 (원본 가운데 색, 오프라인으로 잼)
    buttonFill: { 'Buttons/BigBlueButton_Regular.png': '#41919D', 'Buttons/BigBlueButton_Pressed.png': '#4A6982',
                  'Buttons/BigRedButton_Regular.png': '#F65555', 'Buttons/BigRedButton_Pressed.png': '#BA4954' },
    // 아이콘: assets/icons/fantasy.png, 32×32 칸, [열, 행]
    icons: 'assets/icons/fantasy.png', iconSize: 32,
    weaponIcons: [[0, 5], [1, 5], [5, 5], [11, 5], [2, 5]],     // 일반 목검 / 고급 롱소드 / 희귀 사브르 / 영웅 배틀액스 / 전설 마법 검
    statIcons: { atk: [4, 1], hp: [6, 0], def: [0, 6], aspd: [8, 0] },
    // 인벤토리 칸 = min(floor((격자 너비 − 4×간격) / 5), floor((격자 높이 − 3×간격) / 4))
    cellGap: 6,
    flyCell: 40,                    // 드롭 아이콘 날아가는 박스
    // 색 규칙
    paper: '#FEE1B8', slot: '#F3D3A3', text: '#3B2A1A', sub: '#8A6A4A', line: '#C9A67A', accent: '#E8B04B',
    hud: '#5B3A29', red: '#C62828', green: '#2E7D32',
    // 종이용 글자 색
    gradeText: ['#5F5F5F', '#2E7D32', '#1565C0', '#6A1B9A', '#E65100'],
    probText: ['#2E7D32', '#E65100', '#C62828', '#6D5A45'],    // 성공 / 단계 하락 / 파괴 / 유지
  },
  // 글꼴 (6-7): 이 네 크기만. 캔버스 강화 결과 큰 글씨만 48px 예외
  FONTS: {
    // TODO(기획확인): assets/fonts/ 가 비어 있음. 파일을 넣으면 local을 true로 (없는 파일을 요청하면 콘솔에 "파일 없음"이 찍혀서 자동 탐지하지 않음)
    local: false,
    localFiles: { Galmuri11: 'assets/fonts/Galmuri11.ttf', Galmuri11Bold: 'assets/fonts/Galmuri11-Bold.ttf', Galmuri14: 'assets/fonts/Galmuri14.ttf' },
    cdn: 'https://cdn.jsdelivr.net/npm/galmuri/dist/galmuri.css',
    waitMs: 3000,                   // 폰트 로딩을 기다리는 최대 시간 (그 뒤엔 sans-serif로 진행)
    small: '12px Galmuri11, sans-serif',
    body: '15px Galmuri14, sans-serif',
    title: 'bold 24px Galmuri11, sans-serif',
    big: 'bold 36px Galmuri11, sans-serif',
    result: (px) => `bold ${px}px Galmuri11, sans-serif`,   // 강화 결과 큰 글씨(48px) 연출용
  },
  SIZE: { hero: 96, mob: 80, boss: 160, weapon: 48 },   // 대체 도형 크기
  LAYOUT: {
    hudH: 56,
    battleW: 1280, battleH: 344,
    groundY: 330 - 56,       // 땅 선 y = 330 (1280×720 기준) → 전투 캔버스 안 좌표
    heroX: 360,              // 플레이어 발
    mobX: 920,               // 적 발
    hpBarW: 140, hpBarH: 10,
    bossTimerW: 420, bossTimerH: 14,
    bossTimerY: 34,          // v1.3: 전투 테두리(24px) 아래로 내림 (UI 위치만, 유닛·땅 선은 그대로)
  },
  FX: {
    lungePx: 12, lungeTime: 0.12,
    hitFlashTime: 0.08,
    dmgRisePx: 40, dmgTime: 0.6,
    deathTime: 0.3,
    bossShakePx: 3, bossShakeTime: 0.1,
    dropFlyTime: 0.5, dropHopPx: 120,
    bigDropFlashTime: 0.2, bigDropTextTime: 1.5, bigDropFlashAlpha: 0.45,
    defeatDimTime: 0.5, defeatDimAlpha: 0.6,
    gripPulseTime: 1.5,
    // 6-4 강화
    chargeShakeMaxPx: 6,
    successBurst: 18,
    bigSuccessFromLevel: 7, bigSuccessShakePx: 4, bigSuccessShakeTime: 0.3, bigSuccessParticles: 30,
    destroyFlashTime: 0.25, destroyFlashAlpha: 0.55, destroyShards: 8,
    destroyShakePx: 6, destroyShakeTime: 0.3,
    dropBouncePx: 14, dropBounceTime: 0.4,
    resultTextTime: 1.2,
    // 3-7 치명타 연출: 데미지 숫자 #E8B04B 1.5배 + "치명!", 화면 흔들림 2px 0.06초
    critColor: '#E8B04B', critScale: 1.5, critShakePx: 2, critShakeTime: 0.06,
    particleLife: 0.8,
  },
};
