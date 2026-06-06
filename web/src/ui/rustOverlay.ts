// Rust 경로 오버레이 컨트롤러 — 맵=파티 편성(통합 파티뷰) / 전투=단독 캐릭터 시트.
// overlay.ts(TS RunState 직접)의 Rust판: 원시 데이터는 IPC(run_sheet_data) 묶음, 정적 보강(base/특성/패시브)은 프론트.
// 변이(장착/활성/진형)는 Rust IPC(run_equip/run_unequip/run_set_active/run_move) → 번들·뷰 재조회 → 재렌더.
import { CHARACTERS } from "../content/characters.ts";
import { TRAITS } from "../content/traits.ts";
import { ITEMS } from "../content/items.ts";
import { SKILLS } from "../content/skills.ts";
import { renderCharSheet, type SheetData, type SheetHandlers, type SheetSkill, type SheetTrait } from "./charSheet.ts";
import { describeRule, describeSkillPassives } from "./battle/passiveDesc.ts";
import { renderPartyView, type PartyBoardMember, type PartyViewHandlers } from "./partyView.ts";
import type { Ui } from "./battle/shared.ts";
import type { Equipped, UnitView } from "../contract/types.ts";

interface SheetMemberRaw { charId: string; name: string; avatar?: string; pos: { row: number; col: number }; hp: number; hpMax: number; alive: boolean; equipped: Equipped; skills: SheetSkill[]; activeCount: number }
interface SheetBattleUnitRaw { uid: string; charId: string; name: string; avatar?: string; side: string; hp: number; hpMax: number; shield: number; statuses: UnitView["statuses"]; skills: SheetSkill[]; activeCount: number; equipped: Equipped }
export interface SheetBundle { inBattle: boolean; members: SheetMemberRaw[]; inventory: string[]; battleUnits: SheetBattleUnitRaw[] }

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
export interface RustOverlayDeps {
  app: HTMLElement;
  ui: Ui;
  invoke: Invoke;
  getBundle: () => SheetBundle | null;
  mutate: (fn: () => Promise<void>) => void; // IPC 변이 → 번들/뷰 재조회 → render()
  rerender: () => void; // ui만 바뀜(선택/자세히/닫기) → render()
}

export interface RustOverlay {
  renderOverlay: () => void; // render() 말미에 호출 — 열린 오버레이 재그림
}

export function createRustOverlay(deps: RustOverlayDeps): RustOverlay {
  const { app, ui, invoke } = deps;

  // 캐릭터 특성(상시) → 읽기전용 표시 데이터.
  const traitsOf = (charId: string): SheetTrait[] =>
    (CHARACTERS[charId]?.traitIds ?? []).map((id) => TRAITS[id]).filter(Boolean).map((t) => ({ name: t.name, icon: t.icon, rules: t.rules.map(describeRule) }));
  // 스킬에 active/passive 표시 정보 부착.
  const enrich = (s: SheetSkill): SheetSkill => {
    const sk = SKILLS[s.id];
    return { ...s, isActiveSkill: sk?.active !== false, passives: sk ? describeSkillPassives(sk) : [] };
  };
  const baseOf = (charId: string) => {
    const ch = CHARACTERS[charId];
    return { hp: ch.hp, speedMin: ch.speedMin, speedMax: ch.speedMax, evasion: ch.evasion, accuracy: ch.accuracy, critChance: ch.critChance, critMultiplier: ch.critMultiplier };
  };

  // 맵 파티원 상세(편성 가능) — 보유 스킬/장착/HP.
  function buildSheetData(charId: string): SheetData | null {
    const b = deps.getBundle();
    const m = b?.members.find((x) => x.charId === charId);
    if (!b || !m || !CHARACTERS[charId]) return null;
    return {
      charId, name: m.name, avatar: m.avatar, hp: m.hp, hpMax: m.hpMax, shield: 0,
      base: baseOf(charId), equipped: m.equipped, inventory: b.inventory,
      skills: m.skills.map(enrich), traits: traitsOf(charId), statuses: [],
      activeCount: m.activeCount, editable: !b.inBattle, detail: ui.sheetDetail,
    };
  }
  // 전투 단독 시트(uid 키) — 아군/적 읽기전용. 스탯=라이브 유닛, 상태이상/쉴드=관측.
  function buildBattleSheet(uid: string): SheetData | null {
    const u = deps.getBundle()?.battleUnits.find((x) => x.uid === uid);
    if (!u || !CHARACTERS[u.charId]) return null;
    return {
      charId: u.charId, name: u.name, avatar: u.avatar, hp: u.hp, hpMax: u.hpMax, shield: u.shield,
      base: baseOf(u.charId), equipped: u.equipped, inventory: [],
      skills: u.skills.map(enrich), traits: traitsOf(u.charId), statuses: u.statuses,
      activeCount: u.activeCount, editable: false, detail: ui.sheetDetail,
    };
  }

  const sheetHandlers: SheetHandlers = {
    onToggle: (charId, skillId) => deps.mutate(async () => { await invoke("run_set_active", { charId, skillId }); }),
    onEquip: (charId, slot, itemId) => deps.mutate(async () => { await invoke("run_equip", { charId, slot, itemId }); }),
    onUnequip: (charId, slot) => deps.mutate(async () => { await invoke("run_unequip", { charId, slot }); }),
    onEquipItem: (toCharId, itemId, from) => deps.mutate(async () => {
      const slot = ITEMS[itemId]?.slot; if (!slot) return;
      if (from) await invoke("run_unequip", { charId: from.charId, slot: from.slot });
      await invoke("run_equip", { charId: toCharId, slot, itemId });
    }),
    onToggleDetail: () => { ui.sheetDetail = !ui.sheetDetail; deps.rerender(); },
    onClose: () => { ui.sheetUid = null; ui.sheetCharId = null; deps.rerender(); },
  };
  const partyViewHandlers: PartyViewHandlers = {
    ...sheetHandlers,
    onClose: () => { ui.partyOpen = false; ui.sheetCharId = null; deps.rerender(); },
    onSelect: (charId) => { ui.sheetCharId = charId; deps.rerender(); },
    onMove: (charId, to) => deps.mutate(async () => { await invoke("run_move", { charId, row: to.row, col: to.col }); }),
  };

  function renderOverlay(): void {
    app.querySelector(".party-overlay")?.remove();
    app.querySelector(".charsheet-overlay")?.remove();
    const b = deps.getBundle();
    if (!b) return;
    if (!b.inBattle && ui.partyOpen) {
      const sel = buildSheetData(ui.sheetCharId ?? b.members[0]?.charId ?? "");
      if (!sel) return;
      const members: PartyBoardMember[] = b.members.map((m) => ({ charId: m.charId, name: m.name, avatar: m.avatar, pos: m.pos, hp: m.hp, hpMax: m.hpMax, alive: m.alive, equipped: m.equipped }));
      renderPartyView(app, { members, selected: sel, inventory: b.inventory }, partyViewHandlers);
    } else if (ui.sheetUid) {
      const data = buildBattleSheet(ui.sheetUid);
      if (data) renderCharSheet(app, data, sheetHandlers);
    }
  }

  return { renderOverlay };
}
