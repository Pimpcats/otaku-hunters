import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import type { Cardinal } from '../systems/facing';

// ── Slash-arc VFX: one white sheet, tinted per character ───────────────────────
// The art is a NEUTRAL WHITE arc so a single sheet serves every character via
// setTint with their signature color (signatureTint below).
//
// Drop-in contract: put a real sheet at public/assets/vfx/slash_arc.png — a
// horizontal strip of SQUARE frames (frame size = image height, count = width /
// height), drawn white-on-transparent, arc opening toward +X (right) — then flip
// SLASH_SHEET_ENABLED to true. Until then a procedural 6-frame arc is baked at
// runtime, so the whole attack flow works with zero art present (and no 404s).

const SLASH_SHEET_ENABLED = false; // flip when public/assets/vfx/slash_arc.png exists
const SLASH_SHEET_PATH = 'assets/vfx/slash_arc.png';
const SLASH_SRC_KEY = 'vfx_slash_src';
const PROC_KEY = 'vfx_slash_proc';
const SLASH_ANIM = 'vfx-slash';
const PROC_SIZE = 96;
const PROC_FRAMES = 6;

/** A character's signature color (UI accent doubles as the VFX tint). */
export function signatureTint(characterId: string): number {
  return CHARACTERS.find((c) => c.id === characterId)?.themeColor ?? 0xffffff;
}

/** Queue the real VFX sheet (no-op while the drop-in slot is empty). */
export function loadSlashVfx(scene: Phaser.Scene): void {
  if (SLASH_SHEET_ENABLED) {
    scene.load.image(SLASH_SRC_KEY, `${import.meta.env.BASE_URL}${SLASH_SHEET_PATH}`);
  }
}

/** Slice a horizontal strip of square frames onto its own texture, in place. */
function sliceStrip(scene: Phaser.Scene, key: string): number {
  const tex = scene.textures.get(key);
  const img = tex.getSourceImage() as HTMLImageElement;
  const size = img.height;
  const count = Math.max(1, Math.floor(img.width / size));
  for (let i = 0; i < count; i++) tex.add(i, 0, i * size, 0, size, size);
  return count;
}

/** Bake the procedural fallback: a white crescent sweeping open, frame by frame. */
function bakeProceduralSlash(scene: Phaser.Scene): void {
  const ct = scene.textures.createCanvas(PROC_KEY, PROC_SIZE * PROC_FRAMES, PROC_SIZE)!;
  const ctx = ct.context;
  for (let i = 0; i < PROC_FRAMES; i++) {
    const p = (i + 1) / PROC_FRAMES;
    const cx = i * PROC_SIZE + PROC_SIZE * 0.38; // pivot left of center; arc opens right
    const cy = PROC_SIZE / 2;
    const sweep = Phaser.Math.DegToRad(50 + 130 * Math.min(1, p * 1.25));
    const fade = i < PROC_FRAMES - 2 ? 1 : 1 - (p - 0.66) * 1.8; // tail frames dissolve
    for (const [radius, width, alpha] of [
      [34, 17, 0.4 * fade], // soft outer glow pass
      [34, 9, 0.95 * fade], // bright core pass
    ] as const) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = width * (1 - 0.35 * p); // blade thins as it sweeps
      ctx.lineCap = 'round';
      ctx.arc(cx, cy, radius, -sweep / 2, sweep / 2);
      ctx.stroke();
    }
  }
  ct.refresh();
  for (let i = 0; i < PROC_FRAMES; i++) ct.add(i, 0, i * PROC_SIZE, 0, PROC_SIZE, PROC_SIZE);
  ct.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Resolve the sheet (real if loaded, else baked) + register the anim. Call in create(). */
export function ensureSlashVfx(scene: Phaser.Scene): void {
  const real = SLASH_SHEET_ENABLED && scene.textures.exists(SLASH_SRC_KEY);
  const key = real ? SLASH_SRC_KEY : PROC_KEY;
  let count = PROC_FRAMES;
  if (real) {
    count = sliceStrip(scene, SLASH_SRC_KEY);
    scene.textures.get(SLASH_SRC_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
  } else if (!scene.textures.exists(PROC_KEY)) {
    bakeProceduralSlash(scene);
  }
  if (!scene.anims.exists(SLASH_ANIM)) {
    scene.anims.create({
      key: SLASH_ANIM,
      frames: Array.from({ length: count }, (_, i) => ({ key, frame: i })),
      frameRate: 24,
      repeat: 0,
    });
  }
  scene.registry.set('vfx_slash_key', key);
}

export interface SlashOpts {
  x: number;
  y: number;
  facing: Cardinal; // arc art opens toward +X; rotated/flipped to match
  tint: number;
  scale?: number;
  depth?: number;
}

/** Spawn one slash arc; plays once and destroys itself. */
export function playSlash(scene: Phaser.Scene, opts: SlashOpts): Phaser.GameObjects.Sprite {
  const key = (scene.registry.get('vfx_slash_key') as string) ?? PROC_KEY;
  const s = scene.add.sprite(opts.x, opts.y, key, 0);
  // NORMAL blend, not ADD: the arena floor is bright, and additive blending
  // washes any tint to white there — normal keeps the signature color legible.
  s.setTint(opts.tint);
  s.setScale(opts.scale ?? 1);
  s.setDepth(opts.depth ?? opts.y + 1);
  switch (opts.facing) {
    case 'left':
      s.setFlipX(true);
      break;
    case 'up':
      s.setAngle(-90);
      break;
    case 'down':
      s.setAngle(90);
      break;
    default:
      break; // right = native orientation
  }
  s.play(SLASH_ANIM);
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  return s;
}
