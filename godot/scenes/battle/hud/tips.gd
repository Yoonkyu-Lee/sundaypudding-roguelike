## 툴팁 공간 텍스트 빌더(정적) — 콘텐츠 정의 → 읽는 한 줄 요약. 소비자는 preload로 참조(class_name은 헤드리스 미등록).
## 풀 서술(web skillDesc/passiveDesc) 포팅 전 간이판: 핵심 수치만. 데이터 키 = data.generated.json(camelCase).

const TARGET_KO := {"enemy": "적", "ally": "아군", "self": "자신"}

## 스킬 정의 → "[이름] 명중 85% · 쿨다운 2 · 대상 적 · 피해 12, 출혈 2×2r"
## statuses(id→StatusDef)를 주면 효과 속 statusId를 이름으로 해석.
static func skill(sk: Dictionary, statuses: Dictionary = {}) -> String:
	if sk.is_empty(): return ""
	var parts: Array[String] = ["[%s]" % str(sk.get("name", "?"))]
	parts.append("필중" if bool(sk.get("alwaysHit", false)) else "명중 %d%%" % int(sk.get("accuracy", 0)))
	if int(sk.get("cooldown", 0)) > 0: parts.append("쿨다운 %d" % int(sk.get("cooldown", 0)))
	parts.append("대상 %s" % TARGET_KO.get(str(sk.get("target", "")), str(sk.get("target", "?"))))
	var fx := _effects(sk.get("effects", []), statuses)
	if fx != "": parts.append(fx)
	return " · ".join(parts)

## 상태이상 뷰(StatusView) + 정의(StatusDef) → "출혈 ×3 (2라운드) — 지속피해 · 행동불가"
static func status(sv: Dictionary, def: Dictionary) -> String:
	var name := str(def.get("name", sv.get("id", "?")))
	var head := "%s %s ×%d (%d라운드)" % [str(def.get("icon", sv.get("icon", ""))), name, int(sv.get("stacks", 0)), int(sv.get("duration", 0))]
	var notes: Array[String] = []
	if def.get("dot") != null: notes.append("지속피해")
	if def.get("hot") != null: notes.append("지속회복")
	if bool(def.get("actionDenial", false)): notes.append("행동불가")
	if bool(def.get("shieldShred", false)): notes.append("쉴드파괴")
	if bool(def.get("pierce", false)): notes.append("관통")
	if bool(def.get("undying", false)): notes.append("불사")
	if def.get("damageDealtMult") != null: notes.append("가하는 피해 ×%d%%" % int(def.get("damageDealtMult")))
	if def.get("dmgDealtFlat") != null: notes.append("가하는 피해 %+d" % int(def.get("dmgDealtFlat")))
	if def.get("critChanceAdd") != null: notes.append("크리율 %+d%%" % int(def.get("critChanceAdd")))
	return head if notes.is_empty() else "%s — %s" % [head, " · ".join(notes)]

## 아이템 정의 → "🗡 회칼 (무기) — 피해 +3 · 쉴드획득 +2"
static func item(slot_ko: String, def: Dictionary) -> String:
	if def.is_empty(): return "%s — (비어 있음)" % slot_ko
	var parts: Array[String] = []
	if int(def.get("dmgFlat", 0)) != 0: parts.append("피해 %+d" % int(def.get("dmgFlat", 0)))
	if int(def.get("shieldGainAdd", 0)) != 0: parts.append("쉴드획득 %+d" % int(def.get("shieldGainAdd", 0)))
	var mods: Variant = def.get("mods")
	if mods is Dictionary:
		for k in mods.keys(): parts.append("%s %+d" % [str(k), int(mods[k])])
	var head := "%s %s (%s)" % [str(def.get("icon", "")), str(def.get("name", "?")), slot_ko]
	return head.strip_edges() if parts.is_empty() else "%s — %s" % [head.strip_edges(), " · ".join(parts)]

## 효과 배열 → "피해 12, 출혈 2×2r, 쉴드 8 …" (statuses 있으면 statusId→이름)
static func _effects(effects: Variant, statuses: Dictionary) -> String:
	if not (effects is Array): return ""
	var out: Array[String] = []
	for e in effects:
		if not (e is Dictionary): continue
		match str(e.get("kind", "")):
			"damage": out.append("피해 %d" % int(e.get("amount", 0)))
			"heal": out.append("회복 %d" % int(e.get("amount", 0)))
			"shield": out.append("쉴드 %d" % int(e.get("amount", 0)))
			"cleanse": out.append("정화")
			"applyStatus", "applyStatusSelf":
				var sid := str(e.get("statusId", "?"))
				var nm: String = str(statuses.get(sid, {}).get("name", sid)) if statuses.has(sid) else sid
				var self_mark := "(자신)" if str(e.get("kind", "")) == "applyStatusSelf" else ""
				out.append("%s%s %d×%dr" % [nm, self_mark, int(e.get("stacks", 0)), int(e.get("duration", 0))])
			"move": out.append("이동 %+d열(%s)" % [int(e.get("deltaCol", 0)), "자신" if str(e.get("who", "")) == "self" else "대상"])
			"summon": out.append("소환 %s×%d" % [str(e.get("charId", "?")), int(e.get("count", 1) if e.get("count") != null else 1)])
	return ", ".join(out)
