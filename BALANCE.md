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

## Characters (the roster)

Pick one of three hunters on the menu (`src/data/characters.ts`). Each differs in
starting weapon, base HP, base move speed, and an identity passive. Names are
Japanese vocab so the roster reinforces the lesson.

| Hunter | Weapon | Base HP | Speed | Start passive | Feel |
|--------|--------|---------|-------|---------------|------|
| 後輩 **Kōhai** (junior) | Pocky Shooter | 100 | 220 | — | balanced all-rounder |
| 先生 **Sensei** (teacher) | Otaku Aura | 140 | 184 | +Recovery | tanky crowd-control |
| 浪人 **Rōnin** (wanderer) | Shuriken Storm | 72 | 268 | +Might | fast glass cannon |

## Weapons (per-level base, before passives)

| Weapon | Damage | Cooldown (ms) | Projectiles | Pierce |
|--------|--------|---------------|-------------|--------|
| **Pocky Shooter** (Kōhai) | `13 + 5·(L−1)` | `max(360, 600 − 28·(L−1))` | 1 (+1 @L3, +1 @L6) | 1 (+1 @L4, +1 @L7) |
| **Otaku Aura** (Sensei) | `5 + 3·(L−1)` | `max(480, 900 − 52·(L−1))` | ring hits all in radius | ∞ |
| **Shuriken Storm** (Rōnin) | `7 + 3·(L−1)` | `max(260, 420 − 20·(L−1))` | 2 (→5 by L7), short range | 1 (+1 @L4) |

### Evolutions (the DPS-ceiling lift)

VS-style capstones (`evolvesTo` / `evolveRequires` in `balance.ts`, triggered in
`loadout.ts`). A weapon evolves when **maxed + its required passive maxed +
player level ≥ `EVOLVE_MIN_LEVEL` (40)** — a deliberate *late-game* power spike
(~2× the maxed weapon) that carries you over the final swarm to the boss. Offered
as a priority card on level-up, earned through the Japanese drill like everything.

| Base → Evolved | Requires |
|----------------|----------|
| Pocky Shooter → **Pocky Overdrive** | Might (maxed) |
| Otaku Aura → **Cosmic Otaku Aura** | Area (maxed) |
| Shuriken Storm → **Thousand Cuts** | Speed/ProjSpeed (maxed) |

## Enemy time curve (the difficulty ramp)

Enemies have small base stats × **time multipliers** (t seconds, m = t/60).
**Front-loaded** so pressure builds early, not just at the boss:

```
HP      ×= 1 + 0.30·m + 0.03·m²     // m0=1, m5≈4.3, m10≈8, m15≈13.3, m20≈19
Contact ×= 1 + 0.06·m
Speed   ×= 1 + 0.015·m
XP      ×= 1 + 0.12·m                // gems worth more late, leveling keeps pace
```

Base: RushFan {hp 6, contact 8, speed 70, xp 1}; MerchMule {hp 14, contact 6,
speed 56, xp 3, drops a word-token}.

Spawning ramps faster too: interval `800ms → 200ms` (floors at **10:00**), burst
`1 → 6` (every 3 min, caps 18:00), on-screen cap `60 → 320` (by 16:00),
Merch-Mule share `12% → 32%`.

## The curve (from `tools/balance-sim.ts`)

An "average" build (grade mix 35/45/20 → ~2.15 stacks per level-up) vs. the
enemy curve. After the VS-passive port, front-loaded curve, and **evolutions**:

| Time | Fodder HP | Spawn/s | Single DPS | Clear ratio | Feel |
|------|-----------|---------|-----------|-------------|------|
| 0:00 | 7 | 1 | 22 | 2.5 | one-shots ✓ |
| 5:00 | 24 | 4 | 484 | 11.2 | building |
| 10:00 | 54 | 20 | 753 | 2.2 | hectic (≈220 on screen) |
| 13:00 | — | — | **→1487** | — | **EVOLUTION spike** |
| 15:00 | 100 | 30 | 1487 | 1.6 | pushing through |
| 19:00 | 149 | 35 | 1487 | 0.91 | tense |
| 20:00 | 163 | 35 | 1487 | 0.83 | tense → boss |

- The arc: build → **evolve ~13:00** (DPS roughly doubles) → tense final stretch
  → boss. Boss single-target TTK ≈ **50s**. The run is completable again.
- *Structural note:* the curve's threat grows ~6× from min 10→20, but a 2×
  evolution only lifts you 2×, so the "tense band" can't span the whole back
  half — it's tuned to sit in the final minutes + boss. Pushing tension *earlier*
  (steeper mid curve) trades against reaching the boss; tune by feel.

## Boss — The Ultimate Collector (20:00)

`HP 75,000`, contact 28, slow relentless beeline. An evolved 20-min build does
~1,500 single-target DPS → **~50s fight**. Defeating it = **Stage Clear**.

## Power-ceiling status (was: rebalancing debt — RESOLVED)

VS's tame passive caps capped clear-DPS, which made the run un-completable after
the passive port. **Evolutions fix this**: a maxed weapon + maxed required passive
+ level ≥ 40 evolves into a ~2× form, lifting the ceiling enough to reach and beat
the boss. Remaining levers if we want to shift difficulty further:
- shift `EVOLVE_MIN_LEVEL` (earlier = easier mid-game, later = tenser),
- tune evolved-weapon stats (the ceiling height),
- wire **Curse** as a player-chosen risk/reward difficulty lever (still inert).

Re-run the sim after any change.

## Re-running the simulator

```bash
npx esbuild tools/balance-sim.ts --bundle --platform=node --format=esm \
  --outfile=/tmp/sim.mjs && node /tmp/sim.mjs
```

Edit constants in `balance.ts`, re-run, and read the per-minute table + boss TTK.
