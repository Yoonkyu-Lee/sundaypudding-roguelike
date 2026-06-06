//! 시드 결정론 PRNG (mulberry32) — TS `src/core/rng.ts`와 **바이트 동일**.
//! state는 `u32`(TS는 `|0` signed 저장·`>>>0` unsigned 방출 — Rust는 u32 단일, SERIALIZATION-CONTRACT RNG 부호계약).
//! 정수 코어(`next_u32`)는 전부 u32 wrapping; `next()`만 `/2^32` f64(IEEE754 결정론).

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Rng {
    pub state: u32,
}

impl Rng {
    pub fn new(seed: u32) -> Self {
        Rng { state: seed }
    }

    /// TS `next()`의 정수 코어 — u32. (`Math.imul`=u32 wrapping_mul, `>>>`=u32 `>>`)
    pub fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6d2b79f5);
        let mut t = (self.state ^ (self.state >> 15)).wrapping_mul(1 | self.state);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        t ^ (t >> 14)
    }

    /// [0, 1) 균등 — TS와 동일한 f64 나눗셈.
    pub fn next(&mut self) -> f64 {
        self.next_u32() as f64 / 4294967296.0
    }

    /// [min, max] 정수(양끝 포함). TS: `min + floor(next()*(max-min+1))`.
    pub fn int(&mut self, min: i64, max: i64) -> i64 {
        if max < min {
            return min;
        }
        min + (self.next() * ((max - min + 1) as f64)).floor() as i64
    }

    /// pct(0~100) 확률로 true. TS: `next()*100 < pct`.
    pub fn chance(&mut self, pct: i64) -> bool {
        self.next() * 100.0 < pct as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // TS `src/core/rng.ts` 레퍼런스(추출). Rust가 바이트 동일 재현해야 한다(RNG differential의 기반).
    #[test]
    fn parity_next_u32() {
        let cases: &[(u32, [u32; 6])] = &[
            (1, [2693262067, 11749833, 2265367787, 4213581821, 4159151403, 1207330352]),
            (42, [2581720956, 1925393290, 3661312704, 2876485805, 750819978, 2261697747]),
            (123456789, [1107202814, 4169434471, 3372958138, 885470128, 1301683845, 3208624240]),
            (0, [1144304738, 1416247, 958946056, 627933444, 2007157716, 2340967985]),
            (4294967295, [3850105811, 813802916, 3073704848, 4054706436, 3630262831, 2315588663]),
        ];
        for (seed, expect) in cases {
            let mut r = Rng::new(*seed);
            for (i, e) in expect.iter().enumerate() {
                assert_eq!(r.next_u32(), *e, "seed {} next_u32[{}]", seed, i);
            }
        }
    }

    #[test]
    fn parity_int_chance() {
        let mut r = Rng::new(42);
        assert_eq!([r.int(0, 99), r.int(0, 99), r.int(0, 99), r.int(0, 99)], [60, 44, 85, 66]);
        let mut r2 = Rng::new(42);
        let bits: String = (0..6).map(|_| if r2.chance(50) { '1' } else { '0' }).collect();
        assert_eq!(bits, "010010");
    }

    #[test]
    fn int_clamp_and_clone() {
        let mut r = Rng::new(7);
        assert_eq!(r.int(5, 5), 5); // min==max
        assert_eq!(r.int(10, 3), 10); // max<min → min
        let r2 = r.clone();
        assert_eq!(r, r2); // 상태 복원(직렬화 동등)
    }
}
