// 노드 타입별 기본 core 시드 — 레거시 type 동작 분기를 대체(레이어 일원화).
// 에디터 노드 배치 시 시드(편집 가능), 엔진은 core 없는 노드의 fallback으로 사용. 콘텐츠라 data에 둠.
import type { Layer, NodeType } from "../core/types.ts";
import { NODE_ROSTERS } from "./encounters.ts";

const copyRoster = (key: string) => (NODE_ROSTERS[key] ?? NODE_ROSTERS.battle).map((e) => ({ charId: e.charId, pos: { ...e.pos } }));

/** 타입 → 기본 core 레이어. 콘텐츠 노드만(start/clear 등 구조 노드는 []). */
export function defaultCore(type: NodeType): Layer[] {
  switch (type) {
    case "battle": return [{ kind: "combat", roster: copyRoster("battle") }, { kind: "gold", amount: 8 }, { kind: "reward", tier: 1 }];
    case "elite": return [{ kind: "combat", roster: copyRoster("elite") }, { kind: "gold", amount: 16 }, { kind: "reward", tier: 2 }];
    case "boss": return [{ kind: "combat", boss: true, roster: copyRoster("boss") }, { kind: "gold", amount: 24 }, { kind: "reward", tier: 3 }];
    case "shop": return [{ kind: "shop" }];
    case "rest": return [{ kind: "heal", pct: 50, revive: true }];
    case "encounter": return [{ kind: "event" }]; // 인라인 없음 → 전역 풀 랜덤
    default: return []; // start·clear = 구조 노드
  }
}
