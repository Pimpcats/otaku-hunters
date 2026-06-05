// ─────────────────────────────────────────────────────────────────────────
// Otaku Hunter — Balance model (single source of truth for difficulty & power)
// ─────────────────────────────────────────────────────────────────────────
// Pure data + pure functions only (NO Phaser imports) so the balance simulator
// (tools/balance-sim.ts) and the live game consume the exact same numbers.
//
// Design philosophy (faithful to Vampire Survivors, ported from the real game
// data — see src/data/vs-reference.ts for the verbatim source values):
//  • Stat buckets stack ADDITIVELY within a stat (+5% Might per level →
//    1 + 0.05·level), and MULTIPLICATIVELY across different stats.
//    Final damage = weaponBaseDamage(weaponLevel) · Might.
//  • The Japanese-learning level-up puzzle is a FIRST-CLASS part of this model,
//    not a VS feature we're replacing: every upgrade is still gated behind a
//    particle/build/translate drill (see LevelUpScene), and the grade scales
//    the stacks applied (GRADE_STACKS). Keep that loop intact in any port.
//  • Enemies scale on a TIME curve: HP/contact/speed/XP climb every minute and
//    spawn density rises, so minute 0 = one-shots, 20:00 = a tense wall.
//  • Boss ("The Ultimate Collector") arrives at 20:00 as the run's climax.
//
// Tuned via simulation for the "beatable but tense" target — see BALANCE.md.

import { TEX } from '../constants'; // projectile texture keys (pure string consts)

export const RUN_LENGTH = 1200; // seconds → boss at 20:00
export const BOSS_TIME = 1200;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── Player base stats ──────────────────────────────────────────────────────
export const PLAYER_BASE = {
  maxHp: 100,
  moveSpeed: 220, // px/s
  pickupRadius: 72,
  regen: 0, // hp/s
};

// ── Passive stat upgrades (the additive % buckets) ───────────────────────────
export type StatId =
  // ── Wired into gameplay (consumed by weapons.ts / RunScene) ──
  | 'might'
  | 'haste'
  | 'amount'
  | 'area'
  | 'projSpeed'
  | 'moveSpeed'
  | 'maxHp'
  | 'regen'
  | 'magnet'
  // ── Ported from VS, wired into RunScene ──
  | 'armor' // flat incoming-damage reduction → onPlayerHit
  | 'growth' // XP-gain multiplier → gem/word pickup
  | 'luck' // luck multiplier → word-token drop rolls
  | 'curse' // enemy-stat multiplier → spawnEnemy
  | 'revival' // extra revives → gameOver
  // ── Still inert: no gold economy exists, so greed has nothing to consume ──
  | 'greed'; // gold-gain multiplier → (no economy yet)

export interface PassiveSpec {
  perLevel: number;
  max: number;
}

// Values ported verbatim from the real Vampire Survivors PowerUp data
// (see vs-reference.ts). VS MaxHealth is "+10% of base"; on our base-100 player
// that is numerically +10 HP/level, kept as flat HP so the heal-on-pickup math
// in loadout.ts stays simple.
export const PASSIVES: Record<StatId, PassiveSpec> = {
  might: { perLevel: 0.05, max: 5 }, // VS Might: +5% damage / level
  haste: { perLevel: 0.025, max: 2 }, // VS Cooldown: -2.5% / level
  amount: { perLevel: 1, max: 1 }, // VS Amount: +1 projectile (single rank)
  area: { perLevel: 0.05, max: 2 }, // VS Area: +5% size / level
  projSpeed: { perLevel: 0.1, max: 2 }, // VS Speed: +10% projectile speed / level
  moveSpeed: { perLevel: 0.05, max: 2 }, // VS Move Speed: +5% / level
  maxHp: { perLevel: 10, max: 3 }, // VS Max Health: +10% of base / level
  regen: { perLevel: 0.1, max: 5 }, // VS Recovery: +0.1 hp/s / level
  magnet: { perLevel: 0.25, max: 2 }, // VS Magnet: +25% pickup radius / level
  // Ported from VS, wired into RunScene (greed excepted — no economy yet).
  armor: { perLevel: 1, max: 3 }, // VS Armor: -1 incoming damage / level
  growth: { perLevel: 0.03, max: 5 }, // VS Growth: +3% XP gain / level
  greed: { perLevel: 0.1, max: 5 }, // VS Greed: +10% gold gain / level (inert)
  luck: { perLevel: 0.1, max: 3 }, // VS Luck: +10% luck / level
  curse: { perLevel: 0.1, max: 5 }, // VS Curse: +10% enemy stats / level
  revival: { perLevel: 1, max: 1 }, // VS Revival: +1 resurrection
};

export interface DerivedStats {
  might: number; // damage multiplier
  haste: number; // cooldown multiplier (lower = faster)
  amount: number; // bonus projectiles
  area: number; // size multiplier
  projSpeed: number; // projectile speed multiplier
  moveSpeed: number; // move speed multiplier
  maxHp: number; // absolute max HP
  regen: number; // hp/s
  magnet: number; // pickup radius multiplier
  // Ported from VS — consumed by RunScene (greed still unused: no economy).
  armor: number; // flat incoming-damage reduction
  growth: number; // XP-gain multiplier
  greed: number; // gold-gain multiplier
  luck: number; // luck multiplier
  curse: number; // enemy-stat multiplier
  revival: number; // number of extra revives
}

/** Fold a record of passive levels into concrete multipliers/values.
 *  `baseMaxHp` lets each character start from a different HP pool (the passive
 *  bonus stacks on top of it); defaults to the global player base. */
export function deriveStats(
  levels: Partial<Record<StatId, number>>,
  baseMaxHp: number = PLAYER_BASE.maxHp,
): DerivedStats {
  const L = (id: StatId) => levels[id] ?? 0;
  return {
    might: 1 + PASSIVES.might.perLevel * L('might'),
    haste: clamp(1 - PASSIVES.haste.perLevel * L('haste'), 0.4, 1),
    amount: PASSIVES.amount.perLevel * L('amount'),
    area: 1 + PASSIVES.area.perLevel * L('area'),
    projSpeed: 1 + PASSIVES.projSpeed.perLevel * L('projSpeed'),
    moveSpeed: 1 + PASSIVES.moveSpeed.perLevel * L('moveSpeed'),
    maxHp: baseMaxHp + PASSIVES.maxHp.perLevel * L('maxHp'),
    regen: PASSIVES.regen.perLevel * L('regen'),
    magnet: 1 + PASSIVES.magnet.perLevel * L('magnet'),
    armor: PASSIVES.armor.perLevel * L('armor'),
    growth: 1 + PASSIVES.growth.perLevel * L('growth'),
    greed: 1 + PASSIVES.greed.perLevel * L('greed'),
    luck: 1 + PASSIVES.luck.perLevel * L('luck'),
    curse: 1 + PASSIVES.curse.perLevel * L('curse'),
    revival: PASSIVES.revival.perLevel * L('revival'),
  };
}

// ── Weapons (per-level base stat tables, before passives) ────────────────────
export interface WeaponLevelStats {
  damage: number;
  cooldown: number; // ms between fires (before haste)
  amount: number; // projectiles/pulses (before +amount passive)
  speed: number; // projectile speed px/s (0 = stationary aura)
  pierce: number; // enemies a projectile passes through
  range: number; // targeting + travel distance in px (before ProjSpeed)
}

/** A vocabulary label so names double as Japanese lessons.
 *  Format mirrors the rest of the game: 日本語 Rōmaji — "meaning". */
export interface Vocab {
  jp: string;
  romaji: string;
  meaning: string;
}

export interface WeaponDef {
  id: string;
  name: string;
  vocab?: Vocab; // themed JP label shown in the UI; names double as vocab
  kind: 'projectile' | 'aura';
  maxLevel: number;
  level: (L: number) => WeaponLevelStats;
  // VS-style evolution scaffolding (ported, not yet wired): at maxLevel, owning
  // the required passive lets the weapon evolve into `evolvesTo`. The trigger
  // logic (in loadout/LevelUpScene) is a follow-up — these fields just declare
  // the relationship so the data is ready. Evolutions remain gated behind the
  // Japanese-learning level-up, same as every other upgrade.
  evolvesTo?: string; // weapon id of the evolved form
  evolveRequires?: StatId; // passive that must be owned to evolve
  // ── Visual identity (so each weapon reads distinctly on screen) ──
  projTexture?: string; // bullet texture key (defaults to the round orb)
  tint?: number; // multiplies the bullet texture; for auras, tints the pulse ring
  projScale?: number; // extra projectile scale on top of the Area stat (default 1)
  spin?: number; // projectile angular velocity in deg/s (e.g. spinning shuriken)
}

export const WEAPONS: Record<string, WeaponDef> = {
  // Starter (Kohai): fires the nearest enemy. Reliable single-target → light pierce.
  pocky: {
    id: 'pocky',
    name: 'Okashi Barrage',
    vocab: { jp: 'お菓子', romaji: 'Okashi', meaning: 'sweets / snacks' },
    kind: 'projectile',
    maxLevel: 8,
    evolvesTo: 'pocky_evo',
    evolveRequires: 'might',
    projTexture: TEX.pocky, // pink biscuit stick
    tint: 0xff7ab8,
    projScale: 0.7,
    level: (L) => ({
      damage: 13 + 5 * (L - 1),
      cooldown: Math.max(360, 600 - 28 * (L - 1)),
      amount: 1 + (L >= 3 ? 1 : 0) + (L >= 6 ? 1 : 0),
      speed: 620,
      pierce: 1 + (L >= 4 ? 1 : 0) + (L >= 7 ? 1 : 0),
      range: 900, // reaches across the screen and beyond
    }),
  },
  // Sensei: a pulsing ring that hits everything around you (crowd control).
  aura: {
    id: 'aura',
    name: 'Ōen Wave',
    vocab: { jp: '応援', romaji: 'Ōen', meaning: 'cheer / support' },
    kind: 'aura',
    maxLevel: 8,
    evolvesTo: 'aura_evo',
    evolveRequires: 'area',
    tint: 0x9d7bff, // otaku-purple ring
    level: (L) => ({
      damage: 5 + 3 * (L - 1),
      cooldown: Math.max(480, 900 - 52 * (L - 1)),
      amount: 1,
      speed: 0,
      pierce: 999,
      range: 0, // aura uses its own radius
    }),
  },
  // Ronin: a fast, short-range storm of low-damage piercing stars (glass-cannon).
  shuriken: {
    id: 'shuriken',
    name: 'Shuriken Storm',
    vocab: { jp: '手裏剣', romaji: 'Shuriken', meaning: 'throwing star' },
    kind: 'projectile',
    maxLevel: 8,
    evolvesTo: 'shuriken_evo',
    evolveRequires: 'projSpeed',
    projTexture: TEX.shuriken, // spinning steel star
    tint: 0xd8ecff,
    projScale: 0.7,
    spin: 720,
    level: (L) => ({
      damage: 7 + 3 * (L - 1),
      cooldown: Math.max(260, 420 - 20 * (L - 1)),
      amount: 2 + (L >= 3 ? 1 : 0) + (L >= 5 ? 1 : 0) + (L >= 7 ? 1 : 0), // 2→5
      speed: 540,
      pierce: 1 + (L >= 4 ? 1 : 0),
      range: 460, // short reach — you must wade in
    }),
  },

  // ── Evolved forms (VS-style capstones). Reached only via evolution (maxed
  //    weapon + maxed required passive + player level ≥ EVOLVE_MIN_LEVEL), never
  //    offered from scratch. maxLevel 1: they arrive at full power. This is the
  //    player's DPS-ceiling lift — roughly 2× a maxed weapon — tuned so a late
  //    evolution carries you over the final swarm to the boss WITHOUT making the
  //    mid-game trivial.
  pocky_evo: {
    id: 'pocky_evo',
    name: 'Tabehōdai',
    vocab: { jp: '食べ放題', romaji: 'Tabehōdai', meaning: 'all-you-can-eat' },
    kind: 'projectile',
    maxLevel: 1,
    projTexture: TEX.pocky,
    tint: 0xff3df0,
    projScale: 0.95,
    level: () => ({ damage: 62, cooldown: 330, amount: 4, speed: 720, pierce: 4, range: 1000 }),
  },
  aura_evo: {
    id: 'aura_evo',
    name: 'Tandoku Live',
    vocab: { jp: '単独ライブ', romaji: 'Tandoku Raibu', meaning: 'solo concert' },
    kind: 'aura',
    maxLevel: 1,
    tint: 0xff7ae0,
    level: () => ({ damage: 40, cooldown: 420, amount: 1, speed: 0, pierce: 999, range: 0 }),
  },
  shuriken_evo: {
    id: 'shuriken_evo',
    name: 'Senbon Storm',
    vocab: { jp: '千本', romaji: 'Senbon', meaning: 'a thousand' },
    kind: 'projectile',
    maxLevel: 1,
    projTexture: TEX.shuriken,
    tint: 0x8af6ff,
    projScale: 0.85,
    spin: 900,
    level: () => ({ damage: 30, cooldown: 150, amount: 8, speed: 600, pierce: 4, range: 560 }),
  },
};

// Evolutions only unlock once the player is deep enough into the run — keeps
// the spike a late-game payoff, not an early build-defining freebie. (This gates
// the level-up DRAFT path; the Gacha capsule below is its own, ungated trigger.)
export const EVOLVE_MIN_LEVEL = 40;

// ── 「ガチャ」Gacha capsule (the themed evolution chest / signature payoff) ─────
// A capsule drops occasionally from kills (and one guaranteed early so it's seen).
// Collecting it claims an evolution if one is mechanically eligible; otherwise it
// pays out a "never nothing" consolation so the pull always feels good.
export const GACHA = {
  killChance: 0.006, // base per-kill drop chance (× Star Luck)
  firstDropTime: 180, // seconds → one guaranteed capsule so the payoff is seen
  fallbackXpFrac: 0.5, // no evolution to claim → full heal + this fraction of the next level as XP
};

// ── Enemies: base stats × time multipliers ───────────────────────────────────
export interface EnemyBase {
  hp: number;
  contact: number;
  speed: number;
  xp: number;
}

export const ENEMY_BASE: Record<string, EnemyBase> = {
  RushFan: { hp: 6, contact: 8, speed: 70, xp: 1 },
  MerchMule: { hp: 14, contact: 6, speed: 56, xp: 3 },
  // Themed behavior-AI roster (§7). Stats are placeholders — tune by playtest.
  AnxiousOne: { hp: 8, contact: 7, speed: 84, xp: 2 }, // skittish, fast
  IdolWota: { hp: 12, contact: 7, speed: 68, xp: 3 }, // swaying, hard to pin
  TooCool: { hp: 16, contact: 9, speed: 60, xp: 4 }, // shrugs off weak hits
  CameraGremlin: { hp: 10, contact: 6, speed: 64, xp: 3 }, // ranged flasher
  Lurker: { hp: 18, contact: 8, speed: 50, xp: 4 }, // powers up if ignored
  Glomper: { hp: 40, contact: 12, speed: 38, xp: 6 }, // slow tank, latches
};

// Per-archetype behavior tunables (all live-tunable; movement/AI in archetypes.ts).
export const BEHAVIOR = {
  anxious: { panicRange: 130, fleeMs: 700, approachMul: 1.15 }, // rush, then bolt
  idolWota: { swaySpeed: 0.012, swayAmp: 0.85 }, // lateral concert sway (rad)
  lurker: { farRange: 300, buffRate: 0.05, buffMax: 1.5, crawl: 0.45 }, // ramp while ignored
  glomper: { latchRange: 40, slow: 0.45 }, // multiplies player move speed while latched
  tooCool: { weakHit: 8, glintEveryMs: 2200, glintMs: 600, swagger: 0.7 }, // invuln pulses
  cameko: { standRange: 230, flashEveryMs: 3000 }, // stop-and-flash
};

// Themed bestiary labels — the superfan archetypes named so they teach vocab.
// Data only for now (surfaced in HUD/bestiary as that UI lands); the behavior-AI
// roster (Anxious One, Camera Gremlin, …) is next-phase. JP names per the framework.
export const ENEMY_VOCAB: Record<string, { name: string; vocab: Vocab }> = {
  RushFan: { name: 'Fan', vocab: { jp: 'ファン', romaji: 'Fan', meaning: 'fan' } },
  MerchMule: { name: 'Scalper', vocab: { jp: '転売ヤー', romaji: 'Tenbaiyā', meaning: 'scalper / reseller' } },
  AnxiousOne: { name: 'Shy Fan', vocab: { jp: '陰キャ', romaji: 'Inkya', meaning: 'shy / introvert type' } },
  TooCool: { name: 'Cool Fan', vocab: { jp: '陽キャ', romaji: 'Yōkya', meaning: 'cool / outgoing type' } },
  CameraGremlin: { name: 'Camera Otaku', vocab: { jp: 'カメコ', romaji: 'Kameko', meaning: 'camera-otaku' } },
  IdolWota: { name: 'Idol Stan', vocab: { jp: 'ヲタ芸', romaji: 'Wotagei', meaning: 'idol-fan dance' } },
  Lurker: { name: 'Old Guard', vocab: { jp: '古参', romaji: 'Kosan', meaning: 'old-timer fan' } },
  Glomper: { name: 'Whale', vocab: { jp: '重課金', romaji: 'Jūkakin', meaning: 'whale / heavy spender' } },
  ultimate_collector: {
    name: 'The Ultimate Collector',
    vocab: { jp: '究極コレクター', romaji: 'Kyūkyoku Korekutā', meaning: 'ultimate collector' },
  },
};

// Themed pickup / currency labels (§8). Data for HUD/flavor + the learning layer.
export const PICKUP_VOCAB: Record<string, Vocab> = {
  xp: { jp: 'ハート', romaji: 'Hāto', meaning: 'heart — fan-love' },
  word: { jp: '単語', romaji: 'Tango', meaning: 'vocabulary word' },
  coin: { jp: '円', romaji: 'En', meaning: 'yen' },
  gacha: { jp: 'ガチャ', romaji: 'Gacha', meaning: 'capsule-toy / loot draw' },
};

// Time multipliers (t in seconds, m in minutes). Front-loaded so the pressure
// arrives EARLY (tense by ~8–10 min) instead of only at the boss — the late
// game stays an overwhelm climax.
export const hpMult = (t: number) => {
  const m = t / 60;
  return 1 + 0.3 * m + 0.03 * m * m; // m0=1, m5≈4.3, m10≈8, m15≈13.3, m20≈19
};
export const contactMult = (t: number) => 1 + 0.06 * (t / 60); // gentle
export const speedMult = (t: number) => 1 + 0.015 * (t / 60);
export const xpMult = (t: number) => 1 + 0.12 * (t / 60); // gems worth more late

/** Resolve an enemy's live stats at time t. */
export function enemyStatsAt(key: string, t: number): EnemyBase {
  const b = ENEMY_BASE[key];
  return {
    hp: Math.round(b.hp * hpMult(t)),
    contact: Math.round(b.contact * contactMult(t)),
    speed: Math.round(b.speed * speedMult(t)),
    xp: Math.max(1, Math.round(b.xp * xpMult(t))),
  };
}

// ── Spawning over time ───────────────────────────────────────────────────────
export const spawnInterval = (t: number) => {
  const m = Math.min(t / 60, 10);
  return lerp(800, 200, m / 10); // ms; floors at 10:00 (was 15:00)
};
export const maxAlive = (t: number) => {
  const m = Math.min(t / 60, 16);
  return Math.round(lerp(60, 320, m / 16)); // starts denser, caps by 16:00
};
export const spawnBurst = (t: number) => 1 + Math.floor(Math.min(t / 60, 18) / 3); // 1→6 (every 3 min, caps 18:00)
/** Mule share of spawns (loot mobs) rises a little over time. */
export const muleShare = (t: number) => clamp(0.12 + 0.01 * (t / 60), 0.12, 0.32);

// ── XP / leveling ────────────────────────────────────────────────────────────
export const xpForLevel = (level: number) => Math.round(5 + 4 * level + 0.5 * level * level);

// Word-token XP. A word token is worth ~15× a single XP gem, scales up with the
// player's level so it stays a meaningful chunk, and DECAYS the longer it sits
// on the ground (grab it fast for full value) down to a floor.
export const WORD_XP = {
  base: 15,
  perLevel: 0.15, // +15% of base per level above 1
  decaySeconds: 12, // time on the ground to reach the floor
  floor: 0.35, // minimum fraction once stale
};
export function wordTokenXp(level: number, ageSeconds: number): number {
  const levelScale = 1 + WORD_XP.perLevel * Math.max(0, level - 1);
  const fresh = Math.max(WORD_XP.floor, 1 - ageSeconds / WORD_XP.decaySeconds);
  return Math.max(1, Math.round(WORD_XP.base * levelScale * fresh));
}

// ── Level-up reward scaling (minigame grade → upgrade stacks) ─────────────────
// Baseline (nope) is already a real upgrade; correctness is a BONUS on top
// (guardrail §8.2 — never framed as a penalty).
export type Grade = 'got_it' | 'kinda' | 'nope';
export const GRADE_STACKS: Record<Grade, number> = { got_it: 3, kinda: 2, nope: 1 };
export const NOPE_HEAL = 12; // hp, so a wrong answer still feels rewarding

// ── Boss ─────────────────────────────────────────────────────────────────────
export const BOSS = {
  id: 'ultimate_collector',
  name: '究極コレクター — The Ultimate Collector',
  hp: 75000, // tuned so a 20-min build clears it in ~30–45s (see sim)
  contact: 28,
  speed: 64,
  xp: 200,
};
