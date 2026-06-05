// 4-direction facing (architecture; art is placeholder for now).
//
// Movement vectors snap to the nearest CARDINAL (up/down/left/right). Diagonals
// round to the nearest cardinal. We never free-rotate the sprite image — we swap
// to the correct directional art. There are 3 unique facing SETS — front (down),
// back (up), side — with left/right derived from `side` via flipX.
//
// Key convention real art drops into (no logic changes needed):
//   • animation (preferred):  `${base}-${set}-${state}`   e.g. "player-side-walk"
//   • static texture:         `${base}_${set}`            e.g. "player_side"
//   where set ∈ {down, up, side} and state ∈ {idle, walk, attack}.
// Register sprite-sheet animations under those keys (or add the textures) and
// applyFacing() will use them automatically.

import Phaser from 'phaser';

export type Cardinal = 'down' | 'up' | 'left' | 'right';
export type FacingSet = 'down' | 'up' | 'side';
export type MoveState = 'idle' | 'walk' | 'attack';

/** Snap a movement vector to the nearest cardinal; keep `prev` when stationary. */
export function vectorToCardinal(x: number, y: number, prev: Cardinal): Cardinal {
  if (x === 0 && y === 0) return prev;
  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

/** Map a cardinal to its art set + horizontal flip (left = flipped side). */
export function cardinalToSet(c: Cardinal): { set: FacingSet; flipX: boolean } {
  if (c === 'up') return { set: 'up', flipX: false };
  if (c === 'down') return { set: 'down', flipX: false };
  return { set: 'side', flipX: c === 'left' };
}

export const dirTextureKey = (base: string, set: FacingSet) => `${base}_${set}`;
const animKeyOf = (base: string, set: FacingSet, state: MoveState) => `${base}-${set}-${state}`;

/**
 * Apply a facing + movement state to a sprite. Prefers a registered animation,
 * falls back to a static directional texture. Cheap to call every frame:
 * flipX always updates; texture/anim only changes when set or state changes.
 */
export function applyFacing(
  sprite: Phaser.GameObjects.Sprite,
  base: string,
  cardinal: Cardinal,
  state: MoveState,
): void {
  const { set, flipX } = cardinalToSet(cardinal);
  sprite.setFlipX(flipX);

  if (sprite.getData('faceSet') === set && sprite.getData('faceState') === state) return;
  sprite.setData('faceSet', set);
  sprite.setData('faceState', state);

  const anim = animKeyOf(base, set, state);
  if (sprite.scene.anims.exists(anim)) {
    sprite.play(anim, true);
    return;
  }
  // No animation for this set/state (e.g. idle, or a class with no walk frames):
  // fall back to the static directional frame. Stop any walk anim still playing
  // so the sprite settles on the static frame instead of freezing mid-cycle.
  const tex = dirTextureKey(base, set);
  if (sprite.scene.textures.exists(tex)) {
    if (sprite.anims.isPlaying) sprite.anims.stop();
    sprite.setTexture(tex);
  }
}
