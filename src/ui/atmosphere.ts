import Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../constants';
import { RENDER, DEPTH } from '../data/render';

// Layer 5: vibrant atmosphere — keep the scene bright and inviting (Stardew-poppy,
// never moody), NO real-time lighting. To stay fill-rate cheap with a big swarm we
// bake BOTH the warm "poppy" grade and the edge vignette into a SINGLE precomputed
// overlay (one normal-blend full-screen quad, set up once):
//   • a faint warm core (RENDER.grade @ gradeStrength) lifts the centre toward poppy,
//   • a clear mid-ring keeps the play area untinted,
//   • a soft dark edge (@ vignette) focuses the eye toward the action.
// An optional overall MULTIPLY tint is only added if ambientTint isn't neutral.

const KEY = 'fx_atmosphere';

function rgba(hex: number, a: number): string {
  return `rgba(${(hex >> 16) & 0xff},${(hex >> 8) & 0xff},${hex & 0xff},${a})`;
}

function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(KEY)) return;
  const tex = scene.textures.createCanvas(KEY, W, H);
  if (!tex) return;
  const ctx = tex.getContext();
  const cx = W / 2;
  const cy = H / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * 0.62);
  grad.addColorStop(0, rgba(RENDER.grade, RENDER.gradeStrength)); // warm poppy core
  grad.addColorStop(0.4, rgba(RENDER.grade, 0));
  grad.addColorStop(0.58, 'rgba(6,5,16,0)'); // clear play area
  grad.addColorStop(1, rgba(0x06050f, RENDER.vignette)); // soft dark edges
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  tex.refresh();
}

export class Atmosphere {
  constructor(scene: Phaser.Scene) {
    if (RENDER.vignette > 0 || RENDER.gradeStrength > 0) {
      ensureTexture(scene);
      scene.add
        .image(0, 0, KEY)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.atmosphere);
    }

    // Optional overall grade (MULTIPLY). Neutral white is a no-op, so skip it.
    if (RENDER.ambientTint !== 0xffffff) {
      scene.add
        .rectangle(0, 0, W, H, RENDER.ambientTint, 1)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
        .setDepth(DEPTH.atmosphere - 1);
    }
  }
}
