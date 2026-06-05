import Phaser from 'phaser';
import { RENDER, DEPTH, baselineY } from '../data/render';

// Layer 2: planted drop shadows. Every character/enemy/pickup gets a soft, flat
// elliptical shadow on the floor beneath its feet. This is the single biggest
// "grounds the sprite in 3D space" win for the lowest cost:
//   • One shared soft-blob texture, stamped by pooled Image objects → all shadows
//     batch into a single draw call (cheap even with 40+ enemies).
//   • The shadow sits at the sprite's BASELINE and does NOT follow the walk-bob —
//     it stays planted on the floor while the sprite hops above it.
//   • Squashed by shadowScaleY into a ground ellipse; opacity/size are tunable.
//
// Shadows live on a fixed depth band below the y-sorted entities, so a sprite
// never renders beneath another sprite's shadow.

const KEY = 'fx_shadow';

function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(KEY)) return;
  const d = 64;
  const tex = scene.textures.createCanvas(KEY, d, d);
  if (!tex) return;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.82)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, d, d);
  tex.refresh();
}

interface SyncOpts {
  x?: number; // shadow centre x (defaults to the sprite's x)
  baseY?: number; // floor y the shadow plants on (defaults to the sprite's baseline)
  width?: number; // shadow width in px before shadowWidth (defaults to displayWidth)
  height?: number; // sprite height used for the small foot-lift (defaults to displayHeight)
}

type Owner = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  displayWidth: number;
  displayHeight: number;
  originY: number;
};

export class ShadowLayer {
  constructor(private scene: Phaser.Scene) {
    ensureTexture(scene);
  }

  private shadowOf(owner: Owner): Phaser.GameObjects.Image {
    let s = owner.getData('shadow') as Phaser.GameObjects.Image | undefined;
    if (!s) {
      s = this.scene.add.image(owner.x, owner.y, KEY).setDepth(DEPTH.shadow).setAlpha(RENDER.shadowOpacity);
      owner.setData('shadow', s);
    }
    return s;
  }

  /** Plant / update the shadow under `owner` at its baseline. Cheap; call each frame. */
  sync(owner: Owner, opts: SyncOpts = {}): void {
    if (!RENDER.shadows) return;
    const s = this.shadowOf(owner);
    s.setVisible(true).setAlpha(RENDER.shadowOpacity);
    const w = (opts.width ?? owner.displayWidth) * RENDER.shadowWidth;
    const sc = w / s.width; // s.width is the 64px texture frame, not the scaled size
    s.setScale(sc, sc * RENDER.shadowScaleY);
    const baseY = opts.baseY ?? baselineY(owner);
    const lift = (opts.height ?? owner.displayHeight) * RENDER.shadowFootLift;
    s.setPosition(opts.x ?? owner.x, baseY - lift);
  }

  /** Hide the shadow (e.g. when its owner is recycled out of the pool). */
  hide(owner: Owner): void {
    (owner.getData('shadow') as Phaser.GameObjects.Image | undefined)?.setVisible(false);
  }
}
