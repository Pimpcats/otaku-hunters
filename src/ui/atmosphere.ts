import Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../constants';
import { RENDER, DEPTH } from '../data/render';

// Layer 5: atmosphere + neon glow — the Edgerunners "everything glows" mood.
//
// Two cheap pieces:
//  1) A baked screen overlay (one normal-blend full-screen quad, built once) that
//     carries the colour grade + vignette, so it costs nothing per frame with a big
//     swarm:
//       • a saturated core (RENDER.grade @ gradeStrength) biases the centre,
//       • a clear mid-ring keeps the play area readable,
//       • a deep dark edge (@ vignette) focuses the eye (neon-night).
//     An optional overall MULTIPLY tint is added only if ambientTint isn't neutral.
//  2) Camera POST-FX (WebGL only): a ColorMatrix saturate boost + a bloom so bright
//     neon elements (XP, attacks, the cyan grid, level-up) glow. Skipped cleanly on
//     the Canvas renderer — the baked overlay still gives the dark-edged grade.
//     An optional CRT scanline overlay (RENDER.scanlines) is available, off by default.

const KEY = 'fx_atmosphere';
const SCANLINE_KEY = 'fx_scanline';

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

    this.applyCameraGlow(scene);
    this.addScanlines(scene);
  }

  /**
   * Camera post-FX: a saturation boost then a bloom so bright neon elements glow.
   * WebGL-only — `cameras.main.postFX` is inert under the Canvas renderer, so we
   * gate on the renderer type and the scene simply keeps the baked overlay look.
   */
  private applyCameraGlow(scene: Phaser.Scene): void {
    if (scene.sys.renderer.type !== Phaser.WEBGL) return;
    const fx = scene.cameras.main.postFX;
    if (!fx) return;
    // Saturate first so the bloom blooms the punched-up neon, not the raw frame.
    if (RENDER.saturate > 0) fx.addColorMatrix().saturate(RENDER.saturate, false);
    if (RENDER.bloom) {
      fx.addBloom(RENDER.bloomColor, 1, 1, RENDER.bloomBlur, RENDER.bloomStrength, RENDER.bloomSteps);
    }
  }

  /** Optional CRT scanlines: a 1×2 (clear/dark) tile repeated down the screen. */
  private addScanlines(scene: Phaser.Scene): void {
    if (!RENDER.scanlines) return;
    if (!scene.textures.exists(SCANLINE_KEY)) {
      const tex = scene.textures.createCanvas(SCANLINE_KEY, 1, 2);
      if (!tex) return;
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, 1, 2);
      ctx.fillStyle = rgba(0x000000, RENDER.scanlineAlpha);
      ctx.fillRect(0, 1, 1, 1); // every other row is dimmed
      tex.refresh();
    }
    scene.add
      .tileSprite(0, 0, W, H, SCANLINE_KEY)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.atmosphere + 1);
  }
}
