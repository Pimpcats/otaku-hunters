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
| 後輩 Kōhai | `sprites/heroes/kohai/{idle,walk,attack}.png` | per-dir cycles | ☐ missing | wire-on-request |
| 先生 Sensei | `sprites/heroes/sensei/{idle,walk,attack}.png` | per-dir cycles | ☐ missing | wire-on-request |
| 浪人 Rōnin | `sprites/heroes/ronin/{idle,walk,attack}.png` | per-dir cycles | ☐ missing | wire-on-request |

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
| `themepark_floor_tile.png`, `neonstreet_floor_tile.png` | future stages | ☐ missing | needs stage wiring |

## Parallax — `public/textures/parallax/` (wide, tileable, transparent)
| File | Use | Status | Wired |
|---|---|---|---|
| `arcade_far.png` (~1920×200) | far skyline | ☐ (procedural rects) | ✓ |
| `arcade_mid.png` (~1920×300) | mid buildings | ☐ (procedural rects) | ✓ |
| `arcade_near.png` (~1920×350) | near neon | ☐ (procedural rects) | ✓ |

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
