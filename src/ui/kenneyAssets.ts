// Optional CC0 art drop-in (Kenney packs) for the enemies, projectiles, and
// pickups — the texture slots that, until now, were always procedural.
//
// Mirrors the existing optional-art conventions (see `playerSheet.ts` for the
// roster and `floor_placeholder.png` for the ground): real files drop into
// `public/kenney/` under fixed names, are registered onto the exact texture keys
// the game already uses, and a MISSING file is always safe — that slot simply
// keeps its procedural chibi/shape. Nothing here changes gameplay.
//
// Pipeline:
//   • preload  → `loadKenneyAssets(scene)` queues every manifest file.
//   • create   → `applyKenneyAssets(scene)` (call BEFORE
//                `generatePlaceholderTextures`) bakes the loaded images onto the
//                target keys. The procedural generator then fills only the slots
//                that stayed empty (its own `textures.exists()` guards skip the
//                ones we populated).
//
// Single (non-directional) items load straight onto their target key. Monsters
// are directional: one source image is baked onto `${base}_down|_up|_side` —
// front-facing, with `side` reused for the profile (left derives via flipX in
// systems/facing.ts), the same compromise the roster girls use today. Swap to a
// true multi-frame walk later via the `playerSheet.ts` sheet pattern.
//
// See `public/kenney/README.md` for which CC0 packs to download and the exact
// filenames/sizes each slot expects, and add a CREDITS.md row per file shipped.

import Phaser from 'phaser';
import { TEX } from '../constants';
import { dirTextureKey } from '../systems/facing';
import { FLOOR_TEXTURE_KEY } from '../systems/backdrop';

/** A single, non-directional texture (projectile / pickup). */
interface SingleAsset {
  kind: 'single';
  id: string;
  file: string; // filename under public/kenney/
  key: string; // game texture key to populate
  pack: string; // human-readable Kenney pack name
  url: string; // pack page on kenney.nl (CC0)
  note: string; // sizing / tint guidance for the drop-in README
}

/** A directional creature (enemy) baked onto its 3 facing keys. */
interface DirAsset {
  kind: 'dir';
  id: string;
  file: string;
  base: string; // base texture key; `${base}_down|_up|_side` are populated
  sideFlip: boolean; // true if the source faces LEFT (baked `side` must face right)
  pack: string;
  url: string;
  note: string;
}

/** Overrides a texture key another loader already owns (e.g. the floor tile,
 *  loaded as the placeholder by BootScene). Baked over the existing key only if
 *  the Kenney file is present, otherwise the existing placeholder stands. */
interface OverrideAsset {
  kind: 'override';
  id: string;
  file: string;
  destKey: string; // existing texture key to replace when the file is present
  pack: string;
  url: string;
  note: string;
}

export type KenneyAsset = SingleAsset | DirAsset | OverrideAsset;

// White-drawn projectiles (pocky, shuriken, bullet) are TINTED in-engine by the
// weapon colour, so their drop-in art should likewise be white/grayscale on a
// transparent background to tint cleanly. Pickups (xp, word) are shown as-is.
export const KENNEY_MANIFEST: KenneyAsset[] = [
  // ── Environment ─────────────────────────────────────────────────────────────
  {
    kind: 'override',
    id: 'floor',
    file: 'floor.png',
    destKey: FLOOR_TEXTURE_KEY,
    pack: 'Pattern Pack / Tiny Town / Prototype Textures',
    url: 'https://kenney.nl/assets/pattern-pack',
    note: 'Seamless tiling floor for the perspective plane (Bible §3 gap 3). Dark/tech/neon-grid suits the Edgerunners look. MUST be seamless and power-of-two (128×128 or 256×256) so it tiles + mipmaps cleanly. Grayscale tiles best — the floor mesh tints them with RENDER.floorNear/floorFar.',
  },

  // ── Enemies (directional) ──────────────────────────────────────────────────
  {
    kind: 'dir',
    id: 'rushFan',
    file: 'rush_fan.png',
    base: TEX.rushFan,
    sideFlip: false,
    pack: 'Tiny Dungeon (or Monster Builder Pack)',
    url: 'https://kenney.nl/assets/tiny-dungeon',
    note: 'Small, aggressive monster. ~20px tall, transparent background, faces down.',
  },
  {
    kind: 'dir',
    id: 'merchMule',
    file: 'merch_mule.png',
    base: TEX.merchMule,
    sideFlip: false,
    pack: 'Tiny Dungeon (or Tiny Battle)',
    url: 'https://kenney.nl/assets/tiny-dungeon',
    note: 'Bulkier, boxy "pack mule" creature. ~24px tall, transparent, faces down.',
  },
  {
    kind: 'dir',
    id: 'boss',
    file: 'boss.png',
    base: TEX.boss,
    sideFlip: false,
    pack: 'Monster Builder Pack',
    url: 'https://kenney.nl/assets/monster-builder-pack',
    note: 'The Ultimate Collector boss — largest enemy. ~28px tall, transparent, faces down.',
  },

  // ── Projectiles (white/grayscale → tinted in-engine) ────────────────────────
  {
    kind: 'single',
    id: 'pocky',
    file: 'pocky.png',
    key: TEX.pocky,
    pack: 'Particle Pack / Generic Items',
    url: 'https://kenney.nl/assets/particle-pack',
    note: 'Short capsule/stick projectile, points +x (right). White on transparent so it tints. ~20x8px.',
  },
  {
    kind: 'single',
    id: 'shuriken',
    file: 'shuriken.png',
    key: TEX.shuriken,
    pack: 'Particle Pack / Generic Items',
    url: 'https://kenney.nl/assets/particle-pack',
    note: 'Throwing-star, spun in-engine. White on transparent. ~16x16px, square.',
  },
  {
    kind: 'single',
    id: 'bullet',
    file: 'bullet.png',
    key: TEX.bullet,
    pack: 'Particle Pack',
    url: 'https://kenney.nl/assets/particle-pack',
    note: 'Generic round bolt. White on transparent so it tints. ~10x10px.',
  },

  // ── Pickups (shown as-is, no tint) ──────────────────────────────────────────
  {
    kind: 'single',
    id: 'xp',
    file: 'xp_gem.png',
    key: TEX.xp,
    pack: 'Generic Items (or Board Game Icons)',
    url: 'https://kenney.nl/assets/generic-items',
    note: 'XP gem/orb. Coloured is fine (not tinted). ~10-16px.',
  },
  {
    kind: 'single',
    id: 'word',
    file: 'word_token.png',
    key: TEX.word,
    pack: 'Generic Items',
    url: 'https://kenney.nl/assets/generic-items',
    note: 'Word-token pickup (scroll/card/tile). ~16x16px.',
  },
  {
    kind: 'single',
    id: 'gacha',
    file: 'gacha.png',
    key: TEX.gacha,
    pack: 'Generic Items / Board Game Icons',
    note: 'ガチャ evolution capsule pickup. Gachapon-ball / chest, coloured. ~16-18px.',
    url: 'https://kenney.nl/assets/generic-items',
  },
];

/** Loader key a slot's file loads onto (final key for singles, a temp src key
 *  for directional/override slots that get baked in `applyKenneyAssets`). */
const ownedLoadKey = (a: KenneyAsset): string =>
  a.kind === 'single' ? a.key : `ken_src_${a.id}`;

/** Cache key for the present-files manifest. */
const MANIFEST_KEY = 'ken_manifest';

/** Filenames actually present in public/kenney/, per the committed manifest.json
 *  (ships as []). Tolerates a missing / non-array manifest by treating it empty. */
function presentFiles(scene: Phaser.Scene): Set<string> {
  const data = scene.cache.json.get(MANIFEST_KEY) as unknown;
  return new Set(Array.isArray(data) ? (data as string[]) : []);
}

/**
 * Queue the Kenney drop-ins. Call from a scene `preload()`.
 *
 * We load `manifest.json` (committed, ships as `[]`) FIRST and then only request
 * the image files it lists, so an unfilled slot is never fetched — no 404s, no
 * loader errors, and that slot cleanly falls back to procedural/placeholder art.
 * Add a filename to `public/kenney/manifest.json` when you drop a file in.
 *
 * Singles load straight onto their final texture key; directional/override
 * sources load onto a temp `ken_src_<id>` key that `applyKenneyAssets` bakes from.
 */
export function loadKenneyAssets(scene: Phaser.Scene): void {
  const base = import.meta.env.BASE_URL;
  scene.load.json(MANIFEST_KEY, `${base}kenney/manifest.json`);
  scene.load.once(`filecomplete-json-${MANIFEST_KEY}`, () => {
    const present = presentFiles(scene);
    for (const a of KENNEY_MANIFEST) {
      if (present.has(a.file)) scene.load.image(ownedLoadKey(a), `${base}kenney/${a.file}`);
    }
  });
}

/** Copy a loaded image texture onto `destKey` (optionally horizontally flipped). */
function bakeImageTo(scene: Phaser.Scene, srcKey: string, destKey: string, flip: boolean): void {
  const img = scene.textures.get(srcKey).getSourceImage() as CanvasImageSource & {
    width: number;
    height: number;
  };
  const w = img.width;
  const h = img.height;
  if (scene.textures.exists(destKey)) scene.textures.remove(destKey);
  const canvasTex = scene.textures.createCanvas(destKey, w, h);
  if (!canvasTex) return;
  const ctx = canvasTex.getContext();
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  if (flip) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  canvasTex.refresh();
}

/**
 * Bake every Kenney source that actually loaded onto its target texture key(s).
 * Call in `create()` BEFORE `generatePlaceholderTextures(scene)` so the
 * generator's `textures.exists()` guards skip the slots we filled. Slots whose
 * file was absent are left untouched and stay procedural.
 *
 * Singles are already registered on their final key by the loader, so this only
 * has to fan a directional source out across its three facing keys.
 */
export function applyKenneyAssets(scene: Phaser.Scene): void {
  let applied = 0;
  for (const a of KENNEY_MANIFEST) {
    if (a.kind === 'single') {
      // Loaded straight onto its final key; present means it's active.
      if (scene.textures.exists(a.key)) applied++;
      continue;
    }
    const srcKey = `ken_src_${a.id}`;
    if (!scene.textures.exists(srcKey)) continue; // file absent → keep procedural/placeholder
    if (a.kind === 'override') {
      bakeImageTo(scene, srcKey, a.destKey, false); // replace the placeholder under destKey
    } else {
      bakeImageTo(scene, srcKey, dirTextureKey(a.base, 'down'), false);
      bakeImageTo(scene, srcKey, dirTextureKey(a.base, 'up'), false);
      bakeImageTo(scene, srcKey, dirTextureKey(a.base, 'side'), a.sideFlip);
    }
    applied++;
  }
  if (applied > 0) {
    console.info(`[OtakuHunter] Kenney art active for ${applied}/${KENNEY_MANIFEST.length} slot(s).`);
  }
}
