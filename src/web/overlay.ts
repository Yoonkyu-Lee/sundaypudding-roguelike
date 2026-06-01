// 오버레이 컨트롤러 — 맵=파티 편성 / 전투=단독 캐릭터 시트. ui 단일 출처, 매 렌더 후 재그림.
// main.ts에서 분리(파일 크기). deps로 app·ui·getRun·render 주입(run은 newRun에서 재할당되므로 getter).
import { buildObservation } from "../core/engine.ts";
import { setActiveSkill, movePartyMember, equipItem, unequipItem, getRunView, type RunState } from "../core/run.ts";
import { SKILLS } from "../data/skills.ts";
import { CHARACTERS } from "../data/characters.ts";
import { renderCharSheet, type SheetData, type SheetHandlers } from "./charSheet.ts";
import { renderPartyView, type PartyViewHandlers } from "./partyView.ts";
import type { Ui } from "./battle/shared.ts";

export interface OverlayDeps {
  app: HTMLElement;
  ui: Ui;
  getRun: () => RunState; // run은 새 런 시작 시 재할당 → 호출 시점에 조회
  render: () => void; // 전체 재렌더 (변경 후 트리거)
}

export interface Overlay {
  renderOverlay: () => void; // render() 말미에 호출 — 열린 오버레이 재그림
}

export function createOverlay(deps: OverlayDeps): Overlay {
  const { app, ui } = deps;
  const render = () => deps.render();

  const sheetHandlers: SheetHandlers = {
    onToggle(charId, skillId) { setActiveSkill(deps.getRun(), charId, skillId); render(); }, // 맵에서만 editable
    onEquip(charId, slot, itemId) { equipItem(deps.getRun(), charId, slot, itemId); render(); },
    onUnequip(charId, slot) { unequipItem(deps.getRun(), charId, slot); render(); },
    onToggleDetail() { ui.sheetDetail = !ui.sheetDetail; render(); },
    onClose() { ui.sheetUid = null; ui.sheetCharId = null; render(); },
  };
  const partyViewHandlers: PartyViewHandlers = {
    ...sheetHandlers,
    onClose() { ui.partyOpen = false; ui.sheetCharId = null; render(); },
    onSelect(charId) { ui.sheetCharId = charId; render(); }, // 우측 상세 전환(파티뷰 유지)
    onMove(charId, to) { movePartyMember(deps.getRun(), charId, to); render(); }, // 진형 배치(맵 전용)
  };

  // 맵 파티원/파티뷰 우측 상세 — 보유 스킬/장착/HP(파티 상태). 전투 중이면 실시간 HP.
  function buildSheetData(charId: string): SheetData | null {
    const run = deps.getRun();
    const ch = CHARACTERS[charId];
    if (!ch) return null;
    const pv = getRunView(run).party.find((p) => p.charId === charId); // 보유 스킬/활성/이름/아바타
    const m = run.party.find((p) => p.charId === charId); // 장착/HP (raw)
    let hp = m?.hp ?? ch.hp;
    let hpMax = m?.maxHp ?? ch.hp;
    if (run.phase === "battle" && run.battle) {
      const u = run.battle.units.find((x) => x.side === "ally" && x.charId === charId);
      if (u) { hp = u.hp; hpMax = u.hpMax; } // 전투 중 실시간 HP
    }
    return {
      charId,
      name: pv?.name ?? ch.name,
      avatar: pv?.avatar ?? ch.avatar,
      hp,
      hpMax,
      shield: 0, // 맵에선 쉴드 없음(전투 종료 시 휘발)
      base: { hp: ch.hp, speedMin: ch.speedMin, speedMax: ch.speedMax, evasion: ch.evasion, accuracy: ch.accuracy, critChance: ch.critChance, critMultiplier: ch.critMultiplier },
      equipped: m?.equipped ?? {},
      inventory: run.inventory,
      skills: pv?.skills ?? [],
      statuses: [], // 맵엔 상태이상 없음
      activeCount: pv?.activeCount ?? 0,
      editable: run.phase === "map", // 장착·활성4 변경은 맵에서만
      detail: ui.sheetDetail,
    };
  }

  // 전투 단독 시트(uid 키) — 아군/적 모두 읽기전용. 스탯=라이브 Unit, 스킬=보유풀(아군)/learnset(적).
  function buildBattleSheet(uid: string): SheetData | null {
    const run = deps.getRun();
    const u = run.battle?.units.find((x) => x.uid === uid);
    if (!u) return null;
    const ch = CHARACTERS[u.charId];
    if (!ch) return null;
    const obs = buildObservation(run.battle!);
    const view = [...obs.allies, ...obs.enemies].find((v) => v.uid === uid); // 상태이상·쉴드(분해 관측)
    const m = u.side === "ally" ? run.party.find((p) => p.charId === u.charId) : undefined;
    const ownedIds = m ? m.ownedSkillIds : ch.skillIds; // 적은 learnset 전체 노출
    const activeSet = new Set(u.activeSkillIds);
    const skills = ownedIds.map((sid) => ({
      id: sid,
      name: SKILLS[sid]?.name ?? sid,
      tier: SKILLS[sid]?.tier ?? 1,
      active: activeSet.has(sid),
      canUpgrade: !!SKILLS[sid]?.nextTierId,
      signature: !!SKILLS[sid]?.exclusiveTo,
    }));
    return {
      charId: u.charId,
      name: u.name,
      avatar: ch.avatar,
      hp: u.hp,
      hpMax: u.hpMax,
      shield: view?.shield ?? u.shield,
      base: { hp: ch.hp, speedMin: ch.speedMin, speedMax: ch.speedMax, evasion: ch.evasion, accuracy: ch.accuracy, critChance: ch.critChance, critMultiplier: ch.critMultiplier },
      equipped: m?.equipped ?? {}, // 적은 장착 없음
      inventory: [], // 전투 중 장착 변경 없음
      skills,
      statuses: view?.statuses ?? [], // 활성 상태이상(분해 관측)
      activeCount: u.activeSkillIds.length,
      editable: false, // 전투=읽기전용(아군·적)
      detail: ui.sheetDetail,
    };
  }

  function renderOverlay(): void {
    const run = deps.getRun();
    app.querySelector(".party-overlay")?.remove(); // stale 제거(닫힘/전환)
    app.querySelector(".charsheet-overlay")?.remove();
    if (run.phase === "map" && ui.partyOpen) {
      const rv = getRunView(run);
      const sel = buildSheetData(ui.sheetCharId ?? rv.party[0]?.charId ?? "");
      if (!sel) return;
      const members = rv.party.map((p) => ({ charId: p.charId, name: p.name, avatar: p.avatar, pos: p.pos, hp: p.hp, hpMax: p.maxHp, alive: p.alive }));
      renderPartyView(app, { members, selected: sel }, partyViewHandlers);
    } else if (ui.sheetUid) {
      const data = buildBattleSheet(ui.sheetUid); // 전투 단독 프로필(아군/적)
      if (data) renderCharSheet(app, data, sheetHandlers);
    }
  }

  return { renderOverlay };
}
