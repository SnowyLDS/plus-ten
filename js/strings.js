// =====================================================================
// strings.js — 화면 문구 전부. 번역 시 이 파일만 바꾼다.
// =====================================================================
const STR = {
  title: 'PLUS TEN',
  stage: (s) => `스테이지 ${s}`,
  stageRibbon: (s) => `STAGE ${s}`,     // 6-1 UI 스킨: 리본 위 흰 글씨
  bossTag: 'BOSS',
  farming: '파밍 중',
  challenge: '도전',
  challengeQueued: '도전 대기',
  gold: '골드',

  gradeNames: ['일반', '고급', '희귀', '영웅', '전설'],
  // TODO(기획확인): 무기 이름 규칙이 기획서에 없음. 가장 단순하게 "등급명 + 무기"
  weaponName: (grade) => `${STR.gradeNames[grade]} 무기`,

  statNames: { atk: '공격력', hp: '체력', def: '방어력', aspd: '공격속도' },
  statMax: 'MAX',

  panelStats: '스탯 강화',
  panelEquip: '장착 무기',
  panelInventory: '인벤토리',
  noWeapon: '장착 무기 없음',
  bulkSell: '일반·고급 +0 전부 판매',
  gripLabel: '깡스탯',

  // 무기 상세 팝업
  nextGrip: '다음 단계',
  maxLevel: '최대 강화',
  probSuccess: '성공',
  probDrop: '단계 하락',
  probDestroy: '파괴',
  probKeep: '유지',
  enhanceCost: '강화 비용',
  sellPrice: '판매가',
  btnEnhance: '강화',
  btnEquip: '장착',
  btnSell: '판매',
  btnClose: '닫기',
  equipBlocked: '장착 무기보다 깡스탯이 낮아 장착할 수 없습니다',

  // 강화 결과
  resSuccess: (to) => `+${to} 성공!`,
  resKeep: '실패 (유지)',
  resDrop: (from, to) => `단계 하락 +${from} → +${to}`,
  resDestroy: '파괴',
  enhancing: '강화 중...',

  // 확인 창
  confirmSell: (name, level, price) => `${name} +${level}을(를) ${price} 골드에 판매할까요?`,
  yes: '판매',
  no: '취소',

  // 토스트
  toastAutoSell: (name, level, price) => `인벤토리 가득 – ${name} +${level} 자동 판매 (+${price} 골드)`,
  toastDefeat: '패배 – 이전 스테이지에서 파밍합니다',
  toastBulkSell: (n, price) => `${n}개 판매 (+${price} 골드)`,
  toastBulkNone: '판매할 일반·고급 +0 무기가 없습니다',
  toastSold: (name, level, price) => `${name} +${level} 판매 (+${price} 골드)`,
  bigDrop: (grade) => `${STR.gradeNames[grade]} 무기 획득!`,

  // 디버그
  dbgTitle: '디버그 (` 키로 닫기)',
  dbgSpeed: '게임 속도',
  dbgGold: '골드 +10,000',
  dbgStage: '스테이지 이동',
  dbgGo: '이동',
  dbgGive: '무기 지급',
  dbgSim: '강화 1만 회 시뮬',
  dbgSeed: '시드 고정',
  dbgStats: '현재 수치',
  dbgLog: '플레이 로그',
  dbgCopy: '로그 복사',
  dbgCopied: '로그를 클립보드에 복사했습니다',
  dbgCopyFail: '복사 실패 – 아래 텍스트를 직접 복사하세요',
  dbgFinalAtk: '최종 공격력',
  dbgDps: 'DPS',
  dbgMobHp: '적 체력',     // 6-1 v1.2: 화면 문구의 "몬스터"는 "적"으로
  dbgTtk: '예상 처치 시간',
  dbgSimHead: ['목표', '성공', '하락', '파괴', '유지', '기대(성/하/파/유)', '판정'],
  dbgOk: 'OK',
  dbgNg: 'NG',

  // QA 봇 (9-4, v1.1)
  qaTitle: 'QA 봇 (스탯 전략 비교)',
  qaRun: 'QA 실행',
  qaCopy: 'QA 결과 복사',
  qaProgress: (s, n) => `실행 중… 시드 ${s}/${n} (봇 3종 × ${n}판)`,
  qaDone: (sec) => `완료 (${sec.toFixed(1)}초)`,
  qaBotNames: { A: 'A 균등형', B: 'B 공격력형', C: 'C 공격·공속형' },
  qaBossKill: (s) => `보스 ${s} 처치 (중앙값·처치율)`,
  qaMin: '분',
  qaBest: '20분 최고 스테이지 중앙값 (최소~최대)',
  qaDefeats: '판당 패배: 체력 0 / 제한시간',
  qaStats: '스탯 레벨 공/체/방/속',
  qaPower: '최종 공격력 / DPS / 최대 체력',
  qaH4: 'H4 감소 횟수 (0이어야 함)',
  qaVerdict: { healthy: '건강', warn: '주의 (건강 기준 3 초과, 문제 기준 5 미만)', problem: '문제 신호' },
  qaGap: (g) => `최고·최저 봇 중앙값 차이 ${g}스테이지`,
  qaSigGap: (leader, lagging, gap) => `${STR.qaBotNames[leader]}이(가) ${lagging.map(b => STR.qaBotNames[b]).join(', ')}보다 5스테이지 이상 앞섬 (차이 ${gap}) → 뒤처진 봇이 쓴 스탯의 효율이 낮다는 신호`,
  qaSigBDead: (d) => `B 공격력형의 체력 0 패배가 판당 ${d.toFixed(2)}회 → 체력·방어력이 필요 없는 스탯이라는 신호`,

  // 장착 불가 안내 (5장 v1.1)
  cmpLine: (eq, mine, diff) => `장착 중 ${eq}% → 이 무기 ${mine}% (${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff)}%p)`,
  equipWeaker: '장착 불가',      // v1.3 6-7: 한 줄로 줄임 (이유는 비교 줄과 토스트가 설명)
  equipBlockedToast: (eq) => `장착 무기보다 깡스탯이 낮은 무기는 장착할 수 없어요. 강화해서 ${eq}% 이상으로 만들어 보세요`,
  guideText: '장착한 무기는 강화·판매할 수 없고 더 약한 무기로 바꿀 수도 없어요. 인벤토리 무기로 마음껏 강화해도 지금 전투력은 절대 줄어들지 않아요.',
  guideOk: '확인',
  // TODO(기획확인): 6-1이 "첫 안내 박스 제목 옆" 아이콘을 지정했지만 제목 문구는 없음 → "안내"
  guideTitle: '안내',
  equipProtected: '보호 중 – 더 좋은 무기로만 교체',

  // 설정 창 (6-6, v1.2). v1.1의 HUD 음소거 버튼은 설정 버튼으로 바뀜
  setTitle: '설정',
  setSfx: '효과음',
  setBgm: '배경음악',
  setMute: '전체 음소거 (M)',
  setOff: '꺼짐',

  // 무기 추가 옵션 (3-7, v1.4)
  optNames: { aspd: '공격속도', crit: '치명타 확률', def: '방어력' },
  optTierNames: { high: '상', mid: '중', low: '하' },
  optText: (type, v) => type === 'aspd' ? `공격속도 +${v}%` : type === 'crit' ? `치명타 확률 +${v}%p` : `방어력 +${v}`,
  critName: '치명타',
  critFloat: '치명!',
  optSuffixPct: (v) => `(+${v}%)`,
  optSuffixAdd: (v) => `(+${v})`,
  highOptToast: (name) => `${name} 획득 · 상급 옵션!`,
  dbgOptGen: '전설 1만 개 생성',
  dbgDropSim: '구간별 드롭 1만 회',

  // 튜토리얼 (6-9, v1.4). 단계 정의는 js/tutorial.js
  tut: {
    s1: '어서 와요, 기사님! 적국 병사들이 몰려오고 있어요.',
    s2: '전투는 자동이에요. 일단 지켜보세요!',
    s3: '적을 잡으면 골드가 들어와요. 골드로 강해져 봅시다.',
    s4: '스탯을 올려 볼까요? 네 가지를 골고루 올리는 게 오래 버티는 비결이에요.',
    s5: '무기를 하나 드릴게요. 무기는 공격력을 %로 뻥튀기해줘요.',
    s6: '하나 더 주웠어요! 눌러서 살펴보세요.',
    s7: '이게 이 게임의 핵심, 강화예요! 성공하면 깡스탯이 올라요. 눌러보세요!',
    s8: '성공! +1이 됐어요. 장착한 무기보다 강하니 바꿔 끼워요.',
    s9: '장착한 무기는 강화도 판매도 안 돼요. 더 강한 무기로만 바꿀 수 있어요. 이게 왜 좋은지 곧 알게 될 거예요.',
    s10: '이번엔 좀 위험한 걸 해볼까요? 연습용 검이에요.',
    s11: '+4부터는 단계가 떨어지거나 무기가 부서질 수도 있어요. 두근두근하죠?',
    s12: '그래도 도전! 눌러보세요.',
    s13: '터져버렸네요… 하지만 보세요! 장착한 무기는 그대로예요. 인벤토리 무기로만 강화하니까, 아무리 터져도 지금 전투력은 절대 안 줄어요.',
    s14: '강화를 높게 할수록 비싸게 팔려요. 한 번에 쭉쭉 성공하면 큰돈! 계속 터지면… 운에 맡겨야죠.',
    s15: '5스테이지마다 보스가 나와요. 보스는 30초 안에 잡아야 해요. 보스는 무기를 확정으로 떨어뜨려요!',
    s16: '지면 이전 스테이지를 반복하며 골드와 무기를 모아요. 충분히 강해졌다 싶으면 도전을 눌러 다시 올라가세요.',
    s17: '이제 마음껏 강화해 보세요. 행운을 빌어요, 기사님!',
    next: '다음',
    start: '시작',
    skip: '건너뛰기',
    skipAsk: '튜토리얼을 건너뛸까요?',
    skipYes: '건너뛰기',
    skipNo: '계속하기',
    practiceSword: '연습용 검',
    replay: '튜토리얼 다시 보기',
    replayAsk: '처음부터 다시 시작합니다',
    replayYes: '다시 시작',
    replayNo: '취소',
  },

  // 크레딧 (6-7 출처 표기, v1.3)
  credits: '크레딧',
  creditsLines: [
    'Tiny Swords — Pixel Frog',
    // TODO(기획확인): UI assets pack 2 제작자 이름은 기획자가 채움
    'UI assets pack 2 — 제작자: (기획자 입력)',
    "Shikashi's Fantasy Icons Pack — game-icons.net 디자인 기반, CC BY 3.0",
    '갈무리 폰트 — 이민서, OFL 1.1',
    'BGM — 드보르작 「유머레스크」 직접 편곡',
  ],
};
