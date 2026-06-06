# Asset Credits & Licenses

A running record of every art/audio asset that isn't original game code, what it
is, where it came from, and its license — so it's always clear what's placeholder
and what's safe to ship.

| Asset | Path | Source | License | Notes |
|-------|------|--------|---------|-------|
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
Voice clips generated with [VOICEVOX](https://voicevox.hiroshiba.jp/) — free, open-source Japanese text-to-speech.
Character voice: **VOICEVOX:四国めたん** (Shikoku Metan), style id 2 (ノーマル / normal).
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
