// Generates placeholder "pixel-art" textures procedurally so the slice runs
// with zero art assets. Characters get a 4-direction set (down/up/side) with a
// visible facing nub so you can see the facing system working; real sprites
// drop in later by registering art under the same keys (see systems/facing.ts).

import Phaser from 'phaser';
import { COLORS, TEX } from '../constants';
import type { FacingSet } from '../systems/facing';
import { dirTextureKey } from '../systems/facing';

function circleTexture(scene: Phaser.Scene, key: string, r: number, fill: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(fill, 1);
  g.fillCircle(r, r, r);
  g.generateTexture(key, r * 2, r * 2);
  g.destroy();
}

/** A body square with a bright "facing nub" on the edge it's facing. The
 *  `side` set faces right; left is produced at runtime via flipX. */
function directionalTexture(
  scene: Phaser.Scene,
  base: string,
  size: number,
  fill: number,
  set: FacingSet,
): void {
  const key = dirTextureKey(base, set);
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(fill, 1);
  g.fillRect(0, 0, size, size);
  g.lineStyle(2, 0x000000, 0.6);
  g.strokeRect(1, 1, size - 2, size - 2);

  // facing nub (white) on the leading edge
  const m = Math.max(4, Math.floor(size * 0.24));
  let mx = (size - m) / 2;
  let my = (size - m) / 2;
  if (set === 'down') my = size - m - 2;
  else if (set === 'up') my = 2;
  else mx = size - m - 2; // side → right edge
  g.fillStyle(0xffffff, 0.92);
  g.fillRect(mx, my, m, m);

  g.generateTexture(key, size, size);
  g.destroy();
}

function characterSet(scene: Phaser.Scene, base: string, size: number, fill: number): void {
  directionalTexture(scene, base, size, fill, 'down');
  directionalTexture(scene, base, size, fill, 'up');
  directionalTexture(scene, base, size, fill, 'side');
}

/** Build every placeholder texture used by the run. Idempotent. */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  // Characters — 4-direction sets (down/up/side).
  characterSet(scene, TEX.player, 24, COLORS.player);
  characterSet(scene, TEX.rushFan, 20, COLORS.rushFan);
  characterSet(scene, TEX.merchMule, 24, COLORS.merchMule);
  characterSet(scene, TEX.boss, 24, COLORS.merchMule); // tinted purple at spawn
  // Pickups + projectile (non-directional).
  circleTexture(scene, TEX.xp, 5, COLORS.xp);
  circleTexture(scene, TEX.bullet, 5, COLORS.bullet);
  // word token: a small square
  if (!scene.textures.exists(TEX.word)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(COLORS.word, 1).fillRect(0, 0, 16, 16);
    g.lineStyle(2, 0xffffff, 1).strokeRect(1, 1, 14, 14);
    g.generateTexture(TEX.word, 16, 16);
    g.destroy();
  }
}
