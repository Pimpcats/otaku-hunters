// Enemy spawner (brief §2/§6). Spawns from just off-screen around the player,
// with density ramping over a ~15-min run. Draws archetypes from the stage's
// enemyTable. Spawn weighting keeps ~70% fodder (brief §6).

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

type SpawnFn = (key: string, x: number, y: number) => void;

// Weighted pick so RushFans dominate and Mules are seasoning.
const WEIGHTS: Record<string, number> = { RushFan: 7, MerchMule: 2 };

export class Spawner {
  private table: string[];
  private spawn: SpawnFn;
  private acc = 0;

  constructor(table: string[], spawn: SpawnFn) {
    this.table = table;
    this.spawn = spawn;
  }

  private pickKey(): string {
    const total = this.table.reduce((s, k) => s + (WEIGHTS[k] ?? 1), 0);
    let r = Math.random() * total;
    for (const k of this.table) {
      r -= WEIGHTS[k] ?? 1;
      if (r <= 0) return k;
    }
    return this.table[0];
  }

  /** elapsed = seconds since run start. */
  update(dt: number, elapsed: number, px: number, py: number, alive: number): void {
    // Interval shrinks from ~900ms toward ~180ms over ~10 minutes.
    const ramp = Phaser.Math.Clamp(elapsed / 600, 0, 1);
    const interval = Phaser.Math.Linear(900, 180, ramp);
    const cap = 60 + Math.floor(ramp * 120); // soft population cap

    this.acc += dt;
    while (this.acc >= interval && alive < cap) {
      this.acc -= interval;
      const burst = 1 + Math.floor(ramp * 2);
      for (let i = 0; i < burst && alive < cap; i++) {
        const { x, y } = this.edgePoint(px, py);
        this.spawn(this.pickKey(), x, y);
        alive++;
      }
    }
    if (this.acc > interval) this.acc = interval; // avoid runaway after a pause
  }

  /** A point just outside the visible viewport, centred on the player. */
  private edgePoint(px: number, py: number): { x: number; y: number } {
    const halfW = GAME_WIDTH / 2 + 60;
    const halfH = GAME_HEIGHT / 2 + 60;
    const side = Phaser.Math.Between(0, 3);
    switch (side) {
      case 0:
        return { x: px + Phaser.Math.Between(-halfW, halfW), y: py - halfH };
      case 1:
        return { x: px + Phaser.Math.Between(-halfW, halfW), y: py + halfH };
      case 2:
        return { x: px - halfW, y: py + Phaser.Math.Between(-halfH, halfH) };
      default:
        return { x: px + halfW, y: py + Phaser.Math.Between(-halfH, halfH) };
    }
  }
}
