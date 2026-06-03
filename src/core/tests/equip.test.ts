// 장착 아이템 결정론 테스트 (4.3) — 스탯/데미지/쉴드 보정 + equip/해제/교체 불변식.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, equipItem, unequipItem } from "../run.ts";
import { createBattle, computeDamage } from "../engine.ts";
import { CHARACTERS } from "../../data/characters.ts";

const ROSTER = [{ charId: "kim", pos: { row: 1, col: 0 } }];

test("장착: 방어구 HP 보정 + 슬롯검증 + 교체/해제 인벤토리 왕복", () => {
  const run = createRun(1, ROSTER); // 시작 인벤토리 = ["wood_bat", "leather_vest"]
  const base = CHARACTERS["kim"].hp;
  const m = run.party.find((p) => p.charId === "kim")!;

  // 슬롯-아이템 불일치 거부 (방어구를 무기칸에)
  equipItem(run, "kim", "weapon", "leather_vest");
  assert.equal(m.equipped.weapon, undefined);

  // 방어구 장착 → maxHp +10, 풀피였으니 hp도 +10
  equipItem(run, "kim", "armor", "leather_vest");
  assert.equal(m.maxHp, base + 10);
  assert.equal(m.hp, base + 10);
  assert.ok(!run.inventory.includes("leather_vest"));

  // 교체: iron_plate(+16) — 이전 leather_vest 인벤토리 복귀, hp 증가분 부여
  run.inventory.push("iron_plate");
  equipItem(run, "kim", "armor", "iron_plate");
  assert.equal(m.equipped.armor, "iron_plate");
  assert.equal(m.maxHp, base + 16);
  assert.equal(m.hp, base + 16);
  assert.ok(run.inventory.includes("leather_vest"));

  // 해제 → 스탯 원복 + 인벤토리 복귀 + hp 클램프 불변식
  unequipItem(run, "kim", "armor");
  assert.equal(m.equipped.armor, undefined);
  assert.equal(m.maxHp, base);
  assert.ok(run.inventory.includes("iron_plate"));
  assert.ok(m.hp <= m.maxHp);
});

test("장착: 무기 dmgFlat·치명/쉴드 보정이 전투 유닛에 합산", () => {
  const enc = { id: "t", name: "t", allies: [], enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }], boss: false };
  const states = [
    { charId: "kim", pos: { row: 1, col: 0 }, hp: 40, maxHp: 40, skillDmgBonus: {}, activeSkillIds: ["kim_punch"], equipped: { weapon: "brass_knuckle", armor: "iron_plate" } },
  ];
  const g = createBattle(7, enc, states);
  const u = g.units.find((x) => x.side === "ally")!;

  assert.equal(u.equipDmgFlat, 4); // brass_knuckle dmgFlat
  assert.equal(u.critChance, CHARACTERS["kim"].critChance + 8); // brass_knuckle critChance +8
  assert.equal(u.equipShieldGainAdd, 3); // iron_plate shieldGainAdd
  assert.equal(computeDamage(u, 10, false), 10 + 4); // 무기 dmgFlat 합산(비크리)
});

test("장착: 무장 없으면 보정 0 (기존 동작 보존)", () => {
  const enc = { id: "t", name: "t", allies: [], enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }], boss: false };
  const states = [{ charId: "kim", pos: { row: 1, col: 0 }, hp: 40, maxHp: 40, skillDmgBonus: {}, activeSkillIds: ["kim_punch"], equipped: {} }];
  const u = createBattle(7, enc, states).units.find((x) => x.side === "ally")!;
  assert.equal(u.equipDmgFlat, 0);
  assert.equal(u.equipShieldGainAdd, 0);
  assert.equal(u.critChance, CHARACTERS["kim"].critChance);
  assert.equal(computeDamage(u, 10, false), 10);
});
