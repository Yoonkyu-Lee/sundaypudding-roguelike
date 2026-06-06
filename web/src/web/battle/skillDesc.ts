// 스킬 데이터 → 게임다운 정돈된 설명 (정보 비대칭 해소). 쿨·명중·피해·사정권·면적규칙·특징.
// 모든 값은 기존 Skill/AreaShape/STATUS_DEFS 데이터에서 생성 (데이터-온리).
import type { AreaShape, Skill } from "../../contract/types.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { describeStatus } from "./status.ts";
import { esc } from "./shared.ts";

/** 사정권: 근접(reach=최전열) vs 원거리(아무 칸) vs 아군/자신. 투명하게. */
export function rangeRule(sk: Skill): string {
  if (sk.target === "self") return "자신";
  if (sk.target === "ally") return "아군";
  if (sk.reach !== undefined) return sk.reach <= 1 ? "근접" : `근접 · ${sk.reach}열`;
  if (sk.targetCells && sk.targetCells.length) return "근접 · 전방";
  return "원거리 · 아무 칸";
}

/** 면적(AoE) 규칙을 앵커 기준으로 한 줄 설명. 범위 지정 법칙을 단순·투명하게. */
export function areaRule(area: AreaShape | undefined): string {
  if (!area || area.kind === "single") return "단일 대상";
  switch (area.kind) {
    case "row": return "앵커 가로줄 전체";
    case "col": return "앵커 세로줄(열) 전체";
    case "square": { const r = area.radius ?? 1; return `앵커 중심 ${2 * r + 1}×${2 * r + 1}칸`; }
    case "cross": { const r = area.radius ?? 1; return `앵커 + 상하좌우 ${r}칸`; }
    case "all": return "대상 진영 전체";
    case "free": return `인접한 ${area.count}칸 직접 선택`;
    default: return "단일 대상";
  }
}

/** 스탯 한 줄: 쿨 · 명중(또는 필중) · 피해. effDmg 주면 시전자 실피해(무기/강화/포메이션 반영)를 원본→현재로 병기(0.2). */
export function skillStats(sk: Skill, effDmg?: number): { label: string; value: string }[] {
  const dmg = sk.effects.find((e) => e.kind === "damage");
  const out: { label: string; value: string }[] = [{ label: "쿨", value: sk.cooldown === 0 ? "없음" : `${sk.cooldown}턴` }];
  if (sk.target === "enemy") out.push({ label: "명중", value: `${sk.accuracy >= 0 ? "+" : ""}${sk.accuracy}` });
  else if (sk.alwaysHit) out.push({ label: "명중", value: "필중" });
  if (dmg && dmg.kind === "damage") {
    out.push({ label: "피해", value: String(effDmg ?? dmg.amount) }); // 최종값만 (원인 분해는 '자세히')
  }
  return out;
}

interface Trait { text: string; cls: "buff" | "debuff" | "util"; statusId?: string }

/** 특징 칩(상태부여/쉴드/회복/이동/정화/끼어들기). 상태부여는 statusId 동봉(효과 설명 팝오버용). */
export function skillTraits(sk: Skill): Trait[] {
  const t: Trait[] = [];
  for (const e of sk.effects) {
    switch (e.kind) {
      case "applyStatus": {
        const d = STATUS_DEFS[e.statusId];
        t.push({ text: `${d?.name ?? e.statusId} ${e.stacks}×${e.duration}턴`, cls: d?.buff ? "buff" : "debuff", statusId: e.statusId });
        break;
      }
      case "applyStatusSelf": {
        const d = STATUS_DEFS[e.statusId];
        t.push({ text: `자신 ${d?.name ?? e.statusId} ${e.stacks}×${e.duration}턴`, cls: d?.buff ? "buff" : "debuff", statusId: e.statusId });
        break;
      }
      case "shield": t.push({ text: `쉴드 +${e.amount}`, cls: "buff" }); break;
      case "heal": t.push({ text: `회복 ${e.amount}`, cls: "buff" }); break;
      case "cleanse": t.push({ text: "디버프 정화", cls: "buff" }); break;
      case "move": t.push({ text: e.who === "self" ? (e.deltaCol < 0 ? "자신 전진" : "자신 후퇴") : (e.deltaCol > 0 ? "대상 밀기" : "대상 끌기"), cls: "util" }); break;
    }
  }
  if (sk.grantsInterrupt) t.push({ text: `${sk.grantsInterruptTo === "target" ? "대상 " : ""}끼어들기${sk.grantsInterrupt > 1 ? ` ×${sk.grantsInterrupt}` : ""}`, cls: "util" });
  return t;
}

/** 특징 칩 HTML — 상태부여 칩은 호버/포커스 시 효과 설명 팝오버(유닛 상태칩과 동일 `describeStatus` 재사용). */
export function traitsHtml(sk: Skill): string {
  return skillTraits(sk)
    .map((t) => {
      if (!t.statusId) return `<span class="sktrait ${t.cls}">${esc(t.text)}</span>`;
      const d = STATUS_DEFS[t.statusId];
      const pop = `<span class="statuspop ${t.cls}"><span class="poptitle">${d?.icon ?? ""} ${esc(d?.name ?? t.statusId)}<em>${d?.buff ? "버프" : "디버프"}</em></span><span class="popdesc">${esc(describeStatus(d))}</span></span>`;
      return `<span class="sktrait ${t.cls} pop" tabindex="0">${esc(t.text)}${pop}</span>`;
    })
    .join("");
}

/** 스킬 분류(색 액센트·타입 칩용). 공격/지원/강화/약화/기동. */
export function skillType(sk: Skill): { key: "attack" | "support" | "buff" | "debuff" | "move"; label: string } {
  const has = (k: string) => sk.effects.some((e) => e.kind === k);
  if (has("damage")) return { key: "attack", label: "공격" };
  if (has("heal") || has("shield")) return { key: "support", label: "지원" };
  if (sk.target === "ally" || sk.target === "self") return { key: "buff", label: "강화" };
  if (has("applyStatus")) return { key: "debuff", label: "약화" };
  return { key: "move", label: "기동" };
}

const STAT_ICON: Record<string, string> = { "쿨": "⏱", "명중": "🎯", "피해": "💥" };

/** 스킬 카드 본문 HTML (선택 패널의 균일 카드용). 타입 칩 + 아이콘 스탯 + 사정권/면적 + 특징. */
export function skillCardBody(sk: Skill, effDmg?: number): string {
  const t = skillType(sk);
  const stats = skillStats(sk, effDmg).map((s) => `<span class="skstat"><i>${STAT_ICON[s.label] ?? s.label}</i>${esc(s.value)}</span>`).join("");
  const traits = traitsHtml(sk);
  const aoe = sk.area && sk.area.kind !== "single" ? ` · ${esc(areaRule(sk.area))}` : "";
  return `<span class="sktype t-${t.key}">${t.label}</span>
    <span class="skstats">${stats}</span>
    <span class="skrange">${esc(rangeRule(sk))}${aoe}</span>
    <span class="sktraits">${traits}</span>`;
}

/** 타겟팅 프롬프트용 한 줄 요약. */
export function skillInline(sk: Skill, effDmg?: number): string {
  const stats = skillStats(sk, effDmg).map((s) => `${s.label} ${s.value}`).join(" · ");
  const aoe = sk.area && sk.area.kind !== "single" ? ` · ${areaRule(sk.area)}` : "";
  return `${rangeRule(sk)} · ${stats}${aoe}`;
}
