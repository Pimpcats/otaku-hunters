// Balance simulator (dev tool, not shipped). Plays an "average" build against
// the time curve from src/data/balance.ts and reports whether the run stays in
// the "beatable but tense" band across all 20 minutes.
//
// Run:  npx esbuild tools/balance-sim.ts --bundle --platform=node --format=esm \
//         --outfile=/tmp/sim.mjs && node /tmp/sim.mjs
//
// "Average" player model: a sensible round-robin build, and a grade mix of
// 35% got_it / 45% kinda / 20% nope → ~2.15 upgrade stacks per level-up.

import {
  WEAPONS,
  ENEMY_BASE,
  deriveStats,
  enemyStatsAt,
  hpMult,
  spawnInterval,
  spawnBurst,
  maxAlive,
  muleShare,
  xpForLevel,
  xpMult,
  GRADE_STACKS,
  BOSS,
  RUN_LENGTH,
  EVOLVE_MIN_LEVEL,
  type StatId,
  PASSIVES,
} from '../src/data/balance';

const AVG_STACKS = 0.35 * GRADE_STACKS.got_it + 0.45 * GRADE_STACKS.kinda + 0.2 * GRADE_STACKS.nope;

// Curated investment priority (round-robin, maxed entries skipped).
type Pri = { kind: 'weapon'; id: string; max: number } | { kind: 'stat'; id: StatId };
const PRIORITY: Pri[] = [
  { kind: 'weapon', id: 'pocky', max: WEAPONS.pocky.maxLevel },
  { kind: 'stat', id: 'might' },
  { kind: 'stat', id: 'haste' },
  { kind: 'weapon', id: 'aura', max: WEAPONS.aura.maxLevel },
  { kind: 'stat', id: 'amount' },
  { kind: 'stat', id: 'area' },
  { kind: 'stat', id: 'projSpeed' },
  { kind: 'stat', id: 'maxHp' },
  { kind: 'stat', id: 'regen' },
  { kind: 'stat', id: 'magnet' },
  { kind: 'stat', id: 'moveSpeed' },
];

const weapons = new Map<string, number>([['pocky', 1]]);
const stats: Partial<Record<StatId, number>> = {};
let cursor = 0;

function investOne() {
  // advance round-robin to next non-maxed entry
  for (let tries = 0; tries < PRIORITY.length * 2; tries++) {
    const p = PRIORITY[cursor % PRIORITY.length];
    cursor++;
    if (p.kind === 'weapon') {
      const lvl = weapons.get(p.id) ?? 0;
      if (lvl < p.max) {
        weapons.set(p.id, lvl + 1);
        return;
      }
    } else {
      const lvl = stats[p.id] ?? 0;
      if (lvl < PASSIVES[p.id].max) {
        stats[p.id] = lvl + 1;
        return;
      }
    }
  }
}

function buildDps() {
  const d = deriveStats(stats);
  let single = 0;
  let clear = 0;
  for (const [id, L] of weapons) {
    let def = WEAPONS[id];
    let lvl = L;
    // VS-style evolution: a maxed weapon + maxed required passive, once the
    // player is deep enough (EVOLVE_MIN_LEVEL), fights as its evolved form.
    if (
      def.evolvesTo &&
      def.evolveRequires &&
      L >= def.maxLevel &&
      (stats[def.evolveRequires] ?? 0) >= PASSIVES[def.evolveRequires].max &&
      level >= EVOLVE_MIN_LEVEL
    ) {
      def = WEAPONS[def.evolvesTo];
      lvl = def.maxLevel;
    }
    const w = def.level(lvl);
    const dmg = w.damage * d.might;
    const cd = (w.cooldown * d.haste) / 1000;
    const shots = 1 / cd;
    const proj = w.amount + d.amount;
    single += dmg * shots * proj;
    const swarmHits = def.kind === 'aura' ? 8 : proj * Math.min(w.pierce, 3);
    clear += dmg * shots * swarmHits;
  }
  return { single, clear, stats: d };
}

function avgEnemyHp(t: number) {
  const ms = muleShare(t);
  return ENEMY_BASE.RushFan.hp * hpMult(t) * (1 - ms) + ENEMY_BASE.MerchMule.hp * hpMult(t) * ms;
}
function avgEnemyXp(t: number) {
  const ms = muleShare(t);
  return ENEMY_BASE.RushFan.xp * xpMult(t) * (1 - ms) + ENEMY_BASE.MerchMule.xp * xpMult(t) * ms;
}

let level = 1;
let xp = 0;
let stackBank = 0;
const checkpoints = new Set([0, 60, 120, 300, 600, 900, 1140, 1200]);

console.log('Avg stacks/level-up:', AVG_STACKS.toFixed(2));
console.log(
  ['t', 'lvl', 'fodderHP', 'shotsToKill', 'DPS', 'spawn/s', 'clearRatio', 'maxHP', 'note'].join(
    '\t',
  ),
);

for (let t = 0; t <= RUN_LENGTH; t++) {
  const { single, clear, stats: d } = buildDps();
  const spawnRate = spawnBurst(t) / (spawnInterval(t) / 1000); // enemies/sec
  const ehp = avgEnemyHp(t);
  const killsPerSec = Math.min(spawnRate, clear / ehp);
  const xpPerSec = killsPerSec * avgEnemyXp(t);

  // accumulate xp this second → level-ups → stacks
  xp += xpPerSec;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    stackBank += AVG_STACKS;
  }
  while (stackBank >= 1) {
    stackBank -= 1;
    investOne();
  }

  if (checkpoints.has(t)) {
    const pocky = WEAPONS.pocky.level(weapons.get('pocky') ?? 1);
    const perHit = pocky.damage * d.might;
    const shotsToKill = ehp / perHit;
    const clearRatio = clear / (spawnRate * ehp);
    const note =
      t === 0
        ? shotsToKill <= 1.05
          ? 'one-shots ✓'
          : 'NOT one-shotting!'
        : clearRatio >= 1.15
          ? 'safe'
          : clearRatio >= 0.8
            ? 'tense'
            : 'OVERWHELMED';
    console.log(
      [
        `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`,
        level,
        ehp.toFixed(0),
        shotsToKill.toFixed(2),
        single.toFixed(0),
        spawnRate.toFixed(0),
        clearRatio.toFixed(2),
        d.maxHp.toFixed(0),
        note,
      ].join('\t'),
    );
  }
}

// Boss check at 20:00
const finalClear = buildDps().clear;
console.log(
  `\nBOSS "${BOSS.name}" HP ${BOSS.hp} — time-to-kill at 20:00 build (clearDPS ${finalClear.toFixed(
    0,
  )}, but boss is single target so use singleDPS): ${(BOSS.hp / buildDps().single).toFixed(0)}s`,
);
console.log('final loadout:', { weapons: Object.fromEntries(weapons), stats });
