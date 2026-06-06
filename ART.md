# Otaku Hunter — Art production guide (Track A)

Every art slot in the game is **wired and optional**: drop a correctly-named,
correctly-sized file in and it appears with **no code change**; leave it out and the
game uses procedural placeholder art. This doc is the single spec of *what to make*.

**House style (all assets):** detailed pixel art, ¾ Stardew-tilted camera angle,
**neon Edgerunners palette** — dark near-black base with hot neon accents (electric
cyan, hot magenta/pink, acid yellow, vivid purple), strong glow. Finish each asset
(background → transparent, despeckle, slice to grid) before dropping it in.

> Sandbox note: Claude Code can't generate art and can't reach `kenney.nl` from the
> web sandbox. Produce/finish art on your machine, drop it in, and commit.

---

## 1. Player characters — animated sheets
**Where:** `public/<sheet>.webp` · **Wiring:** `src/ui/playerSheet.ts` (`SHEETS`)

Characters need real multi-frame **walk cycles**, so they use sprite sheets (not the
Kenney single-image path). Each sheet entry declares `frameWidth/frameHeight`, the
per-facing frame indices (`down/up/side`), and optional `walk` frame lists. To add a
character sheet you (or I) edit the `SHEETS` array with the **exact grid dimensions**
— Claude Code can't infer slicing from the image, so give the frame size explicitly.

- Facings: front (down), back (up), side (left = flipped side).
- Drop the file in `public/`, then tell me the grid (cols×rows, cell px) and which
  frames map to each facing + walk cycle, and I'll wire it.

## 2. Enemies — single directional image
**Where:** `public/kenney/<name>.png` + list in `public/kenney/manifest.json`
**Wiring:** `src/ui/kenneyAssets.ts` (baked onto `${base}_down|_up|_side`)

| File | Enemy | Size (transparent, faces down) |
|---|---|---|
| `rush_fan.png` | Rushing Fan (ファン) | ~20px |
| `merch_mule.png` | Merch-Mule (転売ヤー) | ~24px |
| `boss.png` | The Ultimate Collector (究極コレクター) | ~28px |
| *(roster)* | Shy Fan 陰キャ / Cool Fan 陽キャ / Camera Otaku カメコ / Idol Stan ヲタ芸 / Old Guard 古参 / Whale 重課金 | match their `ENEMY_BASE` sizes (~20–28px) |

One front-facing image is mirrored to the 3 facings (left = flipped side). For true
directional walk cycles, use the character-sheet pattern (§1) instead.

## 3. Projectiles — single image (tinted in-engine)
**Where:** `public/kenney/<name>.png` + manifest · **Wiring:** `kenneyAssets.ts`

Draw **white/grayscale on transparent** so the weapon colour tints them.

| File | Projectile | Size |
|---|---|---|
| `pocky.png` | Pocky stick (points +x) | ~20×8px |
| `shuriken.png` | Shuriken (spun in-engine) | ~16×16px square |
| `bullet.png` | Generic bolt | ~10×10px |

## 4. Pickups — single image
**Where:** `public/kenney/<name>.png` + manifest · **Wiring:** `kenneyAssets.ts`

| File | Pickup | Size |
|---|---|---|
| `xp_gem.png` | XP heart / fan-love (ハート) | ~10–16px |
| `word_token.png` | Word tile (単語) | ~16×16px |
| `gacha.png` | ガチャ evolution capsule | ~16–18px |

## 5. Floor — seamless tile
**Where:** `public/kenney/floor.png` + manifest · **Wiring:** `kenneyAssets.ts` → `backdrop.ts`

**Seamless + power-of-two** (128×128 or 256×256). Grayscale tiles best (the floor
mesh tints it with `RENDER.floorNear/floorFar`); dark/tech/neon-grid suits the look.
After adding, flip `RENDER.floorTexture = true` to swap the wireframe grid for it.

## 6. Neon-city parallax — skyline layers
**Where:** `public/kenney/parallax_{far,mid,near}.png` + manifest
**Wiring:** `kenneyAssets.ts` → `src/systems/backdrop.ts` (`PARALLAX_KEYS`)

Horizontally **tileable**, **transparent** above the rooftops. Rendered as scrolling
layers anchored at the horizon (far drifts slowest). Far → near = hazier/shorter →
bolder/taller.

| File | Layer | Suggested size |
|---|---|---|
| `parallax_far.png` | distant, hazy towers | ~960×220 |
| `parallax_mid.png` | buildings + signage glow | ~960×260 |
| `parallax_near.png` | tallest, boldest neon | ~960×320 |

The skyline only shows where there's a back-wall band (it sits on the horizon), so
its prominence scales with `RENDER.groundTilt` / `RENDER.horizonFrac` — raise those
in `src/data/render.ts` if you want more sky for the city to fill.

---

## Manifests (so missing files never 404)
- **`public/kenney/manifest.json`** — list every Kenney/art filename you've added
  (enemies, projectiles, pickups, floor, parallax). The loader requests only listed
  files. Ships as `[]`.
- **Audio** is separate: `public/audio/manifest.json` (VOICEVOX clips, see `CREDITS.md`).

## License
Every externally-sourced asset must be **CC0 / license-compatible**, recorded in
`CREDITS.md` with source + license before committing. AI-generated art: keep it
original and note the tool.
