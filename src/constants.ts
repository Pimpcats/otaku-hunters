// Tunables & shared keys in one place so balancing the slice is one file.

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const COLORS = {
  bg: 0x0b0d1a,
  bgAlt: 0x141831,
  player: 0x6ad7ff,
  bullet: 0xfff27a,
  xp: 0x7CFF9E,
  word: 0xff7ae0,
  rushFan: 0xff5a5a,
  merchMule: 0xffc857,
  // themed superfan roster (behavior-AI enemies)
  anxious: 0x7a86b8, // 陰キャ shy/introvert — muted indigo
  tooCool: 0xffb24d, // 陽キャ cool/outgoing — bright amber
  cameko: 0x4dd0e1, // カメコ camera-otaku — lens teal
  wotagei: 0xff5ac8, // ヲタ芸 idol-dance — hot pink
  kosan: 0x8fae6a, // 古参 old-timer — grizzled green
  jukakin: 0xc06bff, // 重課金 whale — heavy purple
  gacha: 0xffe08a, // ガチャ capsule — gold
  hpBack: 0x33203a,
  hp: 0xff4d6d,
  xpBar: 0x7CFF9E,
  text: 0xffffff,
  // minigame
  panel: 0x141831,
  socket: 0x2a2f55,
  chip: 0x3a3f70,
  particleChip: 0x8a5cff,
  verb: 0x4caf6d,
  correct: 0x4caf6d,
  wrong: 0xff5a5a,
} as const;

// Texture keys for the placeholder art generated at boot.
// Character textures are BASE keys; the real per-facing textures are
// `${base}_down|_up|_side` (see systems/facing.ts). Pickups/projectiles are
// single, non-directional textures.
export const TEX = {
  player: 'char_player',
  rushFan: 'char_rushfan',
  merchMule: 'char_merchmule',
  anxious: 'char_anxious',
  tooCool: 'char_toocool',
  cameko: 'char_cameko',
  wotagei: 'char_wotagei',
  kosan: 'char_kosan',
  jukakin: 'char_jukakin',
  boss: 'char_boss',
  bullet: 'tex_bullet',
  pocky: 'tex_pocky', // pocky-stick projectile
  shuriken: 'tex_shuriken', // throwing-star projectile
  xp: 'tex_xp',
  word: 'tex_word',
  gacha: 'tex_gacha', // ガチャ evolution capsule pickup
} as const;

export const PLAYER = {
  speed: 220,
  maxHp: 100,
  radius: 12,
  pickupRange: 70,
};

export const RUN = {
  // XP needed for level N (1-indexed). Gentle early curve.
  xpForLevel: (level: number) => 5 + level * 4,
  wordDropChance: 0.18, // fraction of non-mule kills that drop a word token
};
