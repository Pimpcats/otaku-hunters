# sprites/

In-game sprite art (transparent PNG). Subfolders:
- `heroes/` — playable characters (animated sheets, per character).
- `enemies/` — enemy art.
- `weapons/` — projectile / weapon-effect sprites.
- `pickups/` — floor pickups.

**Drop-in rule:** after adding a file, also add its path (relative to `public/`)
to `public/art-manifest.json` so the loader requests it (this prevents 404s for
files that aren't there yet). See `ASSET_INDEX.md` for the master checklist.
