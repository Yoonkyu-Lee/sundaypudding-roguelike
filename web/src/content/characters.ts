// 캐릭터 데이터 (포켓몬式 고유 디자인, 4.1). 스탯=기본값(보정 가능).
import type { Character } from "../contract/types.ts";

export const CHARACTERS: Record<string, Character> = {
  // ══ 우익(대한민청) — 플레이어 파티 ══
  // learnset = 전용기(앞 4, 시작 보유) + 배정된 범용기(u_*, 학습으로 습득). u_guard는 kim·shin·cho 공유(범용 예시)
  kim: { id: "kim", name: "김두한", avatar: "/avatars/kimduhan_youth.webp", playable: true, rootJobId: "kim_job_brawler", traitIds: ["bloodlust", "warspirit"], hp: 46, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 0, critChance: 25, critMultiplier: 160, skillIds: ["kim_punch", "kim_kick", "kim_oyabun", "kim_4dollar", "u_guard", "u_war_cry"] },
  shanghai: { id: "shanghai", name: "상하이 조", avatar: "/avatars/shanghai.webp", playable: true, traitIds: ["frontliner"], hp: 28, speedMin: 6, speedMax: 9, evasion: 12, accuracy: 5, critChance: 15, critMultiplier: 150, skillIds: ["sh_pistol", "sh_leg", "sh_grenade", "sh_ult", "u_aimed_shot", "u_snare"] },
  shin: { id: "shin", name: "신영균", avatar: "/avatars/shin.webp", playable: true, traitIds: ["thorns"], hp: 50, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["shin_axe", "shin_charge", "shin_awaken", "shin_ult", "u_guard", "u_war_cry"] },
  cho: { id: "cho", name: "조병옥", avatar: "/avatars/cho.webp", playable: true, traitIds: ["vindictive", "miser"], hp: 34, speedMin: 5, speedMax: 8, evasion: 9, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["cho_warn", "cho_martial", "cho_police", "cho_ult", "u_first_aid", "u_guard"] },

  // ══ 좌익(조선공산당) — 적(엘리트/보스) ══
  jung: { id: "jung", name: "정진영", avatar: "/avatars/jung.webp", traitIds: ["barbed"], aiProfileId: "skirmisher", hp: 32, speedMin: 6, speedMax: 9, evasion: 11, accuracy: 0, critChance: 15, critMultiplier: 150, skillIds: ["jung_shot", "jung_retreat", "jung_charge", "jung_ult"] },
  chunho: { id: "chunho", name: "김천호", avatar: "/avatars/chunho.webp", traitIds: ["bloodfiend", "reflexes"], aiProfileId: "assassin", hp: 26, speedMin: 7, speedMax: 10, evasion: 14, accuracy: 0, critChance: 25, critMultiplier: 160, skillIds: ["chunho_stab", "chunho_shadow", "chunho_dagger", "chunho_ult"] },
  shim: { id: "shim", name: "심영", avatar: "/avatars/shim.webp", traitIds: ["rally"], aiProfileId: "guardian", hp: 48, speedMin: 3, speedMax: 6, evasion: 5, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["shim_speech", "shim_mother", "shim_flag", "shim_ult"] },
  doctor: { id: "doctor", name: "의사양반", avatar: "/avatars/doctor.webp", aiProfileId: "healer", hp: 30, speedMin: 5, speedMax: 8, evasion: 8, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["doc_tap", "doc_heal", "doc_cleanse", "doc_ult"] },

  // ══ 잡몹 ══
  thug: { id: "thug", name: "깡패", avatar: "🧢", hp: 14, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["thug_punch", "thug_kick"] },
  thug2: { id: "thug2", name: "각목 깡패", avatar: "🪵", hp: 18, speedMin: 2, speedMax: 5, evasion: 5, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["thug_club", "thug_throw"] },

  // ══ 야인시대 런1(유년·성장) — 플레이어 파티 ══ (gamedata/run01-youth.md)
  kim_young: { id: "kim_young", name: "소년두한", avatar: "/avatars/kimduhan_child.webp", playable: true, rootJobId: "kim_young_job_boy", traitIds: ["indomitable"], hp: 44, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 0, critChance: 25, critMultiplier: 160, skillIds: ["young_punch", "young_kick"] },
  gaekko: { id: "gaekko", name: "개코", avatar: "/avatars/gaekko.webp", playable: true, hp: 22, speedMin: 5, speedMax: 8, evasion: 13, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["gaekko_dung", "gaekko_taryeong"] },
  jin: { id: "jin", name: "정진영(소년)", avatar: "/avatars/jin.webp", playable: true, hp: 28, speedMin: 4, speedMax: 7, evasion: 9, accuracy: 0, critChance: 15, critMultiplier: 150, skillIds: ["jin_stab", "jin_aid"] },

  // ══ 야인시대 런1 — 적·NPC ══ (avatar=나무위키 드라마 스틸 파밍, 잡몹은 이모지 유지)
  wangcho: { id: "wangcho", name: "왕초", avatar: "/avatars/wangcho.webp", aiProfileId: "bruiser", hp: 53, speedMin: 3, speedMax: 6, evasion: 5, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["wangcho_stone", "wangcho_branch", "wangcho_rule"] },
  beggar_thug: { id: "beggar_thug", name: "거지 깡패", avatar: "🥖", aiProfileId: "skirmisher", hp: 16, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["thug_punch", "thug_kick"] },
  miwa: { id: "miwa", name: "미와", avatar: "/avatars/miwa.webp", aiProfileId: "commander", hp: 40, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 5, critChance: 5, critMultiplier: 150, skillIds: ["miwa_torture", "miwa_pursuit"] },
  detective: { id: "detective", name: "형사", avatar: "🕵", aiProfileId: "guardian", hp: 27, speedMin: 4, speedMax: 7, evasion: 7, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["det_cuff", "det_baton"] },
  kaneyama: { id: "kaneyama", name: "가네야마", avatar: "/avatars/kaneyama.webp", aiProfileId: "coward", hp: 26, speedMin: 3, speedMax: 6, evasion: 5, accuracy: 0, critChance: 5, critMultiplier: 150, skillIds: ["kane_greed", "kane_slap"] },
  jp_student: { id: "jp_student", name: "일본 학생", avatar: "🎒", aiProfileId: "swarm", hp: 16, speedMin: 5, speedMax: 8, evasion: 9, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["jp_gang_beat"] },

  // ══ 야인시대 런2(종로 입성·주먹 패권) — 플레이어 파티 ══ (gamedata/run02)
  duhan: { id: "duhan", name: "두한(청년)", avatar: "/avatars/kimduhan_youth.webp", playable: true, rootJobId: "duhan_job_solo", traitIds: ["phantom_revival", "outnumbered_awakening"], hp: 50, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 5, critChance: 20, critMultiplier: 160, skillIds: ["duhan_kick", "duhan_headbutt"] },
  gaekko_b: { id: "gaekko_b", name: "개코(왕초)", avatar: "/avatars/gaekko.webp", playable: true, hp: 26, speedMin: 5, speedMax: 8, evasion: 12, accuracy: 0, critChance: 22, critMultiplier: 160, skillIds: ["gaekko_summon", "gaekko_grapple"] },
  jin_b: { id: "jin_b", name: "정진영", avatar: "/avatars/jin.webp", playable: true, traitIds: ["devotion"], hp: 34, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["jin_guard", "jin_aid2"] },
  kimyt: { id: "kimyt", name: "김영태", avatar: "📋", playable: true, traitIds: ["torture_resist"], hp: 22, speedMin: 6, speedMax: 9, evasion: 9, accuracy: 5, critChance: 10, critMultiplier: 150, skillIds: ["kimyt_buff", "kimyt_expose"] },
  moon: { id: "moon", name: "문영철", avatar: "🥊", playable: true, traitIds: ["thorns"], hp: 30, speedMin: 5, speedMax: 8, evasion: 8, accuracy: 8, critChance: 20, critMultiplier: 160, skillIds: ["moon_combo", "moon_jab"] },
  mook: { id: "mook", name: "김무옥", avatar: "⚔", playable: true, hp: 46, speedMin: 3, speedMax: 6, evasion: 4, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["mook_taunt", "mook_guard"] },
  beggar_ally: { id: "beggar_ally", name: "거지패", avatar: "🥖", aiProfileId: "swarm", hp: 12, speedMin: 5, speedMax: 8, evasion: 10, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["beggar_swing"] }, // 개코 소환 토큰(R2)

  // ══ 런2 — 적 ══
  kitano: { id: "kitano", name: "기따노", avatar: "🗡", aiProfileId: "assassin", hp: 30, speedMin: 5, speedMax: 8, evasion: 8, accuracy: 8, critChance: 15, critMultiplier: 170, skillIds: ["kitano_slash"] },
  shinmajeok: { id: "shinmajeok", name: "신마적", avatar: "😡", aiProfileId: "bruiser", hp: 36, speedMin: 4, speedMax: 7, evasion: 6, accuracy: 0, critChance: 15, critMultiplier: 150, skillIds: ["shin_choke"] },
  gumajeok: { id: "gumajeok", name: "구마적", avatar: "👹", aiProfileId: "bruiser", hp: 58, speedMin: 3, speedMax: 6, evasion: 5, accuracy: 0, critChance: 15, critMultiplier: 160, skillIds: ["guma_headbutt", "guma_axe"] },
  jakdu: { id: "jakdu", name: "작두", avatar: "🪓", aiProfileId: "guardian", hp: 40, speedMin: 3, speedMax: 6, evasion: 5, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: ["jakdu_chop"] },
  wangbal: { id: "wangbal", name: "왕발", avatar: "🔫", aiProfileId: "assassin", hp: 34, speedMin: 4, speedMax: 7, evasion: 7, accuracy: 10, critChance: 20, critMultiplier: 180, skillIds: ["wangbal_gun"] },
  tanaka: { id: "tanaka", name: "다나까", avatar: "💉", aiProfileId: "commander", hp: 46, speedMin: 4, speedMax: 7, evasion: 6, accuracy: 5, critChance: 10, critMultiplier: 150, skillIds: ["tanaka_opium", "tanaka_jab"] },

  // ══ 야인시대 런3(일제말 항일) — 신규 (두한·김영태·김무옥·정진영·문영철·미와·다나까 재사용) ══ (gamedata/run03)
  beolgae: { id: "beolgae", name: "번개", avatar: "⚡", playable: true, hp: 24, speedMin: 7, speedMax: 10, evasion: 13, accuracy: 5, critChance: 15, critMultiplier: 150, skillIds: ["beolgae_dash"] },
  maruoka: { id: "maruoka", name: "마루오까", avatar: "🥋", aiProfileId: "guardian", hp: 56, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 5, critChance: 10, critMultiplier: 160, skillIds: ["maruoka_throw", "maruoka_choke"] },
  kamisori: { id: "kamisori", name: "가미소리", avatar: "🗡", aiProfileId: "assassin", hp: 38, speedMin: 5, speedMax: 8, evasion: 9, accuracy: 8, critChance: 18, critMultiplier: 170, skillIds: ["kamisori_ambush"] },
  gendarme: { id: "gendarme", name: "헌병", avatar: "🎖", aiProfileId: "commander", hp: 34, speedMin: 4, speedMax: 7, evasion: 6, accuracy: 5, critChance: 5, critMultiplier: 150, skillIds: ["gendarme_torture"] },
  hayashi: { id: "hayashi", name: "하야시", avatar: "🎩", aiProfileId: "commander", hp: 48, speedMin: 4, speedMax: 7, evasion: 7, accuracy: 5, critChance: 10, critMultiplier: 150, skillIds: ["hayashi_order", "hayashi_jab"] },

  // ══ 야인시대 런4(해방·좌우 대결) — 신규 (두한·김무옥·개코·김영태·문영철·신영균(shin)·상하이(shanghai) 재사용) ══ (gamedata/run04)
  sirasoni: { id: "sirasoni", name: "시라소니", avatar: "🐯", playable: true, traitIds: ["drunken_fury"], hp: 48, speedMin: 5, speedMax: 8, evasion: 13, accuracy: 5, critChance: 18, critMultiplier: 160, skillIds: ["sirasoni_rampage", "sirasoni_headbutt"] },
  geumgang: { id: "geumgang", name: "금강", avatar: "🐻", aiProfileId: "bruiser", hp: 62, speedMin: 2, speedMax: 5, evasion: 4, accuracy: 5, critChance: 15, critMultiplier: 180, skillIds: ["geumgang_smash", "geumgang_push"] },
  ihwaryong: { id: "ihwaryong", name: "이화룡", avatar: "🐲", aiProfileId: "guardian", hp: 44, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 5, critChance: 12, critMultiplier: 155, skillIds: ["ihwaryong_strike"] },
  kimcheonho: { id: "kimcheonho", name: "김천호", avatar: "💣", aiProfileId: "assassin", hp: 26, speedMin: 6, speedMax: 9, evasion: 11, accuracy: 5, critChance: 25, critMultiplier: 175, skillIds: ["kimcheonho_ambush"] },
  jeongjinyoung: { id: "jeongjinyoung", name: "정진영(전위대장)", avatar: "🚩", aiProfileId: "commander", hp: 52, speedMin: 4, speedMax: 7, evasion: 7, accuracy: 5, critChance: 12, critMultiplier: 160, skillIds: ["jeong_command", "jeong_pistol"] },

  // ══ 야인시대 런5(사형·전쟁기) — 신규 (두한·문영철·김무옥·김영태·이화룡·시라소니 재사용) ══ (gamedata/run05)
  michael: { id: "michael", name: "마이클 상사", avatar: "🥊", aiProfileId: "bruiser", hp: 60, speedMin: 4, speedMax: 7, evasion: 12, accuracy: 8, critChance: 12, critMultiplier: 165, skillIds: ["michael_box"] },
  nodeoksul: { id: "nodeoksul", name: "노덕술", avatar: "🕴", aiProfileId: "coward", hp: 30, speedMin: 4, speedMax: 7, evasion: 9, accuracy: 5, critChance: 5, critMultiplier: 150, skillIds: ["nodeoksul_assassin"] },
  gosaimachi: { id: "gosaimachi", name: "고사이마찌", avatar: "🔫", aiProfileId: "assassin", hp: 24, speedMin: 5, speedMax: 8, evasion: 9, accuracy: 12, critChance: 22, critMultiplier: 180, skillIds: ["gosaimachi_pistol"] },
  ijeongjae: { id: "ijeongjae", name: "이정재(회장)", avatar: "🎩", playable: true, aiProfileId: "commander", hp: 54, speedMin: 4, speedMax: 7, evasion: 7, accuracy: 5, critChance: 12, critMultiplier: 160, traitIds: ["kim_oyabun_will"], skillIds: ["ijeongjae_order", "ijeongjae_pistol", "ijeongjae_summon"] },
  iseokjae: { id: "iseokjae", name: "이석재", avatar: "🎯", aiProfileId: "assassin", hp: 26, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 15, critChance: 20, critMultiplier: 170, skillIds: ["iseokjae_shot"] },

  // ══ 야인시대 런6(동대문 패권·정치) — 신규 (두한·신영균(shin)·김영태·시라소니·이화룡·이정재·이석재 재사용) ══ (gamedata/run06)
  yujikwang: { id: "yujikwang", name: "유지광", avatar: "🎓", playable: true, hp: 34, speedMin: 6, speedMax: 9, evasion: 11, accuracy: 8, critChance: 20, critMultiplier: 170, skillIds: ["yujikwang_duel", "yujikwang_challenge"] },
  aomasu: { id: "aomasu", name: "아오마스", avatar: "⚔", aiProfileId: "assassin", hp: 42, speedMin: 6, speedMax: 9, evasion: 10, accuracy: 8, critChance: 22, critMultiplier: 170, skillIds: ["aomasu_strike"] },
  doksa: { id: "doksa", name: "독사", avatar: "🐍", aiProfileId: "commander", hp: 30, speedMin: 5, speedMax: 8, evasion: 9, accuracy: 12, critChance: 10, critMultiplier: 150, skillIds: ["doksa_powder"] },
  imhwasu: { id: "imhwasu", name: "임화수", avatar: "🎭", playable: true, aiProfileId: "commander", hp: 32, speedMin: 4, speedMax: 7, evasion: 7, accuracy: 5, critChance: 5, critMultiplier: 150, skillIds: ["imhwasu_trap", "imhwasu_fury"] },

  // ══ 야인시대 런7(자유당 폭정·몰락) — 신규 (이정재·유지광·임화수·시라소니·아오마스·독사·이화룡 재사용) ══ (gamedata/run07)
  osangsa: { id: "osangsa", name: "오상사", avatar: "🦅", aiProfileId: "bruiser", hp: 38, speedMin: 5, speedMax: 8, evasion: 10, accuracy: 8, critChance: 18, critMultiplier: 165, traitIds: ["last_stand"], skillIds: ["osangsa_guts"] },
  manbal: { id: "manbal", name: "맨발", avatar: "👣", aiProfileId: "skirmisher", hp: 28, speedMin: 7, speedMax: 10, evasion: 14, accuracy: 5, critChance: 15, critMultiplier: 155, skillIds: ["manbal_kick"] },
  kimdongjin: { id: "kimdongjin", name: "김동진", avatar: "🏃", aiProfileId: "coward", hp: 30, speedMin: 5, speedMax: 8, evasion: 10, accuracy: 5, critChance: 10, critMultiplier: 150, skillIds: ["kimdongjin_flee"] },
  igibung: { id: "igibung", name: "이기붕", avatar: "🏛", aiProfileId: "commander", hp: 50, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 5, critChance: 8, critMultiplier: 150, skillIds: ["igibung_power", "igibung_order"] },
  gwakyoungju: { id: "gwakyoungju", name: "곽영주", avatar: "📞", aiProfileId: "commander", hp: 36, speedMin: 4, speedMax: 7, evasion: 7, accuracy: 5, critChance: 5, critMultiplier: 150, skillIds: ["gwak_call"] },

  // ══ 야인시대 런8(4.19와 최후) — 신규 (두한·유지광·시라소니·이화룡·곽영주·임화수 재사용) ══ (gamedata/run08)
  ichano: { id: "ichano", name: "이찬오", avatar: "🎓", playable: true, hp: 22, speedMin: 6, speedMax: 9, evasion: 10, accuracy: 8, critChance: 10, critMultiplier: 150, skillIds: ["ichano_watch", "ichano_jab"] },
  joilhwan: { id: "joilhwan", name: "조일환", avatar: "🍚", playable: true, hp: 34, speedMin: 4, speedMax: 7, evasion: 7, accuracy: 5, critChance: 10, critMultiplier: 150, skillIds: ["joilhwan_supply", "joilhwan_jab"] },
  kimhyungwook: { id: "kimhyungwook", name: "김형욱", avatar: "🕵", aiProfileId: "commander", hp: 46, speedMin: 4, speedMax: 7, evasion: 6, accuracy: 8, critChance: 8, critMultiplier: 155, skillIds: ["kimhyungwook_torture", "kimhyungwook_jab"] },
  igwajang: { id: "igwajang", name: "이과장", avatar: "📋", aiProfileId: "commander", hp: 28, speedMin: 4, speedMax: 7, evasion: 6, accuracy: 5, critChance: 5, critMultiplier: 150, skillIds: ["igwajang_weaken"] },
  minister: { id: "minister", name: "국무위원", avatar: "🎩", aiProfileId: "coward", hp: 42, speedMin: 2, speedMax: 4, evasion: 3, accuracy: 0, critChance: 0, critMultiplier: 150, skillIds: ["minister_cower"] },
};
