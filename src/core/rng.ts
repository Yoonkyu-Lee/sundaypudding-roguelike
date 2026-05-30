// 시드 기반 결정론 PRNG (mulberry32). 8.3: 같은 시드 + 같은 행동 = 항상 같은 결과.
// 상태(state)가 직렬화 가능해 리플레이/세이브에 그대로 쓰인다.

export class Rng {
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** [0, 1) 균등 난수 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] 정수 (양끝 포함) */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** pct(0~100) 확률로 true */
  chance(pct: number): boolean {
    return this.next() * 100 < pct;
  }

  /** 직렬화/복원 — 리플레이용 */
  clone(): Rng {
    const r = new Rng(0);
    r.state = this.state;
    return r;
  }
}
