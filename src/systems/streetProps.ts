// Street-corridor props (Bible §3 — the Akihabara street redesign).
//
// World-space neon dressing so the player runs THROUGH a neighbourhood instead of an
// empty arena. Props sit at fixed world positions along the edges of repeating street
// "corridors" (streetWidth tall) and the camera reveals them as the player moves:
//   • FAR edge   (y = r·streetWidth)     — TALL storefront-side props: power poles,
//     arcade cabinets, vending machines, neon signs. Opaque, y-sorted (player passes in
//     front of / behind them).
//   • NEAR edge  (y = (r+½)·streetWidth) — SHORT foreground occluders: railings, crates,
//     bicycles, sale signs, cat trash-cans. Semi-transparent (foregroundOccluderAlpha),
//     y-sorted so the player passes BEHIND them for depth.
//   • OVERHEAD                            — strung festival lanterns: a decorative layer
//     drawn ABOVE the action (fixed high depth, NOT y-sorted).
//
// Placement is deterministic per world-position (a stable hash of the slot), so the
// street has VARIETY yet is identical every run and needs no per-frame work — props are
// static; their y-sort depth = feet world-y, matching entities (render.baselineY).
// No collision: purely visual depth.
//
// Art: real prop sheets (ui/props.ts) are used (animated) when present; otherwise each
// kind draws a procedural neon-rectangle placeholder so the SPATIAL LAYOUT tunes now and
// art drops in later with no layout change.

import Phaser from 'phaser';
import { RENDER } from '../data/render';
import { propSheetById } from '../ui/props';

type Placeholder = 'building' | 'tower' | 'vending' | 'sign' | 'vsign' | 'pole' | 'railing' | 'crates' | 'can' | 'bike';

interface PropSpec {
  tex?: string; // real-art texture key (ui/props.ts); spritesheet or static image
  anim?: string; // idle anim key when the real art is animated
  targetH: number; // in-game height px (props ~40–80px tall near player height)
  ph: Placeholder; // procedural fallback style
}

// FAR (storefront) edge — freestanding ground props in FRONT of the facade wall
// (the continuous building wall itself is systems/facadeWall.ts, a separate layer).
const TOP_KINDS: PropSpec[] = [
  { tex: 'prop_power_pole', targetH: 132, ph: 'pole' },
  { tex: 'prop_arcade', anim: 'prop_arcade_idle', targetH: 82, ph: 'vending' },
  { tex: 'prop_vending', anim: 'prop_vending_idle', targetH: 76, ph: 'vending' },
  { tex: 'prop_signs', anim: 'sign_gesen', targetH: 40, ph: 'sign' },
  { tex: 'prop_signs', anim: 'sign_karaoke', targetH: 62, ph: 'vsign' },
  { tex: 'prop_signs', anim: 'sign_ramen', targetH: 40, ph: 'sign' },
];

// NEAR (foreground) edge — short occluders.
const BOTTOM_KINDS: PropSpec[] = [
  { tex: 'prop_railing', targetH: 36, ph: 'railing' },
  { tex: 'prop_crates', targetH: 48, ph: 'crates' },
  { tex: 'prop_bicycle', targetH: 46, ph: 'bike' },
  { tex: 'prop_sale_sign', targetH: 58, ph: 'vsign' },
  { tex: 'prop_cat_trashcan', targetH: 52, ph: 'can' },
];

const SLOT = 300; // avg world px between candidate prop slots along the street (X)
const LANTERN_DEPTH = 46000; // overhead decorative layer: above entities, below HUD/vfx pops
const NEON = [0x00eaff, 0xff37c0, 0xffe08a, 0xb16bff]; // cyan / magenta / amber / violet

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
    for (let r = 0; r * sw <= worldH; r++) {
      this.edgeRow(r * sw, worldW, r, 'top'); // far storefront row at the seam
      this.lanternRow(r * sw, worldW, r); // lanterns strung along that seam, overhead
    }
    for (let r = 0; (r + 0.5) * sw <= worldH; r++) this.edgeRow((r + 0.5) * sw, worldW, r, 'bottom');
  }

  private edgeRow(bandY: number, worldW: number, rowIndex: number, edge: 'top' | 'bottom'): void {
    const salt = edge === 'bottom' ? 101 : 7;
    const kinds = edge === 'bottom' ? BOTTOM_KINDS : TOP_KINDS;
    for (let c = 0; c * SLOT <= worldW; c++) {
      const h = hash(c, rowIndex, salt);
      if ((h % 1000) / 1000 >= RENDER.propDensity) continue; // density gate
      const x = c * SLOT + (((h >>> 10) % 160) - 80); // ±80px jitter along the street
      const y = bandY + (((h >>> 18) % 70) - 35); // ±35px jitter across the seam
      const [lo, hi] = RENDER.propScale;
      const scale = lo + (((h >>> 4) & 0xff) / 255) * (hi - lo);
      const spec = kinds[(h >>> 24) % kinds.length];
      const obj = this.makeProp(x, y, scale, spec, h);
      if (edge === 'bottom') obj.setAlpha(RENDER.foregroundOccluderAlpha); // foreground occluders are see-through
      obj.setDepth(y); // y-sort with entities (render.baselineY uses feet world-y)
      this.items.push(obj);
    }
  }

  /** Festival lanterns strung along a street seam, overhead and decorative (not y-sorted). */
  private lanternRow(bandY: number, worldW: number, rowIndex: number): void {
    const hasArt = this.scene.textures.exists('prop_lanterns');
    const span = 360; // world px per lantern strand
    for (let c = 0; c * span <= worldW; c++) {
      const h = hash(c, rowIndex, 555);
      if ((h % 1000) / 1000 >= Math.min(0.6, RENDER.propDensity + 0.2)) continue; // a bit denser than props
      const x = c * span + (((h >>> 12) % 80) - 40);
      const y = bandY - 70 - (((h >>> 5) % 24)); // hang above the seam
      const obj = hasArt ? this.realLanterns(x, y) : this.placeholderLanterns(x, y, h);
      obj.setDepth(LANTERN_DEPTH);
      this.items.push(obj);
    }
  }

  private realLanterns(x: number, y: number): Phaser.GameObjects.Sprite {
    const cfg = propSheetById('prop_lanterns');
    const img = this.scene.textures.get('prop_lanterns').getSourceImage() as { height: number };
    const s = this.scene.add.sprite(x, y, 'prop_lanterns').setOrigin(0.5, 0); // hangs DOWN from the wire
    s.setScale((52 / (img.height || (cfg?.frameHeight ?? 768))) * 1);
    if (this.scene.anims.exists('prop_lanterns_idle')) s.play('prop_lanterns_idle');
    return s;
  }

  private placeholderLanterns(x: number, y: number, h: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const n = 5;
    const gap = 26;
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * gap;
      const col = NEON[(h >> i) % NEON.length];
      c.add(this.scene.add.rectangle(lx, 0, 2, 8, 0x101018, 1)); // hanger
      c.add(this.scene.add.ellipse(lx, 16, 16, 22, col, 0.85).setBlendMode(Phaser.BlendModes.ADD));
      c.add(this.scene.add.ellipse(lx, 16, 22, 28, col, 0.2).setBlendMode(Phaser.BlendModes.ADD)); // glow
    }
    return c;
  }

  /** Real animated/static sprite for a spec, else its procedural placeholder. */
  private makeProp(x: number, y: number, scale: number, spec: PropSpec, h: number): Phaser.GameObjects.GameObject &
    Phaser.GameObjects.Components.Depth &
    Phaser.GameObjects.Components.AlphaSingle {
    if (spec.tex && this.scene.textures.exists(spec.tex)) {
      const cfg = propSheetById(spec.tex);
      const frameH = cfg?.frameHeight ?? (this.scene.textures.get(spec.tex).getSourceImage() as { height: number }).height;
      const s = this.scene.add.sprite(x, y, spec.tex).setOrigin(0.5, 1);
      s.setScale((spec.targetH * scale) / (frameH || spec.targetH));
      if (spec.anim && this.scene.anims.exists(spec.anim)) s.play(spec.anim);
      return s;
    }
    return this.placeholder(x, y, scale, spec.ph, spec.targetH, h);
  }

  /** Procedural neon placeholder for a kind — readable as a storefront / sign / pole /
   *  railing / crates / bin / bike now; real art swaps in later with the same footprint. */
  private placeholder(x: number, y: number, scale: number, ph: Placeholder, targetH: number, h: number): Phaser.GameObjects.Container {
    const neon = NEON[(h >>> 6) % NEON.length];
    const c = this.scene.add.container(x, y);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      c.add(o);
      return o;
    };
    const r = (cx: number, cy: number, w: number, hh: number, fill: number, a = 1) =>
      add(this.scene.add.rectangle(cx, cy, w, hh, fill, a));
    const addGlow = (cx: number, cy: number, w: number, hh: number, col: number, a: number, lw: number) =>
      add(this.scene.add.rectangle(cx, cy, w, hh).setStrokeStyle(lw, col, a).setBlendMode(Phaser.BlendModes.ADD));

    const H = targetH; // base height; width derived per kind
    if (ph === 'pole') {
      r(0, -H / 2, 8, H, 0x0a0a14);
      add(this.scene.add.circle(0, -H, 8, neon, 0.9).setBlendMode(Phaser.BlendModes.ADD));
      add(this.scene.add.circle(0, -H, 15, neon, 0.3).setBlendMode(Phaser.BlendModes.ADD));
    } else if (ph === 'sign' || ph === 'vsign') {
      const w = ph === 'vsign' ? H * 0.5 : H * 1.6;
      r(0, -2, 4, H * 0.4, 0x101018); // mount
      r(0, -H + H * 0.2, w, H * 0.8, neon, 0.85).setBlendMode(Phaser.BlendModes.ADD);
      addGlow(0, -H + H * 0.2, w + 8, H * 0.8 + 8, neon, 0.6, 6);
    } else if (ph === 'railing') {
      const w = H * 3.4;
      r(0, -H + 4, w, 5, neon, 0.8).setBlendMode(Phaser.BlendModes.ADD);
      r(0, -4, w, 5, 0x0a0a14);
      for (let i = -2; i <= 2; i++) r(i * (w / 5), -H / 2, 4, H, 0x12121f);
    } else if (ph === 'crates') {
      const w = H * 1.5;
      r(-w * 0.15, -H * 0.35, w * 0.7, H * 0.7, 0x6b4a2a);
      r(w * 0.2, -H * 0.6, w * 0.6, H * 0.6, 0x3a4a6b);
      r(0, -H * 0.15, w * 0.8, H * 0.3, 0x5a3a22);
      addGlow(0, -H / 2, w, H, neon, 0.18, 3);
    } else if (ph === 'can') {
      r(0, -H * 0.45, H * 0.7, H * 0.9, 0x2a2f3a); // bin
      r(0, -H * 0.9, H * 0.45, H * 0.2, 0x101018); // cat (silhouette)
      add(this.scene.add.circle(-H * 0.08, -H * 0.95, 2, 0x9fe8ff, 1).setBlendMode(Phaser.BlendModes.ADD)); // eye
      add(this.scene.add.circle(H * 0.06, -H * 0.95, 2, 0x9fe8ff, 1).setBlendMode(Phaser.BlendModes.ADD));
    } else if (ph === 'bike') {
      const w = H * 2;
      r(0, -H * 0.55, w * 0.8, 4, 0x12121f); // frame bar
      add(this.scene.add.circle(-w * 0.3, -H * 0.2, H * 0.2).setStrokeStyle(3, neon, 0.8).setBlendMode(Phaser.BlendModes.ADD));
      add(this.scene.add.circle(w * 0.3, -H * 0.2, H * 0.2).setStrokeStyle(3, neon, 0.8).setBlendMode(Phaser.BlendModes.ADD));
    } else {
      // building / tower: dark slab + neon outline + a grid of lit windows.
      const w = ph === 'tower' ? H * 0.55 : H * 1.0;
      r(0, -H / 2, w, H, 0x0a0a18);
      addGlow(0, -H / 2, w, H, neon, 0.6, 3);
      addGlow(0, -H / 2, w + 8, H + 8, neon, 0.16, 8);
      const cols = 3;
      const rows = Math.max(3, Math.round(H / 34));
      for (let wy = 0; wy < rows; wy++) {
        for (let wx = 0; wx < cols; wx++) {
          if (((h >>> (wx + wy * 3)) & 1) === 0) continue; // some windows dark
          const px = (wx - (cols - 1) / 2) * (w / (cols + 0.5));
          const py = -H + 10 + wy * ((H - 16) / rows);
          const lit = NEON[(h >>> (wy + 1)) % NEON.length];
          r(px, py, w / (cols + 1), Math.max(4, (H - 16) / rows - 5), lit, 0.7).setBlendMode(Phaser.BlendModes.ADD);
        }
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
