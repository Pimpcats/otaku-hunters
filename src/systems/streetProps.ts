// Street-corridor props (Bible §3 — the Akihabara street redesign).
//
// World-space neon dressing so the player runs THROUGH a neighbourhood instead of an
// empty arena. Props sit at fixed world positions along the edges of repeating street
// "corridors" (streetWidth tall) and the camera reveals them as the player moves:
//   • FAR edge  (y = r·streetWidth)        — storefronts / signs / vending: opaque,
//     y-sorted so the player passes in front of or behind them.
//   • NEAR edge (y = (r+½)·streetWidth)    — foreground occluders (poles, railings):
//     semi-transparent, the player passes BEHIND them for depth.
//
// Placement is deterministic per world-position (a stable hash of the slot), so the
// street has VARIETY (different prop here vs there) yet is identical every run and
// needs no per-frame work — props are static; y-sort is their depth = feet world-y,
// matching entities (render.baselineY). No collision: purely visual depth.
//
// Art: real prop sheets (ui/props.ts) are used when present (e.g. the animated vending
// machine); otherwise each kind draws a procedural neon-rectangle placeholder so the
// SPATIAL LAYOUT can be tuned now and art drops in later with no layout change.

import Phaser from 'phaser';
import { RENDER } from '../data/render';
import { propSheet } from '../ui/props';

type PropKind = 'building' | 'sign' | 'vending' | 'pole' | 'railing';

const SLOT = 300; // avg world px between candidate prop slots along the street (X)
const NEON = [0x00eaff, 0xff37c0, 0xffe08a, 0xb16bff]; // cyan / magenta / amber / violet

// Per-edge kind tables (weighted by repetition). FAR = storefront side, NEAR = foreground.
const FAR_KINDS: PropKind[] = ['building', 'building', 'building', 'sign', 'vending', 'vending'];
const NEAR_KINDS: PropKind[] = ['pole', 'railing', 'railing'];

/** Stable 32-bit hash of integer slot coords → deterministic per-position variety. */
function hash(x: number, y: number, salt: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export class StreetProps {
  private items: Phaser.GameObjects.GameObject[] = [];

  constructor(private scene: Phaser.Scene, worldW: number, worldH: number) {
    const sw = Math.max(120, RENDER.streetWidth);
    // FAR storefront rows on each street seam, NEAR occluder rows half-way between.
    for (let r = 0; r * sw <= worldH; r++) this.row(r * sw, worldW, r, 'far');
    for (let r = 0; (r + 0.5) * sw <= worldH; r++) this.row((r + 0.5) * sw, worldW, r, 'near');
  }

  private row(bandY: number, worldW: number, rowIndex: number, edge: 'far' | 'near'): void {
    const salt = edge === 'near' ? 101 : 7;
    const kinds = edge === 'near' ? NEAR_KINDS : FAR_KINDS;
    for (let c = 0; c * SLOT <= worldW; c++) {
      const h = hash(c, rowIndex, salt);
      if ((h % 1000) / 1000 >= RENDER.propDensity) continue; // density gate
      const x = c * SLOT + (((h >>> 10) % 160) - 80); // ±80px jitter along the street
      const y = bandY + (((h >>> 18) % 80) - 40); // ±40px jitter across the seam
      const [lo, hi] = RENDER.propScale;
      const scale = lo + (((h >>> 4) & 0xff) / 255) * (hi - lo);
      const kind = kinds[(h >>> 24) % kinds.length];
      this.place(x, y, scale, kind, edge, h);
    }
  }

  private place(x: number, y: number, scale: number, kind: PropKind, edge: 'far' | 'near', h: number): void {
    const obj =
      kind === 'vending' && this.scene.textures.exists('prop_vending')
        ? this.realVending(x, y, scale)
        : this.placeholder(x, y, scale, kind, h);
    if (edge === 'near') obj.setAlpha(RENDER.foregroundOccluderAlpha); // foreground occluders are see-through
    obj.setDepth(y); // y-sort with entities (render.baselineY uses feet world-y)
    this.items.push(obj);
  }

  /** Animated vending-machine sprite (feet-anchored, scaled to ~player height). */
  private realVending(x: number, y: number, scale: number): Phaser.GameObjects.Sprite {
    const cfg = propSheet('prop_vending')!;
    const img = this.scene.textures.get('prop_vending').getSourceImage() as { height: number };
    const s = this.scene.add.sprite(x, y, 'prop_vending').setOrigin(0.5, 1);
    s.setScale(((cfg.targetH * scale) / (img.height || cfg.frameHeight)) * 1);
    if (cfg.anim && this.scene.anims.exists(cfg.anim.key)) s.play(cfg.anim.key);
    return s;
  }

  /** Procedural neon placeholder for a kind: a dark body, a glowing outline, and a
   *  little detail — readable as a storefront / sign / pole now; art swaps in later. */
  private placeholder(x: number, y: number, scale: number, kind: PropKind, h: number): Phaser.GameObjects.Container {
    const neon = NEON[(h >>> 6) % NEON.length];
    const c = this.scene.add.container(x, y);
    const add = (o: Phaser.GameObjects.GameObject) => {
      c.add(o);
      return o;
    };
    // body footprint per kind (px, before scale); feet sit at the container origin.
    const dims: Record<PropKind, [number, number]> = {
      building: [92, 150],
      sign: [70, 26],
      vending: [46, 74],
      pole: [10, 150],
      railing: [130, 30],
    };
    const [bw, bh] = dims[kind];

    const body = (w: number, hh: number, fill: number, fillA: number) =>
      add(this.scene.add.rectangle(0, -hh / 2, w, hh, fill, fillA)) as Phaser.GameObjects.Rectangle;
    const glow = (w: number, hh: number, col: number, a: number, lw: number) =>
      (add(this.scene.add.rectangle(0, -hh / 2, w, hh).setStrokeStyle(lw, col, a).setBlendMode(Phaser.BlendModes.ADD)) as Phaser.GameObjects.Rectangle);

    if (kind === 'sign') {
      // A small bright glowing sign on a thin mount.
      add(this.scene.add.rectangle(0, -2, 4, bh, 0x101018, 1));
      body(bw, bh, neon, 0.85).setY(-bh).setBlendMode(Phaser.BlendModes.ADD);
      glow(bw + 8, bh + 8, neon, 0.7, 6).setY(-bh);
    } else if (kind === 'pole') {
      add(this.scene.add.rectangle(0, -bh / 2, bw, bh, 0x0a0a14, 1));
      // lamp head glow at the top
      add(this.scene.add.circle(0, -bh, 9, neon, 0.9).setBlendMode(Phaser.BlendModes.ADD));
      add(this.scene.add.circle(0, -bh, 16, neon, 0.35).setBlendMode(Phaser.BlendModes.ADD));
    } else if (kind === 'railing') {
      add(this.scene.add.rectangle(0, -bh + 4, bw, 5, neon, 0.8).setBlendMode(Phaser.BlendModes.ADD)); // top rail
      add(this.scene.add.rectangle(0, -4, bw, 5, 0x0a0a14, 1)); // bottom rail
      for (let i = -2; i <= 2; i++) add(this.scene.add.rectangle(i * (bw / 5), -bh / 2, 4, bh, 0x12121f, 1)); // posts
    } else {
      // building / vending: dark slab + neon outline + a grid of lit windows.
      body(bw, bh, 0x0a0a18, 1);
      glow(bw, bh, neon, 0.6, 3);
      glow(bw + 8, bh + 8, neon, 0.18, 8);
      const cols = kind === 'vending' ? 2 : 3;
      const rows = kind === 'vending' ? 3 : Math.max(3, Math.round(bh / 36));
      for (let wy = 0; wy < rows; wy++) {
        for (let wx = 0; wx < cols; wx++) {
          if (((h >>> (wx + wy * 3)) & 1) === 0 && kind !== 'vending') continue; // some windows dark
          const px = (wx - (cols - 1) / 2) * (bw / (cols + 0.5));
          const py = -bh + 12 + wy * ((bh - 18) / rows);
          const lit = NEON[(h >>> (wy + 1)) % NEON.length];
          add(this.scene.add.rectangle(px, py, bw / (cols + 1), Math.max(5, (bh - 18) / rows - 5), lit, 0.7).setBlendMode(Phaser.BlendModes.ADD));
        }
      }
      if (kind === 'vending') {
        // amber "販売中" header bar
        add(this.scene.add.rectangle(0, -bh + 3, bw - 6, 8, 0xff37c0, 0.85).setBlendMode(Phaser.BlendModes.ADD));
      }
    }

    c.setScale(scale);
    return c;
  }

  destroy(): void {
    for (const o of this.items) o.destroy();
    this.items = [];
  }
}
