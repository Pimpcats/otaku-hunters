// World-space street props — art drop-in (manifest-gated, like enemyAnims.ts).
//
// A prop sheet is an optional CC0/commissioned spritesheet for a street prop (e.g.
// the neon vending machine). It loads ONLY when its path is listed in
// art-manifest.json, so a missing file never 404s — the prop system falls back to a
// procedural neon-rectangle placeholder for that kind. Frame dimensions are given
// explicitly (Claude Code can't infer grid slicing from an image).
//
// To enable a real prop: drop the file at the listed `path`, add that path to
// public/art-manifest.json, rebuild. The loader slices it and registers its idle
// animation; StreetProps then uses the animated sprite instead of the placeholder.

import Phaser from 'phaser';

export interface PropSheet {
  id: string; // texture key the prop system looks up (e.g. 'prop_vending')
  path: string; // public-relative; loaded only when listed in art-manifest.json
  frameWidth: number;
  frameHeight: number;
  targetH: number; // in-game height px (props scale to ~player height); aspect kept
  anim?: { key: string; frames: number[]; frameRate: number };
}

export const PROP_SHEETS: PropSheet[] = [
  {
    // Neon vending machine (自販機). 2048×768 sheet, 4 frames in a row (512×768 each):
    // the neon trim colour-cycles and a drink can drops in frame 2.
    id: 'prop_vending',
    path: 'sprites/props/vending_machine.png',
    frameWidth: 512,
    frameHeight: 768,
    targetH: 76, // ~player height in-game
    anim: { key: 'prop_vending_idle', frames: [0, 1, 2, 3], frameRate: 3 },
  },
];

const MANIFEST_KEY = 'art_manifest';

/** Queue any prop sheets that are actually present (per art-manifest.json). Call in
 *  preload AFTER loadKenneyAssets (which queues the manifest json this self-gates on). */
export function loadPropSheets(scene: Phaser.Scene): void {
  const base = import.meta.env.BASE_URL;
  scene.load.once(`filecomplete-json-${MANIFEST_KEY}`, () => {
    const data = scene.cache.json.get(MANIFEST_KEY) as unknown;
    const present = new Set(Array.isArray(data) ? (data as string[]) : []);
    for (const s of PROP_SHEETS) {
      if (present.has(s.path)) {
        scene.load.spritesheet(s.id, `${base}${s.path}`, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
      }
    }
  });
}

/** Register each present prop sheet's looping idle animation. Call in create(). */
export function registerPropAnims(scene: Phaser.Scene): void {
  for (const s of PROP_SHEETS) {
    if (!s.anim || !scene.textures.exists(s.id) || scene.anims.exists(s.anim.key)) continue;
    scene.anims.create({
      key: s.anim.key,
      frames: s.anim.frames.map((frame) => ({ key: s.id, frame })),
      frameRate: s.anim.frameRate,
      repeat: -1,
    });
  }
}

/** The sheet config for an id (so StreetProps can read targetH / anim key). */
export function propSheet(id: string): PropSheet | undefined {
  return PROP_SHEETS.find((s) => s.id === id);
}
