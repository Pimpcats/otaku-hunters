# sprites/heroes/

Playable character art. One subfolder per character: `kohai/`, `sensei/`, `ronin/`.

**Target format (per character):** 64×64 per frame, transparent PNG, 4-direction,
neon Edgerunners palette at the ¾ tilt. Three sheets per character:
- `idle.png` — idle (all directions)
- `walk.png` — walk cycle (all directions)
- `attack.png` — attack (all directions)

**Status:** the hero sheets are NOT yet wired to the animation system. When you add
a character's sheets, tell me the exact grid (cols×rows, cell px, and which rows/
cols are which direction) and I'll wire them — Claude can't infer slicing from the
image. Until then the game uses the legacy placeholder in `_legacy/`.
