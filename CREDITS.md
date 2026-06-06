# Asset Credits & Licenses

A running record of every art/audio asset that isn't original game code, what it
is, where it came from, and its license — so it's always clear what's placeholder
and what's safe to ship.

| Asset | Path | Source | License | Notes |
|-------|------|--------|---------|-------|
| Arcade floor tile | `public/textures/floors/arcade_floor_tile.png` | Provided by the project owner (original art) | Owned / original | 512×512 seamless neon tech-grid tile. **Active** — `RENDER.floorTexture` is on; the floor mesh shows it true near the player (`floorTextureTint`) and hazes it dark toward the horizon. |
| Neon-street floor tile | `public/textures/floors/neonstreet_floor_tile.webp` | Provided by the project owner (original art) | Owned / original | 1254×1254 webp. Stored for a future neon-street stage; not yet wired. |
| Arcade far parallax | `public/textures/parallax/arcade_far.webp` | Provided by the project owner (original art) | Owned / original | 1920×300 seamless skyline. **Active** as the far (slowest) parallax layer. |
| Rōnin 4-dir character | `public/sprites/heroes/ronin/ronin_4dir_transparent.webp` | Provided by the project owner (original art) | Owned / original | 1536×1024 transparent sheet, 4 views. Rect-sliced to down/up/side (+flip), ~60px in-game. **Active** as 浪人 Rōnin. |
| Sensei 4-dir character | `public/sprites/heroes/sensei/sensei_4dir_transparent.webp` | Provided by the project owner (original art) | Owned / original | 1536×1024 transparent sheet, 4 views. Rect-sliced to down/up/side (+flip), ~60px in-game. **Active** as 先生 Sensei. |
| Kōhai 4-dir character | `public/sprites/heroes/kohai/kohai_4dir_transparent.webp` | Provided by the project owner (original art) | Owned / original | 1536×1024 transparent sheet, 4 views (front/back/side-L/side-R). Rect-sliced to down/up/side (+flip), ~60px in-game. **Active** as 後輩 Kōhai. |
| Arcade mid parallax | `public/textures/parallax/arcade_mid.webp` | Provided by the project owner (original art) | Owned / original | 1774×887 neon street/shopfronts. **Active** as the mid parallax layer. |
| Arcade near parallax | `public/textures/parallax/arcade_near.webp` | Provided by the project owner (original art) | Owned / original | 1920×500 seamless neon-arcade street. **Active** as the near (fastest) parallax layer; bottom meets the floor. Mid layer still procedural. |
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
