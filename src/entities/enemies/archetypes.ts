// Enemy archetypes (brief §6). Each archetype = a movement AI + visual tell +
// whether it drops a word-token. All numeric stats (hp/contact/speed/xp) now
// come from the time curve in balance.ts (enemyStatsAt), so archetypes are
// behaviour-only and data-driven.

import Phaser from 'phaser';
import { TEX } from '../../constants';

export type EnemySprite = Phaser.Physics.Arcade.Sprite;

export interface EnemyArchetype {
  key: string;
  name: string;
  texture: string;
  dropsWord: boolean; // always drops a word-token on death (brief §3)
  ai: (e: EnemySprite, player: Phaser.GameObjects.Components.Transform, dt: number) => void;
}

export interface EnemyData {
  archetype: EnemyArchetype;
  hp: number;
  contact: number;
  xp: number;
  isBoss?: boolean;
  wanderAngle: number;
  flipTimer: number;
}

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
    dropsWord: false,
    ai: (e, player) => moveToward(e, player.x, player.y, e.getData('speed')),
  },

  // Merch-Mule: wanders evasively, drifts away from the player, and ALWAYS
  // drops a word-token on death — gives the swarm vocab purpose.
  MerchMule: {
    key: 'MerchMule',
    name: 'Merch-Mule',
    texture: TEX.merchMule,
    dropsWord: true,
    ai: (e, player, dt) => {
      const d = e.getData('edata') as EnemyData;
      d.flipTimer -= dt;
      if (d.flipTimer <= 0) {
        d.wanderAngle += Phaser.Math.FloatBetween(-1, 1);
        d.flipTimer = Phaser.Math.Between(400, 900);
      }
      const away = Math.atan2(e.y - player.y, e.x - player.x);
      const dist = Phaser.Math.Distance.Between(e.x, e.y, player.x, player.y);
      const blend = dist < 160 ? 0.6 : 0.15;
      d.wanderAngle = Phaser.Math.Angle.RotateTo(d.wanderAngle, away, blend);
      const speed = e.getData('speed') as number;
      (e.body as Phaser.Physics.Arcade.Body).setVelocity(
        Math.cos(d.wanderAngle) * speed,
        Math.sin(d.wanderAngle) * speed,
      );
    },
  },

  // The run's climax (brief §6 boss): a slow, relentless beeline with huge HP.
  UltimateCollector: {
    key: 'UltimateCollector',
    name: 'The Ultimate Collector',
    texture: TEX.merchMule,
    dropsWord: false,
    ai: (e, player) => moveToward(e, player.x, player.y, e.getData('speed')),
  },
};
