// 캐릭터 데이터 (포켓몬式 고유 디자인, 4.1). 스탯=기본값(보정 가능).
import type { Character } from "../contract/types.ts";

export const CHARACTERS: Record<string, Character> = {
  // ══ 우익(대한민청) — 플레이어 파티 ══
  // learnset = 전용기(앞 4, 시작 보유) + 배정된 범용기(u_*, 학습으로 습득). u_guard는 kim·shin·cho 공유(범용 예시)
  kim: { id: "kim", name: "김두한", avatar: "👊", playable: true, rootJobId: "kim_job_brawler", traitIds: ["bloodlust", "warspirit"], hp: 46, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 0, critChance: 25, critMultiplier: 160, skillIds: ["kim_punch", "kim_kick", "kim_oyabun", "kim_4dollar", "u_guard", "u_war_cry"] },
  shanghai: { id: "shanghai", name: "상하이 조", avatar: "/avatars/shanghai.webp", playable: true, traitIds: ["frontliner"], hp: 28, speedMin: 6, speedMax: 9, evasion: 12, accuracy: 5, critChance: 15, critMultiplier: 150, skillIds: ["sh_pistol", "sh_leg", "sh_grenade", "sh_ult", "u_aimed_shot", "u_snare"] },
  shin: { id: "shin", name: "신영균", avatar: "/avatars/shin.webp", playable: true, traitIds: ["thorns"], hp: 50, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["shin_axe", "shin_charge", "shin_awaken", "shin_ult", "u_guard", "u_war_cry"] },
  cho: { id: "cho", name: "조병옥", avatar: "/avatars/cho.webp", playable: true, traitIds: ["vindictive", "miser"], hp: 34, speedMin: 5, speedMax: 8, evasion: 9, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["cho_warn", "cho_martial", "cho_police", "cho_ult", "u_first_aid", "u_guard"] },

  // ══ 좌익(조선공산당) — 적(엘리트/보스) ══
  jung: { id: "jung", name: "정진영", avatar: "🚩", traitIds: ["barbed"], aiProfileId: "skirmisher", hp: 32, speedMin: 6, speedMax: 9, evasion: 11, accuracy: 0, critChance: 15, critMultiplier: 150, skillIds: ["jung_shot", "jung_retreat", "jung_charge", "jung_ult"] },
  chunho: { id: "chunho", name: "김천호", avatar: "/avatars/chunho.webp", traitIds: ["bloodfiend", "reflexes"], aiProfileId: "assassin", hp: 26, speedMin: 7, speedMax: 10, evasion: 14, accuracy: 0, critChance: 25, critMultiplier: 160, skillIds: ["chunho_stab", "chunho_shadow", "chunho_dagger", "chunho_ult"] },
  shim: { id: "shim", name: "심영", avatar: "/avatars/shim.webp", traitIds: ["rally"], aiProfileId: "guardian", hp: 48, speedMin: 3, speedMax: 6, evasion: 5, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["shim_speech", "shim_mother", "shim_flag", "shim_ult"] },
  doctor: { id: "doctor", name: "의사양반", avatar: "/avatars/doctor.webp", aiProfileId: "healer", hp: 30, speedMin: 5, speedMax: 8, evasion: 8, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["doc_tap", "doc_heal", "doc_cleanse", "doc_ult"] },

  // ══ 잡몹 ══
  thug: { id: "thug", name: "깡패", avatar: "🧢", hp: 14, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["thug_punch", "thug_kick"] },
  thug2: { id: "thug2", name: "각목 깡패", avatar: "🪵", hp: 18, speedMin: 2, speedMax: 5, evasion: 5, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["thug_club", "thug_throw"] },

  // ══ 야인시대 런1(유년·성장) — 플레이어 파티 ══ (gamedata/run01-youth.md)
  kim_young: { id: "kim_young", name: "소년두한", avatar: "👦", playable: true, rootJobId: "kim_young_job_boy", traitIds: ["indomitable"], hp: 44, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 0, critChance: 25, critMultiplier: 160, skillIds: ["young_punch", "young_kick"] }, // avatar: 소년 단독 드라마컷 없음(나무 og=3합성) → 이모지 유지, 수동 교체 대상
  gaekko: { id: "gaekko", name: "개코", avatar: "/avatars/gaekko.webp", playable: true, hp: 22, speedMin: 5, speedMax: 8, evasion: 13, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["gaekko_dung", "gaekko_taryeong"] },
  jin: { id: "jin", name: "정진영(소년)", avatar: "/avatars/jin.webp", playable: true, hp: 28, speedMin: 4, speedMax: 7, evasion: 9, accuracy: 0, critChance: 15, critMultiplier: 150, skillIds: ["jin_stab", "jin_aid"] },

  // ══ 야인시대 런1 — 적·NPC ══ (avatar=나무위키 드라마 스틸 파밍, 잡몹은 이모지 유지)
  wangcho: { id: "wangcho", name: "왕초", avatar: "/avatars/wangcho.webp", aiProfileId: "bruiser", hp: 53, speedMin: 3, speedMax: 6, evasion: 5, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["wangcho_stone", "wangcho_branch", "wangcho_rule"] },
  beggar_thug: { id: "beggar_thug", name: "거지 깡패", avatar: "🥖", aiProfileId: "skirmisher", hp: 16, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["thug_punch", "thug_kick"] },
  miwa: { id: "miwa", name: "미와", avatar: "/avatars/miwa.webp", aiProfileId: "commander", hp: 40, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 5, critChance: 5, critMultiplier: 150, skillIds: ["miwa_torture", "miwa_pursuit"] },
  detective: { id: "detective", name: "형사", avatar: "🕵", aiProfileId: "guardian", hp: 27, speedMin: 4, speedMax: 7, evasion: 7, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["det_cuff", "det_baton"] },
  kaneyama: { id: "kaneyama", name: "가네야마", avatar: "/avatars/kaneyama.webp", aiProfileId: "coward", hp: 26, speedMin: 3, speedMax: 6, evasion: 5, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["kane_greed", "kane_slap"] },
  jp_student: { id: "jp_student", name: "일본 학생", avatar: "🎒", aiProfileId: "swarm", hp: 16, speedMin: 5, speedMax: 8, evasion: 9, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["jp_gang_beat"] },
};
