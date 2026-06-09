# Asset Credits & Licenses

A running record of every art/audio asset that isn't original game code, what it
is, where it came from, and its license — so it's always clear what's placeholder
and what's safe to ship.

| Asset | Path | Source | License | Notes |
|-------|------|--------|---------|-------|
| Arcade floor tile | `public/textures/floors/arcade_floor_tile.png` | Provided by the project owner (original art) | Owned / original | 512×512 neon tech-grid tile. **Inactive** — it has perspective baked in (conflicts with the mesh recession), so `RENDER.floorTexture=false` and the procedural neon TRON grid is used. Re-enable with a FLAT top-down seamless tile. |
| Neon-street floor tile | `public/textures/floors/neonstreet_floor_tile.webp` | Provided by the project owner (original art) | Owned / original | 1254×1254 webp. Superseded by the A–D variant set below. |
| Neon Street floor variants A–D | `public/textures/floors/neon_street_tile_{a,b,c,d}.webp` | Provided by the project owner (original art) | Owned / original | 512×512 flat top-down tiles (uploaded as .png, actually webp), clean/unlabelled. Composed into an N×N atlas (deterministic per-cell pick) when `RENDER.floorTileVariants` is on, for the Neon Street stage. A=manhole/cyan puddle, B=sewer grate/magenta, C=yellow chevrons/gutter, D=crosswalk/pins. |
| Outdoor street floor A–D | `public/textures/floors/floor_street_{a,b,c,d}.png` | Provided by the project owner (original art) | Owned / original | 512×512 seamless flat top-down tiles (edge diff <1.5). **Active** — supersede the neon_street set as the variant-atlas source (`backdrop.OUTDOOR_FLOOR_KEYS`). A=crosswalk/magenta/orange lane, B=manhole/cyan/confetti, C=manhole/faded crosswalk/purple, D=yellow center line/pink+cyan/litter. |
| Street props (animated) | `public/sprites/props/prop_{vending_machine,arcade_cabinet,lanterns,neon_signs}.png` | Provided by the project owner (original art) | Owned / original | Spritesheets: vending 2048×768 4×(512×768)→`prop_vending_idle`@3; arcade 2001×786 4×(500×786)→`prop_arcade_idle`@2; lanterns 2048×768 4×(512×768)→`prop_lanterns_idle`@2 (overhead); neon_signs 1536×1024 3×4(384×341)→`sign_gesen/karaoke/ramen`@3. |
| Street props (static) | `public/sprites/props/prop_{power_pole,railing,cat_trashcan,crates,bicycle,sale_sign}.png` | Provided by the project owner (original art) | Owned / original | Single images along the street edges (`systems/streetProps.ts`): power pole 400×646, railing 343×300, cat trashcan 350×427, crates 437×400, bicycle 450×396, sale sign 303×500. |
| Building facades | `public/sprites/props/facade_{anime_shop,game_center,karaoke,konbini}.png` | Provided by the project owner (original art) | Owned / original | 768×512 front-view storefronts tiled as the street back wall (`systems/facadeWall.ts`). NOTE: a baked Ⓐ/Ⓑ/Ⓒ/Ⓓ corner identifier shows in-game — re-export clean. |
| Arcade far parallax | `public/textures/parallax/arcade_far.webp` | Provided by the project owner (original art) | Owned / original | 1920×1000 distant skyline with **transparent sky**. Far parallax layer (back; fills the band, sky shows the gradient). |
| AnxiousOne enemy (4-dir) | `public/sprites/enemies/anxious_4dir.png` | Provided by the project owner (original art) | Owned / original | 1983×793 green-screen 4-view sheet (陰キャ, dark-blue hoodie); keyed + rect-sliced ~46px. Color-updated v2. |
| CameraGremlin enemy (4-dir) | `public/sprites/enemies/camera_4dir.png` | Provided by the project owner (original art) | Owned / original | 1983×793 green-screen 4-view sheet (カメコ, teal, crouching paparazzo); keyed + rect-sliced ~46px. Color-updated v2. |
| IdolWota enemy (4-dir) | `public/sprites/enemies/wota_4dir.png` | Provided by the project owner (original art) | Owned / original | 1981×793 green-screen 4-view sheet (ヲタ芸, white happi, glowsticks); keyed + rect-sliced ~46px. Color-updated v2. |
| Lurker enemy (4-dir) | `public/sprites/enemies/lurker_4dir.png` | Provided by the project owner (original art) | Owned / original | 1983×793 green-screen 4-view sheet (古参, olive jacket); keyed + rect-sliced ~46px. Color-updated v2. |
| TooCool enemy (4-dir) | `public/sprites/enemies/toocool_4dir.png` | Provided by the project owner (original art) | Owned / original | 1983×793 green-screen 4-view sheet (陽キャ, purple jacket, swagger); keyed + rect-sliced ~46px. Color-updated v2. |
| RushFan enemy (4-dir) | `public/sprites/enemies/rushfan_4dir.png` | Provided by the project owner (original art) | Owned / original | 1983×793 green-screen 4-view sheet (red hoodie); keyed + rect-sliced to down/up/side (+flip), ~46px. Color-updated v2. |
| MerchMule enemy (4-dir) | `public/sprites/enemies/merchmule_4dir.png` | Provided by the project owner (original art) | Owned / original | 1983×793 green-screen 4-view sheet (gold jacket, merch bags); keyed ~50px (bulkier). Color-updated v2. |
| Glomper enemy (4-dir) | `public/sprites/enemies/glomper_4dir.png` | Provided by the project owner (original art) | Owned / original | 1983×793 green-screen 4-view sheet (重課金, hot-pink whale); keyed + rect-sliced ~46px × scale 1.4 (biggest non-boss). |
| RushFan 8-dir walk anim | `public/sprites/enemies/rushfan_walk.webp` | Provided by the project owner (original art) | Owned / original | Transparent 8×4 walk sheet (uploaded 1254×2508, stored 1000×2000); baked to all-8-direction walk anims (~10fps). Replaces the earlier 4-dir version. |
| TooCool walk anim | `public/sprites/enemies/toocool_walk.webp` | Provided by the project owner (original art) | Owned / original | 1254×1254 transparent 4×4 walk sheet (313px frames); baked to per-direction walk anims (~8fps), reversed facing (walks backwards). |
| Ultimate Collector boss (3-phase) | `public/sprites/enemies/boss_collector_4dir.png` | Provided by the project owner (original art) | Owned / original | 1983×793 green-screen sheet, **3 phase-rows × 4 views** (white/silver, rainbow merch). Phase 1 (y26–260) wired ~88px; phases 2–3 (y278–519 / y538–780) await the multi-phase boss (roadmap Phase 4). |
| Rōnin 4-dir character | `public/sprites/heroes/ronin/ronin_4dir_transparent.webp` | Provided by the project owner (original art) | Owned / original | 1536×1024 transparent sheet, 4 views. Rect-sliced to down/up/side (+flip), ~60px in-game. **Active** as 浪人 Rōnin. |
| Sensei 4-dir character | `public/sprites/heroes/sensei/sensei_4dir_transparent.webp` | Provided by the project owner (original art) | Owned / original | 1536×1024 transparent sheet, 4 views. Rect-sliced to down/up/side (+flip), ~60px in-game. **Active** as 先生 Sensei. |
| Kōhai 4-dir character | `public/sprites/heroes/kohai/kohai_4dir_transparent.webp` | Provided by the project owner (original art) | Owned / original | 1536×1024 transparent sheet, 4 views (front/back/side-L/side-R). Rect-sliced to down/up/side (+flip), ~60px in-game. **Active** as 後輩 Kōhai. |
| Arcade mid parallax | `public/textures/parallax/arcade_mid.webp` | Provided by the project owner (original art) | Owned / original | 1920×960 storefronts with **transparent sky**. Mid parallax layer (bottom-anchored, ~0.82 band → far skyline shows above it). |
| Arcade near parallax | `public/textures/parallax/arcade_near.webp` | Provided by the project owner (original art) | Owned / original | 1920×1024 neon arcade street (opaque foreground). Near parallax layer (bottom-anchored at the seam, ~0.6 band → mid + far read as stacked depth planes above it). Layers compose far→mid→near via `RENDER.parallaxHeight`. |
| Floor tile (placeholder) | `public/textures/floors/floor_placeholder.png` | Procedurally generated for this repo (`tools`/build script) | CC0 / public domain (owned) | **Stand-in.** The brief asked for a CC0 tile from [kenney.nl](https://kenney.nl/assets) (e.g. a tile/pavement pattern), but this sandbox's network policy blocks outbound to `kenney.nl` (`403 host_not_allowed`), so a seamless 128×128 grayscale paver was generated in-engine instead. It's grayscale on purpose — the floor mesh tints it with the in-game `RENDER.floorNear`/`floorFar` palette. To swap in a real Kenney tile later, just replace this file (keep it seamless/tileable; power-of-two like 128×128 or 256×256 so it repeats), update this row, and no code changes are needed. |

## Art drop-in slots — wired, not yet filled
A general drop-in pipeline backs the floor, parallax skyline, enemies, projectiles,
and pickups (`src/ui/kenneyAssets.ts`; loaded in `BootScene`). Files go in the
semantic folders under `public/` (`textures/floors`, `textures/parallax`,
`sprites/enemies`, `sprites/weapons`, `sprites/pickups`) and are picked up with **no
code change** once their path is listed in `public/art-manifest.json`; any missing
file falls back to procedural/placeholder art. The full per-slot list, sizes, and
status live in [`public/ASSET_INDEX.md`](./public/ASSET_INDEX.md) and the per-folder
READMEs (spec) + [`ART.md`](./ART.md) (production guide).

These slots are **empty today** (procedural art in use). **When you add a real file,
record its source + license here** before committing (AI-generated → note the tool;
externally-sourced → CC0 / license-compatible only).

## Audio
Voice clips generated with [VOICEVOX](https://voicevox.hiroshiba.jp/) — free, open-source Japanese text-to-speech. Each character has their own voice:

- 後輩 **Kōhai** — 四国めたん (Shikoku Metan), あまあま/sweet style (speaker id 0)
- 先生 **Sensei** — No.7, ノーマル/Normal style (speaker id 29)
- 浪人 **Rōnin** — 中部つるぎ (Chubu Tsurugi), ノーマル/Normal style (speaker id 94)

VOICEVOX is provided under the LGPL license. Individual character voice terms apply — see https://voicevox.hiroshiba.jp/ for details.

Clips live in `public/audio/` with a `manifest.json` (`{ "clips": { "<jp>": { "n", "s"? } } }`)
mapping each Japanese string to its normal/slow filename. The game plays the matching
clip for word pickups, chip placement, particle selection, and full-sentence solves,
falling back to the device Web Speech API for any line without a clip (`src/audio/tts.ts`).
Clips are (re)generated locally with `tools/generate-audio.ts` against a local VOICEVOX
engine — a dev tool only, never a build/runtime dependency.

## Standing rule
Any externally-sourced asset (or procedural stand-in for one) gets a row here with
its **source URL** and **license** before it's committed. CC0 / public-domain only
for placeholders unless a license is explicitly cleared — no attribution-required
or non-commercial assets.
