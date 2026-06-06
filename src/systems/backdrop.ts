import Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../constants';
import { RENDER, DEPTH } from '../data/render';

// Layers 3 + 4: the tilted ground plane and parallax background.
//
// Everything here is drawn in SCREEN space (scrollFactor 0) and scrolled by the
// camera, so world/gameplay positions are never touched — entities stay where
// physics put them; only the floor *reads* as a receding, tilted plane (Hades
// trick: tilt the ground, keep sprites upright billboards).
//
// `groundTilt` blends the floor between two mappings:
//   • tilt 0 → an even, flat grid that scrolls 1:1 with the camera (today's look).
//   • tilt 1 → a strong perspective recession toward a horizon.
//
// The floor can render two ways behind `RENDER.floorTexture`:
//   • a real TILING TEXTURE on a Mesh whose vertices sit at the exact rowY screen
//     positions (so its recession is identical to the grid), UVs = world coords
//     scrolled by the camera, per-vertex tinted by the floor palette; or
//   • the original WIREFRAME grid lines, for A/B comparison.
//
// Cost: the textured floor is one batched Mesh (~one draw call, ~850 verts whose
// UVs we recompute per frame — trivial). The wireframe is ~30 lines + 2 gradient
// rects. Both hold frame rate with a full swarm.

export const FLOOR_TEXTURE_KEY = 'floor_tex';

// Optional neon-city parallax layers (far → near). Drop real art into
// public/textures/parallax/ (arcade_far|mid|near.png) and list it in art-manifest.json;
// the loader registers it under these keys and Backdrop renders horizontally-tiling
// layers instead of the procedural silhouettes. Any missing layer simply isn't created.
export const PARALLAX_KEYS = ['env_parallax_far', 'env_parallax_mid', 'env_parallax_near'] as const;

// Sky/back-wall band height (and floor horizon) = H * RENDER.horizonFrac.
const floorTopY = (): number => H * Phaser.Math.Clamp(RENDER.horizonFrac, 0.02, 0.9);
const PERSP = 5; // perspective compression strength at tilt = 1
const COLS = 18; // mesh columns across the screen
// Horizontal tile-compression cap lives in RENDER.maxSpread (tunable).

export class Backdrop {
  private g: Phaser.GameObjects.Graphics;
  private parallax: Phaser.GameObjects.Graphics;
  private gridGfx: Phaser.GameObjects.Graphics; // neon grid, drawn ADDITIVE so lines glow

  // Textured-floor mesh (only when RENDER.floorTexture and the texture loaded).
  private floor?: Phaser.GameObjects.Mesh;
  private rows: number[] = []; // world depth d at each mesh row
  private spread: number[] = []; // horizontal tile compression at each row
  private sx: number[] = []; // screen x at each mesh column (bottom edge)
  private cols = COLS;

  // Tiling parallax layers, indexed by layer (0 = far … 2 = near). A slot holds a
  // TileSprite when real skyline art was dropped in for that layer; layers left
  // undefined fall back to the procedural silhouettes — so far/mid/near can mix.
  private skyline: ({ s: Phaser.GameObjects.TileSprite; texH: number } | undefined)[] = [];

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.ground);
    this.parallax = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.grid);
    // The neon grid lives on its own ADDITIVE layer so the glow halos build up
    // (and read as light, not paint) over the dark floor; the camera bloom post-FX
    // then amplifies the bright cores into the TRON/Edgerunners glow.
    this.gridGfx = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.grid + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.buildSkyline();
    if (RENDER.floorTexture && scene.textures.exists(FLOOR_TEXTURE_KEY)) {
      this.buildFloorMesh();
    }
  }

  /** Build tiling parallax layers from any dropped-in skyline art. None present →
   *  drawParallax falls back to the procedural silhouettes. */
  private buildSkyline(): void {
    if (!RENDER.parallax || !RENDER.useParallaxArt) return; // toggle off → all procedural
    for (let i = 0; i < PARALLAX_KEYS.length; i++) {
      const key = PARALLAX_KEYS[i];
      if (!this.scene.textures.exists(key)) continue; // this layer stays procedural
      this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR); // smooth the downscale-to-band
      const img = this.scene.textures.get(key).getSourceImage() as { height: number };
      const s = this.scene.add
        .tileSprite(0, 0, W, img.height || H, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.ground + 1 + i); // far background: above the sky gradient, behind the grid
      this.skyline[i] = { s, texH: img.height || H };
    }
  }

  /** Screen y of a floor line `d` world-px back from the near (bottom) edge. */
  private rowY(d: number, tilt: number, floorTop: number): number {
    const flat = H - d; // 1:1 — even spacing
    const persp = floorTop + (H - floorTop) / (1 + PERSP * tilt * (d / RENDER.gridSize));
    return Phaser.Math.Linear(flat, persp, tilt);
  }

  // ── Textured floor (Mesh) ──────────────────────────────────────────────────
  private buildFloorMesh(): void {
    const tilt = Phaser.Math.Clamp(RENDER.groundTilt, 0, 1);
    const floorTop = floorTopY();
    const tileWorld = RENDER.floorTileWorld;

    // Find how far back (world px) the floor recedes before reaching the horizon.
    let dMax = H;
    {
      let lo = 0;
      let hi = 40000;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (this.rowY(mid, tilt, floorTop) > floorTop + 1) lo = mid;
        else hi = mid;
      }
      dMax = lo;
    }

    // Rows uniform in world depth → screen rows bunch toward the horizon (via rowY).
    const R = 56;
    this.rows = [];
    this.spread = [];
    const baseStep = this.rowY(0, tilt, floorTop) - this.rowY(tileWorld, tilt, floorTop); // ≈ tileWorld at the near edge
    for (let j = 0; j <= R; j++) {
      const d = (j / R) * dMax;
      this.rows.push(d);
      // Horizontal compression tied to the SAME rowY mapping (keeps tiles square-ish):
      // as a world tile's on-screen depth shrinks toward the horizon, tiles narrow too.
      const dRow = Math.max(0.001, this.rowY(d, tilt, floorTop) - this.rowY(d + tileWorld, tilt, floorTop));
      this.spread.push(Phaser.Math.Clamp(baseStep / dRow, 1, RENDER.maxSpread));
    }

    const C = this.cols;
    this.sx = [];
    for (let i = 0; i <= C; i++) this.sx.push((i / C) * W);

    // Build geometry. Vertices in MODEL space; setOrtho maps [-1,1] → full screen.
    const verts: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const alphas: number[] = [];
    // Phaser projects mesh model coords by the FULL renderer width/height (so model
    // ±0.5 spans the screen, not ±1), with the mesh centred at (W/2, H/2).
    const toModelX = (px: number) => px / W - 0.5;
    const toModelY = (py: number) => 0.5 - py / H;
    for (let j = 0; j <= R; j++) {
      const y = this.rowY(this.rows[j], tilt, floorTop);
      const fade = Phaser.Math.Clamp((y - floorTop) / (H - floorTop), 0, 1); // 1 near, 0 horizon
      const col = lerpColor(RENDER.floorFar, RENDER.floorTextureTint, fade); // art shows true near, hazes to dark at horizon
      // Keep the floor opaque across most of its depth; only fade the tiles into
      // the gradient in the top band near the horizon (distance haze, and it hides
      // the worst far-distance minification).
      const distFromHorizon = (y - floorTop) / (H - floorTop); // 0 at horizon, 1 near
      const alpha = Phaser.Math.Clamp(distFromHorizon / 0.08, 0, 1); // fade only the top sliver
      for (let i = 0; i <= C; i++) {
        verts.push(toModelX(this.sx[i]), toModelY(y));
        uvs.push(0, 0); // real UVs set per-frame in updateFloorMesh
        colors.push(col);
        alphas.push(alpha);
      }
    }
    const idx: number[] = [];
    const stride = C + 1;
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < C; i++) {
        const a = j * stride + i;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }

    // Smooth (LINEAR) sampling + mipmaps so the tiling floor doesn't shimmer under
    // the pixel-art NEAREST default when tiles minify toward the horizon. The game
    // is global pixelArt (no AA → no auto mipmaps), so generate them for this one
    // POT texture by hand.
    this.scene.textures.get(FLOOR_TEXTURE_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.enableMipmaps(FLOOR_TEXTURE_KEY);

    const mesh = this.scene.add.mesh(W / 2, H / 2, FLOOR_TEXTURE_KEY);
    mesh.addVertices(verts, uvs, idx, false, undefined, colors, alphas);
    mesh.setOrtho(1, 1); // model [-1,1] → full viewport (no perspective divide)
    mesh.hideCCW = false; // don't backface-cull our 2D quads
    mesh.setScrollFactor(0);
    mesh.setDepth(DEPTH.grid + 1); // above the gradient fill, below shadows/entities
    this.floor = mesh;
  }

  /** Generate trilinear mipmaps for a POT texture so it minifies cleanly. */
  private enableMipmaps(key: string): void {
    try {
      const renderer = this.scene.sys.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      const gl = renderer.gl;
      if (!gl) return;
      const src = this.scene.textures.get(key).source[0];
      if (!src.isPowerOf2) return;
      const raw = (src.glTexture as unknown as { webGLTexture: WebGLTexture }).webGLTexture;
      gl.bindTexture(gl.TEXTURE_2D, raw);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      // Anisotropic filtering keeps the floor crisp at grazing angles instead of
      // the smeary blur isotropic mipmaps give a steeply-receding plane.
      const agl = gl as WebGLRenderingContext & { getExtension(n: string): unknown };
      const ext = (agl.getExtension('EXT_texture_filter_anisotropic') ||
        agl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')) as
        | { TEXTURE_MAX_ANISOTROPY_EXT: number; MAX_TEXTURE_MAX_ANISOTROPY_EXT: number }
        | null;
      if (ext) {
        const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
        gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, max));
      }
    } catch {
      /* mipmaps are an enhancement; LINEAR alone still works if this fails */
    }
  }

  private updateFloorMesh(camX: number, camY: number): void {
    const mesh = this.floor!;
    const tileWorld = RENDER.floorTileWorld;
    const worldBottom = camY + H;
    const cx = W / 2;
    const C = this.cols;
    const stride = C + 1;
    const verts = mesh.vertices;
    for (let j = 0; j < this.rows.length; j++) {
      const v = (worldBottom - this.rows[j]) / tileWorld;
      const sp = this.spread[j];
      for (let i = 0; i <= C; i++) {
        const u = (camX + cx + (this.sx[i] - cx) * sp) / tileWorld;
        const vert = verts[j * stride + i];
        // The renderer samples tu/tv (tu = u * frameU); our floor uses the whole
        // image (frameU = 1), so write tu/tv directly each frame.
        vert.u = u;
        vert.v = v;
        vert.tu = u;
        vert.tv = v;
      }
    }
  }

  update(): void {
    const cam = this.scene.cameras.main;
    const camX = cam.scrollX;
    const camY = cam.scrollY;
    const tilt = Phaser.Math.Clamp(RENDER.groundTilt, 0, 1);
    const floorTop = floorTopY(); // wall/floor seam
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

    // Textured floor: just rescroll the mesh UVs and skip the wireframe.
    if (this.floor) {
      this.updateFloorMesh(camX, camY);
      return;
    }

    this.drawNeonGrid(camX, camY, tilt, floorTop, cx);
  }

  /** The neon TRON/Edgerunners floor: glowing cyan grid lines (magenta accents)
   *  receding to the horizon. Each line is a stack of additive passes — a wide
   *  faint halo down to a hot near-white core — so the lines read as light. Near
   *  lines are thicker/brighter; everything fades and bunches toward the horizon. */
  private drawNeonGrid(camX: number, camY: number, tilt: number, floorTop: number, cx: number): void {
    const ng = this.gridGfx;
    ng.clear();
    const grid = RENDER.gridSize;
    const scroll = RENDER.gridScroll;

    // One glowing line = halo passes (build the glow) + a hot near-white core.
    // `fade` 0 (horizon) → 1 (near) drives both brightness and width.
    const glowLine = (x1: number, y1: number, x2: number, y2: number, color: number, fade: number): void => {
      const w = RENDER.gridLineWidth * (0.45 + 0.55 * fade); // near = thicker
      const a = 0.25 + 0.7 * fade; // near = brighter
      ng.lineStyle(w * RENDER.gridGlowWidth, color, a * 0.09 * RENDER.gridGlow);
      ng.lineBetween(x1, y1, x2, y2);
      ng.lineStyle(w * (RENDER.gridGlowWidth * 0.45), color, a * 0.2 * RENDER.gridGlow);
      ng.lineBetween(x1, y1, x2, y2);
      ng.lineStyle(w, color, Phaser.Math.Clamp(a, 0, 1));
      ng.lineBetween(x1, y1, x2, y2);
      // Hot core: a thin near-white centre (additive → blows out to the TRON look,
      // bloom catches it). Only on the brighter near half to keep the distance calm.
      if (fade > 0.18) {
        ng.lineStyle(Math.max(1, w * 0.45), 0xffffff, Phaser.Math.Clamp(a * 0.45, 0, 1));
        ng.lineBetween(x1, y1, x2, y2);
      }
    };

    const accentEvery = RENDER.gridAccentEvery | 0;
    const lineColor = (row: number): number =>
      accentEvery > 0 && row % accentEvery === 0 ? RENDER.gridAccentColor : RENDER.gridColor;

    // ── Horizontal floor lines (bunch toward the horizon via rowY) ──────────────
    const worldBottom = camY + H;
    const phaseY = ((worldBottom * scroll) % grid + grid) % grid;
    const baseRow = Math.floor((worldBottom * scroll) / grid); // stable index for accent striping
    for (let k = 0; k < 140; k++) {
      const d = k * grid + phaseY; // world px back from the near edge
      const y = this.rowY(d, tilt, floorTop);
      if (y <= floorTop + 0.5) break; // receded past the horizon
      if (y > H) continue;
      const fade = Phaser.Math.Clamp((y - floorTop) / (H - floorTop), 0, 1);
      glowLine(0, y, W, y, lineColor(baseRow - k), fade);
    }

    // ── Vertical floor lines, converging to the vanishing x at the seam ─────────
    // Drawn as fading segments so they brighten toward the near (bottom) edge like
    // the horizontals, instead of a flat-alpha streak.
    const phaseX = ((camX * scroll) % grid + grid) % grid;
    const baseCol = Math.floor((camX * scroll) / grid);
    const n = Math.ceil(W / grid) + 2;
    const SEG = 8;
    for (let k = -1; k < n; k++) {
      const sxb = k * grid - phaseX; // x at the near (bottom) edge
      const sxt = Phaser.Math.Linear(sxb, cx, tilt); // converged x at the seam
      const color = lineColor(baseCol + k);
      let px = sxb;
      let py = H;
      for (let s = 1; s <= SEG; s++) {
        const t = s / SEG; // 0 (bottom) → 1 (seam)
        const nx = Phaser.Math.Linear(sxb, sxt, t);
        const ny = Phaser.Math.Linear(H, floorTop, t);
        glowLine(px, py, nx, ny, color, 1 - t);
        px = nx;
        py = ny;
      }
    }
  }

  /** Far → near horizontal bands behind the floor that drift slower than the camera. */
  private drawParallax(camX: number, camY: number, floorTop: number): void {
    const p = this.parallax;
    p.clear();
    if (!RENDER.parallax) {
      for (const layer of this.skyline) layer?.s.setVisible(false);
      return;
    }
    const layers = RENDER.parallaxStrength;
    const show = floorTop > 1; // parallax only reads once there's a back-wall band
    for (let i = 0; i < layers.length; i++) {
      const strength = layers[i];
      const layer = this.skyline[i];

      // ── This layer has real skyline art → tiling TileSprite anchored at the seam ─
      if (layer) {
        layer.s.setVisible(show);
        if (show) {
          // Bottom-anchor the layer at the horizon seam and show only the BOTTOM
          // `hf` fraction of the band. A full image (hf = 1) fills the band; shorter
          // front layers leave the upper band exposing the taller layer behind them,
          // so far/mid/near read as stacked depth planes (needs transparent skies on
          // far+mid). The image is scaled so hf = 1 maps one image height → the band.
          const hf = Phaser.Math.Clamp(RENDER.parallaxHeight[i] ?? 1, 0.05, 1);
          const dispH = floorTop * hf;
          const k = floorTop / layer.texH; // one image height → the FULL band height
          layer.s.setPosition(0, floorTop - dispH); // bottom edge sits on the seam
          layer.s.setSize(W, dispH);
          layer.s.setTileScale(k, k); // proportional, no squash
          layer.s.tilePositionX = (camX * strength) / k; // horizontal parallax drift
          layer.s.tilePositionY = (floorTop - dispH) / k; // reveal the bottom of the image
        }
        continue;
      }

      // ── Otherwise → procedural silhouette rectangles for this layer ──────────────
      if (!show) continue;
      const sil = lerpColor(RENDER.skyBottom, 0x06040f, 0.2 + 0.22 * i);
      const bandH = floorTop * (0.5 + 0.25 * i);
      const yBase = floorTop - bandH;
      const off = -(camX * strength) % (W * 0.5);
      p.fillStyle(sil, 0.45 + 0.15 * i);
      for (let t = -1; t <= 1; t++) {
        const x = off + t * (W * 0.5);
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
