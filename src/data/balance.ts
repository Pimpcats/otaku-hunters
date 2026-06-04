// ─────────────────────────────────────────────────────────────────────────
// Otaku Hunter — Balance model (single source of truth for difficulty & power)
// ─────────────────────────────────────────────────────────────────────────
// Pure data + pure functions only (NO Phaser imports) so the balance simulator
// (tools/balance-sim.ts) and the live game consume the exact same numbers.
//
// Design philosophy (faithful to Vampire Survivors, original values):
//  • Stat buckets stack ADDITIVELY within a stat (+10% Might per level →
//    1 + 0.10·level), and MULTIPLICATIVELY across different stats.
//    Final damage = weaponBaseDamage(weaponLevel) · Might.
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
  | 'might'
  | 'haste'
  | 'amount'
  | 'area'
  | 'projSpeed'
  | 'moveSpeed'
  | 'maxHp'
  | 'regen'
  | 'magnet';

export interface PassiveSpec {
  perLevel: number;
  max: number;
}

export const PASSIVES: Record<StatId, PassiveSpec> = {
  might: { perLevel: 0.1, max: 5 }, // +10% damage / level
  haste: { perLevel: 0.08, max: 5 }, // -8% cooldown / level
  amount: { perLevel: 1, max: 3 }, // +1 projectile / level (all weapons)
  area: { perLevel: 0.12, max: 5 }, // +12% size / level
  projSpeed: { perLevel: 0.1, max: 5 }, // +10% projectile speed / level
  moveSpeed: { perLevel: 0.08, max: 5 }, // +8% move speed / level
  maxHp: { perLevel: 25, max: 5 }, // +25 max HP / level
  regen: { perLevel: 0.5, max: 5 }, // +0.5 hp/s / level
  magnet: { perLevel: 0.3, max: 5 }, // +30% pickup radius / level
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

// Time multipliers (t in seconds, m in minutes).
export const hpMult = (t: number) => {
  const m = t / 60;
  return 1 + 0.18 * m + 0.045 * m * m; // m0=1, m10≈7.3, m20≈22.6
};
export const contactMult = (t: number) => 1 + 0.05 * (t / 60); // gentle
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
  const m = Math.min(t / 60, 15);
  return lerp(900, 200, m / 15); // ms; floors at 15:00
};
export const maxAlive = (t: number) => {
  const m = Math.min(t / 60, 20);
  return Math.round(lerp(40, 300, m / 20));
};
export const spawnBurst = (t: number) => 1 + Math.floor(Math.min(t / 60, 20) / 5); // 1→5
/** Mule share of spawns (loot mobs) rises a little over time. */
export const muleShare = (t: number) => clamp(0.12 + 0.01 * (t / 60), 0.12, 0.32);

// ── XP / leveling ────────────────────────────────────────────────────────────
export const xpForLevel = (level: number) => Math.round(5 + 4 * level + 0.5 * level * level);

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
