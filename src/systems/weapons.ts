// Auto-attack manager (brief §2). No aiming, no fire button. Each owned weapon
// fires on its own cooldown; all numbers come from balance.ts scaled by the
// player's derived stats (Might, Haste, Amount, Area, ProjSpeed).

import Phaser from 'phaser';
import { TEX, COLORS } from '../constants';
import { WEAPONS, type WeaponDef } from '../data/balance';
import type { PlayerLoadout } from './loadout';

type Sprite = Phaser.Physics.Arcade.Sprite;
type DealDamage = (enemy: Sprite, amount: number) => void;
const AURA_BASE_RADIUS = 66;

export class WeaponManager {
  scene: Phaser.Scene;
  loadout: PlayerLoadout;
  bullets: Phaser.Physics.Arcade.Group;

  private lastFire: Record<string, number> = {};
  private auraRing?: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, loadout: PlayerLoadout) {
    this.scene = scene;
    this.loadout = loadout;
    this.bullets = scene.physics.add.group({ defaultKey: TEX.bullet, maxSize: 400 });
  }

  update(time: number, px: number, py: number, enemies: Phaser.Physics.Arcade.Group, deal: DealDamage) {
    const s = this.loadout.stats();
    for (const id of this.loadout.ownedWeaponIds()) {
      const def = WEAPONS[id];
      if (!def) continue;
      const lvl = this.loadout.weaponLevel(id);
      const base = def.level(lvl);
      const cd = base.cooldown * s.haste;
      if (time - (this.lastFire[id] ?? -99999) < cd) continue;
      this.lastFire[id] = time;
      if (def.kind === 'projectile') this.fireProjectile(px, py, base, s, enemies, def);
      else this.pulseAura(px, py, base, s, enemies, deal, def);
    }
  }

  private fireProjectile(
    px: number,
    py: number,
    base: { damage: number; amount: number; speed: number; pierce: number; range: number },
    s: { might: number; amount: number; area: number; projSpeed: number },
    enemies: Phaser.Physics.Arcade.Group,
    def: WeaponDef,
  ) {
    const reach = base.range * s.projSpeed;
    const target = this.nearest(px, py, enemies, reach);
    if (!target) return;
    const angle = Math.atan2(target.y - py, target.x - px);
    const count = base.amount + s.amount;
    const spread = Phaser.Math.DegToRad(11);
    const start = -((count - 1) / 2) * spread;
    for (let i = 0; i < count; i++) {
      this.spawnBullet(px, py, angle + start + i * spread, base, s, def);
    }
  }

  private spawnBullet(
    px: number,
    py: number,
    angle: number,
    base: { damage: number; speed: number; pierce: number; range: number },
    s: { might: number; area: number; projSpeed: number },
    def: WeaponDef,
  ) {
    const tex = def.projTexture ?? TEX.bullet;
    const b = this.bullets.get(px, py, tex) as Sprite | null;
    if (!b) return;
    b.setTexture(tex); // recycled bullets may carry another weapon's shape
    b.enableBody(true, px, py, true, true);
    b.setBlendMode(Phaser.BlendModes.ADD);
    b.setScale(s.area * (def.projScale ?? 1));
    b.setRotation(angle); // point directional shapes (the pocky stick) along travel
    if (def.tint !== undefined) b.setTint(def.tint);
    else b.clearTint();
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.setAngularVelocity(def.spin ?? 0); // spinning shuriken; 0 resets a reused bullet
    b.setData('damage', base.damage * s.might);
    b.setData('pierce', base.pierce);
    b.setData('hits', new Set<Phaser.GameObjects.GameObject>());
    const speed = base.speed * s.projSpeed;
    (b.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    // lifespan = travel distance / speed → bullet covers its full range
    const lifespanMs = (base.range / base.speed) * 1000;
    this.scene.time.delayedCall(lifespanMs, () => {
      if (b.active) this.killBullet(b);
    });
  }

  /** Called by RunScene's bullet↔enemy overlap. Returns true if it hit. */
  onBulletOverlap(b: Sprite, e: Sprite, deal: DealDamage): void {
    if (!b.active || !e.active) return;
    const hits = b.getData('hits') as Set<Phaser.GameObjects.GameObject>;
    if (hits.has(e)) return;
    hits.add(e);
    deal(e, b.getData('damage') as number);
    const pierce = ((b.getData('pierce') as number) ?? 1) - 1;
    b.setData('pierce', pierce);
    if (pierce <= 0) this.killBullet(b);
  }

  private pulseAura(
    px: number,
    py: number,
    base: { damage: number },
    s: { might: number; area: number },
    enemies: Phaser.Physics.Arcade.Group,
    deal: DealDamage,
    def: WeaponDef,
  ) {
    const radius = AURA_BASE_RADIUS * s.area;
    const ringColor = def.tint ?? COLORS.player;
    const dmg = base.damage * s.might;
    const r2 = radius * radius;
    for (const obj of enemies.getChildren()) {
      const e = obj as Sprite;
      if (!e.active) continue;
      const dx = e.x - px;
      const dy = e.y - py;
      if (dx * dx + dy * dy <= r2) deal(e, dmg);
    }
    // visual flash
    if (!this.auraRing) {
      this.auraRing = this.scene.add
        .circle(px, py, radius, ringColor, 0.18)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(45);
    }
    this.auraRing.setFillStyle(ringColor, 0.32);
    this.auraRing.setPosition(px, py).setRadius(radius).setAlpha(0.32).setVisible(true);
    this.scene.tweens.add({ targets: this.auraRing, alpha: 0, duration: 260 });
  }

  killBullet(b: Sprite): void {
    b.disableBody(true, true);
    this.bullets.killAndHide(b);
  }

  private nearest(px: number, py: number, enemies: Phaser.Physics.Arcade.Group, range: number): Sprite | null {
    let best: Sprite | null = null;
    let bestD = range * range;
    for (const obj of enemies.getChildren()) {
      const e = obj as Sprite;
      if (!e.active) continue;
      const d = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }
}
