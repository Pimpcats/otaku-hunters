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
  {
    key: 'sheet_roster',
    file: 'roster_sheet.webp',
    frameWidth: 192,
    frameHeight: 256,
    displayHeight: 54,
    bodyCenter: { x: 0.5, y: 0.62 },
    targets: [
      // blonde green-jacket girl
      { id: 'kohai', frames: { down: 0, up: 10, side: 0 }, sideFacesRight: true },
      // brown green-dress girl
      { id: 'sensei', frames: { down: 16, up: 18, side: 16 }, sideFacesRight: true },
    ],
  },
  {
    key: 'sheet_goth',
    file: 'goth_girl.webp',
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
          frameRate: 7,
          repeat: -1,
        });
      }
    }
  }
}

/** The sheet that baked this character's art, if any is active. */
function sheetForCharacter(scene: Phaser.Scene, id: string): SheetDef | null {
  const key = scene.game.registry.get(REG(id));
  return key ? SHEETS.find((s) => s.key === key) ?? null : null;
}

/**
 * Size the player sprite + hitbox. When real sheet art is active for this
 * character, scale the large frame down to the sheet's `displayHeight` and
 * recentre the physics circle on the body; otherwise keep the default circle for
 * the small procedural art.
 */
export function configurePlayerSprite(
  scene: Phaser.Scene,
  player: Phaser.Physics.Arcade.Sprite,
  characterId: string,
): void {
  const sh = sheetForCharacter(scene, characterId);
  if (!sh) {
    player.setCircle(PLAYER.radius, 0, 0);
    return;
  }
  const scale = sh.displayHeight / sh.frameHeight;
  player.setScale(scale);
  const srcR = PLAYER.radius / scale;
  const cx = sh.frameWidth * sh.bodyCenter.x;
  const cy = sh.frameHeight * sh.bodyCenter.y;
  player.setCircle(srcR, cx - srcR, cy - srcR);
}
