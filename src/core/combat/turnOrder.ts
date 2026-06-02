// 턴 서열 (2.2 라운드제) — SPD 주사위 서열, 커서 진행, 정규 턴 시작/종료 주기 효과.
// 턴서열은 교체 가능한 모듈(0.1): 라운드제 기본, 스타레일式 연속 타임라인은 별도 모듈로 후속.
import type { GameState, QueueEntry, SpeedRoll, Unit } from "../types.ts";
import { aliveUnits, statMod, statusNumSum, unitById } from "../util.ts";
import { tickPeriodic } from "./status.ts";
import { checkWin } from "./winCheck.ts";
import { applySpeedRollPassives, fireTrigger, onUnitTurnStart } from "./passives/index.ts";

const ACTION_CONST = 10000; // 행동 서열 = ACTION_CONST / SPD (2.2)

export function startRound(state: GameState): void {
  state.round++;
  // 라운드마다 SPD 주사위 (2.2) − 마비/둔화(speedDown)로 뒤로 밀림 (3.5). 분해값을 연출용으로 포착(rng 호출 불변).
  const rolls: SpeedRoll[] = aliveUnits(state).map((u) => {
    const sMin = u.speedMin + statMod(u, "speedMin");
    const sMax = Math.max(sMin, u.speedMax + statMod(u, "speedMax"));
    const roll = state.rng.int(sMin, sMax);
    const speedDown = statusNumSum(u, "speedDown");
    return { uid: u.uid, speedMin: sMin, speedMax: sMax, roll, speedDown, speed: Math.max(1, roll - speedDown) };
  });
  applySpeedRollPassives(state, rolls); // speedRoll 패시브(modSpeedRoll/rerollSpeed)가 주사위 조작
  const entries: QueueEntry[] = rolls.map((r) => ({ uid: r.uid, kind: "normal" as const, speed: r.speed }));
  // 행동 서열 = ACTION_CONST / SPD 오름차순 → SPD 높을수록 먼저. 동점은 uid로 결정론적 정렬.
  entries.sort((a, b) => {
    const av = ACTION_CONST / a.speed;
    const bv = ACTION_CONST / b.speed;
    if (av !== bv) return av - bv;
    return a.uid < b.uid ? -1 : 1;
  });
  state.roundOrder = entries;
  state.cursor = -1; // advance가 0으로 전진
  state.log.push({ t: "roundStart", round: state.round, order: [...entries], rolls });
  fireTrigger(state, { on: "roundStart" });
  advance(state);
}

/** 커서를 다음 칸으로 전진. 타임라인 끝이면 새 라운드. 죽은 유닛 칸은 건너뜀(타임라인엔 남음). */
export function advance(state: GameState): void {
  if (state.phase !== "inProgress") return;
  while (true) {
    state.cursor++;
    if (state.cursor >= state.roundOrder.length) {
      fireTrigger(state, { on: "roundEnd" });
      if (state.phase !== "inProgress") return; // roundEnd 효과로 전투 종료 가능
      startRound(state);
      return;
    }
    const next = state.roundOrder[state.cursor];
    const u = unitById(state, next.uid);
    if (!u.alive) continue; // 죽은 유닛 스킵 (칸은 타임라인에 남아 회색 표시)
    state.current = next;
    state.log.push({ t: "turnStart", uid: u.uid, kind: next.kind });
    if (next.kind === "normal") onNormalTurnStart(state, u);
    else fireTrigger(state, { on: "interruptStart", subjectUid: u.uid });
    // 턴 시작 효과로 죽었으면 다음으로
    if (!u.alive) {
      state.current = null;
      if (checkWin(state)) return;
      continue;
    }
    return;
  }
}

/** 정규 턴 시작: 쿨타임 감소 + 중독(turnStart) 발동. 끼어들기는 호출 안 됨. (2.10/2.11) */
function onNormalTurnStart(state: GameState, u: Unit): void {
  onUnitTurnStart(u); // 턴 카운터++ · 턴당 발동 카운터 리셋
  for (const id of Object.keys(u.cooldowns)) {
    if (u.cooldowns[id] > 0) u.cooldowns[id]--;
  }
  tickPeriodic(state, u, "turnStart");
  fireTrigger(state, { on: "turnStart", subjectUid: u.uid });
  fireTrigger(state, { on: "everyNTurns", subjectUid: u.uid });
  checkWin(state);
}

/** 정규 턴 종료: 화상(turnEnd) 발동 + 상태이상 지속시간 차감. 끼어들기는 호출 안 됨. (2.11) */
export function onNormalTurnEnd(state: GameState, u: Unit): void {
  if (u.alive) tickPeriodic(state, u, "turnEnd");
  if (u.alive) fireTrigger(state, { on: "turnEnd", subjectUid: u.uid });
  // 지속시간 차감(정규 턴 기준) — 출혈 포함 모든 상태 (2.11)
  for (const s of u.statuses) s.duration--;
  u.statuses = u.statuses.filter((s) => s.duration > 0 && s.stacks > 0);
}
