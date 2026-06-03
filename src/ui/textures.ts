// Generates placeholder "pixel-art" textures procedurally so the slice runs
// with zero art assets. Real sprites drop in later by replacing these keys.

import Phaser from 'phaser';
import { COLORS, TEX } from '../constants';

function rectTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  fill: number,
  stroke?: number,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(fill, 1);
  g.fillRect(0, 0, w, h);
  if (stroke !== undefined) {
    g.lineStyle(2, stroke, 1);
    g.strokeRect(1, 1, w - 2, h - 2);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

function circleTexture(scene: Phaser.Scene, key: string, r: number, fill: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(fill, 1);
  g.fillCircle(r, r, r);
  g.generateTexture(key, r * 2, r * 2);
  g.destroy();
}

/** Build every placeholder texture used by the run. Idempotent. */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  // Player — cyan diamond-ish block.
  rectTexture(scene, TEX.player, 24, 24, COLORS.player, 0xffffff);
  // Enemies.
  rectTexture(scene, TEX.rushFan, 20, 20, COLORS.rushFan, 0x000000);
  rectTexture(scene, TEX.merchMule, 24, 24, COLORS.merchMule, 0x000000);
  // Pickups.
  circleTexture(scene, TEX.xp, 5, COLORS.xp);
  rectTexture(scene, TEX.word, 16, 16, COLORS.word, 0xffffff);
  // Projectile.
  circleTexture(scene, TEX.bullet, 5, COLORS.bullet);
}
