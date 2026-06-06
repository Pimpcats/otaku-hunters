# Otaku Hunter — Project Bible (v2)

**This is the standing source of truth for the project.** It supersedes the
original build brief. Read this first. The original
`otaku-hunter-claude-code-brief.md` (the `otakucodebrief` file) is still valid for
the detailed data contract and minigame derivation logic (its §1 and §4) — this
doc captures the current direction, what's built, and what's next.

> **Recent implementation note (visual pass, Track 1A–C):** the neon Edgerunners
> palette, in-engine neon glow, and the Kenney floor/asset drop-in pipeline are now
> built — see the ✅ markers in §2 and §3. The remaining visual gap is real
> environment art (Track A / §4). Keep this doc updated as gaps close.

## 1. What the game is (unchanged core)

A Vampire Survivors–style auto-battler that teaches Japanese. Move-only input,
weapons auto-fire, survive a swarm. The learning happens at level-up: combat
freezes and you build a Japanese sentence via the particle-socket minigame, and how
well you do scales your upgrade. Content comes from `lessons.js` (shared with the
Hanasou study app). Stages = themed environments that double as a curriculum (JLPT
tiers). This core is built and playtested — the loop works; only gameplay tweaks
remain, not a redesign.

Tech: Phaser 3 + Vite + TypeScript, web build, mobile + desktop, deployed to GitHub
Pages (pimpcats.github.io/otaku-hunters). Stays 2D — see §3.

## 2. Current state (what's actually built)

- **Core loop**: auto-attack combat, XP, level-up → particle-socket minigame →
  graded upgrade. Working.
- **Particle-socket minigame**: role-marker/sentence-final/tail handling, tier-scaled
  distractors, recent-particle skew-breaker. Working.
- **4-direction facing**: built (`systems/facing.ts`). Player faces movement
  direction (front/back/side + flip), no free-rotation.
- **Characters** (`data/characters.ts`): 3 playable, named with Japanese vocab so
  the roster itself teaches — 後輩 Kōhai, 先生 Sensei, 浪人 Rōnin. Each = starting
  weapon + passive + playstyle (combat identity only; content is gated by stage, not
  character). Keep this Japanese-naming.
- **Stage**: "The Arcade" (L1 content, enemies RushFan + MerchMule, boss "The
  Ultimate Collector").
- **Enemies** (`entities/enemies/archetypes.ts`): Rushing Fan, Merch-Mule, + the
  Ultimate Collector boss. More archetypes are next-phase.
- **2.5D rendering pass**: built (`data/render.ts`, `systems/backdrop.ts`,
  `systems/shadows.ts`, `ui/atmosphere.ts`). Y-sort, planted drop shadows,
  perspective-tilted ground plane, parallax, vignette/grade — all tunable in
  `RENDER`. The perspective/depth illusion works.
- ✅ **Neon Edgerunners palette** (`data/render.ts`): the dark purple/navy defaults
  are replaced by named, swappable `LOOKS` (`ACTIVE_LOOK`) — `neon` (default: hot
  neon on near-black, electric-cyan grid) and `stardew` (bright daylight alt).
- ✅ **In-engine neon glow** (`ui/atmosphere.ts`): camera post-FX bloom + saturation
  ("everything glows") on WebGL, deeper vignette + saturated grade, optional CRT
  scanline toggle. Gracefully skipped on the Canvas renderer.
- ✅ **Kenney CC0 drop-in pipeline** (`ui/kenneyAssets.ts`): enemies, projectiles,
  pickups, and the floor accept CC0 art dropped into `public/kenney/` with no code
  change; missing files fall back to procedural/placeholder art. See
  `public/kenney/README.md` + `CREDITS.md`.
- ✅ **Themed names + JP-vocab layer** (`data/balance.ts`, `systems/loadout.ts`):
  the otaku/fame skin with a `Vocab` ({jp, romaji, meaning}) label on every weapon,
  passive, the boss, enemies (`ENEMY_VOCAB`), and pickups (`PICKUP_VOCAB`). The
  level-up upgrade cards now render the JP word + meaning, so picking an upgrade
  teaches vocab. Mechanics/numbers unchanged. Bigger mechanical additions (new
  weapons, discrete passive items, Gacha-capsule evolution pickup, behavior-AI
  enemy roster) are staged for next-phase per §5.
- **Placeholder art**: roster sheets wired as the player (`ui/playerSheet.ts`); flat
  front art, doesn't yet match the ¾ camera — expected.

## 3. ★ THE CURRENT DIRECTION: 2.5D neon-anime look ★

This is the active focus and the biggest shift from the original plan. The game's
success depends on visual appeal (it's a learning game — engagement is the
product), so we push hard on look.

**Target look — the precise reference:** *Cyberpunk: Edgerunners* (the anime) for
art/mood + *Stardew Valley* for camera perspective + *Vampire Survivors* for
gameplay.

- **Art & mood (Edgerunners):** neon-drenched, high-saturation, bold color — hot
  magenta/pink, electric cyan, acid yellow, vivid purple, against a dark near-black
  base. High contrast, energetic, everything glows. Gritty-but-vibrant anime, not
  pastel-cute and not moody-gloomy. More vibrant and saturated than generic
  "bright," with strong neon accents and bloom.
- **Camera (Stardew):** a friendly, readable, gently-tilted overhead — high enough
  to see the full 360° swarm. **NOT** a low/dramatic Hades angle (that breaks swarm
  readability); the earlier "Hades" framing is superseded. Stardew's readable tilt
  is the target; Edgerunners supplies the color, not the camera.
- **Technique:** 2.5D depth illusion (fake 3D via 2D techniques). NOT real 3D, NOT
  an engine change, NOT a new art pipeline.

**Hard rules (these don't change):**

- Stay Phaser 2D. Depth is illusion, never real 3D models.
- Sprites stay upright billboards. Tilt the world/ground; never skew/rotate the
  pixel sprites onto the floor (keeps the pixel art crisp).
- Preserve VS swarm readability — camera tilt stays at the Stardew "see everything"
  level, never so steep the swarm hides. Every depth value tunable in `RENDER`.
- Hold frame rate with 40+ enemies.

**Where the 2.5D stands now:** the perspective machinery is built and good — tilted
floor, vanishing point, y-sort, shadows. The palette + glow gaps are now closed; the
default look is the glowing electric-cyan perspective grid on near-black with bloom.
What remains for the full lush Edgerunners feel is real environment art to "wear."

**The gaps, in order:**

1. ✅ **Palette → neon Edgerunners.** `RENDER` colors moved from dark purple/navy to
   a dark base + hot neon accents, as named swappable `LOOKS`. Pure config.
2. ✅ **Neon glow / atmosphere (in-engine code).** Bloom on bright elements + a
   saturation boost (camera post-FX), deeper vignette + saturated grade, optional
   scanline toggle. All tunable in `RENDER`; WebGL-only, safe on Canvas.
3. ⏳ **Floor texture.** The tiling-texture path + Kenney floor drop-in are fully
   wired (`RENDER.floorTexture` toggle; `public/kenney/floor.png`). Kept **off by
   default** so the striking neon wireframe grid (gaps 1–2 payoff) shows; flip on
   once a dark/tech/neon CC0 tile is dropped in. Needs the actual tile (Track A).
4. ⏳ **Environment art.** Real neon-city background/parallax art (skyline
   silhouettes, signage glow) to replace the placeholder rectangles. Delivers the
   lush look; comes from the art pipeline (§4), not code.

> Palette + glow (gaps 1–2) were pure config/code, needed no art, and get most of
> the way to the Edgerunners feel on their own. Judge them in playtest before
> investing in environment art.

## 4. Art pipeline (who does what — CRITICAL distinction)

Claude Code **cannot generate art.** It writes code, wires art in, and builds
art-processing tools. Actual art assets come from elsewhere. Two tracks:

**Track A — Art generation (human + AI image tools / asset sources). Not Claude Code.**

- Character/enemy sprites: AI image tools, detailed pixel art at a ¾ Stardew-tilted
  camera angle, neon Edgerunners palette (dark base + hot neon accents, glow).
  Finished (transparent, despeckle, slice to grid) before going in.
- Environment art: neon-city background/parallax (skyline silhouettes, glowing
  signage) + floor textures in the Edgerunners look.
- Placeholder art: free CC0 from Kenney.nl (preferred — public domain), or
  itch.io/OpenGameArt with license-checking. Always record source + license in
  `CREDITS.md`.

**Track B — Integration + tools (Claude Code).**

- Wiring sprite sheets into the 4-direction system (frame dimensions must be given
  explicitly — Claude Code can't infer grid slicing from the image).
- Applying floor/background textures to the perspective plane.
- Bonus tool — `tools/process-sheet.ts`: a CLI that takes a raw AI sprite sheet →
  keys background transparent → despeckles → slices to a uniform grid → exports
  game-ready frames. **Not yet built — "when convenient."**

Standing rule: any externally-sourced asset must be CC0 or clearly license-compatible,
with source + license recorded in `CREDITS.md`. Placeholder ≠ shippable unless the
license allows it.

## 5. Next-phase priorities (after the visual pass)

In rough order; confirm before starting each:

1. Close the 2.5D look gaps (§3), in order. **Palette + glow are done**; next is the
   floor texture (needs a CC0 tile) then real neon-city environment art.
2. More enemy archetypes — behavior-based AI: the Anxious One (rushes then flees),
   the Too-Cool One (backwards swagger), Camera Gremlin, Idol-Wota, Lurker, Glomper.
   (Full roster + behaviors in original brief §6.)
3. Second stage (Theme Park, or a neon-street stage leaning into the Edgerunners
   look) to prove the stage-config system with different content + tileset + enemy
   table.
4. Puzzle Tiers B & C (place+particle, full assembly) — Tier A is built.
5. Gameplay tweaks from playtesting (loop pacing, difficulty curve — minor).
6. Later/hold: the "haunting" SRS requeue mechanic, meta-shop/permanent upgrades,
   more characters, bosses beyond the Collector.
7. Content verification tools (JMdict audit + teacher-review export) — deferred,
   non-blocking. See original brief §11.

## 6. Guardrails (unchanged, still in force)

- Combat is auto; learning is the level-up. Don't turn combat into a quiz.
- No run-ending fail in the minigame — it only scales rewards up by degree; wrong =
  smaller bonus, framed as bonus-missed, never punishment.
- The minigame must require knowing the Japanese, not color/shape matching.
  English/audio prompt only; never show the JP answer.
- Content is plug-and-play; verification NEVER blocks the game. One malformed entry
  skips gracefully — the game runs on whatever's in `lessons.js`.
- Stages and characters are data, not code.
- Visual work is rendering-only — never break the working combat/learning loop to
  make it prettier.

## 7. Working agreement with Claude Code

- Build in tunable, sequenced layers; let the human dial values in playtest rather
  than baking them.
- For any milestone: confirm the plan, build, keep the build green, PR as usual,
  note any external asset licenses in the PR.
- Don't sprint ahead to deferred scope. Close the current visual gaps first.
- When given a new sprite sheet: it's a placeholder swap via texture keys — never a
  logic change.
