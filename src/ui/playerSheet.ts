// Real placeholder sprite sheets for the player roster.
//
// We have two source sheets (1536×1024 webp), each cut into a grid of frames.
// The frames aren't grouped by direction, so — as before — we wire the
// 4-direction system to single STATIC frames chosen to best match each facing,
// and bake them onto the per-facing texture keys the facing system already
// expects (`${base}_down|_up|_side`). applyFacing() then picks them up with zero
// logic change. Left is derived from `side` via flipX.
//
//   roster_sheet.webp — 8 cols × 4 rows, 192×256 cells. Holds several
//     characters; we use the blonde (green jacket) and brown (green dress) girls.
//   goth_girl.webp    — 6 cols × 3 rows, 256×341 cells. One clean goth character.
//
// Per-character frame picks were verified visually against the sheets. The
// blonde/brown girls have no side profile on the sheet, so `side` reuses the
// front frame (they face the viewer while strafing). If a file is missing the
// load simply fails and that class keeps its procedural chibi — never breaks.

import Phaser from 'phaser';
import { PLAYER } from '../constants';
import { CHARACTERS } from '../data/characters';
import { dirTextureKey, type FacingSet } from '../systems/facing';

interface CharFrames {
  id: string; // roster character id this art maps to
  frames: Record<FacingSet, number>; // sheet frame index per facing (static fallback)
  /** Whether `frames.side` already faces RIGHT (baked `side` must face right, so
   *  a left-facing source is flipped). */
  sideFacesRight: boolean;
  /** Optional per-facing WALK cycles (sheet frame indices). Present only for
   *  sheets whose frames form a coherent walk — registered as Phaser anims under
   *  `${base}-${set}-walk`, which applyFacing() prefers over the static frame.
   *  Sheets without clean walk frames (the roster girls) omit this and rely on
   *  the procedural walk-bob instead. */
  walk?: Partial<Record<FacingSet, number[]>>;
}

interface SheetDef {
  key: string;
  file: string;
  frameWidth: number;
  frameHeight: number;
  displayHeight: number; // in-game sprite height in px (source frames are large)
  bodyCenter: { x: number; y: number }; // hitbox centre within the frame (fraction)
  targets: CharFrames[];
}

const SHEETS: SheetDef[] = [
  // Kōhai + Sensei now use their own 4-direction rect sheets (HERO_SHEETS); only
  // the goth sheet (Rōnin) still uses the uniform-grid path.
  {
    key: 'sheet_goth',
    file: 'sprites/heroes/_legacy/goth_girl.webp',
    frameWidth: 256,
    frameHeight: 341,
    displayHeight: 56,
    bodyCenter: { x: 0.5, y: 0.6 },
    targets: [
      // The goth sheet is laid out as columns = direction, rows = animation
      // frames, so each direction yields a clean 3-frame walk cycle:
      //   front = col0 (0,6,12) · back = col3 (3,9,15) · side = col5 (5,11,17)
      {
        id: 'ronin',
        frames: { down: 0, up: 3, side: 17 },
        sideFacesRight: true,
        walk: { down: [0, 6, 12], up: [3, 9, 15], side: [5, 11, 17] },
      },
    ],
  },
];

// registry key → which sheet baked a given character (also the "art active" flag)
const REG = (id: string) => `sheetActive:${id}`;

// Sizing info for the active art, so configurePlayerSprite works the same whether
// the art came from a uniform-grid sheet or an explicit-rect hero sheet.
interface RigSpec {
  displayHeight: number;
  frameW: number;
  frameH: number;
  bodyCenter: { x: number; y: number };
}
const RIG = (id: string) => `rigSpec:${id}`;

// ── Per-character 4-direction sheets sliced by EXPLICIT pixel rectangles ───────
// (a horizontal row of views inside a vertical band — not a uniform grid). Each
// view is baked onto `${base}_down|_up|_side`; left derives from `side` via flipX.
interface HeroRectSheet {
  id: string; // character id
  file: string; // path under public/
  key: string; // loader image key
  viewY: number; // top of the character band (source px)
  viewH: number; // band height (source px)
  displayHeight: number; // in-game sprite height (px)
  bodyCenter: { x: number; y: number }; // hitbox centre within a view (fraction)
  views: { down: [number, number]; up: [number, number]; side: [number, number] }; // [x0,x1] per facing
  sideFlip: boolean; // flip the side crop so the baked 'side' faces RIGHT
}

const HERO_SHEETS: HeroRectSheet[] = [
  {
    id: 'kohai',
    file: 'sprites/heroes/kohai/kohai_4dir_transparent.webp',
    key: 'sheet_kohai_4dir',
    viewY: 194,
    viewH: 597, // 791 − 194
    displayHeight: 60, // ~56–64px tall in-game
    bodyCenter: { x: 0.5, y: 0.66 },
    views: { down: [46, 363], up: [441, 724], side: [805, 1075] },
    sideFlip: true, // frame 2 is side-LEFT → flip so the stored 'side' faces right
  },
  {
    id: 'sensei',
    file: 'sprites/heroes/sensei/sensei_4dir_transparent.webp',
    key: 'sheet_sensei_4dir',
    viewY: 227,
    viewH: 567, // 794 − 227
    displayHeight: 60,
    bodyCenter: { x: 0.5, y: 0.66 },
    views: { down: [104, 346], up: [492, 709], side: [828, 1078] },
    sideFlip: true, // frame 2 is side-LEFT → flip so the stored 'side' faces right
  },
];

/** Queue hero rect-sheet image loads. Call from `preload()`; missing files safe. */
export function loadHeroSheets(scene: Phaser.Scene): void {
  for (const hs of HERO_SHEETS) scene.load.image(hs.key, `${import.meta.env.BASE_URL}${hs.file}`);
}

/** Bake an arbitrary source rectangle of `img` onto `destKey` (optionally h-flipped). */
function bakeRect(
  scene: Phaser.Scene,
  img: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  destKey: string,
  flip: boolean,
): void {
  if (scene.textures.exists(destKey)) scene.textures.remove(destKey);
  const t = scene.textures.createCanvas(destKey, sw, sh);
  if (!t) return;
  const ctx = t.getContext();
  ctx.clearRect(0, 0, sw, sh);
  ctx.save();
  if (flip) {
    ctx.translate(sw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.restore();
  t.refresh();
}

/** Slice each hero rect-sheet's views onto its character's facing keys. Call in
 *  `create()` (after the procedural textures exist; overrides them when loaded). */
export function bakeHeroSheets(scene: Phaser.Scene): void {
  for (const hs of HERO_SHEETS) {
    if (!scene.textures.exists(hs.key)) continue;
    const base = CHARACTERS.find((c) => c.id === hs.id)?.texture;
    if (!base) continue;
    const img = scene.textures.get(hs.key).getSourceImage() as CanvasImageSource;
    const cut = (v: [number, number], facing: FacingSet, flip: boolean) =>
      bakeRect(scene, img, v[0], hs.viewY, v[1] - v[0], hs.viewH, dirTextureKey(base, facing), flip);
    cut(hs.views.down, 'down', false);
    cut(hs.views.up, 'up', false);
    cut(hs.views.side, 'side', hs.sideFlip);
    scene.game.registry.set(REG(hs.id), hs.key);
    scene.game.registry.set(RIG(hs.id), {
      displayHeight: hs.displayHeight,
      frameW: hs.views.down[1] - hs.views.down[0],
      frameH: hs.viewH,
      bodyCenter: hs.bodyCenter,
    } satisfies RigSpec);
  }
}

/** Queue every sheet load. Call from a scene `preload()`. Missing files are safe. */
export function loadPlayerSheets(scene: Phaser.Scene): void {
  for (const sh of SHEETS) {
    const url = `${import.meta.env.BASE_URL}${sh.file}`;
    scene.load.spritesheet(sh.key, url, { frameWidth: sh.frameWidth, frameHeight: sh.frameHeight });
  }
  scene.load.on('loaderror', (file: Phaser.Loader.File) => {
    if (SHEETS.some((s) => s.key === file.key)) {
      console.warn(`[OtakuHunter] ${file.key} not found — procedural art for its classes.`);
    }
  });
}

/** Cut one sheet frame into a standalone texture `key` (optionally h-flipped). */
function bakeFrame(scene: Phaser.Scene, sh: SheetDef, frameIndex: number, key: string, flip: boolean): void {
  const { frameWidth: fw, frameHeight: fh } = sh;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvasTex = scene.textures.createCanvas(key, fw, fh);
  if (!canvasTex) return;
  const ctx = canvasTex.getContext();
  const frame = scene.textures.getFrame(sh.key, frameIndex);
  ctx.clearRect(0, 0, fw, fh);
  ctx.save();
  if (flip) {
    ctx.translate(fw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, fw, fh, 0, 0, fw, fh);
  ctx.restore();
  canvasTex.refresh();
}

/**
 * For each sheet that loaded, bake its front/back/side frames over the
 * per-facing texture keys of its target characters. Call in `create()` AFTER the
 * procedural textures are generated.
 */
export function bakePlayerSheets(scene: Phaser.Scene): void {
  for (const sh of SHEETS) {
    if (!scene.textures.exists(sh.key)) continue;
    for (const t of sh.targets) {
      const base = CHARACTERS.find((c) => c.id === t.id)?.texture;
      if (!base) continue;
      bakeFrame(scene, sh, t.frames.down, dirTextureKey(base, 'down'), false);
      bakeFrame(scene, sh, t.frames.up, dirTextureKey(base, 'up'), false);
      bakeFrame(scene, sh, t.frames.side, dirTextureKey(base, 'side'), !t.sideFacesRight);
      scene.game.registry.set(REG(t.id), sh.key);
      scene.game.registry.set(RIG(t.id), {
        displayHeight: sh.displayHeight,
        frameW: sh.frameWidth,
        frameH: sh.frameHeight,
        bodyCenter: sh.bodyCenter,
      } satisfies RigSpec);
    }
  }
}

/**
 * Register per-facing WALK animations for any sheet target that defines `walk`
 * frames. Keyed `${base}-${set}-walk` so applyFacing() picks them up with zero
 * logic change (it already prefers an animation over the static frame). Left is
 * derived from the right-facing `side` cycle via flipX, same as the static path.
 * Call in `create()` after the sheets have loaded. Safe to call if a sheet is
 * missing — its target is simply skipped and that class stays on static art.
 */
export function registerPlayerAnims(scene: Phaser.Scene): void {
  const SETS: FacingSet[] = ['down', 'up', 'side'];
  for (const sh of SHEETS) {
    if (!scene.textures.exists(sh.key)) continue;
    for (const t of sh.targets) {
      if (!t.walk) continue;
      const base = CHARACTERS.find((c) => c.id === t.id)?.texture;
      if (!base) continue;
      for (const set of SETS) {
        const idxs = t.walk[set];
        if (!idxs || idxs.length === 0) continue;
        const key = `${base}-${set}-walk`;
        if (scene.anims.exists(key)) scene.anims.remove(key);
        scene.anims.create({
          key,
          frames: idxs.map((frame) => ({ key: sh.key, frame })),
          frameRate: 6,
          yoyo: true, // ping-pong the 3 poses so it eases back instead of hard-cutting
          repeat: -1,
        });
      }
    }
  }
}

/**
 * Size the player sprite + hitbox. When real sheet art is active for this
 * character (a rig spec was registered), scale the large frame down to its
 * `displayHeight` and recentre the physics circle on the body; otherwise keep the
 * default circle for the small procedural art.
 */
export function configurePlayerSprite(
  scene: Phaser.Scene,
  player: Phaser.Physics.Arcade.Sprite,
  characterId: string,
): void {
  const rig = scene.game.registry.get(RIG(characterId)) as RigSpec | undefined;
  if (!rig) {
    player.setCircle(PLAYER.radius, 0, 0);
    return;
  }
  const scale = rig.displayHeight / rig.frameH;
  player.setScale(scale);
  const srcR = PLAYER.radius / scale;
  const cx = rig.frameW * rig.bodyCenter.x;
  const cy = rig.frameH * rig.bodyCenter.y;
  player.setCircle(srcR, cx - srcR, cy - srcR);
}
