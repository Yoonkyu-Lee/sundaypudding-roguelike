// 인카운터 이벤트 (7.2) — 생존 보장 + 성장/저해 도박. 데이터 주도(디자이너 편집). 구매(골드)는 상점 전담.
// 스키마(EncounterEvent/Choice/Outcome)는 core/types로 이전(event 레이어가 인라인 소유하려면 types 필요). 여기선 풀 상수만.
import type { EncounterEvent } from "../contract/types.ts";
export type { EncounterOutcome, EncounterChoice, EncounterEvent } from "../contract/types.ts";

export const ENCOUNTER_EVENTS: EncounterEvent[] = [
  {
    id: "shrine",
    title: "수상한 제단",
    text: "낡은 제단이 피를 요구한다. 손을 얹으면 힘을 얻을지도 — 아니면 그저 다칠지도.",
    choices: [
      { id: "offer", label: "피를 바친다 (60%: 스킬 강화 / 실패: HP 15%)", gamble: { chance: 60, win: { kind: "upgradeRandom" }, lose: { kind: "hurt", pct: 15 } } },
      { id: "leave", label: "건드리지 않고 지나간다", result: { kind: "nothing" } },
    ],
  },
  {
    id: "cache",
    title: "버려진 보급품",
    text: "골목에 누군가 숨겨둔 보급품 상자가 있다.",
    choices: [
      { id: "rest", label: "물자로 치료한다 (파티 40% 회복)", result: { kind: "heal", pct: 40 } },
      { id: "loot", label: "값나가는 것만 챙긴다 (골드 +25)", result: { kind: "gold", amount: 25 } },
    ],
  },
  {
    id: "drillmaster",
    title: "퇴역 교관",
    text: "험상궂은 노병이 \"한 수 가르쳐주마\"라며 가로막는다.",
    choices: [
      { id: "spar", label: "대련한다 (70%: 새 기술 습득 / 실패: HP 10%)", gamble: { chance: 70, win: { kind: "learnUniversal" }, lose: { kind: "hurt", pct: 10 } } },
      { id: "bribe", label: "돈으로 무마한다 (골드 −15, 안전)", result: { kind: "gold", amount: -15 } },
    ],
  },
];
