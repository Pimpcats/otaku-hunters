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

## Enemies — `public/sprites/enemies/` (~48×48, faces down, transparent)
| File | Enemy | Status | Wired |
|---|---|---|---|
| `rushfan.png` | Rushing Fan ファン | ☐ (procedural) | single-frame ✓ / sheet wire-on-request |
| `merchmule.png` | Merch-Mule 転売ヤー | ☐ (procedural) | single-frame ✓ |
| `anxious.png` | Shy Fan 陰キャ | ☐ (procedural) | single-frame ✓ |
| `toocool.png` | Cool Fan 陽キャ | ☐ (procedural) | single-frame ✓ |
| `camera.png` | Camera Otaku カメコ | ☐ (procedural) | single-frame ✓ |
| `wota.png` | Idol Stan ヲタ芸 | ☐ (procedural) | single-frame ✓ |
| `lurker.png` | Old Guard 古参 | ☐ (procedural) | single-frame ✓ |
| `glomper.png` | Whale 重課金 | ☐ (procedural) | single-frame ✓ |
| `boss_collector.png` | Ultimate Collector 究極コレクター (~128×128) | ☐ (procedural) | single-frame ✓ |

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
| `arcade_floor_tile.png` | The Arcade floor | ✓ ready | ✓ **active** (`RENDER.floorTexture` on) |
| `floor_placeholder.png` | grayscale paver fallback | ▣ placeholder | yes (used only if the tile is removed) |
| `neonstreet_floor_tile.webp` (1254×1254; uploaded as webp) | Neon-street stage floor | ✓ stored | not wired — no neon-street stage yet (recommend a 512×512 PNG when that stage lands; 1254 is non-power-of-two → no mipmaps) |
| `themepark_floor_tile.png` | Theme-park stage floor | ☐ missing | needs stage wiring |

## Parallax — `public/textures/parallax/` (wide, tileable, transparent)
| File | Use | Status | Wired |
|---|---|---|---|
| `arcade_far.webp` (1920×300) | far skyline | ✓ ready | ✓ **active** (image) |
| `arcade_mid.webp` (1774×887) | mid buildings | ✓ ready | ✓ **active** (image) |
| `arcade_near.webp` (1920×500) | near neon street | ✓ ready | ✓ **active** (image) |

> Toggle `RENDER.useParallaxArt = false` to A/B against the all-procedural look.

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
