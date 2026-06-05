import Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../constants';
import { RENDER, DEPTH } from '../data/render';

// Layers 3 + 4: the tilted ground plane and parallax background.
//
// Everything here is drawn in SCREEN space (scrollFactor 0) and scrolled by the
// camera, so the world/gameplay positions are never touched — entities stay where
// physics put them; only the floor *reads* as a receding, tilted plane. This is
// the Hades trick: tilt the ground, keep the sprites upright billboards.
//
// `groundTilt` blends the floor between two mappings:
//   • tilt 0 → an even, flat grid that scrolls 1:1 with the camera (today's look).
//   • tilt 1 → a strong perspective recession toward a horizon.
// So the dial goes continuously from flat top-down to dramatic, and every value in
// between is valid — exactly the flat→tilted comparison the brief asks for.
//
// Cost: a couple of gradient rects + ~30 lines redrawn per frame in one Graphics.
// Negligible next to the swarm; holds frame rate trivially.

const HORIZON_FULL = 0.15; // horizon screen-y fraction at tilt = 1
const PERSP = 5; // perspective compression strength at tilt = 1

export class Backdrop {
  private g: Phaser.GameObjects.Graphics;
  private parallax: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    // Ground gradient + grid (opaque base).
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.ground);
    // Parallax skyline sits in the back-wall band ABOVE the opaque floor fill but
    // below the shadows/entities, so the silhouettes actually show through.
    this.parallax = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.grid);
  }

  /** Screen y of a floor line `d` world-px back from the near (bottom) edge. */
  private rowY(d: number, tilt: number, floorTop: number): number {
    const flat = H - d; // 1:1 — even spacing
    const persp = floorTop + (H - floorTop) / (1 + (PERSP * tilt) * (d / RENDER.gridSize));
    return Phaser.Math.Linear(flat, persp, tilt);
  }

  update(): void {
    const cam = this.scene.cameras.main;
    const camX = cam.scrollX;
    const camY = cam.scrollY;
    const tilt = Phaser.Math.Clamp(RENDER.groundTilt, 0, 1);
    const floorTop = Phaser.Math.Linear(0, H * HORIZON_FULL, tilt); // wall/floor seam
    const cx = W / 2; // vanishing x

    this.drawParallax(camX, camY, floorTop);

    const g = this.g;
    g.clear();

    // ── Ground gradient: a back wall band above the seam, the floor below it ────
    if (floorTop > 0) {
      g.fillGradientStyle(RENDER.skyTop, RENDER.skyTop, RENDER.skyBottom, RENDER.skyBottom, 1);
      g.fillRect(0, 0, W, floorTop);
    }
    g.fillGradientStyle(RENDER.floorFar, RENDER.floorFar, RENDER.floorNear, RENDER.floorNear, 1);
    g.fillRect(0, floorTop, W, H - floorTop);

    const grid = RENDER.gridSize;
    const scroll = RENDER.gridScroll;

    // ── Horizontal floor lines (constant world-Y), bunching toward the horizon ──
    const worldBottom = camY + H;
    const phaseY = ((worldBottom * scroll) % grid + grid) % grid;
    for (let k = 0; k < 80; k++) {
      const d = k * grid + phaseY; // world px back from the near edge
      const y = this.rowY(d, tilt, floorTop);
      if (y <= floorTop + 0.5) break; // receded past the horizon
      if (y > H) continue;
      const fade = Phaser.Math.Clamp((y - floorTop) / (H - floorTop), 0, 1);
      g.lineStyle(1, lerpColor(RENDER.gridFar, RENDER.gridColor, fade), 0.18 + 0.5 * fade);
      g.lineBetween(0, y, W, y);
    }

    // ── Vertical floor lines (constant world-X), converging toward the vanish ──
    const phaseX = ((camX * scroll) % grid + grid) % grid;
    const n = Math.ceil(W / grid) + 2;
    for (let k = -1; k < n; k++) {
      const sxb = k * grid - phaseX; // x at the near (bottom) edge
      const sxt = Phaser.Math.Linear(sxb, cx, tilt); // converged x at the seam
      g.lineStyle(1, RENDER.gridColor, 0.32);
      g.lineBetween(sxb, H, sxt, floorTop);
    }
  }

  /** Far → near horizontal bands behind the floor that drift slower than the camera. */
  private drawParallax(camX: number, camY: number, floorTop: number): void {
    const p = this.parallax;
    p.clear();
    if (!RENDER.parallax || floorTop <= 1) return; // only meaningful once there's a back wall
    const layers = RENDER.parallaxStrength;
    for (let i = 0; i < layers.length; i++) {
      const strength = layers[i];
      // Nearer layers are taller + darker silhouettes; far layers hazier.
      const sil = lerpColor(RENDER.skyBottom, 0x06040f, 0.2 + 0.22 * i);
      const bandH = floorTop * (0.5 + 0.25 * i);
      const yBase = floorTop - bandH;
      // horizontal drift from camera x; gentle vertical drift from camera y
      const off = -(camX * strength) % (W * 0.5);
      p.fillStyle(sil, 0.45 + 0.15 * i);
      // two tiles so the drift wraps seamlessly across the screen width
      for (let t = -1; t <= 1; t++) {
        const x = off + t * (W * 0.5);
        // simple silhouette: staggered rectangles suggesting a far skyline
        for (let s = 0; s < 4; s++) {
          const bw = W * 0.12;
          const bx = x + s * (W * 0.13);
          const bh = bandH * (0.6 + 0.12 * ((s + i) % 3));
          p.fillRect(bx, yBase + (bandH - bh) + camY * strength * 0.05, bw, bh);
        }
      }
    }
  }
}

/** Lerp between two 0xRRGGBB ints. */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const gg = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gg << 8) | bl;
}
