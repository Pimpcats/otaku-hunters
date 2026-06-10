# textures/floors/

Seamless, tiling floor textures, one per stage. **512×512 seamless PNG**
(power-of-two so it tiles + mipmaps cleanly). Grayscale tiles best — the floor mesh
tints them with `RENDER.floorNear`/`floorFar`.

- `arcade_floor_tile.png` — The Arcade. After adding, set `RENDER.floorTexture = true`
  (in `src/data/render.ts`) to swap the wireframe grid for it.
- `themepark_floor_tile.png`, `neonstreet_floor_tile.png` — future stages.
- `floor_placeholder.png` — current procedural stand-in (grayscale paver).

Add the path to `public/art-manifest.json` (the placeholder is loaded directly).
