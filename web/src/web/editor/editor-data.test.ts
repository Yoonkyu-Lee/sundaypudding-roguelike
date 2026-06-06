// 에디터 데이터 정합성(저작 도구) — 템플릿 라이브러리·드래프트 store·레이어 스키마.
// INVARIANTS Part 4 W. localStorage는 node에서 없음 → 영속은 no-op(인메모리 의미론 검증).
import { test } from "node:test";
import assert from "node:assert/strict";
import { saveTemplate, listTemplates, getTemplate, deleteTemplate, type NodeTemplateContent } from "./templates.ts";
import { blankRun, cloneAsDraft } from "./store.ts";
import { LAYER_SPECS, LAYER_KINDS, DECO_KINDS } from "./layerSchema.ts";
import { validateRun } from "../../contract/run.ts";

// ── W1/W3 템플릿: deep-clone 격리 + id 유일 + list/get/delete ──
test("W1 saveTemplate: content deep-clone 저장 — 이후 원본 변경이 저장본 오염 안 함", () => {
  const before = listTemplates().length;
  const content: NodeTemplateContent = { label: "깡패", core: [{ kind: "combat", roster: [{ charId: "shim", pos: { row: 1, col: 0 } }] }] as never };
  saveTemplate("t1", "battle", content);
  // 원본 content 변형
  (content.core![0] as { roster: unknown[] }).roster.push({ charId: "x" } as never);
  content.label = "변경됨";
  const saved = listTemplates().find((t) => t.name === "t1")!;
  assert.equal((saved.content.core![0] as { roster: unknown[] }).roster.length, 1, "저장본 roster 불변(deep-clone)");
  assert.equal(saved.content.label, "깡패", "저장본 label 불변");
  assert.equal(listTemplates().length, before + 1);
});

test("W3 템플릿 id 유일 + get/delete 정합", () => {
  const a0 = listTemplates().length;
  saveTemplate("ta", "battle", {});
  saveTemplate("tb", "shop", {});
  const ids = listTemplates().map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "id 유일");
  const tb = listTemplates().find((t) => t.name === "tb")!;
  assert.ok(getTemplate(tb.id), "getTemplate으로 조회 가능");
  deleteTemplate(tb.id);
  assert.equal(getTemplate(tb.id), undefined, "삭제 후 조회 불가");
  assert.equal(listTemplates().length, a0 + 1, "ta만 남음");
  // 정리
  const ta = listTemplates().find((t) => t.name === "ta");
  if (ta) deleteTemplate(ta.id);
});

test("saveTemplate: 빈 이름이면 label→type로 대체", () => {
  saveTemplate("  ", "battle", { label: " 보스방 " });
  assert.ok(listTemplates().some((t) => t.name === "보스방"), "label trim으로 명명");
  saveTemplate("", "shop", {});
  assert.ok(listTemplates().some((t) => t.name === "shop"), "label 없으면 type로 명명");
  for (const t of listTemplates().filter((t) => t.name === "보스방" || t.name === "shop")) deleteTemplate(t.id);
});

// ── W5/W6/W7 store: blankRun 유효성 · 왕복 · 복제 격리 ──
test("W5 blankRun()은 validateRun을 통과하는 즉시 유효 런", () => {
  const v = validateRun(blankRun());
  assert.ok(v.ok, `blankRun 무효: ${JSON.stringify(v)}`);
});

test("W6 JSON 내보내기 왕복: JSON.parse(JSON.stringify(def)) ≡ def (plain data)", () => {
  const def = blankRun();
  const round = JSON.parse(JSON.stringify(def));
  assert.deepEqual(round, def, "RunDef 직렬화 왕복 손실");
});

test("W7 cloneAsDraft: deep-clone + 새 draft id + 원본 비공유", () => {
  const def = blankRun();
  def.id = "repo_src"; // 실사용: repo 런(비-draft id)을 편집용 드래프트로 복제
  const copy = cloneAsDraft(def);
  assert.notEqual(copy.id, def.id, "새 id(원본과 다름)");
  assert.ok(copy.id.startsWith("draft_"), "draft_ 접두");
  assert.ok(copy.name.includes("복사본"));
  copy.floors[0].nodes.push({ id: "x", type: "battle", q: 9, r: 9 });
  assert.equal(def.floors[0].nodes.length, 2, "원본 노드 수 불변(deep-clone)");
});

// ── W10 layerSchema: 카탈로그 ⊆ 스펙 + make().kind 일치 ──
test("W10 LAYER_KINDS∪DECO_KINDS ⊆ LAYER_SPECS ∧ make().kind === 키", () => {
  for (const k of [...LAYER_KINDS, ...DECO_KINDS]) {
    assert.ok(LAYER_SPECS[k], `스펙 없음: ${k}`);
  }
  for (const [k, spec] of Object.entries(LAYER_SPECS)) {
    assert.equal(spec.make().kind, k, `${k}.make().kind 불일치`);
  }
  for (const k of DECO_KINDS) assert.ok(LAYER_KINDS.includes(k), `DECO_KINDS ${k}가 LAYER_KINDS에 없음`);
});
