# Asset Credits & Licenses

A running record of every art/audio asset that isn't original game code, what it
is, where it came from, and its license — so it's always clear what's placeholder
and what's safe to ship.

| Asset | Path | Source | License | Notes |
|-------|------|--------|---------|-------|
| Floor tile (placeholder) | `public/textures/floor_placeholder.png` | Procedurally generated for this repo (`tools`/build script) | CC0 / public domain (owned) | **Stand-in.** The brief asked for a CC0 tile from [kenney.nl](https://kenney.nl/assets) (e.g. a tile/pavement pattern), but this sandbox's network policy blocks outbound to `kenney.nl` (`403 host_not_allowed`), so a seamless 128×128 grayscale paver was generated in-engine instead. It's grayscale on purpose — the floor mesh tints it with the in-game `RENDER.floorNear`/`floorFar` palette. To swap in a real Kenney tile later, just replace this file (keep it seamless/tileable; power-of-two like 128×128 or 256×256 so it repeats), update this row, and no code changes are needed. |

## Kenney (CC0) drop-in slots — wired, not yet filled
A general drop-in pipeline for CC0 [Kenney](https://kenney.nl/assets) art now backs
the enemies, projectiles, pickups, and floor (`src/ui/kenneyAssets.ts`; loaded in
`BootScene`). Files go in `public/kenney/` under fixed names and are used with **no
code change**; any missing file falls back to procedural/placeholder art. The slot
list, expected sizes, and suggested packs are in [`public/kenney/README.md`](./public/kenney/README.md).

These slots are **empty today** — the sandbox network policy blocks `kenney.nl`
(`403 host_not_allowed`), so the actual files are downloaded on a networked machine
and committed later. **When a file is added, append a row to the table above** with
its source URL + license before committing.

| Drop-in file | Game slot | Status |
|---|---|---|
| `public/kenney/floor.png` | 2.5D ground plane (set `RENDER.floorTexture = true` after adding) | empty — placeholder paver in use |
| `public/kenney/rush_fan.png` | Rushing Fan enemy | empty — procedural |
| `public/kenney/merch_mule.png` | Merch-Mule enemy | empty — procedural |
| `public/kenney/boss.png` | The Ultimate Collector (boss) | empty — procedural |
| `public/kenney/pocky.png` · `shuriken.png` · `bullet.png` | Projectiles (white → tinted) | empty — procedural |
| `public/kenney/xp_gem.png` · `word_token.png` | Pickups | empty — procedural |

## Standing rule
Any externally-sourced asset (or procedural stand-in for one) gets a row here with
its **source URL** and **license** before it's committed. CC0 / public-domain only
for placeholders unless a license is explicitly cleared — no attribution-required
or non-commercial assets.
