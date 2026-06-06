# sprites/enemies/

Enemy art (transparent PNG, faces DOWN/front). Filenames → game enemy:
`rushfan.png`, `merchmule.png`, `anxious.png`, `toocool.png`, `camera.png`,
`wota.png`, `lurker.png`, `glomper.png`, `boss_collector.png` (boss ~128×128, rest ~48×48).

**Wired (single frame):** a single-frame PNG drops in now — it's mirrored to the
3 facings automatically (left = flipped). Add the path to `public/art-manifest.json`.

**Multi-frame animated sheets:** not wired yet. If a file is an animation sheet
(several frames), tell me the frame size and I'll add slicing/animation — otherwise
the whole sheet would be drawn as one image.
