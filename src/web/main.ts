// 웹 엔트리 — 런 컨트롤러. 맵 ↔ 전투 ↔ 보상 ↔ 결과를 run.phase로 분기.
// 전투는 render.ts(renderApp) 재사용, 맵/보상/결과는 runRender.ts. (7장)
import { step, buildObservation } from "../core/engine.ts";
import { chooseAction } from "../core/ai.ts";
import { createRun, enterNode, resolveBattleEnd, chooseReward, setActiveSkill, movePartyMember, buyShopOffer, leaveShop, chooseEncounterOption, equipItem, unequipItem, getRunView, type RunState } from "../core/run.ts";
import type { Action } from "../core/types.ts";
import { SKILLS } from "../data/skills.ts";
import { CHARACTERS } from "../data/characters.ts";
import { renderApp, type Handlers, type Ui } from "./render.ts";
import { renderRunScreen, type RunHandlers } from "./runRender.ts";
import { createTimelinePanel, type RollView } from "./battle/timelinePanel.ts";
import { renderCharSheet, type SheetData, type SheetHandlers } from "./charSheet.ts";
import { renderPartyView, type PartyViewHandlers } from "./partyView.ts";

const app = document.getElementById("app")!;
const panel = createTimelinePanel(); // 행동서열 패널 — 주사위(rolling)↔전투(live) 한 컴포넌트, 전투 셸에 영속 마운트

const ROSTER = [
  { charId: "kim", pos: { row: 1, col: 0 } }, // 김두한 전방
  { charId: "shin", pos: { row: 2, col: 0 } }, // 신영균 전방
  { charId: "shanghai", pos: { row: 1, col: 2 } }, // 상하이 조 후방
  { charId: "cho", pos: { row: 2, col: 2 } }, // 조병옥 후방
];

let run: RunState;
let seed = 42;
let busy = false;
const ui: Ui = { selectedSkillId: null, hoverCell: null, pickedCells: [], damaged: new Set(), moved: new Set(), seed, sheetCharId: null, sheetUid: null, partyOpen: false, sheetDetail: false };

function resetUi(): void {
  ui.selectedSkillId = null;
  ui.hoverCell = null;
  ui.pickedCells = [];
  ui.damaged = new Set();
  ui.moved = new Set();
  ui.sheetCharId = null; // 노드 전환 시 시트/파티뷰 닫기
  ui.sheetUid = null;
  ui.partyOpen = false;
  ui.sheetDetail = false;
}
function endTargeting(): void {
  ui.selectedSkillId = null;
  ui.hoverCell = null;
  ui.pickedCells = [];
}

let introRound = 0; // 마지막으로 주사위 연출한 라운드 (라운드마다 1회)

function render(): void {
  if (run.phase === "battle" && run.battle) {
    const b = run.battle;
    // 새 라운드 시작 시 SPD 주사위 연출을 먼저 재생, 끝나면 전투 렌더 (8.5: 이벤트 재생)
    if (b.phase === "inProgress" && b.round !== introRound) {
      introRound = b.round;
      const rs = [...b.log].reverse().find((e) => e.t === "roundStart" && e.round === b.round);
      if (rs && rs.t === "roundStart") {
        busy = true;
        const views: RollView[] = rs.rolls.map((r) => {
          const u = b.units.find((x) => x.uid === r.uid)!;
          return { ...r, name: u.name, avatar: CHARACTERS[u.charId]?.avatar, side: u.side };
        });
        // 셸+존 렌더(패널 마운트, 레일 위치 확정) 후 같은 tick에 굴림 시작 → stale 깜빡임 없음
        renderApp(app, b, ui, battleHandlers, panel);
        panel.playRoll(b.round, views, rs.order.map((e) => e.uid), () => {
          busy = false;
          renderBattle(); // 도킹 완료 후 전투 진행(driveBattle)
        });
        return;
      }
    }
    renderBattle();
  } else {
    introRound = 0; // 전투를 떠나면 리셋 → 다음 전투는 1라운드부터 연출
    renderRunScreen(app, getRunView(run), runHandlers);
    renderOverlay();
  }
}

function renderBattle(): void {
  renderApp(app, run.battle!, ui, battleHandlers, panel);
  renderOverlay();
  driveBattle();
}

// ── 오버레이(맵=파티 편성 / 전투=단독 캐릭터 시트) — ui 단일 출처, 매 렌더 후 재그림 ──
const sheetHandlers: SheetHandlers = {
  onToggle(charId, skillId) { setActiveSkill(run, charId, skillId); render(); }, // 맵에서만 editable
  onEquip(charId, slot, itemId) { equipItem(run, charId, slot, itemId); render(); },
  onUnequip(charId, slot) { unequipItem(run, charId, slot); render(); },
  onToggleDetail() { ui.sheetDetail = !ui.sheetDetail; render(); },
  onClose() { ui.sheetUid = null; ui.sheetCharId = null; render(); },
};
const partyViewHandlers: PartyViewHandlers = {
  ...sheetHandlers,
  onClose() { ui.partyOpen = false; ui.sheetCharId = null; render(); },
  onSelect(charId) { ui.sheetCharId = charId; render(); }, // 우측 상세 전환(파티뷰 유지)
  onMove(charId, to) { movePartyMember(run, charId, to); render(); }, // 진형 배치(맵 전용)
};

function buildSheetData(charId: string): SheetData | null {
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

// ── 전투 진행 ──
function driveBattle(): void {
  const b = run.battle!;
  if (b.phase !== "inProgress") {
    // 전투 종료 — 결과를 잠깐 보여준 뒤 런으로 복귀
    busy = true;
    setTimeout(() => {
      busy = false;
      resolveBattleEnd(run);
      resetUi();
      render();
    }, 1100);
    return;
  }
  const actor = b.units.find((u) => u.uid === b.current!.uid)!;
  if (actor.side === "enemy") {
    busy = true;
    setTimeout(() => {
      busy = false;
      battleStep(chooseAction(b));
    }, 600);
  }
}

function battleStep(action: Action): void {
  const b = run.battle!;
  const before = b.log.length;
  step(b, action);
  const newEvents = b.log.slice(before);
  ui.damaged = new Set(newEvents.flatMap((e) => (e.t === "damage" ? [e.targetUid] : [])));
  ui.moved = new Set(newEvents.flatMap((e) => (e.t === "move" ? [e.uid] : [])));
  endTargeting();
  render();
}

const battleHandlers: Handlers = {
  onSkill(skillId) {
    if (busy || !run.battle || run.battle.phase !== "inProgress") return;
    const sk = SKILLS[skillId];
    if (sk?.target === "self") {
      // 자기 대상은 즉시 시전 (앵커=자신 위치)
      const actor = run.battle.units.find((u) => u.uid === run.battle!.current!.uid)!;
      battleStep({ type: "skill", skillId, targetCell: { ...actor.pos } });
      return;
    }
    ui.selectedSkillId = skillId;
    ui.hoverCell = null;
    ui.pickedCells = [];
    render();
  },
  onCellClick(pos) {
    if (busy || !ui.selectedSkillId) return;
    const sk = SKILLS[ui.selectedSkillId];
    if (sk.area?.kind === "free") {
      const count = sk.area.count;
      if (!ui.pickedCells.some((p) => p.row === pos.row && p.col === pos.col)) ui.pickedCells.push(pos);
      if (ui.pickedCells.length >= count) battleStep({ type: "skill", skillId: ui.selectedSkillId, cells: ui.pickedCells.slice() });
      else render();
    } else {
      battleStep({ type: "skill", skillId: ui.selectedSkillId, targetCell: pos });
    }
  },
  onCellHover(pos) {
    if (!ui.selectedSkillId) return;
    const cur = ui.hoverCell;
    if ((pos?.row ?? -9) !== (cur?.row ?? -9) || (pos?.col ?? -9) !== (cur?.col ?? -9)) {
      ui.hoverCell = pos;
      render();
    }
  },
  onCancel() {
    endTargeting();
    render();
  },
  onSkip() {
    if (!busy) battleStep({ type: "skip" });
  },
  onNewBattle() {
    runHandlers.onRestart(); // 전투 화면의 '새 전투' = 런 재시작
  },
  onOpenSheet(uid) {
    ui.sheetUid = uid; // 전투 유닛 프로필(아군/적)
    render();
  },
};

// ── 런 핸들러 ──
const runHandlers: RunHandlers = {
  onNode(id) {
    if (busy || run.phase !== "map") return;
    enterNode(run, id);
    resetUi();
    render();
  },
  onReward(id) {
    if (busy || run.phase !== "reward") return;
    chooseReward(run, id);
    render();
  },
  onRestart() {
    seed += 1;
    newRun(seed);
  },
  onToggleSkill(charId, skillId) {
    if (busy || run.phase !== "map") return;
    setActiveSkill(run, charId, skillId);
    render();
  },
  onBuy(offerId) {
    if (busy || run.phase !== "shop") return;
    buyShopOffer(run, offerId);
    render();
  },
  onLeaveShop() {
    if (busy || run.phase !== "shop") return;
    leaveShop(run);
    resetUi();
    render();
  },
  onEncounterChoice(choiceId) {
    if (busy || run.phase !== "encounter") return;
    chooseEncounterOption(run, choiceId);
    resetUi();
    render();
  },
  onOpenParty(charId) {
    if (run.phase !== "map") return;
    ui.partyOpen = true;
    ui.sheetCharId = charId;
    render();
  },
};

function newRun(s: number): void {
  seed = s;
  ui.seed = s;
  run = createRun(s, ROSTER);
  resetUi();
  render();
}

// Esc: 파티뷰/시트 열려있으면 닫기, 아니면 타겟팅 취소
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (ui.partyOpen) { ui.partyOpen = false; ui.sheetCharId = null; render(); }
  else if (ui.sheetUid) { ui.sheetUid = null; render(); }
  else if (ui.selectedSkillId) battleHandlers.onCancel();
});

newRun(42);
