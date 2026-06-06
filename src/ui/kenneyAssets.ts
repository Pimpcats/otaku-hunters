// Optional art drop-in for the floor, parallax skyline, enemies, projectiles, and
// pickups — the texture slots that are otherwise procedural.
//
// Real files drop into the semantic folders under `public/` (see `ASSET_INDEX.md`
// and each folder's README): `textures/floors`, `textures/parallax`,
// `sprites/enemies`, `sprites/weapons`, `sprites/pickups`. Each is registered onto
// the exact texture key the game already uses, and a MISSING file is always safe —
// that slot keeps its procedural shape. Nothing here changes gameplay.
//
// Pipeline:
//   • preload  → `loadKenneyAssets(scene)` reads `public/art-manifest.json` (a list
//                of relative paths actually present, ships as []) and queues ONLY
//                those, so an unfilled slot is never fetched (no 404s).
//   • create   → `applyKenneyAssets(scene)` (BEFORE `generatePlaceholderTextures`)
//                bakes loaded sources onto target keys; the generator then fills
//                only the slots that stayed empty.
//
// Single (non-directional) items load straight onto their target key. Enemies are
// directional: one front-facing source is baked onto `${base}_down|_up|_side`
// (left = flipped side). Multi-frame animated sheets are NOT handled here yet — a
// sheet would bake as one image; wire those via the `playerSheet.ts` pattern.

import Phaser from 'phaser';
import { TEX } from '../constants';
import { dirTextureKey } from '../systems/facing';
import { FLOOR_TEXTURE_KEY, PARALLAX_KEYS } from '../systems/backdrop';

/** A single, non-directional texture (floor/parallax/projectile/pickup). */
interface SingleAsset {
  kind: 'single';
  id: string;
  path: string; // path relative to public/, e.g. 'sprites/pickups/heart_xp.png'
  key: string; // game texture key to populate
  note: string; // sizing / format guidance (mirrors the folder README)
}

/** A directional enemy baked onto its 3 facing keys. */
interface DirAsset {
  kind: 'dir';
  id: string;
  path: string;
  base: string; // base texture key; `${base}_down|_up|_side` are populated
  sideFlip: boolean; // true if the source faces LEFT (baked `side` must face right)
  note: string;
}

/** Overrides a texture key another loader already owns (the floor placeholder). */
interface OverrideAsset {
  kind: 'override';
  id: string;
  path: string;
  destKey: string; // existing texture key to replace when the file is present
  note: string;
}

export type KenneyAsset = SingleAsset | DirAsset | OverrideAsset;

// Projectiles (pocky/shuriken/bullet) are TINTED in-engine, so their art should be
// white/grayscale on transparent. Pickups/enemies/floor/parallax are shown as-is.
export const KENNEY_MANIFEST: KenneyAsset[] = [
  // ── Floor (textures/floors) ─────────────────────────────────────────────────
  {
    kind: 'override',
    id: 'floor',
    path: 'textures/floors/arcade_floor_tile.png',
    destKey: FLOOR_TEXTURE_KEY,
    note: 'Seamless 512×512 floor tile for The Arcade. After adding, set RENDER.floorTexture = true.',
  },

  // ── Neon-city parallax skyline (textures/parallax), far → near ──────────────
  { kind: 'single', id: 'parallaxFar', path: 'textures/parallax/arcade_far.webp', key: PARALLAX_KEYS[0], note: 'Far skyline (arcade), 1920×300, horizontally seamless.' },
  { kind: 'single', id: 'parallaxMid', path: 'textures/parallax/arcade_mid.png', key: PARALLAX_KEYS[1], note: 'Mid skyline ~1920×300, tileable + transparent.' },
  { kind: 'single', id: 'parallaxNear', path: 'textures/parallax/arcade_near.webp', key: PARALLAX_KEYS[2], note: 'Near skyline (arcade), 1920×500, horizontally seamless; bottom meets the floor.' },

  // ── Enemies (sprites/enemies) — single front-facing frame, mirrored to facings ─
  { kind: 'dir', id: 'rushFan', path: 'sprites/enemies/rushfan.png', base: TEX.rushFan, sideFlip: false, note: 'Rushing Fan ファン, ~48px, transparent, faces down.' },
  { kind: 'dir', id: 'merchMule', path: 'sprites/enemies/merchmule.png', base: TEX.merchMule, sideFlip: false, note: 'Merch-Mule 転売ヤー, ~48px, faces down.' },
  { kind: 'dir', id: 'anxious', path: 'sprites/enemies/anxious.png', base: TEX.anxious, sideFlip: false, note: 'Shy Fan 陰キャ, ~48px, faces down.' },
  { kind: 'dir', id: 'tooCool', path: 'sprites/enemies/toocool.png', base: TEX.tooCool, sideFlip: false, note: 'Cool Fan 陽キャ, ~48px, faces down.' },
  { kind: 'dir', id: 'cameko', path: 'sprites/enemies/camera.png', base: TEX.cameko, sideFlip: false, note: 'Camera Otaku カメコ, ~48px, faces down.' },
  { kind: 'dir', id: 'wotagei', path: 'sprites/enemies/wota.png', base: TEX.wotagei, sideFlip: false, note: 'Idol Stan ヲタ芸, ~48px, faces down.' },
  { kind: 'dir', id: 'kosan', path: 'sprites/enemies/lurker.png', base: TEX.kosan, sideFlip: false, note: 'Old Guard 古参, ~48px, faces down.' },
  { kind: 'dir', id: 'jukakin', path: 'sprites/enemies/glomper.png', base: TEX.jukakin, sideFlip: false, note: 'Whale 重課金, ~48px, faces down.' },
  { kind: 'dir', id: 'boss', path: 'sprites/enemies/boss_collector.png', base: TEX.boss, sideFlip: false, note: 'The Ultimate Collector 究極コレクター — larger, ~128px, faces down.' },

  // ── Projectiles (sprites/weapons) — white/grayscale → tinted in-engine ──────
  { kind: 'single', id: 'pocky', path: 'sprites/weapons/pocky.png', key: TEX.pocky, note: 'Kōhai bolt (お菓子), points +x, white on transparent, ~20×8.' },
  { kind: 'single', id: 'shuriken', path: 'sprites/weapons/shuriken.png', key: TEX.shuriken, note: 'Rōnin shuriken (手裏剣), spun in-engine, white on transparent, ~16×16.' },
  { kind: 'single', id: 'bullet', path: 'sprites/weapons/bullet.png', key: TEX.bullet, note: 'Generic bolt, white on transparent, ~10×10.' },

  // ── Pickups (sprites/pickups) — shown as-is ─────────────────────────────────
  { kind: 'single', id: 'xp', path: 'sprites/pickups/heart_xp.png', key: TEX.xp, note: 'XP heart / fan-love (ハート), ~16px.' },
  { kind: 'single', id: 'word', path: 'sprites/pickups/word_tango.png', key: TEX.word, note: 'Word tile (単語), ~16px.' },
  { kind: 'single', id: 'gacha', path: 'sprites/pickups/gacha_capsule.png', key: TEX.gacha, note: 'ガチャ evolution capsule, ~16-18px.' },
];

/** Loader key a slot's file loads onto (final key for singles, a temp src key for
 *  directional/override slots that get baked in `applyKenneyAssets`). */
const ownedLoadKey = (a: KenneyAsset): string =>
  a.kind === 'single' ? a.key : `ken_src_${a.id}`;

/** Cache key for the present-files manifest. */
const MANIFEST_KEY = 'art_manifest';

/** Relative paths actually present, per public/art-manifest.json (ships as []).
 *  Tolerates a missing / non-array manifest by treating it as empty. */
function presentPaths(scene: Phaser.Scene): Set<string> {
  const data = scene.cache.json.get(MANIFEST_KEY) as unknown;
  return new Set(Array.isArray(data) ? (data as string[]) : []);
}

/**
 * Queue the art drop-ins. Call from a scene `preload()`.
 *
 * Loads `public/art-manifest.json` (ships `[]`) FIRST, then requests only the
 * relative paths it lists — so an unfilled slot is never fetched (no 404s) and that
 * slot cleanly falls back to procedural/placeholder art. Add a file's path to the
 * manifest when you drop it in.
 */
export function loadKenneyAssets(scene: Phaser.Scene): void {
  const base = import.meta.env.BASE_URL;
  scene.load.json(MANIFEST_KEY, `${base}art-manifest.json`);
  scene.load.once(`filecomplete-json-${MANIFEST_KEY}`, () => {
    const present = presentPaths(scene);
    for (const a of KENNEY_MANIFEST) {
      if (present.has(a.path)) scene.load.image(ownedLoadKey(a), `${base}${a.path}`);
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
 * Bake every loaded source onto its target texture key(s). Call in `create()`
 * BEFORE `generatePlaceholderTextures(scene)` so the generator's `textures.exists()`
 * guards skip the slots we filled. Absent slots are left procedural.
 *
 * Singles are already on their final key from the loader, so this only fans a
 * directional source out across its three facing keys (and applies overrides).
 */
export function applyKenneyAssets(scene: Phaser.Scene): void {
  let applied = 0;
  for (const a of KENNEY_MANIFEST) {
    if (a.kind === 'single') {
      if (scene.textures.exists(a.key)) applied++;
      continue;
    }
    const srcKey = `ken_src_${a.id}`;
    if (!scene.textures.exists(srcKey)) continue; // file absent → keep procedural/placeholder
    if (a.kind === 'override') {
      bakeImageTo(scene, srcKey, a.destKey, false);
    } else {
      bakeImageTo(scene, srcKey, dirTextureKey(a.base, 'down'), false);
      bakeImageTo(scene, srcKey, dirTextureKey(a.base, 'up'), false);
      bakeImageTo(scene, srcKey, dirTextureKey(a.base, 'side'), a.sideFlip);
    }
    applied++;
  }
  if (applied > 0) {
    console.info(`[OtakuHunter] drop-in art active for ${applied}/${KENNEY_MANIFEST.length} slot(s).`);
  }
}
