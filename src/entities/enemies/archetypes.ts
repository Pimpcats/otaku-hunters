// Enemy archetypes (brief §6). Each archetype = a movement AI + visual tell +
// whether it drops a word-token. All numeric stats (hp/contact/speed/xp) now
// come from the time curve in balance.ts (enemyStatsAt), so archetypes are
// behaviour-only and data-driven.

import Phaser from 'phaser';
import { TEX, COLORS } from '../../constants';
import { BEHAVIOR } from '../../data/balance';

export type EnemySprite = Phaser.Physics.Arcade.Sprite;

export interface EnemyArchetype {
  key: string;
  name: string;
  texture: string; // BASE key; real textures are `${texture}_down|_up|_side`
  color: number; // death-burst tint
  dropsWord: boolean; // always drops a word-token on death (brief §3)
  ai: (e: EnemySprite, player: Phaser.GameObjects.Components.Transform, dt: number) => void;
  // ── optional per-archetype spawn shape / combat quirks (read by RunScene) ──
  scale?: number; // display + body scale at spawn (default 1)
  hitRadius?: number; // physics circle radius at spawn (default 9)
  weakHit?: number; // hits below this damage are shrugged off (Too-Cool)
  reverseFacing?: boolean; // shows the OPPOSITE up/down facing — Too-Cool walks backwards (too cool to face where he's going)
}

export interface EnemyData {
  archetype: EnemyArchetype;
  hp: number;
  contact: number;
  xp: number;
  isBoss?: boolean;
  wanderAngle: number;
  flipTimer: number;
  // ── behavior-AI scratch (per-enemy state; all optional) ──
  state?: 'approach' | 'flee'; // Anxious One
  timer?: number; // generic ms countdown for state machines / pulse cycles
  phase?: number; // generic accumulator (sway / glint remaining)
  buff?: number; // Lurker power-up fraction (0 = none)
  invuln?: boolean; // Too-Cool glint window (negates hits)
  latched?: boolean; // Glomper is in contact (slows the player)
  flash?: boolean; // Camera Gremlin requests a flash this frame
  baseSpeed?: number; // cached spawn speed (for live buff scaling)
  baseScale?: number; // cached spawn scale
  baseContact?: number; // cached spawn contact
}

function moveToward(e: EnemySprite, tx: number, ty: number, speed: number) {
  const body = e.body as Phaser.Physics.Arcade.Body;
  const dx = tx - e.x;
  const dy = ty - e.y;
  const len = Math.hypot(dx, dy) || 1;
  body.setVelocity((dx / len) * speed, (dy / len) * speed);
}

/** Move directly away from a point. */
function fleeFrom(e: EnemySprite, px: number, py: number, speed: number) {
  moveToward(e, e.x + (e.x - px), e.y + (e.y - py), speed);
}

const distTo = (e: EnemySprite, p: Phaser.GameObjects.Components.Transform) =>
  Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y);

/** Approach the player along an angle offset by `swayRad` (sideways weave). */
function approachWeave(e: EnemySprite, p: Phaser.GameObjects.Components.Transform, speed: number, swayRad: number) {
  const ang = Math.atan2(p.y - e.y, p.x - e.x) + swayRad;
  (e.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
}

export const ARCHETYPES: Record<string, EnemyArchetype> = {
  // Fodder bulk: straight beeline at the player.
  RushFan: {
    key: 'RushFan',
    name: 'Rushing Fan',
    texture: TEX.rushFan,
    color: COLORS.rushFan,
    dropsWord: false,
    ai: (e, player) => moveToward(e, player.x, player.y, e.getData('speed')),
  },

  // Merch-Mule: wanders evasively, drifts away from the player, and ALWAYS
  // drops a word-token on death — gives the swarm vocab purpose.
  MerchMule: {
    key: 'MerchMule',
    name: 'Merch-Mule',
    texture: TEX.merchMule,
    color: COLORS.merchMule,
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

  // 陰キャ Anxious One: rushes in, then bolts before contact — baits your aim.
  AnxiousOne: {
    key: 'AnxiousOne',
    name: 'Shy Fan',
    texture: TEX.anxious,
    color: COLORS.anxious,
    dropsWord: false,
    ai: (e, player, dt) => {
      const d = e.getData('edata') as EnemyData;
      const spd = e.getData('speed') as number;
      d.timer = (d.timer ?? 0) - dt;
      if (d.state === 'flee') {
        if (d.timer <= 0) d.state = 'approach';
      } else if (distTo(e, player) < BEHAVIOR.anxious.panicRange) {
        d.state = 'flee';
        d.timer = BEHAVIOR.anxious.fleeMs;
      }
      if (d.state === 'flee') fleeFrom(e, player.x, player.y, spd);
      else moveToward(e, player.x, player.y, spd * BEHAVIOR.anxious.approachMul);
    },
  },

  // ヲタ芸 Idol Stan: weaves side-to-side in a concert sway; a small hitbox makes
  // it genuinely hard to pin in the swarm.
  IdolWota: {
    key: 'IdolWota',
    name: 'Idol Stan',
    texture: TEX.wotagei,
    color: COLORS.wotagei,
    dropsWord: false,
    hitRadius: 6,
    ai: (e, player, dt) => {
      const d = e.getData('edata') as EnemyData;
      const spd = e.getData('speed') as number;
      d.phase = (d.phase ?? 0) + dt * BEHAVIOR.idolWota.swaySpeed;
      approachWeave(e, player, spd, Math.sin(d.phase) * BEHAVIOR.idolWota.swayAmp);
    },
  },

  // 陽キャ Too-Cool: swaggers in at a swagger pace, ignores weak hits (weakHit),
  // and pulses a brief untargetable "glint" (invuln) — punish it with big hits.
  TooCool: {
    key: 'TooCool',
    name: 'Cool Fan',
    texture: TEX.tooCool,
    color: COLORS.tooCool,
    dropsWord: false,
    weakHit: BEHAVIOR.tooCool.weakHit,
    reverseFacing: true, // walks backwards: moving down shows his back (up), moving up shows his face (down)
    ai: (e, player, dt) => {
      const d = e.getData('edata') as EnemyData;
      const spd = e.getData('speed') as number;
      d.timer = (d.timer ?? BEHAVIOR.tooCool.glintEveryMs) - dt;
      if (d.timer <= 0) {
        d.invuln = true;
        d.phase = BEHAVIOR.tooCool.glintMs; // glint window remaining
        d.timer = BEHAVIOR.tooCool.glintEveryMs;
      }
      if (d.invuln) {
        d.phase = (d.phase ?? 0) - dt;
        if (d.phase <= 0) d.invuln = false;
      }
      approachWeave(e, player, spd * BEHAVIOR.tooCool.swagger, Math.sin((d.timer ?? 0) * 0.01) * 0.25);
    },
  },

  // カメコ Camera Gremlin: stops at range and pops a blinding flash on a cooldown
  // (RunScene renders the flash where it stands). Approaches only if too far.
  CameraGremlin: {
    key: 'CameraGremlin',
    name: 'Camera Otaku',
    texture: TEX.cameko,
    color: COLORS.cameko,
    dropsWord: false,
    ai: (e, player, dt) => {
      const d = e.getData('edata') as EnemyData;
      const spd = e.getData('speed') as number;
      d.timer = (d.timer ?? BEHAVIOR.cameko.flashEveryMs) - dt;
      if (d.timer <= 0) {
        d.flash = true; // consumed by RunScene
        d.timer = BEHAVIOR.cameko.flashEveryMs;
      }
      if (distTo(e, player) > BEHAVIOR.cameko.standRange) moveToward(e, player.x, player.y, spd);
      else (e.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    },
  },

  // 古参 Old Guard: lurks at the edge and powers up the longer it's left alone —
  // ignore it too long and a fast, beefy veteran is suddenly on you.
  Lurker: {
    key: 'Lurker',
    name: 'Old Guard',
    texture: TEX.kosan,
    color: COLORS.kosan,
    dropsWord: false,
    ai: (e, player, dt) => {
      const d = e.getData('edata') as EnemyData;
      const base = (d.baseSpeed ??= e.getData('speed') as number);
      const baseScale = (d.baseScale ??= e.scaleX);
      const baseContact = (d.baseContact ??= d.contact);
      if (distTo(e, player) > BEHAVIOR.lurker.farRange) {
        d.buff = Math.min(BEHAVIOR.lurker.buffMax - 1, (d.buff ?? 0) + BEHAVIOR.lurker.buffRate * (dt / 1000));
      }
      const k = 1 + (d.buff ?? 0);
      e.setScale(baseScale * (1 + (k - 1) * 0.6)); // grows, but not grotesquely
      d.contact = Math.round(baseContact * k);
      moveToward(e, player.x, player.y, base * (BEHAVIOR.lurker.crawl + (1 - BEHAVIOR.lurker.crawl) * k));
    },
  },

  // 重課金 Whale: slow, huge, tanky. On contact it latches (flag read by RunScene
  // to slow the player) — peel away or burn it down.
  Glomper: {
    key: 'Glomper',
    name: 'Whale',
    texture: TEX.jukakin,
    color: COLORS.jukakin,
    dropsWord: false,
    scale: 1.4, // biggest non-boss (per the roster spec)
    hitRadius: 11,
    ai: (e, player) => {
      const d = e.getData('edata') as EnemyData;
      const spd = e.getData('speed') as number;
      d.latched = distTo(e, player) < BEHAVIOR.glomper.latchRange;
      moveToward(e, player.x, player.y, spd);
    },
  },

  // The run's climax (brief §6 boss): a slow, relentless beeline with huge HP.
  UltimateCollector: {
    key: 'UltimateCollector',
    name: 'The Ultimate Collector',
    texture: TEX.boss,
    color: COLORS.word,
    dropsWord: false,
    hitRadius: 30, // large central hitbox to match the ~88px boss art (vs. the 9px default)
    ai: (e, player) => moveToward(e, player.x, player.y, e.getData('speed')),
  },
};
