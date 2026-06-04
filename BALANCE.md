# Otaku Hunter — Balance & Difficulty

All numbers live in **`src/data/balance.ts`** (a single, pure-data module with no
Phaser imports). The game and the **simulator** (`tools/balance-sim.ts`) read the
exact same values, so tuning is "edit one file, re-simulate, ship."

This models Vampire Survivors' design faithfully with **original values** — we
replicate the *system* (which isn't copyrightable), not their data tables.

## Power model (how upgrades stack)

Like VS: bonuses are **additive within a stat bucket, multiplicative across
buckets**.

```
finalDamage = weaponBaseDamage(weaponLevel) × Might
Might       = 1 + 0.10 × (level of Energy Drink)      // +10% per level
Haste(cd)   = clamp(1 − 0.08 × level, 0.4, 1)          // cooldown multiplier
Amount      = +1 projectile per level (all weapons)
Area / ProjSpeed / MoveSpeed / Magnet = 1 + perLevel × level
MaxHP       = 100 + 25 × level   ·   Regen = 0.5 × level hp/s
```

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

Enemies have small base stats × **time multipliers** (t seconds, m = t/60):

```
HP      ×= 1 + 0.18·m + 0.035·m²     // m0=1, m10≈6.3, m20≈18.6
Contact ×= 1 + 0.05·m
Speed   ×= 1 + 0.015·m
XP      ×= 1 + 0.12·m                // gems worth more late, leveling keeps pace
```

Base: RushFan {hp 6, contact 8, speed 70, xp 1}; MerchMule {hp 14, contact 6,
speed 56, xp 3, drops a word-token}.

Spawning ramps too: interval `900ms → 200ms` (floors at 15:00), burst `1 → 5`,
on-screen cap `40 → 300`, Merch-Mule share `12% → 32%`.

## The curve (from `tools/balance-sim.ts`)

An "average" build (grade mix 35/45/20 → ~2.15 stacks per level-up) vs. the
enemy curve. **Target: "beatable but tense."**

| Time | Fodder HP | Hits to kill | Spawn/s | Clear ratio | Feel |
|------|-----------|--------------|---------|-------------|------|
| 0:00 | 7 | <1 | 1 | — | one-shots ✓ |
| 1:00 | 9 | <1 | 1 | 10.6 | powerful |
| 5:00 | 20 | 1 | 3 | 9.2 | comfortable |
| 10:00 | 49 | 1–2 | 7 | 6.9 | building |
| 15:00 | 94 | 2 | 20 | 2.7 | heating up |
| 19:00 | 145 | 3 | 20 | 1.7 | hectic |
| 20:00 | 159 | 3 | 25 | **1.26** | swarmed → boss |

- *Clear ratio* = your clear-DPS ÷ incoming-HP-per-second. >1 = out-clearing
  spawns; ~1.2 at 20:00 with 25 enemies/sec on screen is genuinely tense (you
  can't be everywhere).
- A weaker player (more wrong answers → fewer stacks, slower build) hits the
  wall earlier; a strong player ramps faster — **skill and Japanese both matter.**

## Boss — The Ultimate Collector (20:00)

`HP 60,000`, contact 28, slow relentless beeline. A maxed 20-minute build does
~1,800 single-target DPS → **~33-second fight**. Defeating it = **Stage Clear**.

## Re-running the simulator

```bash
npx esbuild tools/balance-sim.ts --bundle --platform=node --format=esm \
  --outfile=/tmp/sim.mjs && node /tmp/sim.mjs
```

Edit constants in `balance.ts`, re-run, and read the per-minute table + boss TTK.
