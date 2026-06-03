// Enemy archetypes (brief §6). Each archetype = a movement AI + combat quirk +
// visual tell. The slice ships the two the §10 milestone needs; the table is
// data so the rest drop in without touching core code.

import Phaser from 'phaser';
import { TEX } from '../../constants';

export interface EnemyArchetype {
  key: string;
  name: string;
  texture: string;
  hp: number;
  speed: number;
  contactDamage: number;
  xp: number;
  dropsWord: boolean; // always drops a word-token on death (brief §3)
  /** Per-frame steering. Writes a desired velocity onto the body. */
  ai: (e: EnemySprite, player: Phaser.GameObjects.Components.Transform, dt: number) => void;
}

export interface EnemyData {
  archetype: EnemyArchetype;
  hp: number;
  // scratch state for AIs that need memory
  wanderAngle: number;
  flipTimer: number;
}

export type EnemySprite = Phaser.Physics.Arcade.Sprite & { data: Phaser.Data.DataManager };

function moveToward(e: EnemySprite, tx: number, ty: number, speed: number) {
  const body = e.body as Phaser.Physics.Arcade.Body;
  const dx = tx - e.x;
  const dy = ty - e.y;
  const len = Math.hypot(dx, dy) || 1;
  body.setVelocity((dx / len) * speed, (dy / len) * speed);
}

export const ARCHETYPES: Record<string, EnemyArchetype> = {
  // Fodder bulk: straight beeline at the player.
  RushFan: {
    key: 'RushFan',
    name: 'Rushing Fan',
    texture: TEX.rushFan,
    hp: 3,
    speed: 70,
    contactDamage: 8,
    xp: 1,
    dropsWord: false,
    ai: (e, player) => moveToward(e, player.x, player.y, e.getData('speed')),
  },

  // Merch-Mule: wanders evasively, drifts away from the player, and ALWAYS
  // drops a word-token on death — this is what gives the swarm vocab purpose.
  MerchMule: {
    key: 'MerchMule',
    name: 'Merch-Mule',
    texture: TEX.merchMule,
    hp: 6,
    speed: 55,
    contactDamage: 6,
    xp: 2,
    dropsWord: true,
    ai: (e, player, dt) => {
      const d: EnemyData = e.getData('edata');
      d.flipTimer -= dt;
      if (d.flipTimer <= 0) {
        d.wanderAngle += Phaser.Math.FloatBetween(-1, 1);
        d.flipTimer = Phaser.Math.Between(400, 900);
      }
      // bias the wander away from the player so it stays loot-y and evasive
      const away = Math.atan2(e.y - player.y, e.x - player.x);
      const dist = Phaser.Math.Distance.Between(e.x, e.y, player.x, player.y);
      const blend = dist < 160 ? 0.6 : 0.15;
      const angle = Phaser.Math.Angle.RotateTo(d.wanderAngle, away, blend);
      d.wanderAngle = angle;
      const speed = e.getData('speed') as number;
      (e.body as Phaser.Physics.Arcade.Body).setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
      );
    },
  },
};
