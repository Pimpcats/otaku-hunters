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
import { dirTextureKey, type FacingSet } from '../systems/facing';
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
  // Optional 4-view sheet: slice front/back/side-left by explicit x-ranges within a
  // vertical band, downscaled to `displayHeight` px (vs. baking the whole image).
  sheet?: {
    viewY: number;
    viewH: number;
    displayHeight: number; // baked frame height (enemies are smaller than heroes)
    views: { down: [number, number]; up: [number, number]; side: [number, number] };
    chromaKey?: boolean; // source has a solid green background → key it transparent first
  };
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
  { kind: 'single', id: 'parallaxMid', path: 'textures/parallax/arcade_mid.webp', key: PARALLAX_KEYS[1], note: 'Mid skyline (arcade), 1774×887; horizontally tiled, bottom near the seam.' },
  { kind: 'single', id: 'parallaxNear', path: 'textures/parallax/arcade_near.webp', key: PARALLAX_KEYS[2], note: 'Near skyline (arcade), 1920×500, horizontally seamless; bottom meets the floor.' },

  // ── Enemies (sprites/enemies) — green-screened 4-view sheets, rect-sliced ─────
  // Sheets are ~1983×793, four views L→R: front(down)/back(up)/side-left/side-right.
  // We bake down/up/side (side from the side-LEFT frame, flipped for the right via
  // sideFlip). All sheets are green-screened → chromaKey:true keys the green out.
  {
    kind: 'dir',
    id: 'rushFan',
    path: 'sprites/enemies/rushfan_4dir.png',
    base: TEX.rushFan,
    sideFlip: true,
    note: 'Rushing Fan ファン (red hoodie) — green-screen 4-view sheet (1983×793), keyed + rect-sliced ~46px.',
    sheet: { viewY: 167, viewH: 438, displayHeight: 46, views: { down: [115, 460], up: [585, 915], side: [1032, 1401] }, chromaKey: true },
  },
  {
    kind: 'dir',
    id: 'merchMule',
    path: 'sprites/enemies/merchmule_4dir.png',
    base: TEX.merchMule,
    sideFlip: true,
    note: 'Merch-Mule 転売ヤー (gold jacket) — green-screen 4-view sheet (1983×793), keyed + rect-sliced ~50px (bulkier).',
    sheet: { viewY: 148, viewH: 467, displayHeight: 50, views: { down: [62, 445], up: [545, 901], side: [983, 1381] }, chromaKey: true },
  },
  {
    kind: 'dir',
    id: 'anxious',
    path: 'sprites/enemies/anxious_4dir.png',
    base: TEX.anxious,
    sideFlip: true,
    note: 'Shy Fan 陰キャ (dark-blue hoodie) — green-screen 4-view sheet (1983×793), keyed + rect-sliced ~46px.',
    sheet: { viewY: 124, viewH: 549, displayHeight: 46, views: { down: [127, 431], up: [593, 878], side: [1036, 1394] }, chromaKey: true },
  },
  {
    kind: 'dir',
    id: 'tooCool',
    path: 'sprites/enemies/toocool_4dir.png',
    base: TEX.tooCool,
    sideFlip: true,
    note: 'Cool Fan 陽キャ (purple jacket) — green-screen 4-view sheet (1983×793), keyed + rect-sliced ~46px.',
    sheet: { viewY: 82, viewH: 621, displayHeight: 46, views: { down: [137, 380], up: [574, 815], side: [1050, 1339] }, chromaKey: true },
  },
  {
    kind: 'dir',
    id: 'cameko',
    path: 'sprites/enemies/camera_4dir.png',
    base: TEX.cameko,
    sideFlip: true,
    note: 'Camera Otaku カメコ (teal hoodie, crouching) — green-screen 4-view sheet (1983×793), keyed + rect-sliced ~46px.',
    sheet: { viewY: 117, viewH: 521, displayHeight: 46, views: { down: [97, 430], up: [558, 865], side: [981, 1423] }, chromaKey: true },
  },
  {
    kind: 'dir',
    id: 'wotagei',
    path: 'sprites/enemies/wota_4dir.png',
    base: TEX.wotagei,
    sideFlip: true,
    note: 'Idol Stan ヲタ芸 (white happi, glowsticks) — green-screen 4-view sheet (1981×793), keyed + rect-sliced ~46px.',
    sheet: { viewY: 28, viewH: 662, displayHeight: 46, views: { down: [114, 488], up: [637, 978], side: [1076, 1350] }, chromaKey: true },
  },
  {
    kind: 'dir',
    id: 'kosan',
    path: 'sprites/enemies/lurker_4dir.png',
    base: TEX.kosan,
    sideFlip: true,
    note: 'Old Guard 古参 (olive jacket) — green-screen 4-view sheet (1983×793), keyed + rect-sliced ~46px (grows with its lurk buff).',
    sheet: { viewY: 102, viewH: 607, displayHeight: 46, views: { down: [106, 353], up: [586, 824], side: [1075, 1305] }, chromaKey: true },
  },
  {
    kind: 'dir',
    id: 'jukakin',
    path: 'sprites/enemies/glomper_4dir.png',
    base: TEX.jukakin,
    sideFlip: true,
    note: 'Whale 重課金 (hot-pink, huge) — green-screen 4-view sheet (1983×793), keyed + rect-sliced ~46px (×1.4 scale = biggest non-boss).',
    sheet: { viewY: 79, viewH: 657, displayHeight: 46, views: { down: [35, 473], up: [516, 905], side: [975, 1346] }, chromaKey: true },
  },
  {
    kind: 'dir',
    id: 'boss',
    path: 'sprites/enemies/boss_collector_4dir.png',
    base: TEX.boss,
    sideFlip: true,
    // 3 phase-rows × 4 views. We wire PHASE 1 (top row, y26–260) for now; the
    // awakened/rampage rows (y278–519, y538–780) get swapped in with the
    // multi-phase boss logic (roadmap Phase 4).
    note: 'The Ultimate Collector 究極コレクター (white/silver, rainbow merch) — green-screen 3×4 sheet; phase-1 row wired, rect-sliced ~88px (largest).',
    sheet: { viewY: 26, viewH: 234, displayHeight: 88, views: { down: [193, 631], up: [683, 1073], side: [1128, 1449] }, chromaKey: true },
  },

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

/** Slice a source rectangle of `srcKey` and bake it (downscaled) onto `destKey`. */
function bakeRectScaled(
  scene: Phaser.Scene,
  srcKey: string,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  destW: number,
  destH: number,
  destKey: string,
  flip: boolean,
): void {
  const img = scene.textures.get(srcKey).getSourceImage() as CanvasImageSource;
  if (scene.textures.exists(destKey)) scene.textures.remove(destKey);
  const t = scene.textures.createCanvas(destKey, destW, destH);
  if (!t) return;
  const ctx = t.getContext();
  ctx.clearRect(0, 0, destW, destH);
  ctx.imageSmoothingEnabled = true; // smooth the big→small downscale
  ctx.save();
  if (flip) {
    ctx.translate(destW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, destW, destH);
  ctx.restore();
  t.refresh();
}

/** Make a copy of `srcKey` with its solid green (chroma) background keyed to
 *  transparent, at full resolution; returns the new texture key (cached). */
function keyedSource(scene: Phaser.Scene, srcKey: string): string {
  const destKey = `${srcKey}_keyed`;
  if (scene.textures.exists(destKey)) return destKey;
  const img = scene.textures.get(srcKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const w = img.width;
  const h = img.height;
  const t = scene.textures.createCanvas(destKey, w, h);
  if (!t) return srcKey;
  const ctx = t.getContext();
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    // pure chroma green only (keeps teal/cyan neon: those have high blue)
    if (px[i + 1] > 150 && px[i] < 120 && px[i + 2] < 120) px[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  t.refresh();
  return destKey;
}

/** Bake a directional asset's three facing keys — from a 4-view sheet (sliced +
 *  downscaled) when `a.sheet` is set, else from the single source image. */
function bakeDir(scene: Phaser.Scene, a: DirAsset, srcKey: string): void {
  if (a.sheet) {
    const s = a.sheet;
    const src = s.chromaKey ? keyedSource(scene, srcKey) : srcKey;
    const cut = (v: [number, number], facing: FacingSet, flip: boolean) => {
      const sw = v[1] - v[0];
      const destH = s.displayHeight;
      const destW = Math.max(1, Math.round(sw * (destH / s.viewH)));
      bakeRectScaled(scene, src, v[0], s.viewY, sw, s.viewH, destW, destH, dirTextureKey(a.base, facing), flip);
    };
    cut(s.views.down, 'down', false);
    cut(s.views.up, 'up', false);
    cut(s.views.side, 'side', a.sideFlip);
    return;
  }
  bakeImageTo(scene, srcKey, dirTextureKey(a.base, 'down'), false);
  bakeImageTo(scene, srcKey, dirTextureKey(a.base, 'up'), false);
  bakeImageTo(scene, srcKey, dirTextureKey(a.base, 'side'), a.sideFlip);
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
      bakeDir(scene, a, srcKey);
    }
    applied++;
  }
  if (applied > 0) {
    console.info(`[OtakuHunter] drop-in art active for ${applied}/${KENNEY_MANIFEST.length} slot(s).`);
  }
}
