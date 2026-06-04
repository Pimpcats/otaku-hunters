// Real placeholder sprite sheet for the player character.
//
// goth_sheet_transparent_clean.png — 1536×1024, laid out 6 cols × 3 rows = 18
// frames, each cell 256×341 (1536÷6, 1024÷3). The frames are NOT yet grouped by
// direction (they mix front/back/side poses), so for now we wire the 4-direction
// system to single STATIC frames (no walk animation) chosen to best match each
// facing, and bake them into the per-facing texture keys the facing system
// already expects (`${base}_down|_up|_side`). applyFacing() then picks them up
// with zero logic change. Real animated sheets can replace these later by
// registering anims/textures under the same keys — see systems/facing.ts.
//
// Chosen frames (verified visually against the sheet):
//   • down (front): frame 0  — she faces the viewer
//   • up   (back) : frame 3  — back of head + scarf seen from behind
//   • side (profl): frame 5  — walking profile; left is derived via flipX
//
// If the PNG isn't present yet (art not dropped in), the load simply fails and
// we keep the procedural chibi placeholder — the game never breaks.

import Phaser from 'phaser';
import { PLAYER } from '../constants';
import { CHARACTERS } from '../data/characters';
import { dirTextureKey, type FacingSet } from '../systems/facing';

export const PLAYER_SHEET = {
  key: 'goth_sheet',
  file: 'goth_sheet_transparent_clean.png',
  frameWidth: 256,
  frameHeight: 341,
  /** Best-matching frame index per facing on the current (mixed) sheet. */
  frames: { down: 0, up: 3, side: 5 } as Record<FacingSet, number>,
  /**
   * Whether frame `frames.side` faces RIGHT. The baked `side` texture must face
   * right because applyFacing() flips it for left. If she moonwalks in-game,
   * flip this to false (or swap `frames.side` to 4).
   */
  sideFacesRight: true,
  /** In-game display height in px (the source frames are large). */
  displayHeight: 56,
  /** Where the gameplay hitbox sits within the frame (fraction of w/h). */
  bodyCenter: { x: 0.5, y: 0.6 },
  /** Which roster characters show this art. 'all' = every pick uses it. */
  characters: 'all' as 'all' | string[],
};

const REGISTRY_FLAG = 'gothSheetActive';

/** Queue the sheet load. Call from a scene `preload()`. No-op safe if absent. */
export function loadPlayerSheet(scene: Phaser.Scene): void {
  const url = `${import.meta.env.BASE_URL}${PLAYER_SHEET.file}`;
  scene.load.spritesheet(PLAYER_SHEET.key, url, {
    frameWidth: PLAYER_SHEET.frameWidth,
    frameHeight: PLAYER_SHEET.frameHeight,
  });
  // A missing file must not throw — warn and fall back to procedural art.
  scene.load.once('loaderror', (file: Phaser.Loader.File) => {
    if (file.key === PLAYER_SHEET.key) {
      console.warn(`[OtakuHunter] ${PLAYER_SHEET.file} not found — using procedural player art.`);
    }
  });
}

function targetIds(): string[] {
  return PLAYER_SHEET.characters === 'all'
    ? CHARACTERS.map((c) => c.id)
    : PLAYER_SHEET.characters;
}

/** Cut one sheet frame into a standalone texture `key` (optionally h-flipped). */
function bakeFrame(scene: Phaser.Scene, frameIndex: number, key: string, flip: boolean): void {
  const { frameWidth: fw, frameHeight: fh } = PLAYER_SHEET;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvasTex = scene.textures.createCanvas(key, fw, fh);
  if (!canvasTex) return;
  const ctx = canvasTex.getContext();
  const frame = scene.textures.getFrame(PLAYER_SHEET.key, frameIndex);
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
 * If the sheet loaded, bake its front/back/side frames over the per-facing
 * texture keys of the targeted characters. Returns true when real art is now
 * active. Call in `create()` AFTER procedural textures are generated.
 */
export function bakePlayerSheet(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(PLAYER_SHEET.key)) return false;
  const sideFlip = !PLAYER_SHEET.sideFacesRight;
  for (const id of targetIds()) {
    const base = CHARACTERS.find((c) => c.id === id)?.texture;
    if (!base) continue;
    bakeFrame(scene, PLAYER_SHEET.frames.down, dirTextureKey(base, 'down'), false);
    bakeFrame(scene, PLAYER_SHEET.frames.up, dirTextureKey(base, 'up'), false);
    bakeFrame(scene, PLAYER_SHEET.frames.side, dirTextureKey(base, 'side'), sideFlip);
  }
  scene.game.registry.set(REGISTRY_FLAG, true);
  return true;
}

/** Display scale that fits a sheet frame to `displayHeight`. */
export function playerSheetScale(): number {
  return PLAYER_SHEET.displayHeight / PLAYER_SHEET.frameHeight;
}

/**
 * Size the player sprite + hitbox. When the real sheet is active for this
 * character, scale the large frame down to `displayHeight` and recentre the
 * physics circle on the body; otherwise keep the default circle for the small
 * procedural art. (Arcade bodies are in source px and scale with the sprite —
 * see the boss's setScale/setCircle pairing in RunScene.)
 */
export function configurePlayerSprite(
  scene: Phaser.Scene,
  player: Phaser.Physics.Arcade.Sprite,
  characterId: string,
): void {
  const active = scene.game.registry.get(REGISTRY_FLAG) === true && targetIds().includes(characterId);
  if (!active) {
    player.setCircle(PLAYER.radius, 0, 0);
    return;
  }
  const scale = playerSheetScale();
  player.setScale(scale);
  const srcR = PLAYER.radius / scale;
  const cx = PLAYER_SHEET.frameWidth * PLAYER_SHEET.bodyCenter.x;
  const cy = PLAYER_SHEET.frameHeight * PLAYER_SHEET.bodyCenter.y;
  player.setCircle(srcR, cx - srcR, cy - srcR);
}
