// World-space street props — art drop-in (manifest-gated, like enemyAnims.ts).
//
// A prop sheet is an optional spritesheet/image for a street prop. It loads ONLY when
// its path is listed in art-manifest.json, so a missing file never 404s — StreetProps
// falls back to a procedural neon placeholder for that kind. Frame dimensions are given
// explicitly (Claude Code can't infer grid slicing from an image).
//
// `frameWidth` present → loaded as a spritesheet (animated); absent → a static image.
// A single sheet can register MULTIPLE animations (e.g. the neon-signs sheet packs three
// independent signs in three rows).
//
// To enable a prop: drop the file at `path`, add that path to public/art-manifest.json,
// rebuild. The loader slices it, registers its anim(s), and StreetProps uses the real
// (animated) sprite automatically.

import Phaser from 'phaser';

export interface PropAnim {
  key: string;
  frames: number[];
  frameRate: number;
}

export interface PropSheet {
  id: string; // texture key StreetProps looks up (e.g. 'prop_vending')
  path: string; // public-relative; loaded only when listed in art-manifest.json
  frameWidth?: number; // present → spritesheet; absent → static image
  frameHeight?: number;
  anims?: PropAnim[]; // looping idle animation(s) for a spritesheet
}

export const PROP_SHEETS: PropSheet[] = [
  // ── Animated ───────────────────────────────────────────────────────────────
  {
    id: 'prop_vending',
    path: 'sprites/props/prop_vending_machine.png',
    frameWidth: 512,
    frameHeight: 768,
    anims: [{ key: 'prop_vending_idle', frames: [0, 1, 2, 3], frameRate: 3 }],
  },
  {
    id: 'prop_arcade',
    path: 'sprites/props/prop_arcade_cabinet.png',
    frameWidth: 500,
    frameHeight: 786,
    anims: [{ key: 'prop_arcade_idle', frames: [0, 1, 2, 3], frameRate: 2 }],
  },
  {
    id: 'prop_lanterns',
    path: 'sprites/props/prop_lanterns.png',
    frameWidth: 512,
    frameHeight: 768,
    anims: [{ key: 'prop_lanterns_idle', frames: [0, 1, 2, 3], frameRate: 2 }],
  },
  {
    // 3 rows × 4 cols = 3 independent signs, each a 4-frame loop.
    id: 'prop_signs',
    path: 'sprites/props/prop_neon_signs.png',
    frameWidth: 384,
    frameHeight: 341,
    anims: [
      { key: 'sign_gesen', frames: [0, 1, 2, 3], frameRate: 3 }, // ゲーセン (cyan, blinks)
      { key: 'sign_karaoke', frames: [4, 5, 6, 7], frameRate: 3 }, // カラオケ (magenta, pulses)
      { key: 'sign_ramen', frames: [8, 9, 10, 11], frameRate: 3 }, // ラーメン (amber, steam)
    ],
  },
  // ── Building facades (static front-view storefronts; the street "back wall") ──
  { id: 'facade_anime_shop', path: 'sprites/props/facade_anime_shop.png' },
  { id: 'facade_game_center', path: 'sprites/props/facade_game_center.png' },
  { id: 'facade_karaoke', path: 'sprites/props/facade_karaoke.png' },
  { id: 'facade_konbini', path: 'sprites/props/facade_konbini.png' },
  // ── Static props ─────────────────────────────────────────────────────────────
  { id: 'prop_power_pole', path: 'sprites/props/prop_power_pole.png' },
  { id: 'prop_railing', path: 'sprites/props/prop_railing.png' },
  { id: 'prop_cat_trashcan', path: 'sprites/props/prop_cat_trashcan.png' },
  { id: 'prop_crates', path: 'sprites/props/prop_crates.png' },
  { id: 'prop_bicycle', path: 'sprites/props/prop_bicycle.png' },
  { id: 'prop_sale_sign', path: 'sprites/props/prop_sale_sign.png' },
];

// The 4 building-facade texture ids, in a stable order (systems/facadeWall.ts tiles them).
export const FACADE_IDS = ['facade_anime_shop', 'facade_game_center', 'facade_karaoke', 'facade_konbini'] as const;

const MANIFEST_KEY = 'art_manifest';

/** Queue any prop sheets that are actually present (per art-manifest.json). Call in
 *  preload AFTER loadKenneyAssets (which queues the manifest json this self-gates on). */
export function loadPropSheets(scene: Phaser.Scene): void {
  const base = import.meta.env.BASE_URL;
  scene.load.once(`filecomplete-json-${MANIFEST_KEY}`, () => {
    const data = scene.cache.json.get(MANIFEST_KEY) as unknown;
    const present = new Set(Array.isArray(data) ? (data as string[]) : []);
    for (const s of PROP_SHEETS) {
      if (!present.has(s.path)) continue;
      if (s.frameWidth && s.frameHeight) {
        scene.load.spritesheet(s.id, `${base}${s.path}`, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
      } else {
        scene.load.image(s.id, `${base}${s.path}`);
      }
    }
  });
}

/** The sheet config for an id (so StreetProps can read frameHeight / anim keys). */
export function propSheetById(id: string): PropSheet | undefined {
  return PROP_SHEETS.find((s) => s.id === id);
}

/** Register each present prop sheet's looping idle animation(s). Call in create(). */
export function registerPropAnims(scene: Phaser.Scene): void {
  for (const s of PROP_SHEETS) {
    if (!s.anims || !scene.textures.exists(s.id)) continue;
    for (const a of s.anims) {
      if (scene.anims.exists(a.key)) continue;
      scene.anims.create({
        key: a.key,
        frames: a.frames.map((frame) => ({ key: s.id, frame })),
        frameRate: a.frameRate,
        repeat: -1,
      });
    }
  }
}
