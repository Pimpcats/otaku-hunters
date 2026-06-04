# Otaku Hunter — Balance & Difficulty

All numbers live in **`src/data/balance.ts`** (a single, pure-data module with no
Phaser imports). The game and the **simulator** (`tools/balance-sim.ts`) read the
exact same values, so tuning is "edit one file, re-simulate, ship."

This models Vampire Survivors' design faithfully. The passive/weapon values are
now **ported from the real VS data** (see the verbatim reference in
**`src/data/vs-reference.ts`**) — we replicate the *system* (which isn't
copyrightable) and use the real numbers as our starting point, then retune.

> **Japanese first.** This is a language-learning game with a VS combat skeleton.
> Every upgrade below is still earned by solving a Japanese drill on level-up
> (`LevelUpScene`); the port keeps that loop fully intact.

## Power model (how upgrades stack)

Like VS: bonuses are **additive within a stat bucket, multiplicative across
buckets**. Per-level values match the real VS PowerUp table:

```
finalDamage = weaponBaseDamage(weaponLevel) × Might
Might       = 1 + 0.05 × (level of Energy Drink)       // VS: +5% per level, max 5
Haste(cd)   = clamp(1 − 0.025 × level, 0.4, 1)         // VS Cooldown: −2.5%, max 2
Amount      = +1 projectile (single rank, VS Amount max 1)
Area(+5%,max2) / ProjSpeed(+10%,max2) / MoveSpeed(+5%,max2) / Magnet(+25%,max2)
MaxHP       = 100 + 10 × level (max 3)  ·  Regen = 0.1 × level hp/s (max 5)
```

### Ported but not yet wired

Six VS passives are ported as data (`PASSIVES` in `balance.ts`, derived in
`deriveStats`) but **inert** — they're gated out of the level-up offer pool
(`wired: false` in `loadout.ts`) until their consuming system exists:

| VS passive | Themed name | Effect | Wire into |
|------------|-------------|--------|-----------|
| Armor | Kotatsu Blanket | −1 damage taken | `onPlayerHit` |
| Growth | Study Streak | +3% XP gain | gem/word pickup |
| Greed | Gachapon Luck | +10% gold | (no economy yet) |
| Luck | Maneki-neko | +10% luck | drop rolls |
| Curse | Cursed Manga | +10% enemy stats | spawner / `enemyStatsAt` |
| Revival | Extra Life | revive on death | `gameOver` |

**Weapon evolutions** are scaffolded too (`evolvesTo` / `evolveRequires` on
`WeaponDef`) but not triggered yet — the in-run evolve logic is a follow-up.

Upgrades are chosen **1-of-3** on each level-up, and the **minigame grade scales
how many stacks** the pick applies (correctness is a *bonus*, never a penalty —
guardrail §8.2):

| Grade | Stacks | Plus |
|-------|--------|------|
| got_it (first try) | **×3** | — |
| kinda (with a retry) | **×2** | — |
| nope (skip/timeout/wrong) | **×1** | +12 HP heal |

A wrong answer still lets you pick an upgrade (×1) **and** heals — so engaging
with the Japanese only ever helps.

## Weapons (per-level base, before passives)

| Weapon | Damage | Cooldown (ms) | Projectiles | Pierce |
|--------|--------|---------------|-------------|--------|
| **Pocky Shooter** (start) | `9 + 4·(L−1)` | `max(380, 620 − 30·(L−1))` | 1 (+1 @L3, +1 @L6) | 1 (+1 @L4, +1 @L7) |
| **Otaku Aura** (unlock) | `5 + 3·(L−1)` | `max(480, 900 − 52·(L−1))` | ring hits all in radius | ∞ |

## Enemy time curve (the difficulty ramp)

Enemies have small base stats × **time multipliers** (t seconds, m = t/60).
**Front-loaded** (2026-06 pass) so pressure arrives early, not just at the boss:

```
HP      ×= 1 + 0.34·m + 0.055·m²    // m0=1, m5≈4.1, m10≈9.9, m20≈29.8
Contact ×= 1 + 0.06·m
Speed   ×= 1 + 0.015·m
XP      ×= 1 + 0.12·m                // gems worth more late, leveling keeps pace
```

Base: RushFan {hp 6, contact 8, speed 70, xp 1}; MerchMule {hp 14, contact 6,
speed 56, xp 3, drops a word-token}.

Spawning ramps faster too: interval `800ms → 200ms` (floors at **10:00**), burst
`1 → 7` (every 3 min), on-screen cap `60 → 320` (by 16:00), Merch-Mule share
`12% → 32%`.

## The curve (from `tools/balance-sim.ts`)

An "average" build (grade mix 35/45/20 → ~2.15 stacks per level-up) vs. the
enemy curve. After the VS-passive port + front-loaded curve:

| Time | Fodder HP | Hits to kill | Spawn/s | Clear ratio | Feel |
|------|-----------|--------------|---------|-------------|------|
| 0:00 | 7 | <1 | 1 | 2.5 | one-shots ✓ |
| 2:00 | 14 | <1 | 1 | 11.8 | comfortable |
| 5:00 | 30 | <1 | 4 | 8.9 | building |
| 10:00 | 77 | 1.3 | 20 | **1.55** | tense |
| 15:00 | 151 | 2.5 | 30 | 0.53 | OVERWHELMED |
| 19:00 | 232 | 3.9 | 35 | 0.29 | swarmed |

- *Clear ratio* = your clear-DPS ÷ incoming-HP-per-second. >1 = out-clearing
  spawns. The squeeze now lands ~5 min earlier than the old curve.
- A weaker player (more wrong answers → fewer stacks, slower build) hits the
  wall earlier; a strong player ramps faster — **skill and Japanese both matter.**

## Boss — The Ultimate Collector (20:00)

`HP 75,000`, contact 28, slow relentless beeline. Defeating it = **Stage Clear**.

## ⚠ Rebalancing debt — the player power ceiling

VS's tame passive caps mean clear-DPS **hits a hard ceiling (~2,387) and stops
growing** once the build maxes (which now happens early). Combined with the
front-loaded curve, an average build is `OVERWHELMED` by ~15:00 and **does not
reach the 20:00 boss**; boss single-target TTK is also ≈100s. Skill doesn't fix
this — a perfect-answer player just reaches the same ceiling sooner.

The real fix is **lifting the player ceiling**, not softening enemies:
- scale weapon base damage harder per level, and/or
- wire the **VS evolutions** (maxed weapon + required passive → evolved form = a
  big DPS jump), and/or
- wire **Curse** as a player-chosen risk/reward difficulty lever.

Until then the run is intentionally tuned "hard and short" for feel-testing.
Re-run the sim after any change.

## Re-running the simulator

```bash
npx esbuild tools/balance-sim.ts --bundle --platform=node --format=esm \
  --outfile=/tmp/sim.mjs && node /tmp/sim.mjs
```

Edit constants in `balance.ts`, re-run, and read the per-minute table + boss TTK.
