// 노드 템플릿 영속 (localStorage) — 저작한 노드(타입+라벨+core: 적 배치·레이어·룰)를 스냅샷 저장 후
// 카탈로그에서 복제 배치. 드래프트(store.ts)와 분리: 템플릿은 런 경계를 넘는 전역 재사용 라이브러리.
import type { Layer, MapNode, NodeType } from "../../core/types.ts";

const KEY = "spr_node_templates_v1";

/** 노드 스냅샷 — 위치(q/r)·구조 링크(toFloor)는 인스턴스별이라 제외. core/label/layers만 복제 대상. */
export interface NodeTemplateContent { label?: string; core?: Layer[]; layers?: MapNode["layers"]; }
export interface NodeTemplate { id: string; name: string; type: NodeType; content: NodeTemplateContent; }

let counter = 0;
function newId(): string { return `tpl${Date.now().toString(36)}${(counter++).toString(36)}`; } // 웹 전용 — Date.now 허용

function valid(t: unknown): t is NodeTemplate {
  const r = t as NodeTemplate | null;
  return !!r && typeof r.id === "string" && typeof r.name === "string" && typeof r.type === "string" && !!r.content && typeof r.content === "object";
}
function load(): NodeTemplate[] {
  try {
    const s = localStorage.getItem(KEY);
    if (s) { const o = JSON.parse(s); if (Array.isArray(o)) return o.filter(valid); }
  } catch { /* 무시 */ }
  return [];
}
let templates: NodeTemplate[] = load();
function persist(): void { try { localStorage.setItem(KEY, JSON.stringify(templates)); } catch { /* */ } }

export function listTemplates(): NodeTemplate[] { return templates; }

/** 노드에서 템플릿 추출(deep-clone). 빈 이름이면 라벨/타입으로 대체. */
export function saveTemplate(name: string, type: NodeType, content: NodeTemplateContent): void {
  const nm = name.trim() || content.label?.trim() || type;
  const snap: NodeTemplateContent = JSON.parse(JSON.stringify(content));
  templates.push({ id: newId(), name: nm, type, content: snap });
  persist();
}
export function deleteTemplate(id: string): void { templates = templates.filter((t) => t.id !== id); persist(); }
export function getTemplate(id: string): NodeTemplate | undefined { return templates.find((t) => t.id === id); }
