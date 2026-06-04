// Generates placeholder "pixel-art" textures procedurally so the slice runs with
// zero art assets. Characters & monsters are drawn as little chibi creatures
// (body + head + facing eyes + a distinguishing feature) rather than plain dots,
// in a 4-direction set (down/up/side; left = flipped side). Real sprites drop in
// later by registering art under the same keys (see systems/facing.ts).

import Phaser from 'phaser';
import { COLORS, TEX } from '../constants';
import { CHARACTERS } from '../data/characters';
import type { FacingSet } from '../systems/facing';
import { dirTextureKey } from '../systems/facing';

const OUTLINE = 0x0b0d1a;

export interface CreatureSpec {
  size: number;
  body: number; // main body/head fill
  accent: number; // feature / accessory colour
  shape?: 'round' | 'spiky' | 'box';
  ears?: 'none' | 'cat' | 'horns';
  accessory?: 'none' | 'headband' | 'glasses' | 'hat' | 'bag' | 'crown' | 'mask';
}

type G = Phaser.GameObjects.Graphics;

/** Draw one chibi creature, facing `set`, into a size×size graphics buffer. */
function drawCreature(g: G, spec: CreatureSpec, set: FacingSet): void {
  const s = spec.size;
  const shape = spec.shape ?? 'round';
  const headR = s * 0.27;
  const headCx = s * 0.5;
  const headCy = s * 0.4;

  // ── body ──────────────────────────────────────────────────────────────────
  const bx = s * 0.22;
  const bw = s * 0.56;
  const by = s * 0.5;
  const bh = s * 0.42;
  g.lineStyle(Math.max(1, s * 0.06), OUTLINE, 0.9);
  g.fillStyle(spec.body, 1);
  if (shape === 'box') {
    g.fillRect(bx, by, bw, bh);
    g.strokeRect(bx, by, bw, bh);
  } else {
    const r = shape === 'spiky' ? s * 0.1 : s * 0.18;
    g.fillRoundedRect(bx, by, bw, bh, r);
    g.strokeRoundedRect(bx, by, bw, bh, r);
  }
  // little feet
  g.fillStyle(OUTLINE, 0.85);
  g.fillRect(bx + bw * 0.12, by + bh - 1, bw * 0.22, s * 0.08);
  g.fillRect(bx + bw * 0.66, by + bh - 1, bw * 0.22, s * 0.08);

  // ── spikes (angry crowd-monster silhouette) ─────────────────────────────────
  if (shape === 'spiky') {
    g.fillStyle(spec.body, 1);
    const sp = s * 0.13;
    for (let i = 0; i < 4; i++) {
      const px = bx + bw * (0.15 + i * 0.23);
      g.fillTriangle(px, by, px + sp, by, px + sp / 2, by - sp); // top spikes
    }
    g.fillTriangle(bx, by + bh * 0.4, bx, by + bh * 0.8, bx - sp, by + bh * 0.6); // left
    g.fillTriangle(bx + bw, by + bh * 0.4, bx + bw, by + bh * 0.8, bx + bw + sp, by + bh * 0.6); // right
  }

  // ── head ────────────────────────────────────────────────────────────────────
  g.fillStyle(spec.body, 1);
  g.lineStyle(Math.max(1, s * 0.06), OUTLINE, 0.9);
  g.fillCircle(headCx, headCy, headR);
  g.strokeCircle(headCx, headCy, headR);

  // ── ears / horns ─────────────────────────────────────────────────────────────
  if (spec.ears === 'cat') {
    g.fillStyle(spec.body, 1);
    g.fillTriangle(headCx - headR * 0.9, headCy - headR * 0.6, headCx - headR * 0.1, headCy - headR * 0.9, headCx - headR * 0.4, headCy - headR * 1.5);
    g.fillTriangle(headCx + headR * 0.9, headCy - headR * 0.6, headCx + headR * 0.1, headCy - headR * 0.9, headCx + headR * 0.4, headCy - headR * 1.5);
  } else if (spec.ears === 'horns') {
    g.fillStyle(spec.accent, 1);
    g.fillTriangle(headCx - headR * 0.7, headCy - headR * 0.7, headCx - headR * 0.2, headCy - headR * 0.7, headCx - headR * 0.9, headCy - headR * 1.7);
    g.fillTriangle(headCx + headR * 0.7, headCy - headR * 0.7, headCx + headR * 0.2, headCy - headR * 0.7, headCx + headR * 0.9, headCy - headR * 1.7);
  }

  // ── face (down = front eyes, side = one eye toward facing, up = blank back) ──
  const eyeR = Math.max(1, headR * 0.22);
  const drawEye = (ex: number, ey: number) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(ex, ey, eyeR);
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(ex + eyeR * 0.2, ey, eyeR * 0.6);
  };
  if (set === 'down') {
    drawEye(headCx - headR * 0.42, headCy + headR * 0.05);
    drawEye(headCx + headR * 0.42, headCy + headR * 0.05);
  } else if (set === 'side') {
    drawEye(headCx + headR * 0.5, headCy + headR * 0.05); // faces right
  } else {
    // up = back of head: a small hair/accent tuft, no eyes
    g.fillStyle(spec.accent, 0.8);
    g.fillCircle(headCx, headCy - headR * 0.2, headR * 0.35);
  }

  // ── accessory ────────────────────────────────────────────────────────────────
  switch (spec.accessory) {
    case 'headband': {
      g.fillStyle(spec.accent, 1);
      g.fillRect(headCx - headR, headCy - headR * 0.55, headR * 2, headR * 0.45);
      if (set === 'side') {
        g.fillTriangle(headCx + headR, headCy - headR * 0.4, headCx + headR * 1.6, headCy - headR * 0.7, headCx + headR * 1.6, headCy);
      }
      break;
    }
    case 'glasses': {
      if (set !== 'up') {
        g.lineStyle(Math.max(1, s * 0.05), spec.accent, 1);
        if (set === 'down') {
          g.strokeCircle(headCx - headR * 0.42, headCy + headR * 0.05, eyeR * 1.5);
          g.strokeCircle(headCx + headR * 0.42, headCy + headR * 0.05, eyeR * 1.5);
          g.lineBetween(headCx - headR * 0.1, headCy + headR * 0.05, headCx + headR * 0.1, headCy + headR * 0.05);
        } else {
          g.strokeCircle(headCx + headR * 0.5, headCy + headR * 0.05, eyeR * 1.5);
        }
      }
      break;
    }
    case 'mask': {
      // ninja band across the lower face
      g.fillStyle(spec.accent, 1);
      g.fillRect(headCx - headR, headCy + headR * 0.2, headR * 2, headR * 0.5);
      break;
    }
    case 'hat': {
      g.fillStyle(spec.accent, 1);
      g.fillTriangle(headCx - headR, headCy - headR * 0.5, headCx + headR, headCy - headR * 0.5, headCx, headCy - headR * 1.8);
      break;
    }
    case 'crown': {
      g.fillStyle(spec.accent, 1);
      const cy = headCy - headR * 0.7;
      g.fillRect(headCx - headR * 0.9, cy, headR * 1.8, headR * 0.4);
      for (let i = 0; i < 3; i++) {
        const px = headCx - headR * 0.7 + i * headR * 0.7;
        g.fillTriangle(px, cy, px + headR * 0.5, cy, px + headR * 0.25, cy - headR * 0.6);
      }
      break;
    }
    case 'bag': {
      g.fillStyle(spec.accent, 1);
      g.lineStyle(Math.max(1, s * 0.05), OUTLINE, 0.9);
      g.fillRect(bx + bw * 0.62, by + bh * 0.18, bw * 0.42, bh * 0.5);
      g.strokeRect(bx + bw * 0.62, by + bh * 0.18, bw * 0.42, bh * 0.5);
      break;
    }
    default:
      break;
  }
}

function creatureSet(scene: Phaser.Scene, base: string, spec: CreatureSpec): void {
  const sets: FacingSet[] = ['down', 'up', 'side'];
  for (const set of sets) {
    const key = dirTextureKey(base, set);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawCreature(g, spec, set);
    g.generateTexture(key, spec.size, spec.size);
    g.destroy();
  }
}

function circleTexture(scene: Phaser.Scene, key: string, r: number, fill: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(fill, 1);
  g.fillCircle(r, r, r);
  g.generateTexture(key, r * 2, r * 2);
  g.destroy();
}

/** A pocky-stick projectile: a white capsule with a darker "dipped" tip, drawn
 *  white so the weapon's tint colours it. Oriented along +x (rotated to travel
 *  direction in-game). */
function pockyTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const w = 20;
  const h = 8;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, w, h, h / 2); // biscuit stick
  g.fillStyle(0xb8b8b8, 1).fillRoundedRect(w - 8, 0, 8, h, h / 2); // dipped tip (shaded)
  g.generateTexture(key, w, h);
  g.destroy();
}

/** A 4-point throwing-star projectile (white, tinted + spun in-game). */
function shurikenTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const s = 16;
  const c = s / 2;
  const o = c; // blade reaches the edge
  const inn = s * 0.18; // blade half-width at the hub
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(c, c - o, c - inn, c, c + inn, c); // up
  g.fillTriangle(c, c + o, c - inn, c, c + inn, c); // down
  g.fillTriangle(c - o, c, c, c - inn, c, c + inn); // left
  g.fillTriangle(c + o, c, c, c - inn, c, c + inn); // right
  g.fillStyle(0x9a9a9a, 1).fillCircle(c, c, s * 0.12); // hub
  g.generateTexture(key, s, s);
  g.destroy();
}

// Monster recipes (the player roster brings its own, from characters.ts).
const MONSTERS: Record<string, CreatureSpec> = {
  [TEX.rushFan]: { size: 20, body: COLORS.rushFan, accent: 0xffd0d0, shape: 'spiky', ears: 'horns' },
  [TEX.merchMule]: { size: 24, body: COLORS.merchMule, accent: 0x8a5a2a, shape: 'box', accessory: 'bag' },
  [TEX.boss]: { size: 28, body: 0xc44dff, accent: 0xffe08a, shape: 'round', ears: 'horns', accessory: 'crown' },
};

/** Build every placeholder texture used by the run. Idempotent. */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  // Playable characters (each its own 4-direction creature set).
  for (const c of CHARACTERS) creatureSet(scene, c.texture, c.art);
  // Generic player fallback under the legacy key.
  creatureSet(scene, TEX.player, { size: 24, body: COLORS.player, accent: 0xffffff, shape: 'round', accessory: 'headband' });
  // Monsters.
  for (const [base, spec] of Object.entries(MONSTERS)) creatureSet(scene, base, spec);

  // Pickups + projectiles (non-directional). Each weapon gets a distinct shape.
  circleTexture(scene, TEX.xp, 5, COLORS.xp);
  circleTexture(scene, TEX.bullet, 5, COLORS.bullet);
  pockyTexture(scene, TEX.pocky);
  shurikenTexture(scene, TEX.shuriken);
  // word token: a small square
  if (!scene.textures.exists(TEX.word)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(COLORS.word, 1).fillRect(0, 0, 16, 16);
    g.lineStyle(2, 0xffffff, 1).strokeRect(1, 1, 14, 14);
    g.generateTexture(TEX.word, 16, 16);
    g.destroy();
  }
}
