// Unified movement input (brief §2 / guardrail §8.5): WASD/arrows, hold-mouse-
// to-move-toward-cursor on desktop, and a drag-anywhere virtual joystick on the
// left half of the screen for touch. Movement is the ONLY input — no aiming,
// no fire button.

import Phaser from 'phaser';

export class InputController {
  private scene: Phaser.Scene;
  private keys: {
    up: Phaser.Input.Keyboard.Key[];
    down: Phaser.Input.Keyboard.Key[];
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
  };

  // Virtual joystick / pointer-hold state.
  private active = false;
  private originX = 0;
  private originY = 0;
  private curX = 0;
  private curY = 0;
  private readonly deadZone = 8;
  private readonly maxRadius = 60;

  // Visuals for the joystick.
  private baseGfx: Phaser.GameObjects.Arc;
  private knobGfx: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard!;
    const k = (codes: number[]) => codes.map((c) => kb.addKey(c));
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: k([K.W, K.UP]),
      down: k([K.S, K.DOWN]),
      left: k([K.A, K.LEFT]),
      right: k([K.D, K.RIGHT]),
    };

    this.baseGfx = scene.add
      .circle(0, 0, this.maxRadius, 0xffffff, 0.08)
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false);
    this.knobGfx = scene.add
      .circle(0, 0, 22, 0xffffff, 0.22)
      .setScrollFactor(0)
      .setDepth(1001)
      .setVisible(false);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
  }

  private onDown(p: Phaser.Input.Pointer) {
    this.active = true;
    this.originX = p.x;
    this.originY = p.y;
    this.curX = p.x;
    this.curY = p.y;
    this.baseGfx.setPosition(p.x, p.y).setVisible(true);
    this.knobGfx.setPosition(p.x, p.y).setVisible(true);
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (!this.active || !p.isDown) return;
    this.curX = p.x;
    this.curY = p.y;
    const dx = this.curX - this.originX;
    const dy = this.curY - this.originY;
    const len = Math.hypot(dx, dy);
    const clamp = Math.min(len, this.maxRadius);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    this.knobGfx.setPosition(this.originX + nx * clamp, this.originY + ny * clamp);
  }

  private onUp() {
    this.active = false;
    this.baseGfx.setVisible(false);
    this.knobGfx.setVisible(false);
  }

  /** Normalised movement vector for this frame (length 0..1). */
  getDirection(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    let x = 0;
    let y = 0;

    const down = (arr: Phaser.Input.Keyboard.Key[]) => arr.some((key) => key.isDown);
    if (down(this.keys.left)) x -= 1;
    if (down(this.keys.right)) x += 1;
    if (down(this.keys.up)) y -= 1;
    if (down(this.keys.down)) y += 1;

    if (x !== 0 || y !== 0) {
      out.set(x, y).normalize();
      return out;
    }

    // Pointer / joystick drag.
    if (this.active) {
      const dx = this.curX - this.originX;
      const dy = this.curY - this.originY;
      const len = Math.hypot(dx, dy);
      if (len > this.deadZone) {
        out.set(dx / len, dy / len);
        return out;
      }
    }

    out.set(0, 0);
    return out;
  }

  destroy() {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.baseGfx.destroy();
    this.knobGfx.destroy();
  }
}
