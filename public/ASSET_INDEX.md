# Asset index — master tracker

Every art/audio asset the game can use, where it goes, its spec, and status. Use
this as your working checklist while generating art.

**Status legend:** ✓ ready (real art in place) · ▣ placeholder (procedural/legacy
stand-in works) · ☐ missing (drop zone empty).

**How a file gets used:**
1. Drop it at the exact path below (each folder's `README.md` has the format spec).
2. For floor / parallax / enemies / weapons / pickups: **add its path (relative to
   `public/`) to `public/art-manifest.json`** — the loader only requests listed
   files, so unfilled slots never 404.
3. Audio uses its own `public/audio/manifest.json`.
4. Items marked **wire-on-request** need a small code change (animation/UI) — drop
   the file, tell me, and I'll wire it (share sheet grid dims for animations).

---

## Audio — `public/audio/`
| Asset | Path | Spec | Status |
|---|---|---|---|
| Voice clips + manifest | `audio/*.mp3` + `audio/manifest.json` | VOICEVOX (四国めたん), mapped by JP text | ✓ ready (342/483 strings) |

## Heroes — `public/sprites/heroes/` (64×64/frame, 4-dir, transparent)
| Character | Path | Sheets | Status | Wired |
|---|---|---|---|---|
| Legacy roster | `sprites/heroes/_legacy/roster_sheet.webp` | 8×4 @192×256 (Kōhai, Sensei) | ▣ placeholder | yes |
| Legacy goth | `sprites/heroes/_legacy/goth_girl.webp` | 6×3 @256×341 (Rōnin) | ▣ placeholder | yes |
| 後輩 Kōhai | `sprites/heroes/kohai/kohai_4dir_transparent.webp` | 4-dir static (1536×1024 sheet, rect-sliced) | ✓ **ready/active** | yes — down/up/side+flip, ~60px |
| 先生 Sensei | `sprites/heroes/sensei/sensei_4dir_transparent.webp` | 4-dir static (1536×1024 sheet, rect-sliced) | ✓ **ready/active** | yes — down/up/side+flip, ~60px |
| 浪人 Rōnin | `sprites/heroes/ronin/ronin_4dir_transparent.webp` | 4-dir static (1536×1024 sheet, rect-sliced) | ✓ **ready/active** | yes — down/up/side+flip, ~60px |

## Enemies — `public/sprites/enemies/` (green-screen 4-view sheets ~1983×793, sliced)
| File | Enemy | Status | Wired |
|---|---|---|---|
| `rushfan_4dir.png` | Rushing Fan ファン (red hoodie) | ✓ **ready/active** | green-screen 4-view sheet, keyed + rect-sliced ~46px (static fallback) |
| `rushfan_walk.webp` | Rushing Fan ファン — **8-DIR WALK animation** | ✓ **ready/active** | 8×4 sheet → baked walk anims for all 8 directions (down/up/left/right + 4 diagonals @ ~10fps); standard facing. First 8-direction enemy. |
| `merchmule_4dir.png` | Merch-Mule 転売ヤー (gold jacket) | ✓ **ready/active** | green-screen 4-view sheet, keyed ~50px (bulkier) |
| `anxious_4dir.png` | Shy Fan 陰キャ (dark-blue hoodie) | ✓ **ready/active** | green-screen 4-view sheet, keyed ~46px |
| `toocool_4dir.png` | Cool Fan 陽キャ (purple jacket) | ✓ **ready/active** | green-screen 4-view sheet, keyed ~46px (static fallback) |
| `toocool_walk.webp` | Cool Fan 陽キャ — **WALK animation** | ✓ **ready/active** | 4×4 @313 sheet → baked walk anims (~8fps); **reversed facing** (walks backwards — moving toward you shows his back) |
| `camera_4dir.png` | Camera Otaku カメコ (teal, crouching) | ✓ **ready/active** | green-screen 4-view sheet, keyed ~46px |
| `wota_4dir.png` | Idol Stan ヲタ芸 (white happi) | ✓ **ready/active** | green-screen 4-view sheet, keyed ~46px |
| `lurker_4dir.png` | Old Guard 古参 (olive jacket) | ✓ **ready/active** | green-screen 4-view sheet, keyed ~46px (grows with buff) |
| `glomper_4dir.png` | Whale 重課金 (hot-pink, huge) | ✓ **ready/active** | green-screen 4-view sheet, keyed ~46px × **scale 1.4** (biggest non-boss) |
| `boss_collector_4dir.png` | Ultimate Collector 究極コレクター | ✓ **ready/active** | green-screen **3-phase × 4-view** sheet; **phase-1 row** wired ~88px (phases 2–3 await roadmap Phase 4) |

## Weapons / projectiles — `public/sprites/weapons/` (16–32px, transparent)
| File | Use | Status | Wired |
|---|---|---|---|
| `pocky.png` | Kōhai bolt お菓子 (white→tinted, ~20×8) | ☐ (procedural) | ✓ |
| `shuriken.png` | Rōnin shuriken 手裏剣 (white→tinted, ~16×16) | ☐ (procedural) | ✓ |
| `bullet.png` | Generic bolt (white→tinted, ~10×10) | ☐ (procedural) | ✓ |
| `pensaki_bolt`, `mozoto_blade`, `penraito_glow`, `flash_burst`, `sain_photo`, `guzzu_box`, `supacha_bullet`, `oen_wave`, `evo_*` | future weapons | ☐ missing | wire-on-request (no weapon yet) |

## Pickups — `public/sprites/pickups/` (~16×16, transparent)
| File | Use | Status | Wired |
|---|---|---|---|
| `heart_xp.png` | XP heart ハート | ☐ (procedural) | ✓ |
| `word_tango.png` | Word tile 単語 | ☐ (procedural) | ✓ |
| `gacha_capsule.png` | ガチャ capsule | ☐ (procedural) | ✓ |
| `yen_coin.png` | coin 円 (future economy) | ☐ missing | wire-on-request |
| `miren_spirit.png` | 未練 SRS spirit (future) | ☐ missing | wire-on-request |

## Floor — `public/textures/floors/` (512×512 seamless)
| File | Use | Status | Wired |
|---|---|---|---|
| `arcade_floor_tile.png` | The Arcade floor | ✓ stored | ☐ OFF — has baked perspective; procedural TRON grid active (`floorTexture=false`). Flip on with a FLAT seamless tile. |
| `floor_placeholder.png` | grayscale paver fallback | ▣ placeholder | yes (used only if the tile is removed) |
| `neon_street_tile_a.webp` (512×512) | Neon Street floor variant A (manhole, cyan puddle) | ✓ ready | ✓ wired (variant atlas) |
| `neon_street_tile_b.webp` (512×512) | Neon Street floor variant B (magenta glow, sewer grate, stickers) | ✓ ready | ✓ wired (variant atlas) |
| `neon_street_tile_c.webp` (512×512) | Neon Street floor variant C (yellow chevrons, drainage gutter) | ✓ ready | ✓ wired (variant atlas) |
| `neon_street_tile_d.webp` (512×512) | Neon Street floor variant D (crosswalk stripes, pins, puddles) | ✓ ready | ✓ wired (variant atlas) |
| `neonstreet_floor_tile.webp` (1254×1254) | (older single neon-street tile) | ✓ stored | superseded by the A–D variant set above |
| `themepark_floor_tile.png` | Theme-park stage floor | ☐ missing | needs stage wiring |

> **Neon Street multi-tile floor:** when `RENDER.floorTexture` **and** `RENDER.floorTileVariants`
> are both on (now the case), the floor mesh composes an N×N atlas (`floorVariantAtlas`,
> default 4×4) where each cell deterministically picks one of the A–D tiles (seeded by cell
> position) — killing the single-tile repeat. **Now ACTIVE on the Arcade** (replaces the
> procedural neon grid). Tiles haze to the dark floor palette toward the horizon (tunable via
> `floorFar` / the mesh fade). Set both flags false to return to the procedural TRON grid.

## Parallax — `public/textures/parallax/` (wide, tileable, transparent)
| File | Use | Status | Wired |
|---|---|---|---|
| `arcade_far.webp` (1920×1000) | far skyline | ✓ ready | ✓ active (opaque) |
| `arcade_mid.webp` (1920×960) | mid storefronts | ✓ ready | ✓ active (opaque) |
| `arcade_near.webp` (1920×1024) | near arcade street | ✓ ready | ✓ **active** (front; fills the band) |

> Toggle `RENDER.useParallaxArt = false` to A/B against the all-procedural look.
> The parallax skyline now renders on a separate **BackgroundScene** (un-zoomed) behind
> the zoomed gameplay so it never pixelates — it reads as the distant skyline peeking
> over the world-space street props.

## Street props — `public/sprites/props/` (world-space corridor dressing)
World-space neon props (`systems/streetProps.ts`) line repeating street corridors so the
player runs THROUGH a neighbourhood. Manifest-gated like the walk sheets; absent files
fall back to procedural neon-rectangle placeholders, so the spatial layout is tunable now
(`RENDER.streetWidth / propDensity / propScale / foregroundOccluderAlpha`) and art swaps
in with no layout change.

Placement (`systems/streetProps.ts`): TALL props line the FAR storefront edge (y-sorted),
SHORT props occlude on the NEAR edge (`foregroundOccluderAlpha`), and lanterns hang
OVERHEAD (fixed high depth, not y-sorted). All are wired but **awaiting binaries** — the
art was delivered as inline previews, which Claude Code can't write to disk; each PNG must
be committed to the repo, then added to `art-manifest.json` (placeholder shows until both).

| File | Use | Sheet spec → anim(s) | Edge |
|---|---|---|---|
| `prop_vending_machine.png` | 自販機 vending machine (trim cycles, can drops) | 2048×768, 4×(512×768) → `prop_vending_idle` @3 | far |
| `prop_arcade_cabinet.png` | arcade cabinet (attract-mode screen) | 2001×786, 4×(500×786) → `prop_arcade_idle` @2 | far |
| `prop_lanterns.png` | 祭 festival lanterns (sway) | 2048×768, 4×(512×768) → `prop_lanterns_idle` @2 | overhead |
| `prop_neon_signs.png` | 3 signs in one sheet | 1536×1024, 3 rows×4 cols (384×341) → `sign_gesen` 0–3, `sign_karaoke` 4–7, `sign_ramen` 8–11 @3 | far |
| `prop_power_pole.png` | power pole + wires (高圧注意) | 400×646 static | far |
| `prop_railing.png` | street barrier/railing | 343×300 static | near |
| `prop_cat_trashcan.png` | trash can + black cat (不法投棄) | 350×427 static | near |
| `prop_crates.png` | stacked crates (われもの注意) | 437×400 static | near |
| `prop_bicycle.png` | parked bicycle (駐輪禁止) | 450×396 static | near |
| `prop_sale_sign.png` | A-frame neon セール sign | 303×500 static | near |
| `facade_anime_shop.png` | アニメ shop storefront | 768×512 static | back wall |
| `facade_game_center.png` | ゲーセン storefront | 768×512 static | back wall |
| `facade_karaoke.png` | カラオケ storefront | 768×512 static | back wall |
| `facade_konbini.png` | コンビニ storefront | 768×512 static | back wall |

> **Facade back wall** (`systems/facadeWall.ts`): the 4 front-view facades tile a continuous,
> pooled storefront wall along each street seam — world-space (zooms + scrolls 1:1 with the
> camera), depth-banded BEHIND entities/props and IN FRONT of the parallax. Until the PNGs
> land, 4 procedural placeholder facades stand in.

> To activate any prop: commit the PNG to `public/sprites/props/<file>` and add its path to
> `public/art-manifest.json`. The loader (`ui/props.ts`) slices it (spritesheets) + registers
> its anim(s); `StreetProps` then uses the real animated/static sprite instead of the
> procedural placeholder automatically — no layout change.

## UI — `public/ui/` (transparent) — all **wire-on-request** (HUD is procedural today)
| Folder | Files | Spec | Status |
|---|---|---|---|
| `ui/icons/` | `oshi, bpm, aura, doujinshi, kyakko, heijoshin, sunika, karisuma, eiyo_drink`.png | 32×32 passive icons | ☐ missing |
| `ui/frames/` | `levelup_panel.png`, `upgrade_card.png` | panel/card art | ☐ missing |
| `ui/bars/` | `hp_bar.png`, `xp_bar.png` | bar art | ☐ missing |
| `ui/title/` | `logo.png`, `levelup_text.png` | title treatments | ☐ missing |

---

**House style (all art):** detailed pixel art, ¾ Stardew-tilted angle, neon
Edgerunners palette (dark base + hot neon accents, glow), finished transparent.
Record any externally-sourced asset's source + license in `CREDITS.md`. Full
per-slot detail in `ART.md`.
