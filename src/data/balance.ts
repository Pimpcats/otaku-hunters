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
  // ── Ported from VS, NOT yet wired (inert until their systems exist) ──
  | 'armor' // flat incoming-damage reduction → onPlayerHit
  | 'growth' // XP-gain multiplier → gem/word pickup
  | 'greed' // gold-gain multiplier → (no economy yet)
  | 'luck' // luck multiplier → drop rolls
  | 'curse' // enemy-stat multiplier → spawner/enemyStatsAt
  | 'revival'; // extra revives → gameOver

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
  // Ported but inert (see StatId note) — gated out of the live offer pool.
  armor: { perLevel: 1, max: 3 }, // VS Armor: -1 incoming damage / level
  growth: { perLevel: 0.03, max: 5 }, // VS Growth: +3% XP gain / level
  greed: { perLevel: 0.1, max: 5 }, // VS Greed: +10% gold gain / level
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
  // Ported from VS — derived and ready to consume, but no system reads them yet.
  armor: number; // flat incoming-damage reduction
  growth: number; // XP-gain multiplier
  greed: number; // gold-gain multiplier
  luck: number; // luck multiplier
  curse: number; // enemy-stat multiplier
  revival: number; // number of extra revives
}

/** Fold a record of passive levels into concrete multipliers/values. */
export function deriveStats(levels: Partial<Record<StatId, number>>): DerivedStats {
  const L = (id: StatId) => levels[id] ?? 0;
  return {
    might: 1 + PASSIVES.might.perLevel * L('might'),
    haste: clamp(1 - PASSIVES.haste.perLevel * L('haste'), 0.4, 1),
    amount: PASSIVES.amount.perLevel * L('amount'),
    area: 1 + PASSIVES.area.perLevel * L('area'),
    projSpeed: 1 + PASSIVES.projSpeed.perLevel * L('projSpeed'),
    moveSpeed: 1 + PASSIVES.moveSpeed.perLevel * L('moveSpeed'),
    maxHp: PLAYER_BASE.maxHp + PASSIVES.maxHp.perLevel * L('maxHp'),
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

export interface WeaponDef {
  id: string;
  name: string;
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
}

export const WEAPONS: Record<string, WeaponDef> = {
  // Starter: fires the nearest enemy. Reliable single-target → light pierce.
  pocky: {
    id: 'pocky',
    name: 'Pocky Shooter',
    kind: 'projectile',
    maxLevel: 8,
    level: (L) => ({
      damage: 13 + 5 * (L - 1),
      cooldown: Math.max(360, 600 - 28 * (L - 1)),
      amount: 1 + (L >= 3 ? 1 : 0) + (L >= 6 ? 1 : 0),
      speed: 620,
      pierce: 1 + (L >= 4 ? 1 : 0) + (L >= 7 ? 1 : 0),
      range: 900, // reaches across the screen and beyond
    }),
  },
  // Unlockable: a pulsing ring that hits everything around you (crowd control).
  aura: {
    id: 'aura',
    name: 'Otaku Aura',
    kind: 'aura',
    maxLevel: 8,
    level: (L) => ({
      damage: 5 + 3 * (L - 1),
      cooldown: Math.max(480, 900 - 52 * (L - 1)),
      amount: 1,
      speed: 0,
      pierce: 999,
      range: 0, // aura uses its own radius
    }),
  },
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
};

// Time multipliers (t in seconds, m in minutes). Front-loaded so the pressure
// arrives EARLY (tense by ~8–10 min) instead of only at the boss — the late
// game stays an overwhelm climax.
export const hpMult = (t: number) => {
  const m = t / 60;
  return 1 + 0.34 * m + 0.055 * m * m; // m0=1, m5≈4.1, m10≈9.9, m20≈29.8
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
export const spawnBurst = (t: number) => 1 + Math.floor(Math.min(t / 60, 20) / 3); // 1→7 (every 3 min)
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
  name: 'The Ultimate Collector',
  hp: 75000, // tuned so a 20-min build clears it in ~30–45s (see sim)
  contact: 28,
  speed: 64,
  xp: 200,
};
