// ─────────────────────────────────────────────────────────────────────────
// Vampire Survivors — REFERENCE DATA (verbatim source values)
// ─────────────────────────────────────────────────────────────────────────
// This is our north-star copy of the real Vampire Survivors balance data, kept
// here so design/back-and-forth references the actual numbers instead of memory.
// It is NOT consumed by the game — src/data/balance.ts is the live model that we
// PORT from these values and then "make our own" (retune) over time.
//
// Source: github.com/Dezzelshipc/VampireSurvivorsFiles
//         Data/Vampire Survivors/{PowerUp,Weapon,Enemy,Stage}.json
//         (base game; pulled 2026-06-04)
//
// IMPORTANT (project constraint): Otaku Hunter is a Japanese-learning game first.
// VS is the combat skeleton; the level-up LANGUAGE DRILL is the heart. Nothing
// ported here removes or bypasses that — every reward is still earned by solving
// a Japanese puzzle (see src/scenes/LevelUpScene.ts). Port the systems, keep the
// lesson.

// ── PowerUps / passives (the additive % buckets) ─────────────────────────────
// `perLevel` is the gain per rank; `max` is the rank cap in the base game.
// Note how TAME the base caps are (most are 2) — VS power comes mostly from
// weapons + evolutions, with passives as a steady multiplier on top.
export interface VSPassive {
  id: string;
  stat: string;
  perLevel: number;
  max: number;
  note: string;
}

export const VS_PASSIVES: VSPassive[] = [
  { id: 'Might', stat: 'damage', perLevel: 0.05, max: 5, note: '+5% damage' },
  { id: 'Armor', stat: 'damageReduction', perLevel: -1, max: 3, note: '-1 incoming damage (flat)' },
  { id: 'MaxHealth', stat: 'maxHp', perLevel: 0.1, max: 3, note: '+10% max HP' },
  { id: 'Recovery', stat: 'regen', perLevel: 0.1, max: 5, note: '+0.1 HP/sec' },
  { id: 'Cooldown', stat: 'cooldown', perLevel: -0.025, max: 2, note: '-2.5% weapon cooldown' },
  { id: 'Area', stat: 'area', perLevel: 0.05, max: 2, note: '+5% attack area' },
  { id: 'Speed', stat: 'projSpeed', perLevel: 0.1, max: 2, note: '+10% projectile speed' },
  { id: 'Duration', stat: 'duration', perLevel: 0.15, max: 2, note: '+15% effect duration' },
  { id: 'Amount', stat: 'amount', perLevel: 1, max: 1, note: '+1 projectile (single rank)' },
  { id: 'MoveSpeed', stat: 'moveSpeed', perLevel: 0.05, max: 2, note: '+5% movement speed' },
  { id: 'Magnet', stat: 'pickupRadius', perLevel: 0.25, max: 2, note: '+25% pickup range' },
  { id: 'Luck', stat: 'luck', perLevel: 0.1, max: 3, note: '+10% luck' },
  { id: 'Growth', stat: 'xpGain', perLevel: 0.03, max: 5, note: '+3% experience gain' },
  { id: 'Greed', stat: 'goldGain', perLevel: 0.1, max: 5, note: '+10% gold gain' },
  { id: 'Curse', stat: 'enemyStats', perLevel: 0.1, max: 5, note: '+10% enemy quantity/speed/health' },
  { id: 'Revival', stat: 'revives', perLevel: 1, max: 1, note: '+1 resurrection' },
];

// ── Weapons (per-level tables, before passives) ──────────────────────────────
// `power` is a MULTIPLIER against the character's base damage, NOT raw HP — this
// is why VS weapon numbers look tiny (1.0, 1.5) and cannot be copied straight
// onto our raw-HP enemies. We port the SHAPE (amount/cooldown/area/pierce ramps
// + the evolution rule), not these literal power values.
//
// Evolution rule: at maxLevel, owning `evolveRequires` lets the weapon evolve
// (usually via an in-run treasure chest) into `evolvesInto`.
export interface VSWeaponLevel {
  power: number;
  amount: number;
  interval: number; // ms
  area: number;
  speed: number;
  pierce?: number;
}
export interface VSWeapon {
  id: string;
  name: string;
  evolvesInto?: string;
  evolveRequires?: string;
  levels: VSWeaponLevel[]; // index 0 = level 1
}

export const VS_WEAPONS: VSWeapon[] = [
  {
    id: 'WHIP',
    name: 'Whip',
    evolvesInto: 'VAMPIRICA',
    evolveRequires: 'MaxHealth',
    levels: [
      { power: 1, amount: 1, interval: 1350, area: 1, speed: 1 },
      { power: 1, amount: 2, interval: 1350, area: 1, speed: 1 },
      { power: 1.5, amount: 2, interval: 1350, area: 1, speed: 1 },
      { power: 1.5, amount: 2, interval: 1350, area: 1.1, speed: 1 },
      { power: 2, amount: 2, interval: 1350, area: 1.1, speed: 1 },
      { power: 2, amount: 2, interval: 1350, area: 1.2, speed: 1 },
      { power: 2.5, amount: 2, interval: 1350, area: 1.2, speed: 1 },
      { power: 2.5, amount: 2, interval: 1350, area: 1.2, speed: 1 },
    ],
  },
  {
    id: 'MAGIC_WAND',
    name: 'Magic Wand',
    evolvesInto: 'HOLY_MISSILE',
    evolveRequires: 'Cooldown',
    levels: [
      { power: 1, amount: 1, interval: 1200, area: 1, speed: 1, pierce: 1 },
      { power: 1, amount: 2, interval: 1200, area: 1, speed: 1, pierce: 1 },
      { power: 1, amount: 2, interval: 1000, area: 1, speed: 1, pierce: 1 },
      { power: 1, amount: 3, interval: 1000, area: 1, speed: 1, pierce: 1 },
      { power: 2, amount: 3, interval: 1000, area: 1, speed: 1, pierce: 1 },
      { power: 2, amount: 4, interval: 1000, area: 1, speed: 1, pierce: 1 },
      { power: 2, amount: 4, interval: 1000, area: 1, speed: 1, pierce: 2 },
      { power: 3, amount: 4, interval: 1000, area: 1, speed: 1, pierce: 2 },
    ],
  },
  {
    id: 'KNIFE',
    name: 'Knife',
    evolvesInto: 'THOUSAND_EDGE',
    evolveRequires: 'Speed',
    levels: [
      { power: 0.65, amount: 1, interval: 1000, area: 1, speed: 1, pierce: 1 },
      { power: 0.65, amount: 2, interval: 1000, area: 1, speed: 1, pierce: 1 },
      { power: 0.65, amount: 3, interval: 980, area: 1, speed: 1, pierce: 1 },
      { power: 0.65, amount: 4, interval: 960, area: 1, speed: 1, pierce: 1 },
      { power: 0.65, amount: 5, interval: 960, area: 1, speed: 1, pierce: 2 },
      { power: 0.65, amount: 6, interval: 940, area: 1, speed: 1, pierce: 2 },
      { power: 0.65, amount: 7, interval: 940, area: 1, speed: 1, pierce: 2 },
      { power: 1.65, amount: 6, interval: 350, area: 1, speed: 1.5, pierce: 2 },
    ],
  },
];

// ── Enemy & stage scaling model (structural reference) ───────────────────────
// VS Enemy.json gives each enemy flat base stats (hp, power, speed, xp, knockback,
// money). Stage.json is a per-minute event table that (a) ramps a global enemy-HP
// multiplier each minute, (b) swaps in tougher enemy types, (c) raises spawn
// frequency, and (d) fires scripted waves / minute-bosses, capped by the Reaper
// at 30:00. Our balance.ts expresses the same idea as continuous formulas
// (hpMult/contactMult/speedMult/xpMult + spawnInterval/maxAlive) with the boss at
// 20:00. When we add a per-minute event table or tiered enemies, mirror this:
//   { minute, enemies[], frequency, tankChance, bossType?, event? }
// We deliberately keep the live enemy numbers in balance.ts (raw HP space) rather
// than copying VS's flat values, for the same power-vs-raw-HP reason as weapons.
export const VS_STAGE_MODEL_NOTE =
  'Per-minute event table: enemy HP multiplier ramps each minute; tougher types ' +
  'and higher spawn frequency phase in; scripted waves/minute-bosses; Reaper at 30:00.';
