// Layer 2 — the building-facade "back wall" of the street (Bible §3 redesign).
//
// A continuous horizontal row of front-view storefronts tiled across the top of each
// street corridor seam, forming the wall the player runs along the base of. Unlike the
// distant parallax skyline (a separate, un-zoomed BackgroundScene) these are WORLD-space
// and scroll 1:1 with the gameplay camera (they're right next to the player) and zoom
// with it. They sit at a fixed depth band: always BEHIND the player/enemies/ground props,
// always IN FRONT of the parallax (which is on the scene rendered behind RunScene).
//
// Pooled: each frame we cover only the camera's worldView (+ a column of buffer each
// side) with a small recycled sprite pool, so an open world never pays for off-screen
// facades. Facade choice per cell is a stable hash → a varied, repeatable storefront row.
//
// Real art (the 4 facade_* textures) is used when present; otherwise 4 procedural
// placeholder facades are generated once so the layering reads before the art lands.

import Phaser from 'phaser';
import { RENDER } from '../data/render';
import { FACADE_IDS } from '../ui/props';

const FACADE_H = 130; // world px tall (≈ top third of the zoomed screen; tune in review)
const ASPECT = 768 / 512; // facade source aspect (w/h)
const FACADE_DEPTH = -2000; // behind entities/props (y-sort ≥ 0), above the floor (≈ -90000)
const BUF = 1; // extra facade columns rendered each side of the view
const PH_KEYS = ['facade_ph_0', 'facade_ph_1', 'facade_ph_2', 'facade_ph_3'];
const PH_ACCENTS = [0xff37c0, 0x00eaff, 0xff5ac8, 0xffa53d]; // anime / game / karaoke / konbini-ish

/** Stable per-cell facade index (0..3). */
function facadeIndex(c: number, r: number): number {
  let h = (Math.imul(c | 0, 374761393) + Math.imul(r | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h >>> 28) % 4;
}

export class FacadeWall {
  private pool: Phaser.GameObjects.Sprite[] = [];
  private keys: readonly string[];
  private colW = FACADE_H * ASPECT;

  constructor(private scene: Phaser.Scene) {
    const hasArt = FACADE_IDS.every((id) => scene.textures.exists(id));
    if (hasArt) {
      this.keys = FACADE_IDS;
    } else {
      this.makePlaceholders();
      this.keys = PH_KEYS;
    }
  }

  update(): void {
    const cam = this.scene.cameras.main;
    const view = cam.worldView; // accounts for zoom
    const sw = Math.max(120, RENDER.streetWidth);
    const colW = this.colW;
    const cMin = Math.floor(view.left / colW) - BUF;
    const cMax = Math.ceil(view.right / colW) + BUF;
    const rMin = Math.max(0, Math.floor(view.top / sw));
    const rMax = Math.floor((view.bottom + FACADE_H) / sw);

    let i = 0;
    for (let r = rMin; r <= rMax; r++) {
      const yWall = r * sw; // facade bottom sits on the street seam
      for (let c = cMin; c <= cMax; c++) {
        let sp = this.pool[i];
        if (!sp) {
          sp = this.scene.add.sprite(0, 0, this.keys[0]).setOrigin(0.5, 1).setDepth(FACADE_DEPTH);
          this.pool[i] = sp;
        }
        sp.setTexture(this.keys[facadeIndex(c, r)]);
        sp.setPosition(c * colW + colW / 2, yWall);
        sp.setDisplaySize(colW, FACADE_H);
        sp.setVisible(true);
        i++;
      }
    }
    for (; i < this.pool.length; i++) this.pool[i].setVisible(false);
  }

  /** Generate 4 procedural placeholder facades (dark wall + neon sign band + windows +
   *  doorway), one per accent, so the wall layer reads before real facade art arrives. */
  private makePlaceholders(): void {
    const W = 384;
    const H = 256;
    for (let k = 0; k < 4; k++) {
      if (this.scene.textures.exists(PH_KEYS[k])) continue;
      const tex = this.scene.textures.createCanvas(PH_KEYS[k], W, H);
      if (!tex) continue;
      const ctx = tex.getContext();
      const accent = PH_ACCENTS[k];
      const css = (hex: number, a = 1) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
      // wall
      ctx.fillStyle = css(0x14121f);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = css(0x0c0a16);
      ctx.fillRect(0, 0, W, 8); // roof lip
      // neon sign band across the top
      ctx.fillStyle = css(0x05040a);
      ctx.fillRect(14, 16, W - 28, 56);
      ctx.lineWidth = 4;
      ctx.strokeStyle = css(accent, 0.95);
      ctx.shadowColor = css(accent, 1);
      ctx.shadowBlur = 16;
      ctx.strokeRect(20, 22, W - 40, 44);
      ctx.shadowBlur = 0;
      // lit windows / shopfront glow
      for (let wx = 0; wx < 5; wx++) {
        const x = 20 + wx * ((W - 40) / 5);
        ctx.fillStyle = css([0x00eaff, accent, 0xffe08a, 0xb16bff][(wx + k) % 4], 0.5);
        ctx.fillRect(x + 4, 92, (W - 40) / 5 - 10, H - 120);
      }
      // doorway
      ctx.fillStyle = css(0x000007, 0.92);
      ctx.fillRect(W / 2 - 34, H - 92, 68, 92);
      ctx.strokeStyle = css(accent, 0.8);
      ctx.lineWidth = 3;
      ctx.strokeRect(W / 2 - 34, H - 92, 68, 92);
      tex.refresh();
    }
  }

  destroy(): void {
    for (const sp of this.pool) sp.destroy();
    this.pool = [];
  }
}
