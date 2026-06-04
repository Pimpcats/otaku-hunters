# Otaku Hunter

A *Vampire Survivors*–style auto-battler that teaches Japanese on the level-up
screen. Survive the swarm with move-only input + auto-attack; every level-up
opens a **particle-socket minigame** built from the words you collected this
run. Correctness scales your upgrade — as a bonus, never a penalty.

Built with **Phaser 3 + Vite + TypeScript**. Runs in the browser on desktop and
mobile, installable as a PWA.

> This is the **§10 vertical slice**: one playable Arcade run — move, auto-kill a
> swarm of Rushing Fans + Merch-Mules, collect word-tokens, and hit a level-up
> that opens the **Tier-A** (particle-only) minigame drawn from your collected
> words. Stages/characters/bosses, Tiers B–C, the "haunting" SRS mechanic, and
> the meta-shop build outward from here.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
```

Move: **WASD / arrows**, **hold-mouse** toward the cursor, or **drag** anywhere
(virtual joystick) on touch. Weapons auto-fire — there is no aim or attack
button.

## How it teaches (the centerpiece)

On level-up, combat freezes and you get one sentence to build. In Tier-A the
role words are shown in order with **one particle blanked**; you pick the right
one (e.g. は vs が vs を) from distractors drawn only from particles the corpus
actually uses. The English prompt is shown; the Japanese answer never is. Get it
first try → **full** upgrade; with a retry → **partial**; skip/timeout → a small
**heal** (never nothing). See the design brief for the full spec.

## Content

All Japanese is **consumed**, never authored here. `src/data/lessons.js` is the
single source (copied from the Hanasou study app). Dropping in new/updated
content requires nothing more than editing that file — a single malformed entry
is skipped gracefully and never blocks the rest (e.g. `because#4`, whose tokens
don't rebuild its sentence, is excluded as a puzzle target but its words still
spawn as pickups).

`window.LEVELS` + `window.LESSONS` are indexed at boot into game-ready
sentences with derived role-words, particles, verb anchor, difficulty, and an
eligibility flag (`src/data/contentIndex.ts`).

## Project layout

```
src/
  data/        lessons.js (source) · contentIndex · stages · particles-meta · types
               balance.ts (all difficulty/power numbers — see BALANCE.md)
  scenes/      Boot · Meta · Run (the VS loop) · LevelUp (puzzle + 1-of-3 upgrade)
  systems/     input · weapons (WeaponManager) · spawner · puzzle · srs
               loadout.ts (upgrade pool + derived player stats)
  entities/    enemies/archetypes (RushFan, MerchMule, UltimateCollector boss)
  ui/          textures (placeholder art) · hud
  audio/       tts (Web Speech fallback)
tools/         balance-sim.ts (offline difficulty simulator, not shipped)
```

## Difficulty & upgrades

Vampire-Survivors-style balance, all tunable in **`src/data/balance.ts`** and
verified with a simulator (`tools/balance-sim.ts`). Each level-up you **pick 1 of
3 upgrades** (weapons + passives that stack additively within a stat,
multiplicatively across), and your **minigame grade scales the stacks**
(got_it ×3 / kinda ×2 / nope ×1 + heal). Enemies scale on a time curve — one-shots
at 0:00, a packed screen by 20:00, when **The Ultimate Collector** boss arrives.
Full write-up in [`BALANCE.md`](./BALANCE.md).

Art and audio are placeholders (procedural shapes + device TTS) — real assets
drop in by replacing texture keys and wiring audio clips, no gameplay changes.
