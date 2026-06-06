# textures/parallax/

Wide, horizontally-tiling skyline layers per stage (transparent above rooftops).
Rendered as scrolling parallax anchored at the horizon (far drifts slowest).

- `arcade_far.png`  — ~1920×200, hazy distant towers
- `arcade_mid.png`  — ~1920×300, buildings + neon signage
- `arcade_near.png` — ~1920×350, tallest/boldest neon
- `themepark_*`, `neonstreet_*` — future stages.

Add the path to `public/art-manifest.json`. Prominence scales with
`RENDER.groundTilt` / `RENDER.horizonFrac`.
