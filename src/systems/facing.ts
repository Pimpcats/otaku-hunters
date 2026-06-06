// Directional facing — 8-way, with a graceful fall back to 4-way.
//
// Movement snaps to one of 8 facings (each a 45°-wide zone centred on its axis).
// We never free-rotate the sprite image — we pick the matching directional art.
//
// A sprite shows the best art it actually HAS, in this order (per facing + state):
//   1. 8-dir animation  `${base}-${dir}-${state}`     e.g. "char_rushfan-downleft-walk"
//   2. 8-dir static     `${base}_${dir}`              e.g. "char_rushfan_downleft"
//   3. 4-dir animation  `${base}-${set}-${state}`     e.g. "char_toocool-side-walk"  (+flipX)
//   4. 4-dir static     `${base}_${set}`              e.g. "char_kohai_side"         (+flipX)
// So an enemy/character with only 4-dir art (down/up/side) keeps working unchanged —
// diagonals read as the side facing (mirrored for left), exactly like the old system —
// while one with a full 8-dir sheet gets true diagonal art. No caller changes needed.

import Phaser from 'phaser';

export type Cardinal = 'down' | 'up' | 'left' | 'right';
export type FacingDir = Cardinal | 'downleft' | 'downright' | 'upleft' | 'upright';
export type FacingSet = 'down' | 'up' | 'side'; // 4-dir art sets (left/right via flipX)
export type MoveState = 'idle' | 'walk' | 'attack';

/** Snap a movement vector to the nearest cardinal; keep `prev` when stationary.
 *  (Kept for any 4-dir-only caller; the 8-way `vectorToDir8` is preferred.) */
export function vectorToCardinal(x: number, y: number, prev: Cardinal): Cardinal {
  if (x === 0 && y === 0) return prev;
  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

// Screen space: +x = right, +y = down. Sectors are 45° wide, centred on each axis.
const DIR8: FacingDir[] = ['right', 'downright', 'down', 'downleft', 'left', 'upleft', 'up', 'upright'];

/** Snap a movement vector to one of 8 facings; keep `prev` when stationary. */
export function vectorToDir8(x: number, y: number, prev: FacingDir): FacingDir {
  if (x === 0 && y === 0) return prev;
  const idx = (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8;
  return DIR8[idx];
}

/** Mirror a facing vertically (Too-Cool walks backwards). Left/right unchanged. */
export function reverseDir(d: FacingDir): FacingDir {
  switch (d) {
    case 'down':
      return 'up';
    case 'up':
      return 'down';
    case 'downleft':
      return 'upleft';
    case 'upleft':
      return 'downleft';
    case 'downright':
      return 'upright';
    case 'upright':
      return 'downright';
    default:
      return d; // left / right
  }
}

export const dirTextureKey = (base: string, set: FacingSet) => `${base}_${set}`;
const animKeyOf = (base: string, suffix: string, state: MoveState) => `${base}-${suffix}-${state}`;

/** 4-dir fallback for any 8-way facing: which set to show + horizontal flip.
 *  Diagonals read as the side facing (matches the old "diagonal → side" snap). */
function dirToSet4(d: FacingDir): { set: FacingSet; flipX: boolean } {
  if (d === 'up') return { set: 'up', flipX: false };
  if (d === 'down') return { set: 'down', flipX: false };
  // left / right / and all four diagonals → side (mirror the left-pointing ones)
  return { set: 'side', flipX: d === 'left' || d === 'downleft' || d === 'upleft' };
}

/** Resolve the best available art for (base, dir, state): the key, whether it's an
 *  animation, and the horizontal flip. Returns null when nothing is registered. */
function resolveFacing(
  scene: Phaser.Scene,
  base: string,
  dir: FacingDir,
  state: MoveState,
): { key: string; isAnim: boolean; flip: boolean } | null {
  // 1–2: true 8-dir art for this exact direction (no flip — each dir has its own art).
  const anim8 = animKeyOf(base, dir, state);
  if (scene.anims.exists(anim8)) return { key: anim8, isAnim: true, flip: false };
  const tex8 = `${base}_${dir}`;
  if (scene.textures.exists(tex8)) return { key: tex8, isAnim: false, flip: false };
  // 3–4: 4-dir fallback (down/up/side, side mirrored for left).
  const { set, flipX } = dirToSet4(dir);
  const anim4 = animKeyOf(base, set, state);
  if (scene.anims.exists(anim4)) return { key: anim4, isAnim: true, flip: flipX };
  const tex4 = dirTextureKey(base, set);
  if (scene.textures.exists(tex4)) return { key: tex4, isAnim: false, flip: flipX };
  return null;
}

/**
 * Apply a facing + movement state to a sprite. Cheap to call every frame: flipX
 * always updates; the anim/texture only changes when the resolved key changes.
 */
export function applyFacing(
  sprite: Phaser.GameObjects.Sprite,
  base: string,
  dir: FacingDir,
  state: MoveState,
): void {
  const r = resolveFacing(sprite.scene, base, dir, state);
  if (!r) return;
  sprite.setFlipX(r.flip); // flip can change without the key changing (left↔right)

  if (sprite.getData('faceKey') === r.key) return;
  sprite.setData('faceKey', r.key);

  if (r.isAnim) {
    sprite.play(r.key, true);
  } else {
    if (sprite.anims.isPlaying) sprite.anims.stop();
    sprite.setTexture(r.key);
  }
}
