// =====================================================================
// rng.js — 시드 고정 가능한 난수 (mulberry32)
// =====================================================================
const RNG = {
  create(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;   // [0, 1)
    };
    return { next, seed };
  },
  _g: null,
  seed: 0,
  setSeed(seed) { this.seed = seed >>> 0; this._g = this.create(this.seed); },
  random() { return this._g.next(); },
  // [0, n) 정수
  int(n) { return Math.floor(this.random() * n); },
  // 확률 표(합 100)에서 인덱스 하나 뽑기
  pickWeighted(weights, rnd) {
    const r = (rnd === undefined ? this.random() : rnd) * 100;
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (r < acc) return i;
    }
    return weights.length - 1;
  },
};
RNG.setSeed(Date.now());
