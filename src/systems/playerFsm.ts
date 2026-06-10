import Phaser from 'phaser';

// ── Player animation/action state machine (arena) ──────────────────────────────
// States: idle, walk, dash, attack, ultimate.
// Rules: attack interrupts walk (and idle); dash interrupts EVERYTHING (with
// i-frames); attack/dash/ultimate return to idle/walk when finished.
//
// Dash is frameless by design: a velocity burst in the move direction, a
// horizontal stretch on the sprite (scaleX 1.25 / scaleY 0.85 easing back), and
// afterimage ghosts spawned along the path (the scene clones the current frame).
//
// Attack runs 4 virtual frames at 15fps with the hitbox live on frames 2–3
// (1-indexed). The timing is authoritative here so real 4-frame attack sheets
// can drop in later purely as visuals without touching combat timing.

export type PlayerState = 'idle' | 'walk' | 'dash' | 'attack' | 'ultimate';

export const DASH = {
  speedMult: 3.2, // × walk speed during the burst
  durationMs: 180,
  iframesMs: 150,
  cooldownMs: 300,
  ghosts: 3,
  ghostAlpha: 0.4,
  ghostFadeMs: 250,
  stretchX: 1.25,
  stretchY: 0.85,
  stretchBackMs: 220,
} as const;

export const ATTACK = {
  frames: 4,
  fps: 15,
  activeFromFrame: 1, // 0-indexed: frames 2–3 of 4 (1-indexed) are live
  activeToFrame: 2,
} as const;

const ULTIMATE_MS = 600; // stub duration until the ultimate is spec'd

export interface PlayerFsmHooks {
  /** Spawn one afterimage ghost at the sprite's current position/frame. */
  onGhost: () => void;
  /** Fired once per attack when the hitbox goes live (start of frame 2). */
  onAttackActive: () => void;
  /** Fired when an ultimate starts (placeholder burst lives in the scene). */
  onUltimate?: () => void;
}

export class PlayerFsm {
  state: PlayerState = 'idle';

  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private speed: number;
  private hooks: PlayerFsmHooks;

  private baseScaleX: number;
  private baseScaleY: number;
  private stretchTween?: Phaser.Tweens.Tween;

  private stateEnds = 0;
  private dashDir = { x: 0, y: 1 };
  private lastDashAt = -Infinity;
  private invulnUntil = 0;
  private attackStart = 0;
  private attackActiveFired = false;

  /** True while attack frames 2–3 are live; the scene owns the hitbox shape. */
  hitboxActive = false;

  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, speed: number, hooks: PlayerFsmHooks) {
    this.scene = scene;
    this.sprite = sprite;
    this.speed = speed;
    this.hooks = hooks;
    this.baseScaleX = sprite.scaleX;
    this.baseScaleY = sprite.scaleY;
  }

  isInvulnerable(time: number): boolean {
    return time < this.invulnUntil;
  }

  /** Attack interrupts walk/idle only — never dash, attack, or ultimate. */
  tryAttack(time: number): boolean {
    if (this.state !== 'idle' && this.state !== 'walk') return false;
    this.state = 'attack';
    this.attackStart = time;
    this.attackActiveFired = false;
    this.hitboxActive = false;
    return true;
  }

  /** Dash interrupts everything (cooldown-gated). `dir` need not be normalized. */
  tryDash(time: number, dir: { x: number; y: number }): boolean {
    if (time - this.lastDashAt < DASH.cooldownMs) return false;
    if (dir.x === 0 && dir.y === 0) return false;
    const inv = 1 / Math.hypot(dir.x, dir.y);
    this.dashDir = { x: dir.x * inv, y: dir.y * inv };
    this.lastDashAt = time;
    this.hitboxActive = false; // a dashed-out-of attack never lands
    this.state = 'dash';
    this.stateEnds = time + DASH.durationMs;
    this.invulnUntil = time + DASH.iframesMs;

    // Horizontal stretch, easing back to the base scale.
    this.stretchTween?.remove();
    this.sprite.setScale(this.baseScaleX * DASH.stretchX, this.baseScaleY * DASH.stretchY);
    this.stretchTween = this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScaleX,
      scaleY: this.baseScaleY,
      duration: DASH.stretchBackMs,
      ease: 'Quad.easeOut',
    });

    // Ghosts along the path: one now, the rest spread over the dash window.
    this.hooks.onGhost();
    for (let i = 1; i < DASH.ghosts; i++) {
      this.scene.time.delayedCall((DASH.durationMs / DASH.ghosts) * i, () => this.hooks.onGhost());
    }
    return true;
  }

  /** Placeholder ultimate: enterable from idle/walk, returns when done. */
  tryUltimate(time: number): boolean {
    if (this.state !== 'idle' && this.state !== 'walk') return false;
    this.state = 'ultimate';
    this.stateEnds = time + ULTIMATE_MS;
    this.hooks.onUltimate?.();
    return true;
  }

  /** Advance the machine; returns the velocity to apply (world px/s).
   *  `input` is the raw movement vector (unnormalized, -1..1 per axis). */
  update(time: number, input: { x: number; y: number }): { vx: number; vy: number } {
    const moving = input.x !== 0 || input.y !== 0;

    switch (this.state) {
      case 'dash': {
        if (time >= this.stateEnds) {
          this.state = moving ? 'walk' : 'idle';
          break;
        }
        return { vx: this.dashDir.x * this.speed * DASH.speedMult, vy: this.dashDir.y * this.speed * DASH.speedMult };
      }
      case 'attack': {
        const frame = Math.floor((time - this.attackStart) / (1000 / ATTACK.fps));
        if (frame >= ATTACK.frames) {
          this.hitboxActive = false;
          this.state = moving ? 'walk' : 'idle';
          break;
        }
        this.hitboxActive = frame >= ATTACK.activeFromFrame && frame <= ATTACK.activeToFrame;
        if (frame >= ATTACK.activeFromFrame && !this.attackActiveFired) {
          this.attackActiveFired = true;
          this.hooks.onAttackActive();
        }
        return { vx: 0, vy: 0 }; // attacking roots the player
      }
      case 'ultimate': {
        if (time >= this.stateEnds) {
          this.state = moving ? 'walk' : 'idle';
          break;
        }
        return { vx: 0, vy: 0 };
      }
      default:
        break;
    }

    // idle/walk
    this.state = moving ? 'walk' : 'idle';
    if (!moving) return { vx: 0, vy: 0 };
    const inv = 1 / Math.hypot(input.x, input.y);
    return { vx: input.x * inv * this.speed, vy: input.y * inv * this.speed };
  }
}
