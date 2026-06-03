// Auto-attack (brief §2). No aiming, no fire button — the weapon fires on a
// timer toward the nearest enemy. Level-up rewards scale it (brief §4.6).

import Phaser from 'phaser';
import { TEX } from '../constants';

export class Weapon {
  scene: Phaser.Scene;
  bullets: Phaser.Physics.Arcade.Group;

  level = 1;
  damage = 1;
  fireRate = 620; // ms between shots
  projectiles = 1;
  bulletSpeed = 420;
  range = 320;

  private lastFire = 0;
  private readonly minFireRate = 180;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bullets = scene.physics.add.group({
      defaultKey: TEX.bullet,
      maxSize: 200,
    });
  }

  /** Apply N weapon levels (the level-up reward). */
  applyLevels(n: number): void {
    for (let i = 0; i < n; i++) {
      this.level += 1;
      this.damage += 1;
      this.fireRate = Math.max(this.minFireRate, this.fireRate * 0.93);
      if (this.level % 3 === 0) this.projectiles += 1;
      if (this.level % 4 === 0) this.bulletSpeed += 30;
    }
  }

  update(
    time: number,
    px: number,
    py: number,
    enemies: Phaser.Physics.Arcade.Group,
  ): void {
    if (time - this.lastFire < this.fireRate) return;

    const target = this.nearestEnemy(px, py, enemies);
    if (!target) return;
    this.lastFire = time;

    const baseAngle = Math.atan2(target.y - py, target.x - px);
    const spread = Phaser.Math.DegToRad(12);
    const start = -((this.projectiles - 1) / 2) * spread;
    for (let i = 0; i < this.projectiles; i++) {
      this.fireOne(px, py, baseAngle + start + i * spread);
    }
  }

  private fireOne(px: number, py: number, angle: number): void {
    const b = this.bullets.get(px, py, TEX.bullet) as Phaser.Physics.Arcade.Sprite | null;
    if (!b) return;
    b.enableBody(true, px, py, true, true); // re-enables recycled bullet bodies
    b.setData('damage', this.damage);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * this.bulletSpeed, Math.sin(angle) * this.bulletSpeed);
    b.setBlendMode(Phaser.BlendModes.ADD);

    // Despawn after it has travelled roughly `range`.
    this.scene.time.delayedCall((this.range / this.bulletSpeed) * 1000, () => {
      if (b.active) this.killBullet(b);
    });
  }

  killBullet(b: Phaser.Physics.Arcade.Sprite): void {
    b.disableBody(true, true); // stops + disables so it can't keep colliding
    this.bullets.killAndHide(b);
  }

  private nearestEnemy(
    px: number,
    py: number,
    enemies: Phaser.Physics.Arcade.Group,
  ): Phaser.Physics.Arcade.Sprite | null {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let bestDist = this.range * this.range;
    for (const obj of enemies.getChildren()) {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active) continue;
      const dx = e.x - px;
      const dy = e.y - py;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }
}
