// Enemy spawner (brief §2/§6). Density, cap and roster all come from the time
// curve in balance.ts: minute 0 trickles fodder, late game floods the screen.

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { spawnInterval, spawnBurst, maxAlive, muleShare } from '../data/balance';

type SpawnFn = (key: string, x: number, y: number) => void;

export class Spawner {
  private spawn: SpawnFn;
  private acc = 0;

  constructor(spawn: SpawnFn) {
    this.spawn = spawn;
  }

  private pickKey(t: number): string {
    return Math.random() < muleShare(t) ? 'MerchMule' : 'RushFan';
  }

  /** dt in ms, t = seconds since run start. */
  update(dt: number, t: number, px: number, py: number, alive: number): void {
    const interval = spawnInterval(t);
    const cap = maxAlive(t);
    this.acc += dt;
    while (this.acc >= interval && alive < cap) {
      this.acc -= interval;
      const burst = spawnBurst(t);
      for (let i = 0; i < burst && alive < cap; i++) {
        const { x, y } = this.edgePoint(px, py);
        this.spawn(this.pickKey(t), x, y);
        alive++;
      }
    }
    if (this.acc > interval) this.acc = interval; // no runaway after a pause
  }

  private edgePoint(px: number, py: number): { x: number; y: number } {
    const halfW = GAME_WIDTH / 2 + 60;
    const halfH = GAME_HEIGHT / 2 + 60;
    switch (Phaser.Math.Between(0, 3)) {
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
